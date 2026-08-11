-- ============================================================================
-- PMO Licitações — aplicar de uma vez (partes 1 a 3)
-- ============================================================================
-- Cole tudo no SQL Editor do Supabase e execute uma única vez.
--
-- Estas três partes são ADITIVAS e IDEMPOTENTES: criam ou substituem funções
-- e inserem feriados com ON CONFLICT DO NOTHING. Nenhum cronograma de processo
-- é reescrito aqui — rodar duas vezes não causa dano.
--
-- O recálculo dos 66 processos é uma etapa SEPARADA e destrutiva. Está em
-- RECALCULO-PASSO-A-PASSO.md e exige backup antes. Não faça os dois de uma vez.
--
-- Ao final, o bloco de verificação mostra se tudo entrou como esperado.
-- ============================================================================


-- ==========================================================================
-- PARTE 1/3 — Calendário de feriados até 2030 (+ Consciência Negra)
-- origem: supabase/migrations/20260811000000_feriados_2028_2030.sql
-- ==========================================================================

-- ============================================
-- Feriados nacionais 2028-2030
-- ============================================
-- O seed original (00002_cronograma.sql) cobre 2026-2027. Fora do período
-- cadastrado, `somar_dias_uteis` desconta apenas fins de semana e projeta
-- datas otimistas — um cronograma longo (Concorrência, 107 dias úteis)
-- iniciado no fim de 2027 já ultrapassa esse limite.
--
-- Feriados móveis calculados a partir do Domingo de Páscoa:
--   Carnaval        = Páscoa - 48 e - 47
--   Sexta-Feira Santa = Páscoa - 2
--   Corpus Christi  = Páscoa + 60
--   Páscoa: 2028-04-16 | 2029-04-01 | 2030-04-21
--
-- Consciência Negra (20/11) entra como feriado nacional (Lei 14.759/2023),
-- ausente do seed original.

INSERT INTO feriados (data, nome, tipo) VALUES
  ('2028-01-01', 'Confraternização Universal', 'nacional'),
  ('2028-02-28', 'Carnaval', 'nacional'),
  ('2028-02-29', 'Carnaval', 'nacional'),
  ('2028-04-14', 'Sexta-Feira Santa', 'nacional'),
  ('2028-04-21', 'Tiradentes', 'nacional'),
  ('2028-05-01', 'Dia do Trabalho', 'nacional'),
  ('2028-06-15', 'Corpus Christi', 'nacional'),
  ('2028-09-07', 'Independência do Brasil', 'nacional'),
  ('2028-10-12', 'Nossa Sra. Aparecida', 'nacional'),
  ('2028-11-02', 'Finados', 'nacional'),
  ('2028-11-15', 'Proclamação da República', 'nacional'),
  ('2028-11-20', 'Consciência Negra', 'nacional'),
  ('2028-12-25', 'Natal', 'nacional'),

  ('2029-01-01', 'Confraternização Universal', 'nacional'),
  ('2029-02-12', 'Carnaval', 'nacional'),
  ('2029-02-13', 'Carnaval', 'nacional'),
  ('2029-03-30', 'Sexta-Feira Santa', 'nacional'),
  ('2029-04-21', 'Tiradentes', 'nacional'),
  ('2029-05-01', 'Dia do Trabalho', 'nacional'),
  ('2029-05-31', 'Corpus Christi', 'nacional'),
  ('2029-09-07', 'Independência do Brasil', 'nacional'),
  ('2029-10-12', 'Nossa Sra. Aparecida', 'nacional'),
  ('2029-11-02', 'Finados', 'nacional'),
  ('2029-11-15', 'Proclamação da República', 'nacional'),
  ('2029-11-20', 'Consciência Negra', 'nacional'),
  ('2029-12-25', 'Natal', 'nacional'),

  ('2030-01-01', 'Confraternização Universal', 'nacional'),
  ('2030-03-04', 'Carnaval', 'nacional'),
  ('2030-03-05', 'Carnaval', 'nacional'),
  ('2030-04-19', 'Sexta-Feira Santa', 'nacional'),
  ('2030-04-21', 'Tiradentes', 'nacional'),
  ('2030-05-01', 'Dia do Trabalho', 'nacional'),
  ('2030-06-20', 'Corpus Christi', 'nacional'),
  ('2030-09-07', 'Independência do Brasil', 'nacional'),
  ('2030-10-12', 'Nossa Sra. Aparecida', 'nacional'),
  ('2030-11-02', 'Finados', 'nacional'),
  ('2030-11-15', 'Proclamação da República', 'nacional'),
  ('2030-11-20', 'Consciência Negra', 'nacional'),
  ('2030-12-25', 'Natal', 'nacional')
ON CONFLICT (data) DO NOTHING;

-- Consciência Negra nos anos já cadastrados (o seed 00002 não o incluía)
INSERT INTO feriados (data, nome, tipo) VALUES
  ('2026-11-20', 'Consciência Negra', 'nacional'),
  ('2027-11-20', 'Consciência Negra', 'nacional')
ON CONFLICT (data) DO NOTHING;


-- ==========================================================================
-- PARTE 2/3 — Marcos deixam de zerar a cadeia de datas
-- origem: supabase/migrations/20260811010000_fix_marco_e_recalc_modelos.sql
-- ==========================================================================

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


-- ==========================================================================
-- PARTE 3/3 — Cronograma de Processos filtra por status
-- origem: supabase/migrations/20260811020000_cronograma_filtro_status.sql
-- ==========================================================================

