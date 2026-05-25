export function cleanNum(v: unknown): number {
  if (!v) return 0
  if (typeof v === 'number') return v
  const s = String(v).replace('R$', '').trim()
  if (s.includes(',') && !s.includes('e')) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0
  }
  return parseFloat(s) || 0
}

export function formatBRL(v: unknown) {
  return cleanNum(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatDateBR(dateString: string | null | undefined): string {
  if (!dateString || dateString === 'None') return '-'
  const [year, month, day] = dateString.split('T')[0].split('-').map(Number)
  if (!year || !month || !day) return dateString
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR')
}

export function formatDate(d: string | null | undefined) {
  if (!d || d === 'None') return '-'
  return formatDateBR(d)
}

export function getAging(dateStr: string | null | undefined, processo_atrasado?: boolean) {
  if (processo_atrasado === false) return { label: 'Concluído', class: 'aging-green' }
  if (dateStr && dateStr !== 'None') {
    const target = new Date(dateStr)
    if (!isNaN(target.getTime())) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const diff = Math.ceil((target.getTime() - today.getTime()) / 86400000)
      if (diff < 0) return { label: `Atrasado ${Math.abs(diff)}d`, class: 'aging-red' }
      if (diff <= 2) return { label: `Vence em ${diff}d`, class: 'aging-yellow' }
      return { label: `No Prazo (${diff}d)`, class: 'aging-green' }
    }
  }
  if (processo_atrasado === true) return { label: 'Atrasado', class: 'aging-red' }
  return { label: 'Não aplicável', class: 'aging-gray' }
}

import type { SupabaseClient } from '@supabase/supabase-js'

const SEI_LINK_ATIVIDADE = '__SEI_LINK__'

export async function upsertSeiLink(supabase: SupabaseClient, processoId: string, url: string | null) {
  if (!url) {
    await supabase.from('atividades').delete().eq('processo_id', processoId).eq('atividade', SEI_LINK_ATIVIDADE)
    return
  }
  const { data: existing } = await supabase.from('atividades').select('id').eq('processo_id', processoId).eq('atividade', SEI_LINK_ATIVIDADE).maybeSingle()
  if (existing) {
    await supabase.from('atividades').update({ observacao: url }).eq('id', existing.id)
  } else {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('atividades').insert({
      processo_id: processoId,
      atividade: SEI_LINK_ATIVIDADE,
      observacao: url,
      data: new Date().toISOString().split('T')[0],
      created_by: user?.id || null,
    })
  }
}

export async function fetchSeiLink(supabase: SupabaseClient, processoId: string): Promise<string | null> {
  const { data } = await supabase.from('atividades').select('observacao').eq('processo_id', processoId).eq('atividade', SEI_LINK_ATIVIDADE).maybeSingle()
  return data?.observacao || null
}

let seiLinksCache: { data: Record<string, string>; ts: number } | null = null
const CACHE_TTL = 60000

export async function fetchAllSeiLinks(supabase: SupabaseClient): Promise<Record<string, string>> {
  if (seiLinksCache && Date.now() - seiLinksCache.ts < CACHE_TTL) return seiLinksCache.data
  const { data } = await supabase.from('atividades').select('processo_id, observacao').eq('atividade', SEI_LINK_ATIVIDADE).limit(500)
  const map: Record<string, string> = {}
  for (const row of data || []) {
    if (row.observacao) map[row.processo_id] = row.observacao
  }
  seiLinksCache = { data: map, ts: Date.now() }
  return map
}

export function clearSeiLinksCache() { seiLinksCache = null }

function csvEscape(value: unknown): string {
  const s = value == null ? '' : String(value)
  return `"${s.replace(/"/g, '""')}"`
}

function formatDateForFile(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function exportCSV(data: Record<string, unknown>[], filename = 'export') {
  if (data.length === 0) return
  const delimiter = ';'
  const headers = Object.keys(data)
  const rows = data.map(row =>
    headers.map(h => csvEscape(row[h])).join(delimiter)
  )
  const csv = [headers.join(delimiter), ...rows].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}_${formatDateForFile()}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
