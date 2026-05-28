export interface FornecedorResumo {
  nome: string
  cnpj: string | null
  representante: string | null
  email: string | null
  telefone: string | null
  total_contratos: number
  valor_total: number
  valor_executado: number
  primeiro_contrato: string | null
  ultimo_vencimento: string | null
}

export interface Fornecedor extends FornecedorResumo {
  contratos: FornecedorContrato[]
}

export interface FornecedorContrato {
  id: string
  numero_contrato: string
  objeto: string | null
  valor_atual: number
  valor_executado: number
  status: string
  data_inicio_vigencia: string | null
  data_fim_vigencia: string | null
}

export interface FornecedorFilters {
  search?: string
}
