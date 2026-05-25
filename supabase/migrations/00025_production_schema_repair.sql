-- ============================================================
-- Production repair: missing contracts schema + RLS hardening
-- Safe to run after partial application of migrations 00018-00024.
-- ============================================================

CREATE TABLE IF NOT EXISTS contratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid REFERENCES processos(id) ON DELETE SET NULL,
  numero_contrato text NOT NULL,
  ano integer NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  contratada_nome text NOT NULL,
  contratada_cnpj text,
  contratada_representante text,
  contratada_email text,
  contratada_telefone text,
  objeto text,
  categoria text,
  tipo_contratacao text,
  valor_inicial numeric(15,2) NOT NULL DEFAULT 0,
  valor_original numeric(15,2) NOT NULL DEFAULT 0,
  total_aditivos numeric(15,2) NOT NULL DEFAULT 0,
  valor_atual numeric(15,2) NOT NULL DEFAULT 0,
  valor_executado numeric(15,2) NOT NULL DEFAULT 0,
  valor_pago numeric(15,2) NOT NULL DEFAULT 0,
  data_assinatura date,
  data_publicacao date,
  data_inicio_vigencia date,
  data_fim_vigencia date,
  data_limite_renovacao date,
  data_encerramento date,
  status text NOT NULL DEFAULT 'minuta',
  gestor_id uuid REFERENCES colaboradores(id) ON DELETE SET NULL,
  fiscal_tecnico_id uuid REFERENCES colaboradores(id) ON DELETE SET NULL,
  fiscal_administrativo_id uuid REFERENCES colaboradores(id) ON DELETE SET NULL,
  fiscal_substituto_id uuid REFERENCES colaboradores(id) ON DELETE SET NULL,
  unidade_id uuid,
  coordenacao_id uuid REFERENCES coordenacoes(id) ON DELETE SET NULL,
  link_sei text,
  link_drive text,
  permite_renovacao boolean NOT NULL DEFAULT true,
  permite_aditivo boolean NOT NULL DEFAULT true,
  tem_garantia boolean NOT NULL DEFAULT false,
  tem_ordem_servico boolean NOT NULL DEFAULT false,
  execucao_continua boolean NOT NULL DEFAULT false,
  emergencial boolean NOT NULL DEFAULT false,
  observacoes text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE contratos
  ADD COLUMN IF NOT EXISTS valor_original numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_aditivos numeric(15,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS ordens_servico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
  processo_id uuid REFERENCES processos(id) ON DELETE SET NULL,
  numero_os text NOT NULL,
  objeto text,
  descricao text,
  valor numeric(15,2) NOT NULL DEFAULT 0,
  valor_medido numeric(15,2) NOT NULL DEFAULT 0,
  valor_pago numeric(15,2) NOT NULL DEFAULT 0,
  data_emissao date,
  data_inicio date,
  data_fim_prevista date,
  data_fim_real date,
  status text NOT NULL DEFAULT 'rascunho',
  solicitante_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  fiscal_id uuid REFERENCES colaboradores(id) ON DELETE SET NULL,
  contratada_responsavel text,
  percentual_execucao numeric(5,2) NOT NULL DEFAULT 0,
  local_execucao text,
  observacoes text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contrato_aditivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
  numero_aditivo text NOT NULL,
  tipo text NOT NULL,
  justificativa text,
  valor_anterior numeric(15,2) NOT NULL DEFAULT 0,
  valor_alteracao numeric(15,2) NOT NULL DEFAULT 0,
  valor_novo numeric(15,2) NOT NULL DEFAULT 0,
  vigencia_anterior_fim date,
  vigencia_nova_fim date,
  data_assinatura date,
  data_publicacao date,
  status text NOT NULL DEFAULT 'em_elaboracao',
  link_sei text,
  documento_url text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contrato_medicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
  ordem_servico_id uuid REFERENCES ordens_servico(id) ON DELETE SET NULL,
  numero_medicao text NOT NULL,
  competencia text,
  periodo_inicio date,
  periodo_fim date,
  valor_medido numeric(15,2) NOT NULL DEFAULT 0,
  percentual_executado numeric(5,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'em_elaboracao',
  fiscal_id uuid REFERENCES colaboradores(id) ON DELETE SET NULL,
  observacoes text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contrato_pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
  ordem_servico_id uuid REFERENCES ordens_servico(id) ON DELETE SET NULL,
  medicao_id uuid REFERENCES contrato_medicoes(id) ON DELETE SET NULL,
  numero_nota_fiscal text NOT NULL,
  valor numeric(15,2) NOT NULL DEFAULT 0,
  data_emissao_nf date,
  data_vencimento date,
  data_atesto date,
  data_pagamento date,
  status text NOT NULL DEFAULT 'aguardando_nf',
  observacoes text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contrato_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
  ordem_servico_id uuid REFERENCES ordens_servico(id) ON DELETE SET NULL,
  medicao_id uuid REFERENCES contrato_medicoes(id) ON DELETE SET NULL,
  tipo_documento text NOT NULL,
  nome text NOT NULL,
  url text,
  status text NOT NULL DEFAULT 'pendente',
  obrigatorio boolean NOT NULL DEFAULT false,
  validado_por uuid REFERENCES profiles(id) ON DELETE SET NULL,
  validado_em timestamptz,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contrato_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
  entidade text NOT NULL,
  entidade_id uuid,
  acao text NOT NULL,
  descricao text,
  valor_anterior text,
  valor_novo text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contratos_processo_id ON contratos(processo_id);
CREATE INDEX IF NOT EXISTS idx_contratos_status ON contratos(status);
CREATE INDEX IF NOT EXISTS idx_contratos_data_fim ON contratos(data_fim_vigencia);
CREATE INDEX IF NOT EXISTS idx_contratos_fiscal_tecnico ON contratos(fiscal_tecnico_id);
CREATE INDEX IF NOT EXISTS idx_contratos_contratada ON contratos(contratada_nome);
CREATE INDEX IF NOT EXISTS idx_contratos_numero ON contratos(numero_contrato);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_contrato ON ordens_servico(contrato_id);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_status ON ordens_servico(status);
CREATE INDEX IF NOT EXISTS idx_aditivos_contrato ON contrato_aditivos(contrato_id);
CREATE INDEX IF NOT EXISTS idx_medicoes_contrato ON contrato_medicoes(contrato_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_contrato ON contrato_pagamentos(contrato_id);
CREATE INDEX IF NOT EXISTS idx_contrato_docs_contrato ON contrato_documentos(contrato_id);
CREATE INDEX IF NOT EXISTS idx_contrato_historico ON contrato_historico(contrato_id);

ALTER TABLE contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordens_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE contrato_aditivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE contrato_medicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE contrato_pagamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE contrato_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE contrato_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_generated ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE colaborador_favoritos ENABLE ROW LEVEL SECURITY;
ALTER TABLE colaborador_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY contratos_select ON contratos FOR SELECT USING (auth.role() = 'authenticated');
  CREATE POLICY contratos_write ON contratos FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor', 'consultor'))) WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor', 'consultor')));
  CREATE POLICY os_select ON ordens_servico FOR SELECT USING (auth.role() = 'authenticated');
  CREATE POLICY os_write ON ordens_servico FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor', 'consultor'))) WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor', 'consultor')));
  CREATE POLICY aditivos_select ON contrato_aditivos FOR SELECT USING (auth.role() = 'authenticated');
  CREATE POLICY aditivos_write ON contrato_aditivos FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor'))) WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor')));
  CREATE POLICY medicoes_select ON contrato_medicoes FOR SELECT USING (auth.role() = 'authenticated');
  CREATE POLICY medicoes_write ON contrato_medicoes FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor', 'consultor'))) WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor', 'consultor')));
  CREATE POLICY pagamentos_select ON contrato_pagamentos FOR SELECT USING (auth.role() = 'authenticated');
  CREATE POLICY pagamentos_write ON contrato_pagamentos FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor', 'consultor'))) WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor', 'consultor')));
  CREATE POLICY contrato_docs_select ON contrato_documentos FOR SELECT USING (auth.role() = 'authenticated');
  CREATE POLICY contrato_docs_write ON contrato_documentos FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor', 'consultor'))) WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor', 'consultor')));
  CREATE POLICY contrato_historico_select ON contrato_historico FOR SELECT USING (auth.role() = 'authenticated');
  CREATE POLICY contrato_historico_insert ON contrato_historico FOR INSERT WITH CHECK (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY document_templates_select ON document_templates FOR SELECT USING (auth.role() = 'authenticated');
  CREATE POLICY document_templates_write ON document_templates FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor'))) WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor')));
  CREATE POLICY template_versions_select ON template_versions FOR SELECT USING (auth.role() = 'authenticated');
  CREATE POLICY template_versions_write ON template_versions FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor'))) WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor')));
  CREATE POLICY document_generated_select ON document_generated FOR SELECT USING (auth.role() = 'authenticated');
  CREATE POLICY document_generated_insert ON document_generated FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  CREATE POLICY template_usage_log_select ON template_usage_log FOR SELECT USING (auth.role() = 'authenticated');
  CREATE POLICY template_usage_log_insert ON template_usage_log FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  CREATE POLICY template_favorites_own ON template_favorites FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  CREATE POLICY colaboradores_select ON colaboradores FOR SELECT USING (auth.role() = 'authenticated');
  CREATE POLICY colaboradores_write ON colaboradores FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor'))) WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor')));
  CREATE POLICY colaborador_favoritos_own ON colaborador_favoritos FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  CREATE POLICY colaborador_logs_select ON colaborador_logs FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor')));
  CREATE POLICY notes_own ON notes FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

