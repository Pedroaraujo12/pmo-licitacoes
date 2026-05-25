'use client'

import { Archive, Star, Bell, Link2, Pencil, Trash2 } from 'lucide-react'
import { type Note, PRIORITY_LABELS, PRIORITY_CARD_COLORS, TAG_COLORS } from '@/types/notes'
import { formatDateBR } from '@/lib/utils'

interface NoteCardProps {
  note: Note
  onEdit: (note: Note) => void
  onArchive: (id: string) => void
  onDelete: (id: string) => void
  onToggleDestacado: (id: string, destacado: boolean) => void
}

export default function NoteCard({ note, onEdit, onArchive, onDelete, onToggleDestacado }: NoteCardProps) {
  const hasReminder = !!note.reminder_at
  const hasLinks = !!note.processo_id || !!note.colaborador_id

  return (
    <div
      className={`rounded-xl border p-4 shadow-sm transition-all hover:shadow-md ${PRIORITY_CARD_COLORS[note.priority]} border-l-4`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          {note.title && (
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{note.title}</h3>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onToggleDestacado(note.id, !note.destacado)}
            className={`p-1 rounded transition-colors ${
              note.destacado ? 'text-amber-500' : 'text-gray-400 hover:text-amber-500'
            }`}
            title="Destacar"
          >
            <Star className={`w-4 h-4 ${note.destacado ? 'fill-amber-500' : ''}`} />
          </button>
          <button
            onClick={() => onEdit(note)}
            className="p-1 rounded text-gray-400 hover:text-violet-500 transition-colors"
            title="Editar"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => onArchive(note.id)}
            className="p-1 rounded text-gray-400 hover:text-blue-500 transition-colors"
            title="Arquivar"
          >
            <Archive className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(note.id)}
            className="p-1 rounded text-gray-400 hover:text-red-500 transition-colors"
            title="Excluir"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3 whitespace-pre-wrap mb-2">
        {note.content}
      </p>

      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            note.priority === 'alta'
              ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
              : note.priority === 'media'
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
          }`}
        >
          {PRIORITY_LABELS[note.priority]}
        </span>

        {note.tags?.map(tag => (
          <span
            key={tag}
            className={`text-xs px-2 py-0.5 rounded-full ${TAG_COLORS[tag] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}
          >
            {tag}
          </span>
        ))}

        {hasReminder && (
          <span className="text-xs text-gray-400 flex items-center gap-0.5">
            <Bell className="w-3 h-3" />
            {formatDateBR(note.reminder_at!)}
          </span>
        )}

        {hasLinks && (
          <span className="text-xs text-gray-400 flex items-center gap-0.5">
            <Link2 className="w-3 h-3" />
            {note.processos?.id_processo && `${note.processos.id_processo}`}
            {note.processos?.id_processo && note.colaboradores?.nome_completo && ' · '}
            {note.colaboradores?.nome_completo && note.colaboradores.nome_completo}
            {!note.processos?.id_processo && !note.colaboradores?.nome_completo && 'Vinculada'}
          </span>
        )}
      </div>

      <div className="mt-2 text-xs text-gray-400">
        {formatDateBR(note.created_at)}
      </div>
    </div>
  )
}
