-- ============================================================
-- Migration 00018: Módulo Repositório de Modelos de Documentos
-- ============================================================
-- Aplicar via Management API (SQL Editor ou curl)
-- ============================================================

-- 1. Enum para status de versão
DO $$ BEGIN
  CREATE TYPE template_status AS ENUM ('rascunho', 'em_revisao_juridica', 'aprovado', 'obsoleto');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Tabela: document_templates
CREATE TABLE IF NOT EXISTS document_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  tipo_documento TEXT NOT NULL,
  categoria     TEXT NOT NULL DEFAULT 'licitacoes',
  base_legal    TEXT,
  descricao     TEXT,
  conteudo      TEXT NOT NULL DEFAULT '',
  status        template_status NOT NULL DEFAULT 'rascunho',
  tags          TEXT[] NOT NULL DEFAULT '{}',
  created_by    UUID NOT NULL REFERENCES profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Tabela: template_versions
CREATE TABLE IF NOT EXISTS template_versions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id        UUID NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
  version_number     INTEGER NOT NULL,
  conteudo           TEXT NOT NULL DEFAULT '',
  resumo_alteracao   TEXT,
  status             template_status NOT NULL DEFAULT 'rascunho',
  aprovado_por       UUID REFERENCES profiles(id),
  data_aprovacao     TIMESTAMPTZ,
  observacoes_aprovacao TEXT,
  author_id          UUID NOT NULL REFERENCES profiles(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(template_id, version_number)
);

-- 4. Chave versao_vigente em document_templates
ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS versao_vigente_id UUID REFERENCES template_versions(id);

