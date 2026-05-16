export type UserRole = 'admin' | 'gestor' | 'consultor' | 'visualizador'

export interface Profile {
  id: string
  name: string
  avatar_url: string | null
  role: UserRole
  created_at: string
}

export interface Processo {
  id: string
  data_entrada: string | null
  coordenacao_id: string | null
  drive: string | null
  status_id: string | null
  id_processo: string | null
  qtd_itens: number | null
  responsavel_id: string | null
  objeto_resumido: string | null
  demandante_id: string | null
  modalidade_id: string | null
  prioridade: string | null
  atividade_atual: string | null
  data_atividade: string | null
  progresso: number | null
  data_entrega: string | null
  houve_recurso: string | null
  valor_estimado: number | null
  valor_homologado: number | null
  despesa_evitada: number | null
  observacoes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // Joins
  coordenacao?: { nome: string } | null
  status?: { nome: string } | null
  responsavel?: { nome: string } | null
  demandante?: { nome: string } | null
  modalidade?: { nome: string } | null
}

export interface Atividade {
  id: string
  processo_id: string
  atividade: string
  data: string | null
  responsavel: string | null
  observacao: string | null
  created_by: string | null
  created_at: string
}

export interface StatusProcesso {
  id: string
  nome: string
}

export interface Modalidade {
  id: string
  nome: string
}

export interface Coordenacao {
  id: string
  nome: string
}

export interface Demandante {
  id: string
  nome: string
}

export interface Responsavel {
  id: string
  nome: string
}
