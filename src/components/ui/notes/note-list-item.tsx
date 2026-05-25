'use client'

import { Archive, Star, Bell, Link2, Pencil, Trash2 } from 'lucide-react'
import { type Note, PRIORITY_LABELS, TAG_COLORS } from '@/types/notes'
import { formatDateBR } from '@/lib/utils'

interface NoteListItemProps {
  note: Note
  onEdit: (note: Note) => void
  onArchive: (id: string) => void
  onDelete: (id: string) => void
  onToggleDestacado: (id: string, destacado: boolean) => void
}

export default function NoteListItem({ note, onEdit, onArchive, onDelete, onToggleDestacado }: NoteListItemProps) {
  const hasReminder = !!note.reminder_at
  const hasLinks = !!note.processo_id || !!note.colaborador_id

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group border-b border-gray-100 dark:border-gray-800 last:border-0">
      <button
        onClick={() => onToggleDestacado(note.id, !note.destacado)}
        className={`p-1 rounded shrink-0 mt-0.5 ${
          note.destacado ? 'text-amber-500' : 'text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100'
        } transition-all`}
        title="Destacar"
      >
        <Star className={`w-4 h-4 ${note.destacado ? 'fill-amber-500' : ''}`} />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              note.priority === 'alta' ? 'bg-rose-500' : note.priority === 'media' ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
          />
          {note.title && (
            <span className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">{note.title}</span>
          )}
          {!note.title && (
            <span className="text-gray-500 dark:text-gray-400 text-sm italic">Sem título</span>
          )}
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">{note.content}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className={`text-xs font-medium ${note.priority === 'alta' ? 'text-rose-600 dark:text-rose-400' : note.priority === 'media' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {PRIORITY_LABELS[note.priority]}
          </span>
          {note.tags?.map(tag => (
            <span key={tag} className={`text-xs px-1.5 py-0.5 rounded ${TAG_COLORS[tag] ?? 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
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
              {!note.processos?.id_processo && !note.colaboradores?.nome_completo && ''}
            </span>
          )}
          <span className="text-xs text-gray-400">{formatDateBR(note.created_at)}</span>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onEdit(note)} className="p-1.5 rounded text-gray-400 hover:text-violet-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title="Editar">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => onArchive(note.id)} className="p-1.5 rounded text-gray-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title="Arquivar">
          <Archive className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => onDelete(note.id)} className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" title="Excluir">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
