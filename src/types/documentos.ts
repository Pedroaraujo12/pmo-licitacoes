export type TemplateStatus = 'rascunho' | 'em_revisao_juridica' | 'aprovado' | 'obsoleto'

export type TipoDocumento =
  | 'edital'
  | 'termo_referencia'
  | 'minuta_contrato'
  | 'despacho'
  | 'oficio'
  | 'parecer'
  | 'ata'
  | 'aviso'
  | 'estudo_tecnico'
  | 'instrumento_cooperacao'
  | 'outro'

export type CategoriaDocumento =
  | 'licitacoes'
  | 'contratos'
  | 'instrumentos_cooperacao'
  | 'dispensa'
  | 'inexigibilidade'
  | 'credenciamento'

export interface DocumentTemplate {
  id: string
  title: string
  tipo_documento: TipoDocumento
  categoria: CategoriaDocumento
  base_legal: string | null
  sei_link: string | null
  descricao: string | null
  conteudo: string
  status: TemplateStatus
  tags: string[]
  versao_vigente_id: string | null
  created_by: string
  created_at: string
  updated_at: string
  // Joins
  profiles?: { name: string } | null
  template_versions?: TemplateVersion[] | null
  versao_vigente?: TemplateVersion | null
}

export interface TemplateVersion {
  id: string
  template_id: string
  version_number: number
  conteudo: string
  resumo_alteracao: string | null
  status: TemplateStatus
  aprovado_por: string | null
  data_aprovacao: string | null
  observacoes_aprovacao: string | null
  author_id: string
  created_at: string
  // Joins
  profiles?: { name: string } | null
  profiles_aprovador?: { name: string } | null
}

export interface TemplatePlaceholder {
  id: string
  placeholder: string
  descricao: string | null
  tabela_origem: string
  coluna_origem: string
  json_extract_path: string | null
  created_at: string
}

export interface DocumentGenerated {
  id: string
  processo_id: string
  template_id: string
  template_version_id: string
  titulo_documento: string
  conteudo_gerado: string
  created_by: string
  created_at: string
  // Joins
  document_templates?: DocumentTemplate | null
  template_versions?: TemplateVersion | null
  processos?: { id_processo: string | null } | null
}

export interface TemplateUsageLog {
  id: string
  template_id: string
  template_version_id: string | null
  acao: string
  user_id: string
  processo_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface TemplateMetric {
  tipo_documento: TipoDocumento
  modelos_ativos: number
  modelos_total: number
  documentos_gerados: number
  documentos_gerados_30d: number
}

export const TIPO_DOCUMENTO_LABELS: Record<TipoDocumento, string> = {
  edital: 'Edital',
  termo_referencia: 'Termo de Referência',
  minuta_contrato: 'Minuta de Contrato',
  despacho: 'Despacho',
  oficio: 'Ofício',
  parecer: 'Parecer',
  ata: 'Ata',
  aviso: 'Aviso',
  estudo_tecnico: 'Estudo Técnico Preliminar',
  instrumento_cooperacao: 'Instrumento de Cooperação',
  outro: 'Outro',
}

export const CATEGORIA_LABELS: Record<CategoriaDocumento, string> = {
  licitacoes: 'Licitações',
  contratos: 'Contratos',
  instrumentos_cooperacao: 'Instrumentos de Cooperação',
  dispensa: 'Dispensa',
  inexigibilidade: 'Inexigibilidade',
  credenciamento: 'Credenciamento',
}

export const TEMPLATE_STATUS_LABELS: Record<TemplateStatus, string> = {
  rascunho: 'Rascunho',
  em_revisao_juridica: 'Em Revisão Jurídica',
  aprovado: 'Aprovado',
  obsoleto: 'Obsoleto',
}

export const TEMPLATE_STATUS_COLORS: Record<TemplateStatus, string> = {
  rascunho: '#94a3b8',
  em_revisao_juridica: '#eab308',
  aprovado: '#22c55e',
  obsoleto: '#ef4444',
}
