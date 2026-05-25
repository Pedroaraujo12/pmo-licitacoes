'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Star, Save, Link2 } from 'lucide-react'
import {
  type Note,
  type NoteInsert,
  type NoteUpdate,
  type NotePriority,
  PRIORITY_LABELS,
  AVAILABLE_TAGS,
  TAG_COLORS,
} from '@/types/notes'
import { createNote, updateNote } from '@/lib/notes'
import { createClient } from '@/lib/supabase/client'

interface NoteModalProps {
  note?: Note | null
  open: boolean
  onClose: () => void
  onSaved: (note: Note) => void
  defaultProcessoId?: string | null
  defaultColaboradorId?: string | null
}

export default function NoteModal({
  note,
  open,
  onClose,
  onSaved,
  defaultProcessoId,
  defaultColaboradorId,
}: NoteModalProps) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [priority, setPriority] = useState<NotePriority>('media')
  const [destacado, setDestacado] = useState(false)
  const [reminderDate, setReminderDate] = useState('')
  const [reminderTime, setReminderTime] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [processoId, setProcessoId] = useState('')
  const [colaboradorId, setColaboradorId] = useState('')
  const [saving, setSaving] = useState(false)
  const [colaboradores, setColaboradores] = useState<{ id: string; nome_completo: string }[]>([])
  const [processos, setProcessos] = useState<{ id: string; id_processo: string | null }[]>([])
  const [errorMsg, setErrorMsg] = useState('')

  const resetForm = useCallback(() => {
    if (note) {
      setTitle(note.title)
      setContent(note.content)
      setPriority(note.priority)
      setDestacado(note.destacado)
      setSelectedTags(note.tags ?? [])
      setProcessoId(note.processo_id ?? '')
      setColaboradorId(note.colaborador_id ?? '')
      if (note.reminder_at) {
        const d = new Date(note.reminder_at)
        setReminderDate(d.toISOString().slice(0, 10))
        setReminderTime(d.toISOString().slice(11, 16))
      } else {
        setReminderDate('')
        setReminderTime('')
      }
    } else {
      setTitle('')
      setContent('')
      setPriority('media')
      setDestacado(false)
      setReminderDate('')
      setReminderTime('')
      setSelectedTags([])
      setProcessoId(defaultProcessoId ?? '')
      setColaboradorId(defaultColaboradorId ?? '')
    }
  }, [note, defaultProcessoId, defaultColaboradorId])

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return
    setErrorMsg('')
    setColaboradores([])
    setProcessos([])
    const supabase = createClient()
    supabase.from('colaboradores').select('id, nome_completo').order('nome_completo').then((res: { data: { id: string; nome_completo: string }[] | null }) => {
      setColaboradores(res.data ?? [])
    })
    supabase.from('processos').select('id, id_processo').order('id_processo').then((res: { data: { id: string; id_processo: string | null }[] | null }) => {
      setProcessos(res.data ?? [])
    })
    resetForm()
  }, [open, resetForm])
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!open) return null

  function toggleTag(tag: string) {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  async function handleSave() {
    if (!content.trim()) return
    setSaving(true)
    setErrorMsg('')

    let reminder_at: string | null = null
    if (reminderDate) {
      reminder_at = reminderTime
        ? `${reminderDate}T${reminderTime}:00`
        : `${reminderDate}T23:59:00`
    }

    const payload: NoteInsert = {
      title: title.trim(),
      content: content.trim(),
      priority,
      destacado,
      reminder_at,
      tags: selectedTags,
      processo_id: processoId || null,
      colaborador_id: colaboradorId || null,
    }

    try {
      let result: Note | null
      if (note) {
        result = await updateNote(note.id, payload as NoteUpdate)
      } else {
        result = await createNote(payload)
      }
      if (result) {
        onSaved(result)
        onClose()
      } else {
        setErrorMsg('Erro ao salvar nota. Verifique se os IDs vinculados existem.')
      }
    } catch (err: unknown) {
      let msg: string
      if (err instanceof Error) {
        msg = err.message
      } else if (typeof err === 'object' && err !== null) {
        msg = JSON.stringify(err)
      } else {
        msg = String(err)
      }
      setErrorMsg(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {note ? 'Editar anotação' : 'Nova anotação'}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <input
            type="text"
            placeholder="Título (opcional)"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />

          <textarea
            placeholder="Escreva sua anotação..."
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
            autoFocus
          />

          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 w-full">Prioridade:</span>
            {(['baixa', 'media', 'alta'] as NotePriority[]).map(p => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  priority === p
                    ? p === 'alta'
                      ? 'bg-rose-200 text-rose-800 dark:bg-rose-800 dark:text-rose-200'
                      : p === 'media'
                      ? 'bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200'
                      : 'bg-emerald-200 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-200'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {PRIORITY_LABELS[p]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setDestacado(!destacado)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                destacado
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <Star className={`w-4 h-4 ${destacado ? 'fill-amber-500' : ''}`} />
              Destacar
            </button>
          </div>

          <div>
            <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Lembrete:</span>
            <div className="flex gap-2">
              <input
                type="date"
                value={reminderDate}
                onChange={e => setReminderDate(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <input
                type="time"
                value={reminderTime}
                onChange={e => setReminderTime(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>
          </div>

          <div>
            <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Tags:</span>
            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_TAGS.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedTags.includes(tag)
                      ? TAG_COLORS[tag] ?? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
                      : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
                <Link2 className="w-3 h-3 inline mr-1" />
                Vincular a processo
              </span>
              <select
                value={processoId}
                onChange={e => setProcessoId(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="">Nenhum</option>
                {processos.map(p => (
                  <option key={p.id} value={p.id}>{p.id_processo || p.id}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
                <Link2 className="w-3 h-3 inline mr-1" />
                Vincular a colaborador
              </span>
              <select
                value={colaboradorId}
                onChange={e => setColaboradorId(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="">Nenhum</option>
                {colaboradores.map(c => (
                  <option key={c.id} value={c.id}>{c.nome_completo}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="px-4 pb-2">
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
              {errorMsg}
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !content.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
