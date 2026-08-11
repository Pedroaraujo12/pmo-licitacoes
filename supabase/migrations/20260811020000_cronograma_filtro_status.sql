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