-- ============================================
-- Cronograma de Processos: filtrar por status
-- ============================================
-- A tela de Cronograma serve para acompanhar o que está em execução, mas
-- get_cronograma_page listava todos os processos — inclusive concluídos,
-- cancelados, devolvidos e não recebidos. Com 66 cadastrados e 21 em
-- andamento, dois terços da tela eram ruído.
--
-- Acrescenta p_status (opcional) e devolve status_nome, para a tela poder
-- filtrar e exibir. Sem p_status o comportamento é o de antes.
-- ============================================

DROP FUNCTION IF EXISTS public.get_cronograma_page(text, int, int);

CREATE OR REPLACE FUNCTION public.get_cronograma_page(
  p_search text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0,
  p_status text[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  id_processo text,
  objeto_resumido text,
  data_entrada date,
  data_entrega date,
  modalidade_nome text,
  status_nome text,
  total_atividades bigint,
  concluidas bigint,
  atrasadas bigint,
  ultima_fase text,
  progresso int,
  processo_atrasado boolean,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH processo_count AS (
    SELECT
      p.id,
      p.id_processo,
      p.objeto_resumido,
      p.data_entrada,
      p.data_entrega,
      m.nome AS modalidade_nome,
      sp.nome AS status_nome,
      COUNT(ca.id)::bigint AS total_atividades,
      COUNT(ca.id) FILTER (WHERE ca.status = 'concluido')::bigint AS concluidas,
      COUNT(ca.id) FILTER (WHERE ca.status <> 'concluido' AND ca.data_fim < CURRENT_DATE)::bigint AS atrasadas
    FROM processos p
    LEFT JOIN modalidades m ON m.id = p.modalidade_id
    LEFT JOIN status_processo sp ON sp.id = p.status_id
    LEFT JOIN cronograma_atividades ca ON ca.processo_id = p.id
    WHERE
      (p_search IS NULL OR p.id_processo ILIKE '%' || p_search || '%' OR p.objeto_resumido ILIKE '%' || p_search || '%')
      AND (p_status IS NULL OR sp.nome = ANY(p_status))
    GROUP BY p.id, p.id_processo, p.objeto_resumido, p.data_entrada, p.data_entrega, m.nome, sp.nome
  ),
  ultimas_fases AS (
    SELECT DISTINCT ON (ca.processo_id)
      ca.processo_id,
      ca.fase AS ultima_fase
    FROM cronograma_atividades ca
    WHERE ca.status <> 'concluido'
    ORDER BY ca.processo_id, ca.ordem DESC
  )
  SELECT
    pc.id,
    pc.id_processo,
    pc.objeto_resumido,
    pc.data_entrada,
    pc.data_entrega,
    pc.modalidade_nome,
    pc.status_nome,
    pc.total_atividades,
    pc.concluidas,
    pc.atrasadas,
    uf.ultima_fase,
    CASE WHEN pc.total_atividades > 0
      THEN (pc.concluidas * 100 / pc.total_atividades)::int
      ELSE 0
    END AS progresso,
    (pc.atrasadas > 0 OR (pc.data_entrega IS NOT NULL AND pc.data_entrega < CURRENT_DATE AND pc.concluidas < pc.total_atividades)) AS processo_atrasado,
    COUNT(*) OVER() AS total_count
  FROM processo_count pc
  LEFT JOIN ultimas_fases uf ON uf.processo_id = pc.id
  ORDER BY pc.data_entrega NULLS LAST
  LIMIT p_limit
  OFFSET p_offset;
$$;

COMMENT ON FUNCTION public.get_cronograma_page(text, int, int, text[]) IS
  'Resumo do cronograma por processo. p_status filtra pelos nomes de status_processo (ex: ARRAY[''Em andamento'']); NULL traz todos.';




-- ============================================================================
-- VERIFICAÇÃO — confira estes números depois de executar
-- ============================================================================

-- 1. Feriados: 2026 a 2030, 13 por ano (12 + Consciência Negra)
select extract(year from data)::int as ano, count(*) as feriados
  from feriados
 where data >= '2026-01-01'
 group by 1 order by 1;

-- 2. Contagem de dias úteis (esperado ao lado de cada linha)
select somar_dias_uteis('2026-08-10'::date, 0) as marco,          -- 2026-08-10
       somar_dias_uteis('2026-08-08'::date, 0) as marco_sabado,   -- 2026-08-10
       somar_dias_uteis('2026-08-10'::date, 1) as um_dia,         -- 2026-08-10
       somar_dias_uteis('2026-09-01'::date, 5) as com_feriado,    -- 2026-09-08
       somar_dias_uteis(null, 5)               as nulo;           -- null (não trava)

-- 3. Filtro de status na tela de Cronograma: deve devolver só os em andamento
select count(*) as processos_em_andamento
  from get_cronograma_page(null, 500, 0, ARRAY['Em andamento']);

-- 4. Total geral, para comparar
select count(*) as processos_todos
  from get_cronograma_page(null, 500, 0, null);

-- 5. Diagnóstico do que o recálculo terá pela frente (nada é alterado aqui)
select 'etapas sem data (bug do marco)' as item, count(*)::text as valor
  from cronograma_atividades where data_fim is null
union all
select 'etapas com cronograma antigo', count(*)::text
  from cronograma_atividades where modelo_etapa_id is null
union all
select 'etapas com prazo ajustado à mão', count(*)::text
  from cronograma_atividades where overridden = true
union all
select 'etapas concluídas (a preservar)', count(*)::text
  from cronograma_atividades where status = 'concluido';