-- 5. Tabela: template_placeholders (mapeamento automático)
CREATE TABLE IF NOT EXISTS template_placeholders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  placeholder   TEXT NOT NULL UNIQUE,
  descricao     TEXT,
  tabela_origem TEXT NOT NULL,
  coluna_origem TEXT NOT NULL,
  json_extract_path TEXT,  -- ex: "coordenacoes.nome" para joins
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Tabela: document_generated (documentos gerados para processos)
CREATE TABLE IF NOT EXISTS document_generated (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id         UUID NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
  template_id         UUID NOT NULL REFERENCES document_templates(id),
  template_version_id UUID NOT NULL REFERENCES template_versions(id),
  titulo_documento    TEXT NOT NULL,
  conteudo_gerado     TEXT NOT NULL,
  created_by          UUID NOT NULL REFERENCES profiles(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Tabela: template_usage_log (auditoria)
CREATE TABLE IF NOT EXISTS template_usage_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id         UUID NOT NULL REFERENCES document_templates(id),
  template_version_id UUID REFERENCES template_versions(id),
  acao                TEXT NOT NULL,
  user_id             UUID NOT NULL REFERENCES profiles(id),
  processo_id         UUID REFERENCES processos(id) ON DELETE SET NULL,
  metadata            JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Tabela: template_favorites
CREATE TABLE IF NOT EXISTS template_favorites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(template_id, user_id)
);

-- 9. Índices
CREATE INDEX IF NOT EXISTS idx_template_versions_template_id ON template_versions(template_id);
CREATE INDEX IF NOT EXISTS idx_template_versions_status ON template_versions(status);
CREATE INDEX IF NOT EXISTS idx_document_templates_tipo ON document_templates(tipo_documento);
CREATE INDEX IF NOT EXISTS idx_document_templates_status ON document_templates(status);
CREATE INDEX IF NOT EXISTS idx_document_templates_tags ON document_templates USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_document_generated_processo ON document_generated(processo_id);
CREATE INDEX IF NOT EXISTS idx_document_generated_template ON document_generated(template_id);
CREATE INDEX IF NOT EXISTS idx_template_usage_log_template ON template_usage_log(template_id);
CREATE INDEX IF NOT EXISTS idx_template_usage_log_user ON template_usage_log(user_id);
CREATE INDEX IF NOT EXISTS idx_template_usage_log_acao ON template_usage_log(acao);
CREATE INDEX IF NOT EXISTS idx_template_favorites_user ON template_favorites(user_id);

-- 10. Função para buscar texto nos templates (full-text simplificado)
CREATE OR REPLACE FUNCTION search_templates(search_term TEXT)
RETURNS SETOF document_templates
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY SELECT *
  FROM document_templates
  WHERE
    title ILIKE '%' || search_term || '%'
    OR descricao ILIKE '%' || search_term || '%'
    OR conteudo ILIKE '%' || search_term || '%'
    OR search_term = ANY(tags)
  ORDER BY
    CASE WHEN title ILIKE '%' || search_term || '%' THEN 0 ELSE 1 END,
    created_at DESC;
END;
$$;

-- 11. Função para popular placeholders padrão
INSERT INTO template_placeholders (placeholder, descricao, tabela_origem, coluna_origem, json_extract_path) VALUES
  ('NUMERO_PROCESSO', 'Número do processo (ex: AGSUS.000000/0000-00)', 'processos', 'id_processo', NULL),
  ('ANO_PROCESSO', 'Ano do processo', 'processos', 'id_processo', NULL),
  ('UNIDADE_DEMANDANTE', 'Nome da unidade demandante', 'processos', 'demandante_id', 'demandantes.nome'),
  ('COORDENACAO', 'Nome da coordenação', 'processos', 'coordenacao_id', 'coordenacoes.nome'),
  ('OBJETO', 'Objeto resumido da licitação', 'processos', 'objeto_resumido', NULL),
  ('VALOR_ESTIMADO', 'Valor estimado formatado (R$)', 'processos', 'valor_estimado', NULL),
  ('VALOR_HOMOLOGADO', 'Valor homologado formatado (R$)', 'processos', 'valor_homologado', NULL),
  ('RESPONSAVEL_PELO_PROCESSO', 'Nome do responsável pelo processo', 'processos', 'responsavel_id', 'responsaveis.nome'),
  ('MODALIDADE', 'Modalidade da licitação', 'processos', 'modalidade_id', 'modalidades.nome'),
  ('STATUS_PROCESSO', 'Status do processo', 'processos', 'status_id', 'status_processo.nome'),
  ('DATA_ENTRADA', 'Data de entrada do processo', 'processos', 'data_entrada', NULL),
  ('DATA_ENTREGA', 'Data prevista de entrega', 'processos', 'data_entrega', NULL),
  ('PRIORIDADE', 'Prioridade do processo', 'processos', 'prioridade', NULL),
  ('QTD_ITENS', 'Quantidade de itens', 'processos', 'qtd_itens', NULL),
  ('PROGRESSO', 'Percentual de progresso', 'processos', 'progresso', NULL),
  ('ATIVIDADE_ATUAL', 'Atividade atual do processo', 'processos', 'atividade_atual', NULL),
  ('DRIVE_LINK', 'Link do Google Drive', 'processos', 'drive', NULL),
  ('OBSERVACOES', 'Observações do processo', 'processos', 'observacoes', NULL),
  ('DESPESA_EVITADA', 'Despesa evitada (economia)', 'processos', 'despesa_evitada', NULL),
  ('HOUVE_RECURSO', 'Se houve recurso (Sim/Não)', 'processos', 'houve_recurso', NULL)
ON CONFLICT (placeholder) DO NOTHING;

-- 12. View para métricas do módulo
CREATE OR REPLACE VIEW vw_template_metrics AS
SELECT
  dt.tipo_documento,
  COUNT(DISTINCT dt.id) FILTER (WHERE dt.status = 'aprovado') AS modelos_ativos,
  COUNT(DISTINCT dt.id) AS modelos_total,
  COUNT(dg.id) AS documentos_gerados,
  COUNT(dg.id) FILTER (WHERE dg.created_at >= now() - interval '30 days') AS documentos_gerados_30d
FROM document_templates dt
LEFT JOIN document_generated dg ON dg.template_id = dt.id
GROUP BY dt.tipo_documento;

-- 13. Trigger para updated_at
CREATE OR REPLACE FUNCTION update_document_templates_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_document_templates_updated_at ON document_templates;
CREATE TRIGGER trg_document_templates_updated_at
  BEFORE UPDATE ON document_templates
  FOR EACH ROW EXECUTE FUNCTION update_document_templates_updated_at();

-- 14. Trigger de auditoria para document_templates
CREATE OR REPLACE FUNCTION audit_template_changes()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO template_usage_log (template_id, acao, user_id, metadata)
    VALUES (NEW.id, 'criou', NEW.created_by, jsonb_build_object('title', NEW.title));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO template_usage_log (template_id, acao, user_id, metadata)
    VALUES (NEW.id, 'editou', NEW.created_by, jsonb_build_object(
      'changes', jsonb_build_object(
        'title_old', OLD.title, 'title_new', NEW.title,
        'status_old', OLD.status, 'status_new', NEW.status
      )
    ));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_template_changes ON document_templates;
CREATE TRIGGER trg_audit_template_changes
  AFTER INSERT OR UPDATE ON document_templates
  FOR EACH ROW EXECUTE FUNCTION audit_template_changes();

-- 15. Trigger de auditoria para template_versions
CREATE OR REPLACE FUNCTION audit_template_version_changes()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO template_usage_log (template_id, template_version_id, acao, user_id, metadata)
    VALUES (NEW.template_id, NEW.id, 'criou_versao', NEW.author_id, jsonb_build_object(
      'version_number', NEW.version_number,
      'status', NEW.status
    ));
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'aprovado' AND OLD.status != 'aprovado' THEN
    INSERT INTO template_usage_log (template_id, template_version_id, acao, user_id, metadata)
    VALUES (NEW.template_id, NEW.id, 'aprovou', NEW.aprovado_por, jsonb_build_object(
      'version_number', NEW.version_number,
      'data_aprovacao', NEW.data_aprovacao
    ));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_template_version_changes ON template_versions;
CREATE TRIGGER trg_audit_template_version_changes
  AFTER INSERT OR UPDATE ON template_versions
  FOR EACH ROW EXECUTE FUNCTION audit_template_version_changes();
