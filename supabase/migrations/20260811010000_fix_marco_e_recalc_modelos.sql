-- ============================================
-- Fix: marcos zeram a cadeia de datas + recálculo geral pelos modelos ativos
-- ============================================
-- PROBLEMA
-- Em criar_cronograma_para_processo, etapa de duração 0 (marco) gravava
-- data_fim = NULL. Como a etapa seguinte começa em (data_fim + 1) e NULL + 1
-- é NULL em SQL, o marco interrompia a cadeia: todas as etapas posteriores
-- ficavam sem data. Pior, a chamada seguinte virava somar_dias_uteis(NULL, n),
-- cujo laço nunca satisfaz a condição de parada — só termina no
-- statement_timeout.
--
-- Ritos com marco (modelos DIOP):
--   Pregão .......... etapa  4 (Designação de Comissão)   -> quebrava 5..20
--   Concorrência .... etapa  4 (Designação de Comissão)   -> quebrava 5..24
--   Credenciamento .. etapa  7 (Acolhimento de documentos)-> quebrava 8..15
--   Cotação ......... sem marco                           -> único íntegro
--
-- SOLUÇÃO
-- Marco passa a começar e terminar no mesmo dia útil, mantendo a cadeia —
-- mesma convenção do Simulador de Cronograma. Mais uma guarda contra NULL
-- em somar_dias_uteis, para nenhum dado ruim virar laço infinito.
-- ============================================

-- 1. somar_dias_uteis: guarda de NULL + marco cai em dia útil
--    Convenção preservada: INCLUSIVA (o próprio dia de início conta como o
--    primeiro dia útil). Não altere isso sem revisar todo o cronograma.
CREATE OR REPLACE FUNCTION somar_dias_uteis(data_inicio DATE, qtd_dias INT)
RETURNS DATE AS $$
DECLARE
  data_atual DATE := data_inicio;
  dias_contados INT := 0;
  guarda INT := 0;
BEGIN
  -- entrada inválida devolve NULL em vez de girar para sempre
  IF data_inicio IS NULL THEN
    RETURN NULL;
  END IF;

  -- marco (0 dias): não consome prazo, mas precisa cair em dia útil
  IF qtd_dias IS NULL OR qtd_dias <= 0 THEN
    WHILE (EXTRACT(DOW FROM data_atual) IN (0, 6)
           OR EXISTS (SELECT 1 FROM feriados f WHERE f.data = data_atual))
          AND guarda < 400 LOOP
      data_atual := data_atual + 1;
      guarda := guarda + 1;
    END LOOP;
    RETURN data_atual;
  END IF;

  LOOP
    IF EXTRACT(DOW FROM data_atual) NOT IN (0, 6)
       AND NOT EXISTS (SELECT 1 FROM feriados f WHERE f.data = data_atual) THEN
      dias_contados := dias_contados + 1;
      IF dias_contados >= qtd_dias THEN
        RETURN data_atual;
      END IF;
    END IF;
    data_atual := data_atual + 1;
    guarda := guarda + 1;
    EXIT WHEN guarda > 4000;              -- rede de segurança
  END LOOP;

  RETURN data_atual;
END;
$$ LANGUAGE plpgsql;

-- 2. criar_cronograma_para_processo: marco mantém a cadeia
CREATE OR REPLACE FUNCTION criar_cronograma_para_processo(p_processo_id UUID, p_data_inicio DATE)
RETURNS void AS $$
DECLARE
  v_modalidade_id UUID;
  v_modelo_id UUID;
  v_etapa RECORD;
  v_data_atual DATE := p_data_inicio;
  v_data_fim_atividade DATE;
