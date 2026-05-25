'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, StickyNote } from 'lucide-react'
import type { Note, NoteFilters } from '@/types/notes'
import { listNotes, archiveNote, deleteNote, updateNote } from '@/lib/notes'
import NoteModal from '@/components/ui/notes/note-modal'
import NoteCard from '@/components/ui/notes/note-card'
import NoteListItem from '@/components/ui/notes/note-list-item'
import NoteFiltersBar from '@/components/ui/notes/note-filters-bar'

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<NoteFilters>({ status: 'ativa' })
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('cards')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)

  const loadNotes = useCallback(async () => {
    setLoading(true)
    const data = await listNotes(filters)
    setNotes(data)
    setLoading(false)
  }, [filters])

  useEffect(() => {
    loadNotes() // eslint-disable-line react-hooks/set-state-in-effect
  }, [loadNotes])

  function openNew() {
    setEditingNote(null)
    setModalOpen(true)
  }

  function openEdit(note: Note) {
    setEditingNote(note)
    setModalOpen(true)
  }

  function handleSaved() {
    loadNotes()
  }

  async function handleArchive(id: string) {
    await archiveNote(id)
    loadNotes()
  }

  async function handleDelete(id: string) {
    if (confirm('Excluir esta anotação permanentemente?')) {
      await deleteNote(id)
      loadNotes()
    }
  }

  async function handleToggleDestacado(id: string, destacado: boolean) {
    await updateNote(id, { destacado })
    loadNotes()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <StickyNote className="w-6 h-6 text-violet-600 dark:text-violet-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Bloco de Anotações</h1>
        </div>
        <button
          onClick={openNew}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova anotação
        </button>
      </div>

      <div className="mb-6">
        <NoteFiltersBar filters={filters} onChange={setFilters} viewMode={viewMode} onViewModeChange={setViewMode} />
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Carregando...</div>
      ) : notes.length === 0 ? (
        <div className="text-center py-12">
          <StickyNote className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">Nenhuma anotação encontrada</p>
          <button
            onClick={openNew}
            className="mt-3 text-sm text-violet-600 dark:text-violet-400 hover:underline"
          >
            Criar primeira anotação
          </button>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {notes.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              onEdit={openEdit}
              onArchive={handleArchive}
              onDelete={handleDelete}
              onToggleDestacado={handleToggleDestacado}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {notes.map(note => (
            <NoteListItem
              key={note.id}
              note={note}
              onEdit={openEdit}
              onArchive={handleArchive}
              onDelete={handleDelete}
              onToggleDestacado={handleToggleDestacado}
            />
          ))}
        </div>
      )}

      <NoteModal
        note={editingNote}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  )
}
