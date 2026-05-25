'use client'

import { Search, Filter, LayoutList, LayoutGrid } from 'lucide-react'
import type { NoteFilters, NotePriority } from '@/types/notes'
import { AVAILABLE_TAGS } from '@/types/notes'

interface NoteFiltersProps {
  filters: NoteFilters
  onChange: (filters: NoteFilters) => void
  viewMode: 'list' | 'cards'
  onViewModeChange: (mode: 'list' | 'cards') => void
}

export default function NoteFiltersBar({ filters, onChange, viewMode, onViewModeChange }: NoteFiltersProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por texto..."
            value={filters.search ?? ''}
            onChange={e => onChange({ ...filters, search: e.target.value })}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
          <button
            onClick={() => onViewModeChange('list')}
            className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-gray-700 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            title="Visualização em lista"
          >
            <LayoutList className="w-4 h-4" />
          </button>
          <button
            onClick={() => onViewModeChange('cards')}
            className={`p-2 rounded-md transition-colors ${viewMode === 'cards' ? 'bg-white dark:bg-gray-700 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            title="Visualização em cartões"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-gray-400" />

        <select
          value={filters.priority ?? ''}
          onChange={e => onChange({ ...filters, priority: e.target.value as NotePriority | '' })}
          className="px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="">Todas prioridades</option>
          <option value="alta">Alta</option>
          <option value="media">Média</option>
          <option value="baixa">Baixa</option>
        </select>

        <select
          value={filters.tag ?? ''}
          onChange={e => onChange({ ...filters, tag: e.target.value })}
          className="px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="">Todas tags</option>
          {AVAILABLE_TAGS.map(tag => (
            <option key={tag} value={tag}>{tag}</option>
          ))}
        </select>

        <select
          value={filters.status ?? 'ativa'}
          onChange={e => onChange({ ...filters, status: e.target.value as NoteFilters['status'] })}
          className="px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="ativa">Ativas</option>
          <option value="todas">Todas</option>
          <option value="arquivada">Arquivadas</option>
        </select>

        <select
          value={filters.dateRange ?? ''}
          onChange={e => onChange({ ...filters, dateRange: e.target.value as NoteFilters['dateRange'] })}
          className="px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="">Todas datas</option>
          <option value="hoje">Hoje</option>
          <option value="7d">Últimos 7 dias</option>
          <option value="30d">Últimos 30 dias</option>
        </select>
      </div>
    </div>
  )
}
