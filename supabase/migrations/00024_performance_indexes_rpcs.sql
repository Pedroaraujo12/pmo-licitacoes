-- ============================================================
-- FASE 9: Índices para performance
-- ============================================================

-- Processos
CREATE INDEX IF NOT EXISTS idx_processos_data_entrada ON processos (data_entrada DESC);
CREATE INDEX IF NOT EXISTS idx_processos_data_entrega ON processos (data_entrega);
CREATE INDEX IF NOT EXISTS idx_processos_status_id ON processos (status_id);
CREATE INDEX IF NOT EXISTS idx_processos_responsavel_id ON processos (responsavel_id);
CREATE INDEX IF NOT EXISTS idx_processos_modalidade_id ON processos (modalidade_id);
CREATE INDEX IF NOT EXISTS idx_processos_coordenacao_id ON processos (coordenacao_id);
CREATE INDEX IF NOT EXISTS idx_processos_id_processo ON processos (id_processo);

-- Busca textual (pg_trgm)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_processos_objeto_trgm ON processos USING gin (objeto_resumido gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_processos_id_processo_trgm ON processos USING gin (id_processo gin_trgm_ops);

-- Cronograma
CREATE INDEX IF NOT EXISTS idx_cronograma_processo_id ON cronograma_atividades (processo_id);
CREATE INDEX IF NOT EXISTS idx_cronograma_status ON cronograma_atividades (status);
CREATE INDEX IF NOT EXISTS idx_cronograma_data_fim ON cronograma_atividades (data_fim);
CREATE INDEX IF NOT EXISTS idx_cronograma_responsavel_id ON cronograma_atividades (responsavel_id);

-- Notas
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes (user_id);
CREATE INDEX IF NOT EXISTS idx_notes_status ON notes (status);
CREATE INDEX IF NOT EXISTS idx_notes_priority ON notes (priority);
CREATE INDEX IF NOT EXISTS idx_notes_reminder_at ON notes (reminder_at);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_processo_id ON notes (processo_id);
CREATE INDEX IF NOT EXISTS idx_notes_colaborador_id ON notes (colaborador_id);

-- Colaboradores
CREATE INDEX IF NOT EXISTS idx_colaboradores_user_id ON colaboradores (user_id);
CREATE INDEX IF NOT EXISTS idx_colaboradores_nome ON colaboradores (nome_completo);
CREATE INDEX IF NOT EXISTS idx_colaboradores_unidade ON colaboradores (unidade);
CREATE INDEX IF NOT EXISTS idx_colaboradores_situacao ON colaboradores (situacao);
CREATE INDEX IF NOT EXISTS idx_colaboradores_data_nascimento ON colaboradores (data_nascimento);

-- Atividades
CREATE INDEX IF NOT EXISTS idx_atividades_processo_id ON atividades (processo_id);
CREATE INDEX IF NOT EXISTS idx_atividades_atividade ON atividades (atividade);
CREATE INDEX IF NOT EXISTS idx_atividades_processo_atividade ON atividades (processo_id, atividade);

-- Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_id_role ON profiles (id, role);

-- ============================================================
-- FASE 3: get_layout_alerts
-- ============================================================

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

-- ============================================================
-- FASE 4: get_dashboard_summary
-- ============================================================

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

-- ============================================================
-- FASE 8: list_users_with_email
-- ============================================================

CREATE OR REPLACE FUNCTION public.list_users_with_email()
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  role text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    p.id,
    p.name,
    COALESCE(p.email, au.email) AS email,
    p.role,
    p.created_at
  FROM profiles p
  LEFT JOIN auth.users au ON au.id = p.id
  ORDER BY p.created_at DESC;
$$;

-- ============================================================
-- FASE 5+6: search_processos (busca + paginação server-side)
-- ============================================================

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
  status_nome text,
  modalidade_nome text,
  responsavel_nome text,
  coordenacao_nome text,
  demandante_nome text,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
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
      sp.nome AS status_nome,
      m.nome AS modalidade_nome,
      r.nome AS responsavel_nome,
      c.nome AS coordenacao_nome,
      d.nome AS demandante_nome
    FROM processos p
    LEFT JOIN status_processo sp ON sp.id = p.status_id
    LEFT JOIN modalidades m ON m.id = p.modalidade_id
    LEFT JOIN responsaveis r ON r.id = p.responsavel_id
    LEFT JOIN coordenacoes c ON c.id = p.coordenacao_id
    LEFT JOIN demandantes d ON d.id = p.demandante_id
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

-- ============================================================
-- get_cronograma_page: resumo do cronograma por processo
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_cronograma_page(
  p_search text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  id_processo text,
  objeto_resumido text,
  data_entrada date,
  data_entrega date,
  modalidade_nome text,
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
AS $$
  WITH processo_count AS (
    SELECT
      p.id,
      p.id_processo,
      p.objeto_resumido,
      p.data_entrada,
      p.data_entrega,
      m.nome AS modalidade_nome,
      COUNT(ca.id)::bigint AS total_atividades,
      COUNT(ca.id) FILTER (WHERE ca.status = 'concluido')::bigint AS concluidas,
      COUNT(ca.id) FILTER (WHERE ca.status <> 'concluido' AND ca.data_fim < CURRENT_DATE)::bigint AS atrasadas
    FROM processos p
    LEFT JOIN modalidades m ON m.id = p.modalidade_id
    LEFT JOIN cronograma_atividades ca ON ca.processo_id = p.id
    WHERE
      (p_search IS NULL OR p.id_processo ILIKE '%' || p_search || '%' OR p.objeto_resumido ILIKE '%' || p_search || '%')
    GROUP BY p.id, p.id_processo, p.objeto_resumido, p.data_entrada, p.data_entrega, m.nome
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

-- ============================================================
-- get_contrato_metricas: métricas agregadas do módulo contratos
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_contrato_metricas()
RETURNS TABLE (
  total bigint,
  vigentes bigint,
  vencendo_30d bigint,
  vencidos bigint,
  valor_contratado numeric,
  valor_executado numeric,
  saldo numeric,
  sem_fiscal bigint,
  sem_movimentacao bigint,
  pagamentos_pendentes bigint,
  os_em_execucao bigint,
  aditivos_andamento bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH c AS (
    SELECT
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE status IN ('vigente', 'proximo_vencimento'))::bigint AS vigentes,
      COUNT(*) FILTER (WHERE status = 'vencido')::bigint AS vencidos,
      COUNT(*) FILTER (
        WHERE status IN ('vigente', 'proximo_vencimento')
          AND data_fim_vigencia BETWEEN CURRENT_DATE AND CURRENT_DATE + 30
      )::bigint AS vencendo_30d,
      COALESCE(SUM(valor_atual), 0) AS valor_contratado,
      COALESCE(SUM(valor_executado), 0) AS valor_executado,
      COALESCE(SUM(valor_atual - COALESCE(valor_executado, 0)), 0) AS saldo,
      COUNT(*) FILTER (WHERE fiscal_tecnico_id IS NULL)::bigint AS sem_fiscal,
      COUNT(*) FILTER (WHERE updated_at < CURRENT_DATE - 30)::bigint AS sem_movimentacao
    FROM contratos
  )
  SELECT
    c.total,
    c.vigentes,
    c.vencendo_30d,
    c.vencidos,
    c.valor_contratado,
    c.valor_executado,
    c.saldo,
    c.sem_fiscal,
    c.sem_movimentacao,
    (SELECT COUNT(*)::bigint FROM contrato_pagamentos WHERE status IN ('aguardando_atesto', 'aguardando_liquidacao', 'aguardando_pagamento')) AS pagamentos_pendentes,
    (SELECT COUNT(*)::bigint FROM ordens_servico WHERE status = 'em_execucao') AS os_em_execucao,
    (SELECT COUNT(*)::bigint FROM contrato_aditivos WHERE status IN ('em_elaboracao', 'pendente_assinatura')) AS aditivos_andamento
  FROM c;
$$;
