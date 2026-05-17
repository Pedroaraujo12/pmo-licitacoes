-- ============================================
-- Modelo de Cronograma Padrão por Modalidade
-- Matriz de Responsabilidade (RACI)
-- ============================================

-- 1. TABELA: modelo_cronograma (template por modalidade)
CREATE TABLE IF NOT EXISTS modelo_cronograma (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modalidade_id UUID NOT NULL REFERENCES modalidades(id),
  nome TEXT NOT NULL DEFAULT 'Cronograma Padrão',
  total_dias_uteis INT NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_modelo_cronograma_modalidade ON modelo_cronograma(modalidade_id);

ALTER TABLE modelo_cronograma ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Todos podem ver modelo_cronograma' AND tablename = 'modelo_cronograma') THEN
    CREATE POLICY "Todos podem ver modelo_cronograma" ON modelo_cronograma FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin/Gestor pode gerenciar modelo_cronograma' AND tablename = 'modelo_cronograma') THEN
    CREATE POLICY "Admin/Gestor pode gerenciar modelo_cronograma" ON modelo_cronograma FOR INSERT
      WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor')));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin/Gestor pode editar modelo_cronograma' AND tablename = 'modelo_cronograma') THEN
    CREATE POLICY "Admin/Gestor pode editar modelo_cronograma" ON modelo_cronograma FOR UPDATE
      USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor')));
  END IF;
END $$;

-- 2. TABELA: modelo_etapa (etapas do template com RACI)
CREATE TABLE IF NOT EXISTS modelo_etapa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modelo_cronograma_id UUID NOT NULL REFERENCES modelo_cronograma(id) ON DELETE CASCADE,
  ordem INT NOT NULL,
  fase TEXT NOT NULL DEFAULT '',
  descricao TEXT NOT NULL,
  setor TEXT NOT NULL DEFAULT '',
  duracao_dias_uteis INT NOT NULL DEFAULT 0,
  dia_inicio_relativo INT,
  dia_fim_relativo INT,
  papel_responsavel TEXT DEFAULT '',
  responsavel_R TEXT DEFAULT '',
  responsavel_A TEXT DEFAULT '',
  responsavel_C TEXT DEFAULT '',
  responsavel_I TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_modelo_etapa_cronograma ON modelo_etapa(modelo_cronograma_id);
CREATE INDEX IF NOT EXISTS idx_modelo_etapa_ordem ON modelo_etapa(modelo_cronograma_id, ordem);

ALTER TABLE modelo_etapa ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Todos podem ver modelo_etapa' AND tablename = 'modelo_etapa') THEN
    CREATE POLICY "Todos podem ver modelo_etapa" ON modelo_etapa FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin/Gestor pode gerenciar modelo_etapa' AND tablename = 'modelo_etapa') THEN
    CREATE POLICY "Admin/Gestor pode gerenciar modelo_etapa" ON modelo_etapa FOR INSERT
      WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor')));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin/Gestor pode editar modelo_etapa' AND tablename = 'modelo_etapa') THEN
    CREATE POLICY "Admin/Gestor pode editar modelo_etapa" ON modelo_etapa FOR UPDATE
      USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor')));
  END IF;
END $$;

-- 3. ADICIONAR COLUNAS NA cronograma_atividades (se não existirem)
ALTER TABLE cronograma_atividades ADD COLUMN IF NOT EXISTS modelo_etapa_id UUID REFERENCES modelo_etapa(id);
ALTER TABLE cronograma_atividades ADD COLUMN IF NOT EXISTS responsavel_id UUID REFERENCES responsaveis(id);
ALTER TABLE cronograma_atividades ADD COLUMN IF NOT EXISTS data_inicio_real DATE;
ALTER TABLE cronograma_atividades ADD COLUMN IF NOT EXISTS data_fim_real DATE;
ALTER TABLE cronograma_atividades ADD COLUMN IF NOT EXISTS observacao TEXT;

-- ============================================
-- SEED DOS MODELOS (apenas se ainda não existirem)
-- ============================================
DO $$
DECLARE
  v_pregao_id UUID;
  v_cotacao_id UUID;
  v_concorrencia_id UUID;
  v_modelo_pregao UUID;
  v_modelo_cotacao UUID;
  v_modelo_concorrencia UUID;
