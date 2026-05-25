-- Migration: 00022_contratos
-- Módulo Gestão de Contratos — ciclo pós-licitação

-- ============================================================
-- 1. CONTRATOS
-- ============================================================
CREATE TABLE contratos (
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
  valor_atual numeric(15,2) NOT NULL DEFAULT 0,
  valor_executado numeric(15,2) NOT NULL DEFAULT 0,
  valor_pago numeric(15,2) NOT NULL DEFAULT 0,
  data_assinatura date,
  data_publicacao date,
  data_inicio_vigencia date,
  data_fim_vigencia date,
  data_limite_renovacao date,
  data_encerramento date,
  status text NOT NULL DEFAULT 'minuta'
    CHECK (status IN (
      'minuta', 'aguardando_assinatura', 'aguardando_publicacao',
      'vigente', 'suspenso', 'proximo_vencimento',
      'vencido', 'encerrado', 'rescindido'
    )),
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

CREATE INDEX idx_contratos_processo_id ON contratos(processo_id);
CREATE INDEX idx_contratos_status ON contratos(status);
CREATE INDEX idx_contratos_data_fim ON contratos(data_fim_vigencia);
CREATE INDEX idx_contratos_fiscal_tecnico ON contratos(fiscal_tecnico_id);
CREATE INDEX idx_contratos_contratada ON contratos(contratada_nome);
CREATE INDEX idx_contratos_numero ON contratos(numero_contrato);

-- ============================================================
-- 2. ORDENS DE SERVIÇO
-- ============================================================
CREATE TABLE ordens_servico (
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
  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN (
      'rascunho', 'emitida', 'em_execucao', 'pausada',
      'aguardando_medicao', 'medida', 'paga',
      'concluida', 'cancelada'
    )),
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

CREATE INDEX idx_ordens_servico_contrato ON ordens_servico(contrato_id);
CREATE INDEX idx_ordens_servico_status ON ordens_servico(status);
CREATE INDEX idx_ordens_servico_fiscal ON ordens_servico(fiscal_id);
CREATE INDEX idx_ordens_servico_processo ON ordens_servico(processo_id);

-- ============================================================
-- 3. ADITIVOS
-- ============================================================
CREATE TABLE contrato_aditivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
  numero_aditivo text NOT NULL,
  tipo text NOT NULL
    CHECK (tipo IN (
      'aditivo_prazo', 'aditivo_valor', 'aditivo_prazo_valor',
      'supressao', 'acrescimo', 'reequilibrio',
      'apostilamento', 'prorrogacao'
    )),
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

CREATE INDEX idx_aditivos_contrato ON contrato_aditivos(contrato_id);

-- ============================================================
-- 4. MEDIÇÕES
-- ============================================================
CREATE TABLE contrato_medicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
  ordem_servico_id uuid REFERENCES ordens_servico(id) ON DELETE SET NULL,
  numero_medicao text NOT NULL,
  competencia text,
  periodo_inicio date,
  periodo_fim date,
  valor_medido numeric(15,2) NOT NULL DEFAULT 0,
  percentual_executado numeric(5,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'em_elaboracao'
    CHECK (status IN (
      'em_elaboracao', 'enviada', 'em_analise', 'aprovada',
      'reprovada', 'retificada', 'encaminhada_pagamento'
    )),
  fiscal_id uuid REFERENCES colaboradores(id) ON DELETE SET NULL,
  observacoes text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_medicoes_contrato ON contrato_medicoes(contrato_id);
CREATE INDEX idx_medicoes_os ON contrato_medicoes(ordem_servico_id);
CREATE INDEX idx_medicoes_status ON contrato_medicoes(status);

-- ============================================================
-- 5. PAGAMENTOS
-- ============================================================
CREATE TABLE contrato_pagamentos (
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
  status text NOT NULL DEFAULT 'aguardando_nf'
    CHECK (status IN (
      'aguardando_nf', 'aguardando_atesto', 'aguardando_liquidacao',
      'aguardando_pagamento', 'pago', 'pago_atraso',
      'glosado', 'cancelado'
    )),
  observacoes text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pagamentos_contrato ON contrato_pagamentos(contrato_id);
CREATE INDEX idx_pagamentos_os ON contrato_pagamentos(ordem_servico_id);
CREATE INDEX idx_pagamentos_medicao ON contrato_pagamentos(medicao_id);
CREATE INDEX idx_pagamentos_status ON contrato_pagamentos(status);

-- ============================================================
-- 6. DOCUMENTOS DO CONTRATO
-- ============================================================
CREATE TABLE contrato_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
  ordem_servico_id uuid REFERENCES ordens_servico(id) ON DELETE SET NULL,
  medicao_id uuid REFERENCES contrato_medicoes(id) ON DELETE SET NULL,
  tipo_documento text NOT NULL
    CHECK (tipo_documento IN (
      'instrumento_contratual', 'publicacao', 'proposta_vencedora',
      'termo_referencia', 'garantia', 'certidoes',
      'designacao_fiscal', 'ordem_servico', 'aditivo',
      'apostilamento', 'termo_encerramento', 'outro'
    )),
  nome text NOT NULL,
  url text,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'anexado', 'validado', 'dispensado')),
  obrigatorio boolean NOT NULL DEFAULT false,
  validado_por uuid REFERENCES profiles(id) ON DELETE SET NULL,
  validado_em timestamptz,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contrato_docs_contrato ON contrato_documentos(contrato_id);
CREATE INDEX idx_contrato_docs_os ON contrato_documentos(ordem_servico_id);

-- ============================================================
-- 7. HISTÓRICO DO CONTRATO
-- ============================================================
CREATE TABLE contrato_historico (
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

CREATE INDEX idx_contrato_historico ON contrato_historico(contrato_id);

-- ============================================================
-- RLS — todas as tabelas
-- ============================================================
ALTER TABLE contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordens_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE contrato_aditivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE contrato_medicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE contrato_pagamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE contrato_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE contrato_historico ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados podem ler tudo (para static export via localStorage)
CREATE POLICY "contratos_select" ON contratos FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "ordens_servico_select" ON ordens_servico FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "aditivos_select" ON contrato_aditivos FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "medicoes_select" ON contrato_medicoes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "pagamentos_select" ON contrato_pagamentos FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "docs_select" ON contrato_documentos FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "historico_select" ON contrato_historico FOR SELECT USING (auth.role() = 'authenticated');

-- Apenas admin/gestor podem inserir/atualizar/deletar
CREATE POLICY "contratos_insert" ON contratos FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor'))
);
CREATE POLICY "contratos_update" ON contratos FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor', 'consultor'))
);
CREATE POLICY "contratos_delete" ON contratos FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor'))
);

