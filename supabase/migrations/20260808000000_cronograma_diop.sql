-- ============================================
-- Cronogramas DIOP por Modalidade
-- Aplica os cronogramas oficiais da aba "CRONOGRAMA DIOP":
--   Pregão Eletrônico        -> 69 dias úteis (20 etapas)
--   Cotação de Preços        -> 35 dias úteis (17 etapas)  [versão 2 da planilha]
--   Credenciamento (serv. eh.)-> 60 dias úteis (15 etapas)
--   Concorrência (obras)     -> 107 dias úteis (23 etapas)
-- As modalidades Dispensa e Inexigibilidade NAO são alteradas.
--
-- Obs.: o total declarado do DIOP para Concorrência é 107 dias;
-- a soma das durações copiadas da planilha é 99 (mantidas as durações
-- exatas). O total_dias_uteis segue o oficial (107).
-- ============================================

-- 1. Criar novos modelos (ativos) a partir do DIOP
DO $$
DECLARE
  v_modal UUID; v_id UUID;
BEGIN

  -- ---- PREGÃO ELETRÔNICO (69 dias = 20 etapas) ----
  SELECT id INTO v_modal FROM modalidades WHERE nome = 'Pregão Eletrônico' LIMIT 1;
  IF v_modal IS NOT NULL THEN
    INSERT INTO modelo_cronograma (modalidade_id, nome, total_dias_uteis, ativo)
SELECT v_modal, 'Cronograma DIOP Pregão', 69, true
WHERE NOT EXISTS (SELECT 1 FROM modelo_cronograma WHERE modalidade_id = v_modal AND nome = 'Cronograma DIOP Pregão');
SELECT id INTO v_id FROM modelo_cronograma WHERE modalidade_id = v_modal AND nome = 'Cronograma DIOP Pregão' LIMIT 1;
    DELETE FROM modelo_etapa WHERE modelo_cronograma_id = v_id;
    INSERT INTO modelo_etapa (modelo_cronograma_id, ordem, fase, descricao, setor, duracao_dias_uteis) VALUES
      (v_id, 1,  'Planejamento', 'Análise do TR/UAC', 'UAC', 5),
      (v_id, 2,  'Produção',     'Pesquisa de Preços', 'UAC', 5),
      (v_id, 3,  'Produção',     'Relatório/Pesquisa de Preços', 'UAC', 1),
      (v_id, 4,  'Revisão',      'Designação de Comissão', 'UAC', 0),
      (v_id, 5,  'Produção',     'Elaboração de Minuta/Edital/Anexos', 'UAC', 5),
      (v_id, 6,  'Análise',      'Análise Jurídica', 'UJUR', 5),
      (v_id, 7,  'Produção',     'Adequação ao Parecer Jurídico', 'UAC', 1),
      (v_id, 8,  'Produção',     'Publicação do Edital (8 dias - Aquisição / 10 dias - Serviço)', 'UCOM', 8),
      (v_id, 9,  'Execução',     'Abertura Fase de Lances', 'UAC', 1),
      (v_id, 10, 'Execução',     'Fase de Julgamento das Propostas', 'UAC', 8),
      (v_id, 11, 'Execução',     'Envio da Proposta e doc. de qualificação técnica para análise', 'UAC', 1),
      (v_id, 12, 'Análise',      'Retorno Área Técnica', 'NAAGE', 5),
      (v_id, 13, 'Execução',     'Fase de Julgamento da Habilitação', 'UAC', 1),
      (v_id, 14, 'Análise',      'Prazo Recursal (3 dias úteis)', 'UAC', 3),
      (v_id, 15, 'Análise',      'Prazo Contrarrazões (3 dias úteis)', 'UAC', 3),
      (v_id, 16, 'Análise',      'Decisão quanto ao recurso (5 dias úteis)', 'UAC', 5),
      (v_id, 17, 'Aprovação',    'Envio do Recurso (2 dias)', 'DIOP', 2),
      (v_id, 18, 'Aprovação',    'Adjudicação (1 dia sem recurso)', 'DIOP', 1),
      (v_id, 19, 'Aprovação',    'Homologação', 'DIOP', 1),
      (v_id, 20, 'Aprovação',    'Assinatura do Contrato', 'DIOP', 8);
  END IF;

  -- ---- COTAÇÃO DE PREÇOS (35 dias = 17 etapas) ----
  SELECT id INTO v_modal FROM modalidades WHERE nome IN ('Cotação de Preços', 'Cotação de preço') ORDER BY nome LIMIT 1;
  IF v_modal IS NOT NULL THEN
    INSERT INTO modelo_cronograma (modalidade_id, nome, total_dias_uteis, ativo)