BEGIN
  -- Buscar IDs das modalidades
  SELECT id INTO v_pregao_id FROM modalidades WHERE nome = 'Pregão Eletrônico' LIMIT 1;
  SELECT id INTO v_cotacao_id FROM modalidades WHERE nome IN ('Cotação de Preços', 'Cotação de preço') ORDER BY nome LIMIT 1;
  SELECT id INTO v_concorrencia_id FROM modalidades WHERE nome = 'Concorrência' LIMIT 1;

  -- ==========================================
  -- MODELO PREGÃO (52 dias úteis, 17 etapas)
  -- ==========================================
  IF v_pregao_id IS NOT NULL THEN
    SELECT id INTO v_modelo_pregao FROM modelo_cronograma
    WHERE modalidade_id = v_pregao_id AND nome = 'Cronograma Padrão Pregão' LIMIT 1;

    IF v_modelo_pregao IS NULL THEN
      INSERT INTO modelo_cronograma (modalidade_id, nome, total_dias_uteis)
      VALUES (v_pregao_id, 'Cronograma Padrão Pregão', 52)
      RETURNING id INTO v_modelo_pregao;

      INSERT INTO modelo_etapa (modelo_cronograma_id, ordem, fase, descricao, setor, duracao_dias_uteis, papel_responsavel) VALUES
        (v_modelo_pregao, 1,  'Planejamento', 'Análise do Termo de Referência e anexos', 'UAC', 3, 'João'),
        (v_modelo_pregao, 2,  'Produção',     'Pesquisa de Preços e levantamento do custo estimado da Contratação', 'UAC', 5, 'Maria'),
        (v_modelo_pregao, 3,  'Produção',     'Relatório de Pesquisa de Preços', 'UAC', 1, 'Pedro'),
        (v_modelo_pregao, 4,  'Análise',      'Disponibilidade orçamentária', 'UFOC', 2, 'Pedro'),
        (v_modelo_pregao, 5,  'Revisão',      'Designação da Comissão de Seleção', 'UAC', 1, 'Pedro'),
        (v_modelo_pregao, 6,  'Produção',     'Elaboração da Minuta de Edital e Anexos. Envio à UJUR/AGSUS', 'UAC', 5, 'Maria'),
        (v_modelo_pregao, 7,  'Análise',      'Análise jurídica e Emissão de Parecer', 'UJUR', 5, 'Maria'),
        (v_modelo_pregao, 8,  'Produção',     'Adequações e atendimento ao Parecer Jurídico quanto aos aspectos técnicos do Edital e Anexos e Autorização de Governança para publicação do Edital', 'NAAGE', 1, 'João'),
        (v_modelo_pregao, 9,  'Produção',     'Publicação do Edital (prazos legais: 8 dias úteis - Pregão)', 'UAC', 8, 'João'),
        (v_modelo_pregao, 10, 'Execução',     'Abertura e Fase de Lances', 'UAC', 1, 'João'),
        (v_modelo_pregao, 11, 'Execução',     'Fase de Julgamento das Propostas, Aceitação e Habilitação', 'UAC', 8, ''),
        (v_modelo_pregao, 12, 'Execução',     'Envios da proposta e documentação de qualificação técnica para análise da área demandante', 'UAC', 1, ''),
        (v_modelo_pregao, 13, 'Análise',      'Resposta da Área demandante', 'NAAGE', 1, ''),
        (v_modelo_pregao, 14, 'Análise',      'Prazo recursal (3 dias úteis)', 'UAC', 3, ''),
        (v_modelo_pregao, 15, 'Aprovação',    'Prazo para contrarrazões (3 dias úteis)', 'UAC', 3, ''),
        (v_modelo_pregao, 16, 'Aprovação',    'Decisão quanto ao recurso (5 dias úteis)', 'UAC', 5, ''),
        (v_modelo_pregao, 17, 'Aprovação',    'Envios do Recurso ao Jurídico e Ratificação pela autoridade competente da decisão do pregoeiro', 'DIOP', 2, '');
    END IF;
  END IF;

  -- =============================================
  -- MODELO COTAÇÃO DE PREÇOS (20 dias úteis, 10 etapas)
  -- =============================================
  IF v_cotacao_id IS NOT NULL THEN
    SELECT id INTO v_modelo_cotacao FROM modelo_cronograma
    WHERE modalidade_id = v_cotacao_id AND nome = 'Cronograma Padrão Cotação de Preços' LIMIT 1;

    IF v_modelo_cotacao IS NULL THEN
      INSERT INTO modelo_cronograma (modalidade_id, nome, total_dias_uteis)
      VALUES (v_cotacao_id, 'Cronograma Padrão Cotação de Preços', 20)
      RETURNING id INTO v_modelo_cotacao;

      INSERT INTO modelo_etapa (modelo_cronograma_id, ordem, fase, descricao, setor, duracao_dias_uteis, papel_responsavel) VALUES
        (v_modelo_cotacao, 1,  'Planejamento', 'Análise do Termo de Referência e anexos', 'UAC', 2, ''),
        (v_modelo_cotacao, 2,  'Produção',     'Pesquisa de Preços e levantamento do custo estimado da Contratação', 'UAC', 3, ''),
        (v_modelo_cotacao, 3,  'Análise',      'Disponibilidade orçamentária', 'UFOC', 1, ''),
        (v_modelo_cotacao, 4,  'Revisão',      'Designação da Comissão de Seleção', 'UAC', 1, ''),
        (v_modelo_cotacao, 5,  'Produção',     'Elaboração da Minuta de Edital e Anexos. Envio à UJUR/AGSUS', 'UAC', 3, ''),
        (v_modelo_cotacao, 6,  'Análise',      'Análise jurídica e Emissão de Parecer', 'UJUR', 3, ''),
        (v_modelo_cotacao, 7,  'Produção',     'Publicação do Edital (3 dias úteis - Cotação de Preços)', 'UAC', 3, ''),
        (v_modelo_cotacao, 8,  'Execução',     'Abertura e Fase de Lances', 'UAC', 1, ''),
        (v_modelo_cotacao, 9,  'Análise',      'Prazo recursal (3 dias úteis)', 'UAC', 2, ''),
        (v_modelo_cotacao, 10, 'Aprovação',    'Homologação e Adjudicação', 'UAC', 1, '');
    END IF;
  END IF;

  -- =============================================
  -- MODELO CONCORRÊNCIA (~70 dias úteis, 14 etapas)
  -- =============================================
  IF v_concorrencia_id IS NOT NULL THEN
    SELECT id INTO v_modelo_concorrencia FROM modelo_cronograma
    WHERE modalidade_id = v_concorrencia_id AND nome = 'Cronograma Padrão Concorrência' LIMIT 1;

    IF v_modelo_concorrencia IS NULL THEN
      INSERT INTO modelo_cronograma (modalidade_id, nome, total_dias_uteis)
      VALUES (v_concorrencia_id, 'Cronograma Padrão Concorrência', 70)
      RETURNING id INTO v_modelo_concorrencia;

      INSERT INTO modelo_etapa (modelo_cronograma_id, ordem, fase, descricao, setor, duracao_dias_uteis) VALUES
        (v_modelo_concorrencia, 1,  'Planejamento', 'Análise do Termo de Referência e anexos', 'UAC', 3),
        (v_modelo_concorrencia, 2,  'Produção',     'Pesquisa de Preços e levantamento do custo estimado da Contratação', 'UAC', 5),
        (v_modelo_concorrencia, 3,  'Análise',      'Disponibilidade orçamentária', 'UFOC', 2),
        (v_modelo_concorrencia, 4,  'Produção',     'Elaboração do Edital e anexos. Envio à UJUR/AGSUS', 'UAC', 5),
        (v_modelo_concorrencia, 5,  'Análise',      'Análise jurídica e Emissão de Parecer', 'UJUR', 5),
        (v_modelo_concorrencia, 6,  'Produção',     'Adequações ao Parecer Jurídico e Autorização de Governança', 'NAAGE', 2),
        (v_modelo_concorrencia, 7,  'Produção',     'Publicação do Edital (15 dias úteis - Concorrência)', 'UAC', 15),
        (v_modelo_concorrencia, 8,  'Execução',     'Abertura de propostas', 'UAC', 1),
        (v_modelo_concorrencia, 9,  'Execução',     'Fase de Julgamento das Propostas, Aceitação e Habilitação', 'UAC', 10),
        (v_modelo_concorrencia, 10, 'Análise',      'Prazo recursal (5 dias úteis)', 'UAC', 5),
        (v_modelo_concorrencia, 11, 'Aprovação',    'Prazo para contrarrazões (5 dias úteis)', 'UAC', 5),
        (v_modelo_concorrencia, 12, 'Aprovação',    'Decisão quanto ao recurso (5 dias úteis)', 'UAC', 5),
        (v_modelo_concorrencia, 13, 'Aprovação',    'Homologação e Adjudicação', 'UAC', 2),
        (v_modelo_concorrencia, 14, 'Aprovação',    'Envios ao Jurídico e Ratificação', 'DIOP', 2);
    END IF;
  END IF;