CREATE POLICY "os_insert" ON ordens_servico FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor', 'consultor'))
);
CREATE POLICY "os_update" ON ordens_servico FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor', 'consultor'))
);
CREATE POLICY "os_delete" ON ordens_servico FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor'))
);

CREATE POLICY "aditivos_insert" ON contrato_aditivos FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor'))
);
CREATE POLICY "aditivos_update" ON contrato_aditivos FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor'))
);
CREATE POLICY "aditivos_delete" ON contrato_aditivos FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor'))
);

CREATE POLICY "medicoes_insert" ON contrato_medicoes FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor', 'consultor'))
);
CREATE POLICY "medicoes_update" ON contrato_medicoes FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor', 'consultor'))
);
CREATE POLICY "medicoes_delete" ON contrato_medicoes FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor'))
);

CREATE POLICY "pagamentos_insert" ON contrato_pagamentos FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor', 'consultor'))
);
CREATE POLICY "pagamentos_update" ON contrato_pagamentos FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor', 'consultor'))
);
CREATE POLICY "pagamentos_delete" ON contrato_pagamentos FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor'))
);

CREATE POLICY "docs_insert" ON contrato_documentos FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor', 'consultor'))
);
CREATE POLICY "docs_update" ON contrato_documentos FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor', 'consultor'))
);
CREATE POLICY "docs_delete" ON contrato_documentos FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gestor'))
);

-- Histórico: insert via trigger, select para todos
CREATE POLICY "historico_insert" ON contrato_historico FOR INSERT WITH CHECK (auth.role() = 'authenticated');