SELECT v_modal, 'Cronograma DIOP Cotação de Preços', 35, true
WHERE NOT EXISTS (SELECT 1 FROM modelo_cronograma WHERE modalidade_id = v_modal AND nome = 'Cronograma DIOP Cotação de Preços');
SELECT id INTO v_id FROM modelo_cronograma WHERE modalidade_id = v_modal AND nome = 'Cronograma DIOP Cotação de Preços' LIMIT 1;
    DELETE FROM modelo_etapa WHERE modelo_cronograma_id = v_id;
    INSERT INTO modelo_etapa (modelo_cronograma_id, ordem, fase, descricao, setor, duracao_dias_uteis) VALUES
      (v_id, 1,  'Planejamento', 'Analisar a Solicitação de Compras e anexos', 'UAC', 3),
      (v_id, 2,  'Produção',     'Elaboração da requisição de propostas, modelos e anexos', 'UAC', 2),
      (v_id, 3,  'Produção',     'Solicitar a publicação da cotação de preços', 'UAC', 1),
      (v_id, 4,  'Execução',     'Publicação no site (UCOM)', 'UCOM', 1),
      (v_id, 5,  'Execução',     'Publicação da Cotação de Preços p/ Recebimento de Propostas', 'UCOM', 3),
      (v_id, 6,  'Execução',     'Enviar a proposta de menor valor para área demandante', 'UAC', 2),
      (v_id, 7,  'Análise',      'Resposta da área demandante', 'NAAGE', 2),
      (v_id, 8,  'Análise',      'Confeccionar o Mapa de Preço', 'UAC', 2),
      (v_id, 9,  'Análise',      'Solicitar Disponibilidade Orçamentária', 'UFOC', 1),
      (v_id, 10, 'Análise',      'Conceder Disponibilidade Orçamentária (UFOC)', 'UFOC', 1),
      (v_id, 11, 'Análise',      'Elaboração do Relatório de Contratação', 'UAC', 2),
      (v_id, 12, 'Análise',      'Envio à UJUR para análise', 'UJUR', 1),
      (v_id, 13, 'Análise',      'Emissão de Parecer jurídico (UJUR)', 'UJUR', 7),
      (v_id, 14, 'Análise',      'Análise do Parecer emitido', 'UAC', 1),
      (v_id, 15, 'Aprovação',    'Autorizar a contratação - Ato de Ratificação', 'DIOP', 1),
      (v_id, 16, 'Aprovação',    'Elaborar o contrato ou Ordem de Fornecimento', 'DIOP', 2),
      (v_id, 17, 'Aprovação',    'Encaminhar o instrumento contratual ao contratado para aprovação', 'DIOP', 3);
  END IF;

  -- ---- CREDENCIAMENTO (60 dias = 15 etapas) ----
  SELECT id INTO v_modal FROM modalidades WHERE nome = 'Credenciamento' LIMIT 1;
  IF v_modal IS NOT NULL THEN
    INSERT INTO modelo_cronograma (modalidade_id, nome, total_dias_uteis, ativo)
SELECT v_modal, 'Cronograma DIOP Credenciamento', 60, true
WHERE NOT EXISTS (SELECT 1 FROM modelo_cronograma WHERE modalidade_id = v_modal AND nome = 'Cronograma DIOP Credenciamento');
SELECT id INTO v_id FROM modelo_cronograma WHERE modalidade_id = v_modal AND nome = 'Cronograma DIOP Credenciamento' LIMIT 1;
    DELETE FROM modelo_etapa WHERE modelo_cronograma_id = v_id;
    INSERT INTO modelo_etapa (modelo_cronograma_id, ordem, fase, descricao, setor, duracao_dias_uteis) VALUES
      (v_id, 1,  'Planejamento', 'Análise do TR e demais documentos (UAC)', 'UAC', 8),
      (v_id, 2,  'Produção',     'Confecção do Edital e Anexos (UAC)', 'UAC', 8),
      (v_id, 3,  'Produção',     'Envio para Parecer Jurídico (UAC)', 'UAC', 1),
      (v_id, 4,  'Análise',      'Análise Jurídica (UJUR)', 'UJUR', 5),
      (v_id, 5,  'Produção',     'Saneamento do Processo (UAC)', 'UAC', 2),
      (v_id, 6,  'Execução',     'Publicação do Credenciamento (UAC)', 'UCOM', 1),
      (v_id, 7,  'Execução',     'Prazo de acolhimento de documentação dos interessados (indeterminado)', 'UAC', 0),
      (v_id, 8,  'Execução',     'Análise de habilitação e envio dos documentos para análise técnica', 'UAC', 3),
      (v_id, 9,  'Análise',      'Análise dos documentos pela área técnica', 'NAAGE', 5),
      (v_id, 10, 'Análise',      'Julgamento do Credenciamento', 'UAC', 2),
      (v_id, 11, 'Análise',      'Prazo recursal', 'UAC', 3),
      (v_id, 12, 'Análise',      'Contrarrazões', 'UAC', 3),
      (v_id, 13, 'Execução',     'Julgamento (UAC)', 'UAC', 8),
      (v_id, 14, 'Execução',     'Publicação da lista de habilitados/inabilitados', 'UCOM', 1),
      (v_id, 15, 'Aprovação',    'Assinatura do Contrato', 'DIOP', 10);
  END IF;

  -- ---- CONCORRÊNCIA p/ obras (107 dias = 23 etapas) ----
  SELECT id INTO v_modal FROM modalidades WHERE nome = 'Concorrência' LIMIT 1;
  IF v_modal IS NOT NULL THEN
    INSERT INTO modelo_cronograma (modalidade_id, nome, total_dias_uteis, ativo)