END $$;

-- ============================================
-- FUNÇÃO ATUALIZADA: criar_cronograma_para_processo (usando template)
-- ============================================
CREATE OR REPLACE FUNCTION criar_cronograma_para_processo(p_processo_id UUID, p_data_inicio DATE)
RETURNS void AS $$
DECLARE
  v_modalidade_id UUID;
  v_modelo_id UUID;
  v_etapa RECORD;
  v_data_atual DATE := p_data_inicio;
  v_data_fim_atividade DATE;
BEGIN
  DELETE FROM cronograma_atividades WHERE processo_id = p_processo_id;

  SELECT modalidade_id INTO v_modalidade_id FROM processos WHERE id = p_processo_id;

  SELECT id INTO v_modelo_id FROM modelo_cronograma
  WHERE modalidade_id = v_modalidade_id AND ativo = true
  ORDER BY created_at DESC LIMIT 1;

  IF v_modelo_id IS NULL THEN
    FOR v_etapa IN
      SELECT * FROM (VALUES
        (1, 3,  'Planejamento', 'Análise do Termo de Referência e anexos', 'UAC'),
        (2, 5,  'Produção',     'Pesquisa de Preços e levantamento do custo estimado da Contratação', 'UAC'),
        (3, 1,  'Produção',     'Relatório de Pesquisa Preços', 'UAC'),
        (4, 2,  'Análise',      'Disponibilidade orçamentária', 'UFOC'),
        (5, 1,  'Revisão',      'Designação da Comissão de Seleção', 'UAC'),
        (6, 5,  'Produção',     'Elaboração Da Minuta de Edital e Anexos. Envio à UJUR/AGSUS', 'UAC'),
        (7, 5,  'Análise',      'Análise jurídica e Emissão de Parecer', 'UJUR'),
        (8, 1,  'Produção',     'Adequações e atendimento ao Parecer Jurídico', 'NAAGE'),
        (9, 8,  'Produção',     'Publicação do Edital', 'UAC'),
        (10, 1, 'Execução',     'Abertura e Fase de Lances', 'UAC'),
        (11, 8, 'Execução',     'Fase de Julgamento das Propostas', 'UAC'),
        (12, 1, 'Execução',     'Envio da proposta para análise da área demandante', 'UAC'),
        (13, 1, 'Análise',      'Resposta da Área demandante', 'NAAGE'),
        (14, 3, 'Análise',      'Prazo recursal', 'UAC'),
        (15, 3, 'Aprovação',    'Prazo contrarrazões', 'UAC'),
        (16, 5, 'Aprovação',    'Decisão quanto ao recurso', 'UAC'),
        (17, 2, 'Aprovação',    'Envio do Recurso ao Jurídico e Ratificação', 'DIOP')
      ) AS t(ordem, dias, fase, descricao, setor) ORDER BY t.ordem
    LOOP
      IF v_etapa.ordem = 1 THEN v_data_atual := p_data_inicio;
      ELSE v_data_atual := v_data_fim_atividade + 1; END IF;

      IF v_etapa.dias > 0 THEN
        v_data_fim_atividade := somar_dias_uteis(v_data_atual, v_etapa.dias - 1);
      ELSE
        v_data_fim_atividade := NULL;
      END IF;

      INSERT INTO cronograma_atividades (processo_id, ordem, dias_uteis, fase, descricao, setor, status, data_inicio, data_fim)
      VALUES (p_processo_id, v_etapa.ordem, v_etapa.dias, v_etapa.fase, v_etapa.descricao, v_etapa.setor, 'nao_iniciado', v_data_atual, v_data_fim_atividade);
    END LOOP;
    RETURN;
  END IF;

  FOR v_etapa IN
    SELECT * FROM modelo_etapa
    WHERE modelo_cronograma_id = v_modelo_id
    ORDER BY ordem
  LOOP
    IF v_etapa.ordem = 1 THEN v_data_atual := p_data_inicio;
    ELSE v_data_atual := v_data_fim_atividade + 1; END IF;

    IF v_etapa.duracao_dias_uteis > 0 THEN
      v_data_fim_atividade := somar_dias_uteis(v_data_atual, v_etapa.duracao_dias_uteis - 1);
    ELSE
      v_data_fim_atividade := NULL;
    END IF;

    INSERT INTO cronograma_atividades (processo_id, ordem, dias_uteis, fase, descricao, setor, status, data_inicio, data_fim, modelo_etapa_id)
    VALUES (p_processo_id, v_etapa.ordem, v_etapa.duracao_dias_uteis, v_etapa.fase, v_etapa.descricao, v_etapa.setor, 'nao_iniciado', v_data_atual, v_data_fim_atividade, v_etapa.id);
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop e recria o trigger para apontar pra função atualizada
DROP TRIGGER IF EXISTS on_processo_created ON processos;
CREATE TRIGGER on_processo_created
  AFTER INSERT ON processos
  FOR EACH ROW
  EXECUTE FUNCTION trigger_criar_cronograma();

