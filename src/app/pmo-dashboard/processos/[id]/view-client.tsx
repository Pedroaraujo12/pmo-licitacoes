'use client'

import { useEffect, useState, useRef, use, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Processo, Atividade, CronogramaAtividade } from '@/types/database'
import { ArrowLeft, Edit, Trash2, ExternalLink, AlertTriangle, FileText, FileSignature } from 'lucide-react'
import DeleteConfirmDialog from '@/components/ui/delete-confirm-dialog'
import CronogramaDinamico from '@/components/ui/cronograma-dinamico'
import GerarDocumentoModal from '@/components/ui/documentos/gerar-documento-modal'
import { formatBRL, formatDate } from '@/lib/utils'
import { listGeneratedDocuments } from '@/lib/documentos'
import type { DocumentGenerated } from '@/types/documentos'
import { useToast } from '@/components/ui/toast'
import { useIsMobile } from '@/hooks/useIsMobile'
import RelatedNotes from '@/components/ui/notes/related-notes'

function isOverdue(etapa: CronogramaAtividade) {
  if (etapa.status === 'concluido') return false
  if (!etapa.data_fim) return false
  return new Date(etapa.data_fim) < new Date(new Date().toDateString())
}

export default function ProcessoViewClient({ params, idOverride }: { params?: Promise<{ id: string }>; idOverride?: string }) {
  const paramsId = idOverride ?? (params ? use(params).id : '')
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryId = searchParams.get('id')
  const id = useMemo(() => queryId || paramsId, [queryId, paramsId])
  const [processo, setProcesso] = useState<Processo | null>(null)
  const [cronograma, setCronograma] = useState<CronogramaAtividade[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const [atividades, setAtividades] = useState<Atividade[]>([])
  const [linkSei, setLinkSei] = useState<string | null>(null)
  const [profile, setProfile] = useState<{ role: string } | null>(null)
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  const isMobile = useIsMobile()
  const [showDocModal, setShowDocModal] = useState(false)
  const [documentos, setDocumentos] = useState<DocumentGenerated[]>([])
  const [responsavelColaborador, setResponsavelColaborador] = useState<{ id: string; nome_completo: string; cargo: string | null; unidade: string | null; email_institucional: string | null; telefone_institucional: string | null } | null>(null)
  const [contratoVinculado, setContratoVinculado] = useState<{ id: string; numero_contrato: string; contratada_nome: string; status: string; valor_atual: number } | null>(null)

  function getSupabase() {
    if (!supabaseRef.current) supabaseRef.current = createClient()
    return supabaseRef.current
  }

  useEffect(() => {
    let cancelled = false
    const watchdog = window.setTimeout(() => {
      if (!cancelled) setLoading(false)
    }, 12000)
    const supabase = getSupabase()
    async function load() {
      setLoading(true)
      try {
        // Try processos first
        const { data: proc } = await supabase
          .from('processos')
          .select('*, coordenacoes(nome), status_processo(nome), responsaveis(nome), demandantes(nome), modalidades(nome)')
          .eq('id', id)
          .single()

        if (!proc && typeof window !== 'undefined') {
          // Fallback: extract ID from URL (handles _redirects proxy)
          const m = window.location.pathname.match(/\/processos\/([a-f0-9-]+)/)
          if (m && m[1] !== id) return
        }

        if (proc) {
          setProcesso(proc)

          // Fetch colaborador info for responsável if linked
          try {
            const { data: resp } = await supabase
              .from('responsaveis')
              .select('colaborador_id')
              .eq('id', proc.responsavel_id)
              .maybeSingle()
            if (resp?.colaborador_id) {
              const { data: colab } = await supabase
                .from('colaboradores')
                .select('id, nome_completo, cargo, unidade, email_institucional, telefone_institucional')
                .eq('id', resp.colaborador_id)
                .single()
              setResponsavelColaborador(colab as { id: string; nome_completo: string; cargo: string | null; unidade: string | null; email_institucional: string | null; telefone_institucional: string | null })
            } else {
              setResponsavelColaborador(null)
            }
          } catch {
            setResponsavelColaborador(null)
          }

          const { data: crono } = await supabase
            .from('cronograma_atividades')
            .select('*')
            .eq('processo_id', id)
            .order('ordem', { ascending: true })
            .limit(200)
          setCronograma(crono || [])
        }
        const { data: atv } = await supabase
          .from('atividades')
          .select('*')
          .eq('processo_id', id)
          .order('created_at', { ascending: false })
          .limit(200)
        setAtividades(atv || [])
        const { data: docs } = await listGeneratedDocuments(supabase, id)
        if (docs) setDocumentos(docs)
        const seiLink = (atv || []).find((a: { atividade: string }) => a.atividade === '__SEI_LINK__')
        setLinkSei(seiLink?.observacao || null)
        const { data: { session } } = await supabase.auth.getSession()
        const user = session?.user
        if (user) {
          const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single()
          setProfile(prof)
        }

        // Carregar contrato vinculado
        const { data: contratoData } = await supabase
          .from('contratos')
          .select('id, numero_contrato, contratada_nome, status, valor_atual')
          .eq('processo_id', id)
          .maybeSingle()
        if (contratoData) {
          const c = contratoData as { id: string; numero_contrato: string; contratada_nome: string; status: string; valor_atual: number }
          setContratoVinculado(c)
        }
      } catch (err) {
        console.warn('Erro ao carregar processo:', err)
      } finally {
        if (!cancelled) setLoading(false)
        window.clearTimeout(watchdog)
      }
    }
    load()
    return () => {
      cancelled = true
      window.clearTimeout(watchdog)
    }
  }, [id])

  const [deleteTarget, setDeleteTarget] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      const { error: err1 } = await getSupabase().from('processos').delete().eq('id', id)
      if (err1) {
        console.error('Erro ao excluir:', err1)
        toast('Erro ao excluir processo', 'error')
        setDeleting(false)
        return
      }
      toast('Processo excluído com sucesso', 'success')
      router.push('/pmo-dashboard')
    } catch (err) {
      console.error('Erro inesperado ao excluir:', err)
      setDeleting(false)
    }
  }

  if (loading) return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {[1,2,3].map(i => (
        <div key={i} style={{ background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)', padding: isMobile ? 16 : 24, marginBottom: 16 }}>
          {[1,2,3,4].map(j => (
            <div key={j} style={{ height: 14, background: 'rgba(71,85,105,0.4)', borderRadius: 6, marginBottom: 10, width: `${40 + j * 15}%` }} />
          ))}
        </div>
      ))}
    </div>
  )
  if (!processo) return <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>Processo não encontrado</div>

  const canEdit = !!(profile?.role && ['admin', 'gestor', 'consultor'].includes(profile.role))
  const canDelete = profile?.role && ['admin', 'gestor'].includes(profile.role)
  const etapasConcluidas = cronograma.filter(e => e.status === 'concluido').length
  const totalEtapas = cronograma.length
  const progressoPct = totalEtapas > 0 ? Math.round((etapasConcluidas / totalEtapas) * 100) : 0
  const etapasAtrasadas = cronograma.filter(isOverdue).length

  const cardStyle: React.CSSProperties = {
    background: 'rgba(30,41,59,0.7)',
    backdropFilter: 'blur(12px)',
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.1)',
    padding: isMobile ? 16 : 24,
    marginBottom: 24,
  }
  const fieldStyle: React.CSSProperties = {
    background: 'rgba(30,41,59,0.5)',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.06)',
    padding: '12px 16px',
  }
  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex', flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: 'space-between', marginBottom: 24, gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: isMobile ? '100%' : 'auto' }}>
          <button onClick={() => router.push('/pmo-dashboard')}
            className="cursor-pointer bg-transparent border-none text-slate-400 hover:text-slate-200 transition">
            <ArrowLeft size={20} />
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, color: '#f8fafc', margin: 0, wordBreak: 'break-word' }}>
              <a href={linkSei || '#'} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', textDecoration: linkSei ? 'underline' : 'none', textUnderlineOffset: 3 }}>
                {processo.id_processo}
                {!linkSei && <span style={{ color: '#64748b', fontSize: 10, marginLeft: 6, fontWeight: 400 }}>(sem link)</span>}
              </a>
            </h1>
            <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>{processo.objeto_resumido}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, width: isMobile ? '100%' : 'auto' }}>
          <button
            onClick={() => setShowDocModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer border-none bg-cyan-600 hover:bg-cyan-500 text-white"
            style={{ flex: isMobile ? 1 : undefined }}
          >
            <FileText size={14} /> Gerar Documento
          </button>
          {canEdit && (
            <button
              onClick={() => router.push(`/pmo-dashboard/processos/editar?id=${id}`)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer border-none bg-amber-600 hover:bg-amber-500 text-white"
              style={{ flex: isMobile ? 1 : undefined }}
            >
              <Edit size={14} /> Editar
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => setDeleteTarget(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer border-none bg-red-600 hover:bg-red-500 text-white"
              style={{ flex: isMobile ? 1 : undefined }}
            >
              <Trash2 size={14} /> Excluir
            </button>
          )}
        </div>
      </div>

      {/* Info Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap: 16, marginBottom: 24,
      }}>
        <div style={fieldStyle}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Data de Entrada</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#f1f5f9' }}>{formatDate(processo.data_entrada)}</div>
        </div>
        <div style={fieldStyle}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Coordenação</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#f1f5f9' }}>{processo.coordenacoes?.nome || '-'}</div>
        </div>
        <div style={fieldStyle}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#f1f5f9' }}>{processo.status_processo?.nome || '-'}</div>
        </div>
        <div style={fieldStyle}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Responsável</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
            {processo.responsaveis?.nome || '-'}
            {responsavelColaborador && (
              <button onClick={() => router.push(`/pmo-dashboard/colaboradores/detalhe?id=${responsavelColaborador.id}`)}
                style={{ fontSize: 11, color: '#60a5fa', background: 'rgba(96,165,250,0.1)', border: 'none',
                  borderRadius: 6, padding: '2px 8px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Ver ficha
              </button>
            )}
          </div>
          {responsavelColaborador && (
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              {responsavelColaborador.cargo && <span>{responsavelColaborador.cargo} · </span>}
              {responsavelColaborador.unidade && <span>{responsavelColaborador.unidade}</span>}
            </div>
          )}
        </div>
        <div style={fieldStyle}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Modalidade</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#f1f5f9' }}>{processo.modalidades?.nome || '-'}</div>
        </div>
        <div style={fieldStyle}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Progresso</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 6, background: '#1e293b', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${progressoPct}%`,
                background: progressoPct === 100 ? '#10b981' : '#3b82f6',
                borderRadius: 3,
                transition: 'width 0.3s',
              }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#f1f5f9' }}>
              {progressoPct}% ({etapasConcluidas}/{totalEtapas})
            </span>
          </div>
        </div>
        <div style={fieldStyle}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Valor Estimado</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#22c55e' }}>{processo.valor_estimado ? formatBRL(processo.valor_estimado) : '-'}</div>
        </div>
        <div style={fieldStyle}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Valor Homologado</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#22c55e' }}>{processo.valor_homologado ? formatBRL(processo.valor_homologado) : '-'}</div>
        </div>
        <div style={fieldStyle}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Drive</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#f1f5f9' }}>
            {processo.drive ? (
              <a href={processo.drive} target="_blank" rel="noopener noreferrer"
                style={{ color: '#60a5fa', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                <ExternalLink size={14} /> Abrir documento
              </a>
            ) : '-'}
          </div>
        </div>
      </div>

      {/* Contratação */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
            <FileSignature size={14} /> Contratação
          </h3>
          <div style={{ display: 'flex', gap: 6 }}>
            {contratoVinculado ? (
              <button onClick={() => router.push(`/pmo-dashboard/contratos/detalhe?id=${contratoVinculado.id}`)}
                className="cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition border-none">
                Ver Contrato
              </button>
            ) : (
              <Link href={`/pmo-dashboard/contratos/novo?processo_id=${id}`}
                className="cursor-pointer bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition border-none inline-flex items-center">
                Criar Contrato
              </Link>
            )}
          </div>
        </div>
        {contratoVinculado ? (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 12 }}>
            <div style={fieldStyle}>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2, fontWeight: 600, textTransform: 'uppercase' }}>Nº Contrato</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{contratoVinculado.numero_contrato}</div>
            </div>
            <div style={fieldStyle}>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2, fontWeight: 600, textTransform: 'uppercase' }}>Contratada</div>
              <div style={{ fontSize: 13, color: '#f1f5f9' }}>{contratoVinculado.contratada_nome}</div>
            </div>
            <div style={fieldStyle}>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2, fontWeight: 600, textTransform: 'uppercase' }}>Valor</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#22c55e' }}>{formatBRL(contratoVinculado.valor_atual)}</div>
            </div>
            <div style={fieldStyle}>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2, fontWeight: 600, textTransform: 'uppercase' }}>Status</div>
              <div style={{ fontSize: 13, color: '#f1f5f9' }}>{contratoVinculado.status}</div>
            </div>
          </div>
        ) : (
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Nenhum contrato vinculado a este processo.</p>
        )}
      </div>

      {/* Barra de alerta de atraso */}
      {etapasAtrasadas > 0 && (
        <div style={{
          ...cardStyle,
          borderLeft: '4px solid #ef4444',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <AlertTriangle size={20} className="text-red-400" />
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#fca5a5', margin: 0 }}>
              {etapasAtrasadas} etapa{etapasAtrasadas > 1 ? 's' : ''} em atraso
            </p>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0 0' }}>
              Prazo original estimado em {totalEtapas} dias úteis
            </p>
          </div>
        </div>
      )}

      {/* Observações */}
      {processo.observacoes && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Observações</h3>
          <p style={{ fontSize: 13, color: '#cbd5e1', margin: 0 }}>{processo.observacoes}</p>
        </div>
      )}

      {/* Documentos Gerados */}
      {documentos.length > 0 && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <FileText size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Documentos Gerados
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {documentos.map(d => (
              <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(30,41,59,0.5)', borderRadius: 8 }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#f1f5f9' }}>{d.titulo_documento}</span>
                  <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8 }}>{d.created_at ? formatDate(d.created_at) : ''}</span>
                </div>
                <span style={{ fontSize: 11, color: '#60a5fa' }}>v{d.template_versions?.version_number || '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={cardStyle}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          📅 Cronograma Dinâmico
        </h3>
        {cronograma.length === 0 ? (
          <p style={{ fontSize: 13, color: '#64748b' }}>
            Nenhuma etapa de cronograma encontrada.
          </p>
        ) : (
          <CronogramaDinamico
            atividades={cronograma}
            processoId={id}
            canEdit={canEdit}
            userRole={profile?.role || null}
            onUpdate={(updated) => setCronograma(updated)}
          />
        )}
      </div>

      {/* Adicionar Atividade */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Registrar Atividade</h3>
        <form onSubmit={async (e) => {
          e.preventDefault()
          const fd = new FormData(e.currentTarget)
          const atividade = fd.get('atividade') as string
          const observacao = fd.get('observacao') as string
          if (!atividade.trim()) return
          const supabase = getSupabase()
          const { data: { user } } = await supabase.auth.getUser()
          const { data: saved, error } = await supabase.from('atividades').insert({
            processo_id: id,
            atividade: atividade.trim(),
            observacao: observacao.trim() || null,
            data: new Date().toISOString().split('T')[0],
            responsavel: user?.email || null,
            created_by: user?.id || null,
          }).select().single()
          if (error) { console.error(error); return }
          if (saved) setAtividades(prev => [saved as Atividade, ...prev])
          e.currentTarget.reset()
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            <input name="atividade" placeholder="Título da atividade" required
              style={{ padding: '8px 10px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 13, background: 'rgba(30,41,59,0.5)', color: '#cbd5e1', outline: 'none' }} />
            <textarea name="observacao" placeholder="Observação (opcional)" rows={2}
              style={{ padding: '8px 10px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 13, background: 'rgba(30,41,59,0.5)', color: '#cbd5e1', outline: 'none', resize: 'vertical' }} />
          </div>
          <button type="submit"
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer border-none"
          >Registrar</button>
        </form>
      </div>

      {/* Histórico de Atividades */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', margin: '0 0 16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Histórico de Atividades</h3>
        {atividades.length === 0 ? (
          <p style={{ fontSize: 13, color: '#64748b' }}>Nenhuma atividade registrada</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {atividades.map(a => (
              <div key={a.id} style={{ padding: '12px', background: 'rgba(30,41,59,0.5)', borderRadius: 8, borderLeft: '3px solid #3b82f6' }}>
                <div style={{
                  display: 'flex', flexDirection: isMobile ? 'column' : 'row',
                  justifyContent: 'space-between', marginBottom: 4, gap: 2,
                }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: '#f1f5f9' }}>{a.atividade}</span>
                  <span style={{ fontSize: 12, color: '#64748b' }}>
                    {a.data ? formatDate(a.data) : ''}
                    {a.responsavel && ` - ${a.responsavel}`}
                  </span>
                </div>
                {a.observacao && <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>{a.observacao}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Anotações Relacionadas */}
      <RelatedNotes processoId={id} />

      <GerarDocumentoModal
        open={showDocModal}
        onClose={() => setShowDocModal(false)}
        processoId={id}
        onGenerated={(doc) => {
          setDocumentos(prev => [doc as unknown as DocumentGenerated, ...prev])
        }}
      />
      <DeleteConfirmDialog
        open={deleteTarget}
        onClose={() => { setDeleteTarget(false); setDeleting(false) }}
        onConfirm={handleDelete}
        loading={deleting}
        titulo="Excluir Processo"
        mensagem={`Tem certeza que deseja excluir o processo "${processo.id_processo}"? Esta ação é irreversível.`}
      />
    </div>
  )
}
