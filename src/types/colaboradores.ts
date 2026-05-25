export type SituacaoFuncional = 'ativo' | 'afastado' | 'desligado'
export type RegimeColaborador = 'efetivo' | 'comissionado' | 'terceirizado' | 'estagiario' | 'cedido'

export interface Colaborador {
  id: string
  nome_completo: string
  cpf: string | null
  matricula: string | null
  sexo: string
  data_nascimento: string
  cargo: string | null
  funcao: string | null
  unidade: string | null
  lotacao: string | null
  regime: RegimeColaborador
  data_admissao: string | null
  situacao: SituacaoFuncional
  data_desligamento: string | null
  email_institucional: string | null
  telefone_institucional: string | null
  ramal: string | null
  email_pessoal: string | null
  celular: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  cep: string | null
  user_id: string | null
  foto_url: string | null
  observacoes: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
  // Joins
  profiles_colaboradores_user_id_fkey?: { name: string; email: string } | null
  profiles_colaboradores_created_by_fkey?: { name: string } | null
  profiles_colaboradores_updated_by_fkey?: { name: string } | null
}

export interface ColaboradorAniversariante extends Colaborador {
  mes_nascimento: number
  dia_nascimento: number
  idade: number
  periodo_aniversario: 'hoje' | 'essa_semana' | 'esse_mes' | 'outro'
}

export interface ColaboradorFavorito {
  id: string
  colaborador_id: string
  user_id: string
  created_at: string
}

export const SITUACAO_LABELS: Record<SituacaoFuncional, string> = {
  ativo: 'Ativo',
  afastado: 'Afastado',
  desligado: 'Desligado',
}

export const SITUACAO_COLORS: Record<SituacaoFuncional, string> = {
  ativo: '#22c55e',
  afastado: '#f59e0b',
  desligado: '#ef4444',
}

export const REGIME_LABELS: Record<RegimeColaborador, string> = {
  efetivo: 'Efetivo',
  comissionado: 'Comissionado',
  terceirizado: 'Terceirizado',
  estagiario: 'Estagiário',
  cedido: 'Cedido',
}

export const SEXO_LABELS: Record<string, string> = {
  M: 'Masculino',
  F: 'Feminino',
  Nao_informado: 'Não informado',
}