BEGIN
  IF p_data_inicio IS NULL THEN
    RETURN;                                -- sem data de entrada não há o que projetar
  END IF;

  DELETE FROM cronograma_atividades WHERE processo_id = p_processo_id;

  SELECT modalidade_id INTO v_modalidade_id FROM processos WHERE id = p_processo_id;

  SELECT id INTO v_modelo_id FROM modelo_cronograma
  WHERE modalidade_id = v_modalidade_id AND ativo = true
  ORDER BY created_at DESC LIMIT 1;

  IF v_modelo_id IS NULL THEN
    RETURN;                                -- modalidade sem modelo: nada a semear
  END IF;

  FOR v_etapa IN
    SELECT * FROM modelo_etapa
    WHERE modelo_cronograma_id = v_modelo_id
    ORDER BY ordem
  LOOP
    IF v_etapa.ordem = 1 THEN
      v_data_atual := p_data_inicio;
    ELSE
      v_data_atual := v_data_fim_atividade + 1;
    END IF;

    -- marco (0 dias) termina no próprio dia útil; a cadeia continua
    v_data_fim_atividade := somar_dias_uteis(v_data_atual, v_etapa.duracao_dias_uteis);

    INSERT INTO cronograma_atividades
      (processo_id, ordem, dias_uteis, fase, descricao, setor, status,
       data_inicio, data_fim, modelo_etapa_id)
    VALUES
      (p_processo_id, v_etapa.ordem, v_etapa.duracao_dias_uteis, v_etapa.fase,
       v_etapa.descricao, v_etapa.setor, 'nao_iniciado',
       somar_dias_uteis(v_data_atual, 0), v_data_fim_atividade, v_etapa.id);
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Recálculo de todos os processos pelos modelos ativos
--    Generaliza recalc_cronograma_diop_preservo, que só alcançava modelos
--    'Cronograma DIOP%' — Dispensa e Inexigibilidade ficavam de fora.
--    Preserva status, responsável, datas reais e observação das etapas já
--    trabalhadas, casando etapa antiga com nova por similaridade de descrição.
--    Para simular sem gravar, use transação explícita:
--      begin;
--      select * from recalc_cronograma_modelos();
--      rollback;                          -- confira o relatório e desfaça
CREATE OR REPLACE FUNCTION recalc_cronograma_modelos()
RETURNS TABLE(processo_id uuid, nome_processo text, modalidade text, resultado text,
              etapas_novas bigint, concluidos_preservados bigint, em_andamento_preservados bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r RECORD; oldr RECORD; newr RECORD; best RECORD;
  best_score float8; s float8;
  cnt_c bigint; cnt_a bigint; cnt_n bigint;
  usados uuid[];
BEGIN
  FOR r IN
    SELECT p.id, p.id_processo, p.data_entrada, m.nome AS modi
    FROM processos p
    JOIN modalidades m ON m.id = p.modalidade_id
    WHERE p.data_entrada IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM modelo_cronograma mc
        WHERE mc.modalidade_id = p.modalidade_id AND mc.ativo = true
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

      cnt_c := 0; cnt_a := 0; cnt_n := 0; usados := ARRAY[]::uuid[];

      FOR newr IN
        SELECT ca.id, crono_normalize(ca.descricao) AS n
        FROM cronograma_atividades ca
        WHERE ca.processo_id = r.id ORDER BY ca.ordem
      LOOP
        cnt_n := cnt_n + 1;
        best := NULL; best_score := 0;

        FOR oldr IN
          SELECT * FROM _old_cron WHERE NOT (id = ANY(usados)) ORDER BY ordem
        LOOP
          s := crono_match_score(newr.n, oldr.n);
          IF s > best_score THEN best_score := s; best := oldr; END IF;
        END LOOP;

        IF best IS NOT NULL AND best_score >= 2 THEN
          UPDATE cronograma_atividades SET
            status = CASE WHEN best.status IN ('concluido', 'em_andamento')
                          THEN best.status ELSE 'nao_iniciado' END,
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

      processo_id := r.id; nome_processo := r.id_processo; modalidade := r.modi;
      resultado := 'OK'; etapas_novas := cnt_n;
      concluidos_preservados := cnt_c; em_andamento_preservados := cnt_a;
      RETURN NEXT;

    EXCEPTION WHEN OTHERS THEN
      processo_id := r.id; nome_processo := r.id_processo; modalidade := r.modi;
      resultado := 'ERRO: ' || SQLERRM; etapas_novas := 0;
      concluidos_preservados := 0; em_andamento_preservados := 0;
      RETURN NEXT;
    END;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION recalc_cronograma_modelos() IS
  'Regera o cronograma de todos os processos pelo modelo ativo da modalidade, preservando status, responsável, datas reais e observação. Grava ao ser chamada — para simular, envolva em begin/rollback.';
