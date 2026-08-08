-- Correção: processos com status terminal não devem contar como atrasados
-- (ex.: "Concluído", "Cancelado", "Devolvido" têm data_entrega no passado, mas
--  já não estão pendentes). Afeta contagens de KPI (dashboard) e badge (sidebar).

CREATE OR REPLACE FUNCTION public.get_layout_alerts(p_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'processos_atrasados', (
      SELECT COUNT(*)::int
      FROM processos p
      WHERE p.data_entrega < CURRENT_DATE
        AND p.status_processo NOT IN ('Concluído', 'Homologado', 'Cancelado', 'Devolvido', 'Suspenso')
    ),
    'proximos_vencimentos', (
      SELECT COUNT(*)::int
      FROM cronograma_atividades ca
      WHERE ca.status <> 'concluido'
        AND ca.data_fim >= CURRENT_DATE
        AND ca.data_fim <= CURRENT_DATE + INTERVAL '3 days'
    ),
    'contratos_alertas', (
      SELECT COUNT(*)::int
      FROM contratos
      WHERE status IN ('vigente', 'proximo_vencimento')
        AND data_fim_vigencia <= CURRENT_DATE
    ) + (
      SELECT COUNT(*)::int
      FROM ordens_servico
      WHERE status NOT IN ('concluida', 'cancelada')
        AND data_fim_prevista < CURRENT_DATE
    ),
    'sem_colaborador', (
      SELECT NOT EXISTS (
        SELECT 1 FROM colaboradores WHERE user_id = p_user_id
      )
    )
  ) INTO result;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_dashboard_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_processos', (SELECT COUNT(*)::int FROM processos),
    'processos_atrasados', (
      SELECT COUNT(*)::int
      FROM processos
      WHERE data_entrega < CURRENT_DATE
        AND status_processo NOT IN ('Concluído', 'Homologado', 'Cancelado', 'Devolvido', 'Suspenso')
    ),
    'processos_vencendo_7_dias', (
      SELECT COUNT(*)::int
      FROM processos
      WHERE data_entrega BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
    ),
    'valor_estimado_total', (
      SELECT COALESCE(SUM(valor_estimado), 0) FROM processos
    ),
    'valor_homologado_total', (
      SELECT COALESCE(SUM(valor_homologado), 0) FROM processos
    ),
    'economia_total', (
      SELECT COALESCE(SUM(valor_estimado - valor_homologado), 0)
      FROM processos
      WHERE status_processo IN ('Concluído', 'Homologado')
    ),
    'por_status', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('status', sp.nome, 'total', x.total)), '[]'::jsonb)
      FROM (
        SELECT sp.nome, COUNT(*)::int AS total
        FROM processos p
        LEFT JOIN status_processo sp ON sp.id = p.status_id
        GROUP BY sp.nome
        ORDER BY total DESC
      ) x
    ),
    'por_modalidade', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('modalidade', m.nome, 'total', x.total)), '[]'::jsonb)
      FROM (
        SELECT m.nome, COUNT(*)::int AS total
        FROM processos p
        LEFT JOIN modalidades m ON m.id = p.modalidade_id
        GROUP BY m.nome
        ORDER BY total DESC
      ) x
    ),
    'etapa_distribuicao', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('fase', x.fase, 'qtd', x.qtd)), '[]'::jsonb)
      FROM (
        SELECT atividade_atual AS fase, COUNT(*)::int AS qtd
        FROM processos
        WHERE atividade_atual IS NOT NULL AND atividade_atual <> ''
        GROUP BY atividade_atual
        ORDER BY qtd DESC
      ) x
    ),
    'aniversariantes_15_dias', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('id', c.id, 'nome', c.nome_completo, 'dia', EXTRACT(DAY FROM c.data_nascimento)::int, 'mes', EXTRACT(MONTH FROM c.data_nascimento)::int, 'unidade', c.unidade)), '[]'::jsonb)
      FROM colaboradores c
      WHERE c.data_nascimento IS NOT NULL
        AND (
          (EXTRACT(MONTH FROM c.data_nascimento) > EXTRACT(MONTH FROM CURRENT_DATE))
          OR (EXTRACT(MONTH FROM c.data_nascimento) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(DAY FROM c.data_nascimento) >= EXTRACT(DAY FROM CURRENT_DATE))
        )
        AND (
          (EXTRACT(MONTH FROM c.data_nascimento) < EXTRACT(MONTH FROM CURRENT_DATE) + INTERVAL '1 month' AND EXTRACT(DAY FROM c.data_nascimento) <= EXTRACT(DAY FROM CURRENT_DATE) + 15)
          OR (EXTRACT(MONTH FROM c.data_nascimento) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(DAY FROM c.data_nascimento) <= EXTRACT(DAY FROM CURRENT_DATE) + 15)
        )
      LIMIT 20
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- search_processos também emite processo_atrasado (usado pelo front em filtros
-- e indicação de "atrasado") — aplicar a mesma regra de exclusão de status terminais.
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
      p.data_entrega IS NOT NULL AND p.data_entrega < CURRENT_DATE
        AND COALESCE(sp.nome, '') NOT IN ('Concluído', 'Homologado', 'Cancelado', 'Devolvido', 'Suspenso') AS processo_atrasado
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
