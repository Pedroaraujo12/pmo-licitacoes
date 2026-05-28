export type ContratoStatus =
  | 'minuta'
  | 'aguardando_assinatura'
  | 'aguardando_publicacao'
  | 'vigente'
  | 'suspenso'
  | 'proximo_vencimento'
  | 'vencido'
  | 'encerrado'
  | 'rescindido'

export type OsStatus =
  | 'rascunho'
  | 'emitida'
  | 'em_execucao'
  | 'pausada'
  | 'aguardando_medicao'
  | 'medida'
  | 'paga'
  | 'concluida'
  | 'cancelada'

export type AditivoTipo =
  | 'aditivo_prazo'
  | 'aditivo_valor'
  | 'aditivo_prazo_valor'
  | 'supressao'
  | 'acrescimo'
  | 'reequilibrio'
  | 'apostilamento'
  | 'prorrogacao'

export type MedicaoStatus =
  | 'em_elaboracao'
  | 'enviada'
  | 'em_analise'
  | 'aprovada'
  | 'reprovada'
  | 'retificada'
  | 'encaminhada_pagamento'

export type PagamentoStatus =
  | 'aguardando_nf'
  | 'aguardando_atesto'
  | 'aguardando_liquidacao'
  | 'aguardando_pagamento'
  | 'pago'
  | 'pago_atraso'
  | 'glosado'
  | 'cancelado'

export type DocumentoContratoStatus = 'pendente' | 'anexado' | 'validado' | 'dispensado'

export type TipoDocumentoContrato =
  | 'instrumento_contratual'
  | 'publicacao'
  | 'proposta_vencedora'
  | 'termo_referencia'
  | 'garantia'
  | 'certidoes'
  | 'designacao_fiscal'
  | 'ordem_servico'
  | 'aditivo'
  | 'apostilamento'
  | 'termo_encerramento'
  | 'outro'

export const CONTRATO_STATUS_RECORDS: Record<ContratoStatus, { label: string; color: string; bgColor: string }> = {
  minuta: { label: 'Minuta', color: '#64748b', bgColor: '#f1f5f9' },
  aguardando_assinatura: { label: 'Aguardando Assinatura', color: '#f59e0b', bgColor: '#fffbeb' },
  aguardando_publicacao: { label: 'Aguardando Publicação', color: '#f59e0b', bgColor: '#fffbeb' },
  vigente: { label: 'Vigente', color: '#059669', bgColor: '#ecfdf5' },
  suspenso: { label: 'Suspenso', color: '#dc2626', bgColor: '#fef2f2' },
  proximo_vencimento: { label: 'Próximo do Vencimento', color: '#ea580c', bgColor: '#fff7ed' },
  vencido: { label: 'Vencido', color: '#dc2626', bgColor: '#fef2f2' },
  encerrado: { label: 'Encerrado', color: '#6b7280', bgColor: '#f9fafb' },
  rescindido: { label: 'Rescindido', color: '#991b1b', bgColor: '#fef2f2' },
}

export const OS_STATUS_RECORDS: Record<OsStatus, { label: string; color: string; bgColor: string }> = {
  rascunho: { label: 'Rascunho', color: '#6b7280', bgColor: '#f9fafb' },
  emitida: { label: 'Emitida', color: '#2563eb', bgColor: '#eff6ff' },
  em_execucao: { label: 'Em Execução', color: '#059669', bgColor: '#ecfdf5' },
  pausada: { label: 'Pausada', color: '#f59e0b', bgColor: '#fffbeb' },
  aguardando_medicao: { label: 'Aguardando Medição', color: '#ea580c', bgColor: '#fff7ed' },
  medida: { label: 'Medida', color: '#7c3aed', bgColor: '#f5f3ff' },
  paga: { label: 'Paga', color: '#059669', bgColor: '#ecfdf5' },
  concluida: { label: 'Concluída', color: '#16a34a', bgColor: '#f0fdf4' },
  cancelada: { label: 'Cancelada', color: '#dc2626', bgColor: '#fef2f2' },
}

export const ADITIVO_TIPO_RECORDS: Record<AditivoTipo, { label: string }> = {
  aditivo_prazo: { label: 'Aditivo de Prazo' },
  aditivo_valor: { label: 'Aditivo de Valor' },
  aditivo_prazo_valor: { label: 'Aditivo de Prazo e Valor' },
  supressao: { label: 'Supressão' },
  acrescimo: { label: 'Acréscimo' },
  reequilibrio: { label: 'Reequilíbrio Econômico-Financeiro' },
  apostilamento: { label: 'Apostilamento' },
  prorrogacao: { label: 'Prorrogação' },
}

