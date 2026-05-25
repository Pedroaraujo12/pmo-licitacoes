export type NotePriority = 'baixa' | 'media' | 'alta'
export type NoteStatus = 'ativa' | 'arquivada'

export interface Note {
  id: string
  user_id: string
  title: string
  content: string
  priority: NotePriority
  status: NoteStatus
  destacado: boolean
  compartilhada: boolean
  reminder_at: string | null
  tags: string[]
  processo_id: string | null
  colaborador_id: string | null
  created_at: string
  updated_at: string
  processos?: { id_processo: string | null } | null
  colaboradores?: { nome_completo: string } | null
}

export interface NoteInsert {
  title?: string
  content?: string
  priority?: NotePriority
  destacado?: boolean
  reminder_at?: string | null
  tags?: string[]
  processo_id?: string | null
  colaborador_id?: string | null
}

export interface NoteUpdate extends NoteInsert {
  status?: NoteStatus
}

export interface NoteFilters {
  priority?: NotePriority | ''
  tag?: string
  status?: NoteStatus | 'todas'
  dateRange?: 'hoje' | '7d' | '30d' | ''
  search?: string
  destacado?: boolean
}

export interface NoteCounts {
  active: number
  today: number
  high_priority: number
}

export const PRIORITY_LABELS: Record<NotePriority, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
}

export const PRIORITY_COLORS: Record<NotePriority, string> = {
  baixa: 'bg-emerald-100 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800',
  media: 'bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-800',
  alta: 'bg-rose-100 border-rose-300 dark:bg-rose-950/40 dark:border-rose-800',
}

export const PRIORITY_CARD_COLORS: Record<NotePriority, string> = {
  baixa: 'bg-emerald-50 border-l-emerald-400 dark:bg-emerald-950/20',
  media: 'bg-amber-50 border-l-amber-400 dark:bg-amber-950/20',
  alta: 'bg-rose-50 border-l-rose-400 dark:bg-rose-950/20',
}

export const AVAILABLE_TAGS = [
  'Hoje',
  'Esta semana',
  'Importante',
  'Reunião',
  'Ideias',
  'Lembrete',
  'Acompanhar',
]

export const TAG_COLORS: Record<string, string> = {
  Hoje: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  'Esta semana': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  Importante: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  Reunião: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  Ideias: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  Lembrete: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  Acompanhar: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
}
