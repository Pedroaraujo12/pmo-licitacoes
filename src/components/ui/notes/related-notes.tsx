'use client'

import { useEffect, useState } from 'react'
import { StickyNote, Plus, Star, Bell } from 'lucide-react'
import type { Note } from '@/types/notes'
import { getNotesByProcesso, getNotesByColaborador } from '@/lib/notes'
import NoteModal from './note-modal'
import { formatDateBR } from '@/lib/utils'

interface RelatedNotesProps {
  processoId?: string
  colaboradorId?: string
}

export default function RelatedNotes({ processoId, colaboradorId }: RelatedNotesProps) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    loadNotes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processoId, colaboradorId])

  async function loadNotes() {
    setLoading(true)
    let data: Note[]
    if (processoId) {
      data = await getNotesByProcesso(processoId)
    } else if (colaboradorId) {
      data = await getNotesByColaborador(colaboradorId)
    } else {
      data = []
    }
    setNotes(data)
    setLoading(false)
  }

  if (loading) return null
  if (notes.length === 0 && !modalOpen) return null

  return (
    <div style={{ background: 'rgba(30,41,59,0.5)', borderRadius: 12, padding: 16, borderLeft: '4px solid #8b5cf6' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <StickyNote className="w-4 h-4 text-violet-400" />
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Anotações Relacionadas
          </h3>
          {notes.length > 0 && (
            <span style={{ fontSize: 11, color: '#64748b' }}>({notes.length})</span>
          )}
        </div>
        <button
          onClick={() => setModalOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, border: 'none', background: 'rgba(139,92,246,0.2)', color: '#a78bfa', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
        >
          <Plus className="w-3 h-3" /> Nova
        </button>
      </div>

      {notes.length === 0 && (
        <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Nenhuma anotação vinculada ainda.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {notes.map(note => (
          <div
            key={note.id}
            style={{
              padding: '10px 12px',
              background: 'rgba(15,23,42,0.5)',
              borderRadius: 8,
              borderLeft: `3px solid ${note.priority === 'alta' ? '#f43f5e' : note.priority === 'media' ? '#f59e0b' : '#10b981'}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              {note.destacado && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
              {note.title && (
                <span style={{ fontWeight: 600, fontSize: 13, color: '#f1f5f9' }}>{note.title}</span>
              )}
              {note.reminder_at && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 11, color: '#64748b', marginLeft: 'auto' }}>
                  <Bell className="w-3 h-3" />
                  {formatDateBR(note.reminder_at)}
                </span>
              )}
            </div>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, whiteSpace: 'pre-wrap' }}>{note.content}</p>
            {note.tags && note.tags.length > 0 && (
              <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                {note.tags.map(tag => (
                  <span key={tag} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>{tag}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {modalOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setModalOpen(false)}
        >
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: 500, width: '90%' }}>
            <NoteModal
              note={null}
              open={true}
              onClose={() => { setModalOpen(false); loadNotes() }}
              onSaved={() => { setModalOpen(false); loadNotes() }}
              defaultProcessoId={processoId || null}
              defaultColaboradorId={colaboradorId || null}
            />
          </div>
        </div>
      )}
    </div>
  )
}
