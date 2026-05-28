'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Sun, Plus, ArrowUp, FileSignature, AlertTriangle, Clock } from 'lucide-react'
import type { Note } from '@/types/notes'
import { getTodayNotes, archiveNote, deleteNote, updateNote } from '@/lib/notes'
import NoteCard from '@/components/ui/notes/note-card'
import NoteModal from '@/components/ui/notes/note-modal'
import { createClient } from '@/lib/supabase/client'
import { formatDateBR } from '@/lib/utils'

interface ContratoAlertaItem {
  id: string
  numero_contrato: string
  contratada_nome: string
  tipo: string
  descricao: string
  gravidade: 'alto' | 'medio'
  link: string
}

export default function TodayNotesPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [alertas, setAlertas] = useState<ContratoAlertaItem[]>([])

  useEffect(() => {
    loadNotes()
    loadContratoAlertas()
  }, [])

  async function loadContratoAlertas() {
    const supabase = createClient()
    if (!supabase) return
    const items: ContratoAlertaItem[] = []
    const hoje = new Date().toISOString().slice(0, 10)
    const trintaDias = new Date()
    trintaDias.setDate(trintaDias.getDate() + 30)
    const trintaDiasStr = trintaDias.toISOString().slice(0, 10)

    const { data: contratos, error: contratosError } = await supabase
      .from('contratos')
      .select('id, numero_contrato, contratada_nome, data_fim_vigencia, status')
      .in('status', ['vigente', 'proximo_vencimento', 'vencido'])
      .limit(50)
    if (contratosError) {
      console.warn('Contract alerts unavailable:', contratosError)
      setAlertas([])
      return
    }
    if (contratos) {
      for (const c of contratos) {
        if (c.data_fim_vigencia && c.data_fim_vigencia <= trintaDiasStr) {
          const diff = Math.ceil((new Date(c.data_fim_vigencia + 'T00:00:00').getTime() - new Date().getTime()) / 86400000)
          items.push({
            id: c.id, numero_contrato: c.numero_contrato, contratada_nome: c.contratada_nome,
            tipo: diff < 0 ? 'vencido' : 'proximo_vencimento',
            descricao: diff < 0 ? `Vencido há ${Math.abs(diff)} dia(s)` : `Vence em ${diff} dia(s)`,
            gravidade: diff < 0 ? 'alto' : diff <= 7 ? 'alto' : 'medio',
            link: `/pmo-dashboard/contratos/detalhe?id=${c.id}`,
          })
        }
      }
    }

    const { data: osAtrasadas } = await supabase
      .from('ordens_servico')
      .select('id, numero_os, contratos!inner(numero_contrato), data_fim_prevista, contrato_id')
      .not('status', 'in', '("concluida","cancelada")')
      .lt('data_fim_prevista', hoje)
      .limit(30)
    if (osAtrasadas) {
      for (const os of osAtrasadas) {
        const cArr = os.contratos as unknown as { numero_contrato: string }[]
        items.push({
          id: os.id, numero_contrato: cArr?.[0]?.numero_contrato || '',
          contratada_nome: '',
          tipo: 'os_atrasada',
          descricao: `OS ${os.numero_os} atrasada (vencia ${formatDateBR(os.data_fim_prevista)})`,
          gravidade: 'alto',
          link: `/pmo-dashboard/ordens-servico/detalhe?id=${os.id}`,
        })
      }
    }

    const { data: medicoes } = await supabase
      .from('contrato_medicoes')
      .select('id, numero_medicao, contratos!inner(numero_contrato), status, contrato_id')
      .in('status', ['enviada', 'em_analise'])
      .limit(30)
    if (medicoes) {
      for (const m of medicoes) {
        const cArr = m.contratos as unknown as { numero_contrato: string }[]
        items.push({
          id: m.id, numero_contrato: cArr?.[0]?.numero_contrato || '',
          contratada_nome: '',
          tipo: 'medicao_pendente',
          descricao: `Medição ${m.numero_medicao} aguardando análise`,
          gravidade: 'medio',
          link: m.contrato_id ? `/pmo-dashboard/contratos/detalhe?id=${m.contrato_id}` : '#',
        })
      }
    }

    setAlertas(items)
  }

  async function loadNotes() {
    setLoading(true)
    try {
      const data = await Promise.race([
        getTodayNotes(),
        new Promise<Note[]>((resolve) => window.setTimeout(() => resolve([]), 10000)),
      ])
      setNotes(data)
    } catch (err) {
      console.warn('Erro ao carregar painel do dia:', err)
      setNotes([])
    } finally {
      setLoading(false)
    }
  }

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
    setModalOpen(false)
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
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sun className="w-6 h-6 text-amber-500" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Painel do Dia</h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <button
          onClick={openNew}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova anotação
        </button>
      </div>

      {/* Alertas de Contratos */}
      {alertas.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <FileSignature className="w-5 h-5 text-emerald-500" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Alertas de Contratos</h2>
          </div>
          <div className="space-y-2">
            {alertas.map((alerta, i) => (
              <Link
                key={`${alerta.tipo}-${i}`}
                href={alerta.link}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-colors cursor-pointer ${
                  alerta.gravidade === 'alto'
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/30'
                    : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/30'
                }`}
              >
                {alerta.gravidade === 'alto' ? (
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                ) : (
                  <Clock className="w-5 h-5 text-amber-500 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {alerta.numero_contrato && `${alerta.numero_contrato} — `}{alerta.descricao}
                  </div>
                  {alerta.contratada_nome && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{alerta.contratada_nome}</div>
                  )}
                </div>
                <ArrowUp className="w-4 h-4 text-gray-400 shrink-0 rotate-45" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Notas do Dia */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Carregando...</div>
      ) : notes.length === 0 ? (
        <div className="text-center py-12">
          <Sun className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">Nenhuma prioridade ou lembrete para hoje</p>
          <button onClick={openNew} className="mt-3 text-sm text-violet-600 dark:text-violet-400 hover:underline">
            Adicionar anotação
          </button>
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <ArrowUp className="w-4 h-4 text-rose-500" />
            Notas com prioridade alta, destacadas, com a tag &quot;Hoje&quot; ou com lembrete para hoje
          </div>

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
        </>
      )}

      <NoteModal
        note={editingNote}
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingNote(null) }}
        onSaved={handleSaved}
      />
    </div>
  )
}
