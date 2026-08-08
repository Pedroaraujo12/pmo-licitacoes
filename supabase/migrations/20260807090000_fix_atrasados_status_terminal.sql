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