-- ============================================
-- VIEW: vw_cronograma_processo
-- ============================================
DROP VIEW IF EXISTS vw_cronograma_processo;
CREATE VIEW vw_cronograma_processo AS
SELECT
  ca.id, ca.processo_id, p.id_processo, p.modalidade_id,
  m.nome AS modalidade_nome,
  ca.ordem, ca.fase, ca.descricao AS atividade_descricao,
  ca.setor, ca.dias_uteis, ca.status,
  ca.data_inicio, ca.data_fim, ca.modelo_etapa_id,
  r.nome AS responsavel_nome,
  ca.data_inicio_real, ca.data_fim_real, ca.observacao,
  CASE
    WHEN ca.status != 'concluido' AND ca.data_fim IS NOT NULL AND ca.data_fim < CURRENT_DATE THEN true
    ELSE false
  END AS em_atraso
FROM cronograma_atividades ca
JOIN processos p ON p.id = ca.processo_id
LEFT JOIN modalidades m ON m.id = p.modalidade_id
LEFT JOIN responsaveis r ON r.id = ca.responsavel_id;

-- ============================================
-- VIEW: vw_status_processo_cronograma
-- ============================================
DROP VIEW IF EXISTS vw_status_processo_cronograma;
CREATE VIEW vw_status_processo_cronograma AS
SELECT
  ca.processo_id,
  p.id_processo,
  p.modalidade_id,
  m.nome AS modalidade_nome,
  (
    SELECT ca2.descricao FROM cronograma_atividades ca2
    WHERE ca2.processo_id = ca.processo_id AND ca2.status != 'concluido'
    ORDER BY ca2.ordem LIMIT 1
  ) AS atividade_atual,
  (
    SELECT ca2.data_fim FROM cronograma_atividades ca2
    WHERE ca2.processo_id = ca.processo_id AND ca2.status != 'concluido'
    ORDER BY ca2.ordem LIMIT 1
  ) AS data_fim_atividade_atual,
  (
    SELECT ca2.ordem FROM cronograma_atividades ca2
    WHERE ca2.processo_id = ca.processo_id AND ca2.status != 'concluido'
    ORDER BY ca2.ordem LIMIT 1
  ) AS ordem_atividade_atual,
  MAX(ca.ordem) AS total_etapas,
  COUNT(ca.status) FILTER (WHERE ca.status = 'concluido') AS etapas_concluidas,
  COUNT(ca.status) FILTER (WHERE ca.status != 'concluido' AND ca.data_fim IS NOT NULL AND ca.data_fim < CURRENT_DATE) AS etapas_atrasadas,
  CASE
    WHEN COUNT(ca.status) FILTER (WHERE ca.status != 'concluido' AND ca.data_fim IS NOT NULL AND ca.data_fim < CURRENT_DATE) > 0 THEN true
    ELSE false
  END AS processo_atrasado,
  CASE
    WHEN COUNT(ca.status) = 0 THEN 0
    ELSE ROUND((COUNT(ca.status) FILTER (WHERE ca.status = 'concluido')::DECIMAL / COUNT(ca.status)::DECIMAL) * 100)
  END AS progresso_calculado,
  MAX(ca.data_fim) AS data_fim_prevista_total
FROM cronograma_atividades ca
JOIN processos p ON p.id = ca.processo_id
LEFT JOIN modalidades m ON m.id = p.modalidade_id
GROUP BY ca.processo_id, p.id_processo, p.modalidade_id, m.nome;

-- ============================================
-- FUNÇÃO: recalcular_cronograma_processos_existentes()
-- ============================================
CREATE OR REPLACE FUNCTION recalcular_cronograma_processos_existentes()
RETURNS TABLE(processo_id UUID, id_processo TEXT, status TEXT) AS $$
DECLARE
  v_rec RECORD;
BEGIN
  FOR v_rec IN
    SELECT id, id_processo, data_entrada FROM processos
    WHERE data_entrada IS NOT NULL
    ORDER BY data_entrada
  LOOP
    BEGIN
      PERFORM criar_cronograma_para_processo(v_rec.id, v_rec.data_entrada);
      processo_id := v_rec.id;
      id_processo := v_rec.id_processo;
      status := 'OK';
      RETURN NEXT;
    EXCEPTION WHEN OTHERS THEN
      processo_id := v_rec.id;
      id_processo := v_rec.id_processo;
      status := 'ERRO: ' || SQLERRM;
      RETURN NEXT;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