CREATE OR REPLACE FUNCTION public.recalcular_valores_contrato()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  _contrato_id uuid;
BEGIN
  _contrato_id := COALESCE(NEW.contrato_id, OLD.contrato_id);

  UPDATE contratos c
  SET
    total_aditivos = COALESCE((
      SELECT SUM(CASE WHEN a.tipo = 'supressao' THEN -ABS(a.valor_alteracao) ELSE ABS(a.valor_alteracao) END)
      FROM contrato_aditivos a
      WHERE a.contrato_id = _contrato_id
        AND a.tipo IN ('acrescimo', 'supressao', 'aditivo_valor', 'aditivo_prazo_valor', 'reequilibrio', 'apostilamento')
    ), 0),
    valor_atual = COALESCE(NULLIF(c.valor_original, 0), c.valor_inicial, 0) + COALESCE((
      SELECT SUM(CASE WHEN a.tipo = 'supressao' THEN -ABS(a.valor_alteracao) ELSE ABS(a.valor_alteracao) END)
      FROM contrato_aditivos a
      WHERE a.contrato_id = _contrato_id
        AND a.tipo IN ('acrescimo', 'supressao', 'aditivo_valor', 'aditivo_prazo_valor', 'reequilibrio', 'apostilamento')
    ), 0)
  WHERE c.id = _contrato_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_recalcular_valores_aditivo ON contrato_aditivos;
