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
  coordenacoes?: { nome: string } | null
  status_processo?: { nome: string } | null
  responsaveis?: { nome: string } | null
  demandantes?: { nome: string } | null
  modalidades?: { nome: string } | null
  // Cronograma fields (from vw_status_processo_cronograma)
  processo_atrasado?: boolean
  etapas_concluidas?: number
  total_etapas?: number
  data_fim_prevista_total?: string | null
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

export interface ModeloCronograma {
  id: string
  modalidade_id: string
  nome: string
  total_dias_uteis: number
  ativo: boolean
  created_at: string
}

export interface ModeloEtapa {
  id: string
  modelo_cronograma_id: string
  ordem: number
  fase: string
  descricao: string
  setor: string
  duracao_dias_uteis: number
  dia_inicio_relativo: number | null
  dia_fim_relativo: number | null
  papel_responsavel: string
  created_at: string
}

export interface CronogramaAtividade {
  id: string
  processo_id: string
  ordem: number
  dias_uteis: number
  fase: string
  descricao: string
  setor: string
  status: 'nao_iniciado' | 'em_andamento' | 'concluido'
  data_inicio: string | null
  data_fim: string | null
  modelo_etapa_id: string | null
  responsavel_id: string | null
  data_inicio_real: string | null
  data_fim_real: string | null
  created_at: string
}

export interface StatusProcessoCronograma {
  processo_id: string
  id_processo: string | null
  modalidade_id: string | null
  modalidade_nome: string | null
  atividade_atual: string | null
  data_fim_atividade_atual: string | null
  ordem_atividade_atual: number | null
  total_etapas: number
  etapas_concluidas: number
  etapas_atrasadas: number
  processo_atrasado: boolean
  progresso_calculado: number
  data_fim_prevista_total: string | null
}

export interface Feriado {
  id: string
  data: string
  nome: string
  tipo: string
  created_at: string
}
