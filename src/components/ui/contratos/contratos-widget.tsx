'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatBRL } from '@/lib/utils'
import { FileSignature, AlertTriangle, Clock, CheckCircle, ExternalLink } from 'lucide-react'

export default function ContratosWidget() {
  const [dados, setDados] = useState<{
    vigentes: number
    vencendo30d: number
    vencidos: number
    osAtrasadas: number
    valorOriginal: number
    valorAditivos: number
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    if (!supabase) return
    async function load() {
      const hoje = new Date().toISOString().slice(0, 10)
      const trintaDias = new Date()
      trintaDias.setDate(trintaDias.getDate() + 30)
      const trintaDiasStr = trintaDias.toISOString().slice(0, 10)

      const [{ data: contratos, error: contratosError }, { data: os, error: osError }] = await Promise.all([
        supabase.from('contratos').select('status, valor_original, total_aditivos, valor_atual, data_fim_vigencia').limit(50),
        supabase.from('ordens_servico').select('status, data_fim_prevista')
          .not('status', 'in', '("concluida","cancelada")').limit(50),
      ])
      if (contratosError || osError) {
        console.warn('Contratos widget unavailable:', contratosError || osError)
        setDados(null)
        setLoading(false)
        return
      }

      const todos = (contratos || []) as { status: string; valor_original: number; total_aditivos: number; valor_atual: number; data_fim_vigencia: string }[]
      const osList = (os || []) as { status: string; data_fim_prevista: string }[]

      setDados({
        vigentes: todos.filter(c => ['vigente', 'proximo_vencimento'].includes(c.status)).length,
        vencendo30d: todos.filter(c =>
          ['vigente', 'proximo_vencimento'].includes(c.status) &&
          c.data_fim_vigencia && c.data_fim_vigencia >= hoje && c.data_fim_vigencia <= trintaDiasStr,
        ).length,
        vencidos: todos.filter(c =>
          c.data_fim_vigencia && c.data_fim_vigencia < hoje &&
          !['encerrado', 'rescindido'].includes(c.status),
        ).length,
        osAtrasadas: osList.filter(o =>
          o.data_fim_prevista && o.data_fim_prevista < hoje,
        ).length,
        valorOriginal: todos.reduce((acc, c) => acc + (c.valor_original || c.valor_atual || 0), 0),
        valorAditivos: todos.reduce((acc, c) => acc + (c.total_aditivos || 0), 0),
      })
      setLoading(false)
    }
    load().catch(err => {
      console.warn('Contratos widget unavailable:', err)
      setDados(null)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
        </div>
      </div>
    )
  }

  if (!dados) return null

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileSignature className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider">Contratos</h3>
        </div>
        <Link href="/pmo-dashboard/contratos"
          className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5">
          Ver painel <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Vigentes</span>
          </div>
          <span className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">{dados.vigentes}</span>
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Vencem em 30d</span>
          </div>
          <span className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">{dados.vencendo30d}</span>
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
            <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Vencidos</span>
          </div>
          <span className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">{dados.vencidos}</span>
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">OS Atrasadas</span>
          </div>
          <span className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">{dados.osAtrasadas}</span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Valor Original</span>
          <span className="text-xs font-bold text-gray-900 dark:text-gray-100">{formatBRL(dados.valorOriginal)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Aditivos</span>
          <span className={`text-xs font-bold ${dados.valorAditivos >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {formatBRL(dados.valorAditivos)}
          </span>
        </div>
        <div className="flex justify-between items-center pt-1.5 border-t border-gray-100 dark:border-gray-700">
          <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300 uppercase">Valor Atual</span>
          <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">{formatBRL(dados.valorOriginal + dados.valorAditivos)}</span>
        </div>
      </div>
    </div>
  )
}
