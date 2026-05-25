'use client'

import { useEffect, useState } from 'react'
import { StickyNote, Bell, Star, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { getNoteCounts } from '@/lib/notes'
import type { NoteCounts } from '@/types/notes'

export default function NotesWidget() {
  const [counts, setCounts] = useState<NoteCounts>({ active: 0, today: 0, high_priority: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getNoteCounts().then(setCounts).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="animate-pulse h-20 bg-gray-100 dark:bg-gray-800 rounded" />
      </div>
    )
  }

  if (counts.active === 0) return null

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <StickyNote className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Bloco de Anotações</h3>
        </div>
        <Link
          href="/pmo-dashboard/notas"
          className="text-xs text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-0.5"
        >
          Ver todas <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{counts.active}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Ativas</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-amber-500 flex items-center justify-center gap-1">
            <Bell className="w-4 h-4" />
            {counts.today}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Hoje</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-rose-500 flex items-center justify-center gap-1">
            <Star className="w-4 h-4" />
            {counts.high_priority}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Prioridade alta</div>
        </div>
      </div>

      {(counts.today > 0 || counts.high_priority > 0) && (
        <Link
          href="/pmo-dashboard/notas/hoje"
          className="mt-3 block text-center text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline py-1.5 rounded-lg bg-violet-50 dark:bg-violet-950/30"
        >
          Ver Painel do Dia
        </Link>
      )}
    </div>
  )
}
