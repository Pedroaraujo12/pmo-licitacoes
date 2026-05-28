-- Expose processo observations in dashboard/process search results so the
-- execution flow can display operational notes beside the current activity.

DROP FUNCTION IF EXISTS public.search_processos(
  text,
  uuid,
  uuid,
  uuid,
  uuid,
  date,
  date,
  text,
  int,
  int
);

CREATE OR REPLACE FUNCTION public.search_processos(
  p_search text DEFAULT NULL,
  p_status_id uuid DEFAULT NULL,
  p_modalidade_id uuid DEFAULT NULL,
  p_responsavel_id uuid DEFAULT NULL,
  p_coordenacao_id uuid DEFAULT NULL,
  p_data_inicio date DEFAULT NULL,
  p_data_fim date DEFAULT NULL,
  p_prioridade text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  id_processo text,
  objeto_resumido text,
  data_entrada date,
  data_entrega date,
  valor_estimado numeric,
  valor_homologado numeric,
  prioridade text,
  atividade_atual text,
  observacoes text,
  status_nome text,
  modalidade_nome text,
  responsavel_nome text,
  coordenacao_nome text,
  demandante_nome text,
  processo_atrasado boolean,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH filtered AS (
    SELECT
      p.id,
      p.id_processo,
      p.objeto_resumido,
      p.data_entrada,
      p.data_entrega,
      p.valor_estimado,
      p.valor_homologado,
      p.prioridade,
      p.atividade_atual,
      p.observacoes,
      sp.nome AS status_nome,
      m.nome AS modalidade_nome,
      r.nome AS responsavel_nome,
      c.nome AS coordenacao_nome,
      d.nome AS demandante_nome,
      p.data_entrega IS NOT NULL AND p.data_entrega < CURRENT_DATE AS processo_atrasado
    FROM public.processos p
    LEFT JOIN public.status_processo sp ON sp.id = p.status_id
    LEFT JOIN public.modalidades m ON m.id = p.modalidade_id
    LEFT JOIN public.responsaveis r ON r.id = p.responsavel_id
    LEFT JOIN public.coordenacoes c ON c.id = p.coordenacao_id
    LEFT JOIN public.demandantes d ON d.id = p.demandante_id
    WHERE
      (p_search IS NULL OR p.id_processo ILIKE '%' || p_search || '%' OR p.objeto_resumido ILIKE '%' || p_search || '%')
      AND (p_status_id IS NULL OR p.status_id = p_status_id)
      AND (p_modalidade_id IS NULL OR p.modalidade_id = p_modalidade_id)
      AND (p_responsavel_id IS NULL OR p.responsavel_id = p_responsavel_id)
      AND (p_coordenacao_id IS NULL OR p.coordenacao_id = p_coordenacao_id)
      AND (p_data_inicio IS NULL OR p.data_entrada >= p_data_inicio)
      AND (p_data_fim IS NULL OR p.data_entrada <= p_data_fim)
      AND (p_prioridade IS NULL OR p.prioridade = p_prioridade)
  )
  SELECT
    *,
    COUNT(*) OVER() AS total_count
  FROM filtered
  ORDER BY data_entrada DESC NULLS LAST
  LIMIT p_limit
  OFFSET p_offset;
$$;

REVOKE ALL ON FUNCTION public.search_processos(text, uuid, uuid, uuid, uuid, date, date, text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_processos(text, uuid, uuid, uuid, uuid, date, date, text, int, int) TO authenticated;