SELECT v_modal, 'Cronograma DIOP Concorrência', 107, true
WHERE NOT EXISTS (SELECT 1 FROM modelo_cronograma WHERE modalidade_id = v_modal AND nome = 'Cronograma DIOP Concorrência');
SELECT id INTO v_id FROM modelo_cronograma WHERE modalidade_id = v_modal AND nome = 'Cronograma DIOP Concorrência' LIMIT 1;
    DELETE FROM modelo_etapa WHERE modelo_cronograma_id = v_id;
    INSERT INTO modelo_etapa (modelo_cronograma_id, ordem, fase, descricao, setor, duracao_dias_uteis) VALUES
      (v_id, 1,  'Planejamento', 'Análise do TR', 'UAC', 5),
      (v_id, 2,  'Produção',     'Pesquisa de Preços', 'UAC', 5),
      (v_id, 3,  'Produção',     'Relatório/Pesquisa de Preços', 'UAC', 1),
      (v_id, 4,  'Revisão',      'Designação de Comissão', 'UAC', 0),
      (v_id, 5,  'Produção',     'Elaboração de Minuta/Edital/Anexos', 'UAC', 5),
      (v_id, 6,  'Análise',      'Análise Jurídica', 'UJUR', 5),
      (v_id, 7,  'Produção',     'Adequação ao Parecer Jurídico', 'UAC', 1),
      (v_id, 8,  'Produção',     'Publicação do Edital (15 dias)', 'UCOM', 15),
      (v_id, 9,  'Execução',     'Envio da doc. de qualificação técnica para análise', 'UAC', 8),
      (v_id, 10, 'Execução',     'Julgamento de Habilitação', 'UAC', 1),
      (v_id, 11, 'Análise',      'Prazo Recursal (3 dias úteis)', 'UAC', 3),
      (v_id, 12, 'Análise',      'Prazo Contrarrazões (3 dias úteis)', 'UAC', 3),
      (v_id, 13, 'Análise',      'Decisão quanto ao recurso (5 dias úteis)', 'UAC', 5),
      (v_id, 14, 'Análise',      'Envio do Recurso Jurídico', 'DIOP', 5),
      (v_id, 15, 'Execução',     'Abertura de Lances', 'UAC', 2),
      (v_id, 16, 'Execução',     'Fase de Julgamento das Propostas', 'UAC', 8),
      (v_id, 17, 'Análise',      'Prazo Recursal (3 dias úteis)', 'UAC', 3),
      (v_id, 18, 'Análise',      'Prazo Contrarrazões (3 dias úteis)', 'UAC', 3),
      (v_id, 19, 'Análise',      'Decisão quanto ao recurso (5 dias úteis)', 'UAC', 5),
      (v_id, 20, 'Análise',      'Envio do Recurso (5 dias)', 'DIOP', 5),
      (v_id, 21, 'Aprovação',    'Adjudicação', 'DIOP', 1),
      (v_id, 22, 'Aprovação',    'Homologação', 'DIOP', 2),
      (v_id, 23, 'Aprovação',    'Assinatura do Contrato', 'DIOP', 8);
  END IF;

  -- 2) Desativar os modelos antigos dessas modalidades
  UPDATE modelo_cronograma SET ativo = false
  WHERE ativo = true
    AND modalidade_id IN (
      SELECT id FROM modalidades
      WHERE nome IN ('Pregão Eletrônico', 'Cotação de Preços', 'Cotação de preço', 'Credenciamento', 'Concorrência')
    )
    AND nome NOT LIKE 'Cronograma DIOP%';