export const MEDICAO_STATUS_RECORDS: Record<MedicaoStatus, { label: string; color: string; bgColor: string }> = {
  em_elaboracao: { label: 'Em Elaboração', color: '#6b7280', bgColor: '#f9fafb' },
  enviada: { label: 'Enviada pela Contratada', color: '#2563eb', bgColor: '#eff6ff' },
  em_analise: { label: 'Em Análise', color: '#f59e0b', bgColor: '#fffbeb' },
  aprovada: { label: 'Aprovada', color: '#059669', bgColor: '#ecfdf5' },
  reprovada: { label: 'Reprovada', color: '#dc2626', bgColor: '#fef2f2' },
  retificada: { label: 'Retificada', color: '#7c3aed', bgColor: '#f5f3ff' },
  encaminhada_pagamento: { label: 'Encaminhada para Pagamento', color: '#ea580c', bgColor: '#fff7ed' },
}

export const PAGAMENTO_STATUS_RECORDS: Record<PagamentoStatus, { label: string; color: string; bgColor: string }> = {
  aguardando_nf: { label: 'Aguardando NF', color: '#6b7280', bgColor: '#f9fafb' },
  aguardando_atesto: { label: 'Aguardando Atesto', color: '#2563eb', bgColor: '#eff6ff' },
  aguardando_liquidacao: { label: 'Aguardando Liquidação', color: '#f59e0b', bgColor: '#fffbeb' },
  aguardando_pagamento: { label: 'Aguardando Pagamento', color: '#ea580c', bgColor: '#fff7ed' },
  pago: { label: 'Pago', color: '#059669', bgColor: '#ecfdf5' },
  pago_atraso: { label: 'Pago com Atraso', color: '#dc2626', bgColor: '#fef2f2' },
  glosado: { label: 'Glosado', color: '#dc2626', bgColor: '#fef2f2' },
  cancelado: { label: 'Cancelado', color: '#6b7280', bgColor: '#f9fafb' },
}

export const TIPO_DOCUMENTO_CONTRATO_RECORDS: Record<TipoDocumentoContrato, { label: string }> = {
  instrumento_contratual: { label: 'Instrumento Contratual' },
  publicacao: { label: 'Publicação' },
  proposta_vencedora: { label: 'Proposta Vencedora' },
  termo_referencia: { label: 'Termo de Referência' },
  garantia: { label: 'Garantia Contratual' },
  certidoes: { label: 'Certidões' },
  designacao_fiscal: { label: 'Designação de Fiscal' },
  ordem_servico: { label: 'Ordem de Serviço' },
  aditivo: { label: 'Aditivo' },
  apostilamento: { label: 'Apostilamento' },
  termo_encerramento: { label: 'Termo de Encerramento' },
  outro: { label: 'Outro' },
}

export interface Contrato {
  id: string
  processo_id: string | null
  numero_contrato: string
  ano: number
  contratada_nome: string
  contratada_cnpj: string | null
  contratada_representante: string | null
  contratada_email: string | null
  contratada_telefone: string | null
  objeto: string | null
  categoria: string | null
  tipo_contratacao: string | null
  valor_original: number
  valor_inicial: number
  valor_atual: number
  valor_executado: number
  valor_pago: number
  total_aditivos: number
  data_assinatura: string | null
  data_publicacao: string | null
  data_inicio_vigencia: string | null
  data_fim_vigencia: string | null
  data_limite_renovacao: string | null
  data_encerramento: string | null
  status: ContratoStatus
  gestor_id: string | null
  fiscal_tecnico_id: string | null
  fiscal_administrativo_id: string | null
  fiscal_substituto_id: string | null
  unidade_id: string | null
  coordenacao_id: string | null
  link_sei: string | null
  link_drive: string | null
  permite_renovacao: boolean
  permite_aditivo: boolean
  tem_garantia: boolean
  tem_ordem_servico: boolean
  execucao_continua: boolean
  emergencial: boolean
  observacoes: string | null
  created_by: string | null
  created_at: string
  updated_at: string

  // Joins
  processos?: { id_processo: string | null; objeto_resumido: string | null; modalidades?: { nome: string } | null } | null
  gestor?: { nome: string } | null
  fiscal_tecnico?: { nome: string } | null
  fiscal_administrativo?: { nome: string } | null
  coordenacoes?: { nome: string } | null
}

