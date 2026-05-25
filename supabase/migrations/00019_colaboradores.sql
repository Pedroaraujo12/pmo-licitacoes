-- ============================================================
-- Migration 00019: Módulo Dados Funcionais dos Colaboradores
-- ============================================================

-- 1. Tipo enum para situação funcional
DO $$ BEGIN
  CREATE TYPE situacao_funcional AS ENUM ('ativo', 'afastado', 'desligado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Tipo enum para regime
DO $$ BEGIN
  CREATE TYPE regime_colaborador AS ENUM ('efetivo', 'comissionado', 'terceirizado', 'estagiario', 'cedido');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Tabela principal: colaboradores
CREATE TABLE IF NOT EXISTS colaboradores (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Identificação
  nome_completo       TEXT NOT NULL,
  cpf                 TEXT UNIQUE,
  matricula           TEXT UNIQUE,
  sexo                TEXT CHECK (sexo IN ('M', 'F', 'Nao_informado')) DEFAULT 'Nao_informado',
  data_nascimento     DATE NOT NULL,
  -- Dados funcionais
  cargo               TEXT,
  funcao              TEXT,
  unidade             TEXT,
  lotacao             TEXT,
  regime              regime_colaborador DEFAULT 'efetivo',
  data_admissao       DATE,
  situacao            situacao_funcional NOT NULL DEFAULT 'ativo',
  data_desligamento   DATE,
  -- Contatos institucionais
  email_institucional TEXT,
  telefone_institucional TEXT,
  ramal               TEXT,
  -- Contatos pessoais (LGPD - restrito)
  email_pessoal       TEXT,
  celular             TEXT,
  logradouro          TEXT,
  numero              TEXT,
  complemento         TEXT,
  bairro              TEXT,
  cidade              TEXT,
  uf                  TEXT,
  cep                 TEXT,
  -- Vinculação com usuário do sistema (1:1)
  user_id             UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Metadados
  foto_url            TEXT,
  observacoes         TEXT,
  created_by          UUID REFERENCES profiles(id),
  updated_by          UUID REFERENCES profiles(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Tabela de favoritos (agenda rápida por usuário)
CREATE TABLE IF NOT EXISTS colaborador_favoritos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id  UUID NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(colaborador_id, user_id)
);

-- 5. Tabela de logs de auditoria
CREATE TABLE IF NOT EXISTS colaborador_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id  UUID NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  acao            TEXT NOT NULL,
  user_id         UUID REFERENCES profiles(id),
  dados_anteriores JSONB,
  dados_novos     JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Índices
CREATE INDEX IF NOT EXISTS idx_colaboradores_nome ON colaboradores(nome_completo);
CREATE INDEX IF NOT EXISTS idx_colaboradores_unidade ON colaboradores(unidade);
CREATE INDEX IF NOT EXISTS idx_colaboradores_cargo ON colaboradores(cargo);
CREATE INDEX IF NOT EXISTS idx_colaboradores_situacao ON colaboradores(situacao);
CREATE INDEX IF NOT EXISTS idx_colaboradores_user_id ON colaboradores(user_id);
CREATE INDEX IF NOT EXISTS idx_colaboradores_data_nascimento ON colaboradores(data_nascimento);
CREATE INDEX IF NOT EXISTS idx_colaboradores_cpf ON colaboradores(cpf);
CREATE INDEX IF NOT EXISTS idx_colaborador_favoritos_user ON colaborador_favoritos(user_id);
CREATE INDEX IF NOT EXISTS idx_colaborador_logs_colaborador ON colaborador_logs(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_colaborador_logs_created ON colaborador_logs(created_at);

-- 7. Função de busca textual
CREATE OR REPLACE FUNCTION search_colaboradores(search_term TEXT)
RETURNS SETOF colaboradores
LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY SELECT *
  FROM colaboradores
  WHERE
    nome_completo ILIKE '%' || search_term || '%'
    OR unidade ILIKE '%' || search_term || '%'
    OR cargo ILIKE '%' || search_term || '%'
    OR funcao ILIKE '%' || search_term || '%'
    OR email_institucional ILIKE '%' || search_term || '%'
    OR telefone_institucional ILIKE '%' || search_term || '%'
  ORDER BY
    CASE WHEN nome_completo ILIKE '%' || search_term || '%' THEN 0 ELSE 1 END,
    nome_completo ASC;
END;
$$;

-- 8. View aniversariantes do mês
CREATE OR REPLACE VIEW vw_aniversariantes AS
SELECT
  c.*,
  EXTRACT(MONTH FROM c.data_nascimento) AS mes_nascimento,
  EXTRACT(DAY FROM c.data_nascimento) AS dia_nascimento,
  (EXTRACT(YEAR FROM age(CURRENT_DATE, c.data_nascimento)))::int AS idade,
  CASE
    WHEN EXTRACT(MONTH FROM c.data_nascimento) = EXTRACT(MONTH FROM CURRENT_DATE)
     AND EXTRACT(DAY FROM c.data_nascimento) = EXTRACT(DAY FROM CURRENT_DATE)
    THEN 'hoje'
    WHEN EXTRACT(MONTH FROM c.data_nascimento) = EXTRACT(MONTH FROM CURRENT_DATE)
     AND EXTRACT(DAY FROM c.data_nascimento) BETWEEN EXTRACT(DAY FROM CURRENT_DATE) AND EXTRACT(DAY FROM CURRENT_DATE + interval '7 days')
    THEN 'essa_semana'
    WHEN EXTRACT(MONTH FROM c.data_nascimento) = EXTRACT(MONTH FROM CURRENT_DATE)
    THEN 'esse_mes'
    ELSE 'outro'
  END AS periodo_aniversario
FROM colaboradores c
WHERE c.situacao = 'ativo';

-- 9. View métricas dashboard
CREATE OR REPLACE VIEW vw_colaboradores_metricas AS
SELECT
  COUNT(*) FILTER (WHERE situacao = 'ativo') AS ativos,
  COUNT(*) FILTER (WHERE situacao = 'afastado') AS afastados,
  COUNT(*) FILTER (WHERE situacao = 'desligado') AS desligados,
  COUNT(*) AS total,
  COUNT(DISTINCT unidade) FILTER (WHERE unidade IS NOT NULL) AS unidades_distintas,
  COUNT(*) FILTER (WHERE regime = 'efetivo') AS efetivos,
  COUNT(*) FILTER (WHERE regime = 'comissionado') AS comissionados,
  COUNT(*) FILTER (WHERE regime = 'terceirizado') AS terceirizados,
  COUNT(*) FILTER (WHERE regime = 'estagiario') AS estagiarios,
  COUNT(*) FILTER (WHERE regime = 'cedido') AS cedidos
FROM colaboradores;

-- 10. Trigger updated_at
CREATE OR REPLACE FUNCTION update_colaboradores_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_colaboradores_updated_at ON colaboradores;
CREATE TRIGGER trg_colaboradores_updated_at
  BEFORE UPDATE ON colaboradores
  FOR EACH ROW EXECUTE FUNCTION update_colaboradores_updated_at();

-- 11. Trigger de auditoria
CREATE OR REPLACE FUNCTION audit_colaborador_changes()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := COALESCE(NEW.updated_by, NEW.created_by);

  IF TG_OP = 'INSERT' THEN
    INSERT INTO colaborador_logs (colaborador_id, acao, user_id, dados_novos)
    VALUES (NEW.id, 'criou', v_user_id, row_to_json(NEW)::jsonb);
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO colaborador_logs (colaborador_id, acao, user_id, dados_anteriores, dados_novos)
    VALUES (NEW.id, 'editou', v_user_id, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_colaborador_changes ON colaboradores;
CREATE TRIGGER trg_audit_colaborador_changes
  AFTER INSERT OR UPDATE ON colaboradores
  FOR EACH ROW EXECUTE FUNCTION audit_colaborador_changes();