END $$;

-- ============================================
-- Helpers de normalização sem acentos
-- ============================================
CREATE OR REPLACE FUNCTION crono_normalize(s text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(lower(coalesce(s, '')), '[^a-z0-9]', '', 'g');
$$;

CREATE OR REPLACE FUNCTION crono_match_score(a text, b text) RETURNS float8
LANGUAGE sql IMMUTABLE AS $$
  SELECT
    CASE WHEN a <> '' AND a = b THEN 4
         WHEN a <> '' AND b <> '' AND length(a) >= 4 AND length(b) >= 4
              AND (a LIKE '%' || b || '%' OR b LIKE '%' || a || '%') THEN 2
         ELSE 0
    END;
$$;

-- ============================================
-- Rebuild preservando status (concluído/em andamento),
-- responsável, datas reais e observações quando a
-- descrição antiga casa com a nova etapa (match 1:1).
-- ============================================
CREATE OR REPLACE FUNCTION recalc_cronograma_diop_preservo()
RETURNS TABLE(processo_id uuid, nome_processo text, modalidade text, resultado text,
              concluidos_preservados bigint, em_andamento_preservados bigint)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  r RECORD;
  oldr RECORD;
  newr RECORD;
  best RECORD;
  best_score float8;
  s float8;
  cnt_c bigint := 0;
  cnt_a bigint := 0;
  usados uuid[] := ARRAY[]::uuid[];
  tem_mod BOOLEAN;
BEGIN
  FOR r IN
    SELECT p.id, p.id_processo, p.data_entrada, m.nome AS modi
    FROM processos p
    JOIN modalidades m ON m.id = p.modalidade_id
    WHERE p.data_entrada IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM modelo_cronograma mc
        WHERE mc.modalidade_id = p.modalidade_id AND mc.ativo = true AND mc.nome LIKE 'Cronograma DIOP%'
      )
    ORDER BY p.data_entrada
  LOOP
    BEGIN
      DROP TABLE IF EXISTS _old_cron;
      CREATE TEMP TABLE _old_cron ON COMMIT DROP AS
        SELECT ca.id, ca.ordem, ca.descricao, crono_normalize(ca.descricao) AS n,
               ca.status, ca.responsavel_id, ca.data_inicio_real, ca.data_fim_real, ca.observacao
        FROM cronograma_atividades ca
        WHERE ca.processo_id = r.id;

      PERFORM criar_cronograma_para_processo(r.id, r.data_entrada);

      cnt_c := 0; cnt_a := 0; usados := ARRAY[]::uuid[];

      FOR newr IN
        SELECT ca.id, crono_normalize(ca.descricao) AS n, ca.descricao
        FROM cronograma_atividades ca
        WHERE ca.processo_id = r.id ORDER BY ca.ordem
      LOOP
        best := NULL; best_score := 0;
        FOR oldr IN
          SELECT * FROM _old_cron WHERE NOT (id = ANY(usados)) ORDER BY ordem
        LOOP
          s := crono_match_score(newr.n, oldr.n);
          IF s > best_score THEN best_score := s; best := oldr; END IF;
        END LOOP;

        IF best IS NOT NULL AND best_score >= 2 THEN
          UPDATE cronograma_atividades SET
            status = CASE WHEN best.status IN ('concluido', 'em_andamento') THEN best.status ELSE 'nao_iniciado' END,
            responsavel_id = best.responsavel_id,
            data_inicio_real = best.data_inicio_real,
            data_fim_real = best.data_fim_real,
            observacao = best.observacao
          WHERE id = newr.id;
          IF best.status = 'concluido' THEN cnt_c := cnt_c + 1;
          ELSIF best.status = 'em_andamento' THEN cnt_a := cnt_a + 1;
          END IF;
          usados := usados || best.id;
        END IF;
      END LOOP;

      processo_id := r.id;
      nome_processo := r.id_processo;
      modalidade := r.modi;
      resultado := 'OK';
      concluidos_preservados := cnt_c;
      em_andamento_preservados := cnt_a;
      RETURN NEXT;
    EXCEPTION WHEN OTHERS THEN
      processo_id := r.id;
      nome_processo := r.id_processo;
      modalidade := r.modi;
      resultado := 'ERRO: ' || SQLERRM;
      concluidos_preservados := 0;
      em_andamento_preservados := 0;
      RETURN NEXT;
    END;
  END LOOP;
END;
$$;