export interface OrdemServico {
  id: string
  contrato_id: string
  processo_id: string | null
  numero_os: string
  objeto: string | null
  descricao: string | null
  valor: number
  valor_medido: number
  valor_pago: number
  data_emissao: string | null
  data_inicio: string | null
  data_fim_prevista: string | null
  data_fim_real: string | null
  status: OsStatus
  solicitante_id: string | null
  fiscal_id: string | null
  contratada_responsavel: string | null
  percentual_execucao: number
  local_execucao: string | null
  observacoes: string | null
  created_by: string | null
  created_at: string
  updated_at: string

  // Joins
  contratos?: { numero_contrato: string; contratada_nome: string; status: ContratoStatus } | null
  processos?: { id_processo: string | null } | null
  fiscais?: { nome_completo: string } | null
}

export interface ContratoAditivo {
  id: string
  contrato_id: string
  numero_aditivo: string
  tipo: AditivoTipo
  justificativa: string | null
  valor_anterior: number
  valor_alteracao: number
  valor_novo: number
  vigencia_anterior_fim: string | null
  vigencia_nova_fim: string | null
  data_assinatura: string | null
  data_publicacao: string | null
  status: string
  link_sei: string | null
  documento_url: string | null
  created_by: string | null
  created_at: string
}

export interface ContratoMedicao {
  id: string
  contrato_id: string
  ordem_servico_id: string | null
  numero_medicao: string
  competencia: string | null
  periodo_inicio: string | null
  periodo_fim: string | null
  valor_medido: number
  percentual_executado: number
  status: MedicaoStatus
  fiscal_id: string | null
  observacoes: string | null
  created_by: string | null
  created_at: string

  // Joins
  ordens_servico?: { numero_os: string } | null
  fiscais?: { nome_completo: string } | null
}

export interface ContratoPagamento {
  id: string
  contrato_id: string
  ordem_servico_id: string | null
  medicao_id: string | null
  numero_nota_fiscal: string
  valor: number
  data_emissao_nf: string | null
  data_vencimento: string | null
  data_atesto: string | null
  data_pagamento: string | null
  status: PagamentoStatus
  observacoes: string | null
  created_by: string | null
  created_at: string

  // Joins
  ordens_servico?: { numero_os: string } | null
  medicoes?: { numero_medicao: string } | null
}

export interface ContratoDocumento {
  id: string
  contrato_id: string
  ordem_servico_id: string | null
  medicao_id: string | null
  tipo_documento: TipoDocumentoContrato
  nome: string
  url: string | null
  status: DocumentoContratoStatus
  obrigatorio: boolean
  validado_por: string | null
  validado_em: string | null
  created_by: string | null
  created_at: string
}

export interface ContratoHistorico {
  id: string
  contrato_id: string
  entidade: string
  entidade_id: string | null
  acao: string
  descricao: string | null
  valor_anterior: string | null
  valor_novo: string | null
  created_by: string | null
  created_at: string

  // Joins
  profiles?: { name: string } | null
}

export interface ContratoAlerta {
  tipo: string
  mensagem: string
  gravidade: 'baixo' | 'medio' | 'alto'
  acao?: string
  acaoLink?: string
}

export interface ContratoMetricas {
  total: number
  vigentes: number
  vencendo_30d: number
  vencidos: number
  valor_contratado: number
  valor_executado: number
  saldo: number
  pagamentos_pendentes: number
  os_em_execucao: number
  aditivos_andamento: number
  sem_fiscal: number
  sem_movimentacao: number
}

export interface ValoresBreakdown {
  valorOriginal: number
  totalAcrescimos: number
  totalSupressoes: number
  totalAditivos: number
  valorAtualCalculado: number
  diferenca: number
}

export const CONTRATO_DOCUMENTOS_OBRIGATORIOS: { tipo: TipoDocumentoContrato; label: string }[] = [
  { tipo: 'instrumento_contratual', label: 'Instrumento Contratual' },
  { tipo: 'publicacao', label: 'Publicação' },
  { tipo: 'proposta_vencedora', label: 'Proposta Vencedora' },
  { tipo: 'termo_referencia', label: 'Termo de Referência' },
  { tipo: 'garantia', label: 'Garantia Contratual' },
  { tipo: 'certidoes', label: 'Certidões' },
  { tipo: 'designacao_fiscal', label: 'Designação de Fiscal' },
]

export interface ContratoFilters {
  search?: string
  status?: ContratoStatus | ''
  modalidade_id?: string
  contratada?: string
  fiscal_id?: string
  unidade_id?: string
  vigencia?: 'vence_30d' | 'vencidos' | ''
  saldo_baixo?: boolean
  sem_fiscal?: boolean
  meus_contratos?: boolean
  limit?: number
  offset?: number
}