CREATE TRIGGER trigger_recalcular_valores_aditivo
  AFTER INSERT OR UPDATE OR DELETE ON contrato_aditivos
  FOR EACH ROW EXECUTE FUNCTION recalcular_valores_contrato();

CREATE OR REPLACE FUNCTION public.get_layout_alerts(p_user_id uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN jsonb_build_object(
    'processos_atrasados', (SELECT COUNT(*)::int FROM processos WHERE data_entrega < CURRENT_DATE),
    'proximos_vencimentos', (
      SELECT COUNT(*)::int FROM cronograma_atividades
      WHERE status <> 'concluido'
        AND data_fim >= CURRENT_DATE
        AND data_fim <= CURRENT_DATE + INTERVAL '3 days'
    ),
    'contratos_alertas', (
      SELECT COUNT(*)::int FROM contratos
      WHERE status IN ('vigente', 'proximo_vencimento')
        AND data_fim_vigencia <= CURRENT_DATE
    ) + (
      SELECT COUNT(*)::int FROM ordens_servico
      WHERE status NOT IN ('concluida', 'cancelada')
        AND data_fim_prevista < CURRENT_DATE
    ),
    'sem_colaborador', (SELECT NOT EXISTS (SELECT 1 FROM colaboradores WHERE user_id = p_user_id))
  );
END;
$$;

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
SET search_path = public
AS $$
  SELECT
    COUNT(*)::bigint,
    COUNT(*) FILTER (WHERE status IN ('vigente', 'proximo_vencimento'))::bigint,
    COUNT(*) FILTER (WHERE status IN ('vigente', 'proximo_vencimento') AND data_fim_vigencia BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days')::bigint,
    COUNT(*) FILTER (WHERE data_fim_vigencia < CURRENT_DATE AND status NOT IN ('encerrado', 'rescindido'))::bigint,
    COALESCE(SUM(valor_atual), 0),
    COALESCE(SUM(valor_executado), 0),
    COALESCE(SUM(valor_atual - valor_executado), 0),
    COUNT(*) FILTER (WHERE fiscal_tecnico_id IS NULL)::bigint,
    COUNT(*) FILTER (WHERE updated_at < now() - INTERVAL '30 days')::bigint,
    (SELECT COUNT(*) FROM contrato_pagamentos WHERE status IN ('aguardando_nf', 'aguardando_atesto', 'aguardando_liquidacao', 'aguardando_pagamento'))::bigint,
    (SELECT COUNT(*) FROM ordens_servico WHERE status = 'em_execucao')::bigint,
    (SELECT COUNT(*) FROM contrato_aditivos WHERE status NOT IN ('assinado', 'publicado', 'cancelado'))::bigint
  FROM contratos;
$$;
