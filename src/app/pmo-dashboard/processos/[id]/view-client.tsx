'use client'

import { useEffect, useState, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Processo, Atividade, CronogramaAtividade } from '@/types/database'
import { ArrowLeft, Edit, Trash2, CheckCircle2, Circle, Clock, AlertTriangle } from 'lucide-react'

function formatDate(d: string | null | undefined) {
  if (!d) return '-'
  const date = new Date(d)
  if (isNaN(date.getTime())) return d
  return date.toLocaleDateString('pt-BR')
}

function statusIcon(status: string) {
  switch (status) {
    case 'concluido': return <CheckCircle2 size={16} className="text-emerald-400" />
    case 'em_andamento': return <Clock size={16} className="text-blue-400" />
    default: return <Circle size={16} className="text-slate-600" />
  }
}

function isOverdue(etapa: CronogramaAtividade) {
  if (etapa.status === 'concluido') return false
  if (!etapa.data_fim) return false
  return new Date(etapa.data_fim) < new Date(new Date().toDateString())
}

export default function ProcessoViewClient({ params }: { params: Promise<{ id: string }> }) {
  const paramsId = use(params).id
  const [id, setId] = useState(paramsId)
  const router = useRouter()
  const [processo, setProcesso] = useState<Processo | null>(null)
  const [cronograma, setCronograma] = useState<CronogramaAtividade[]>([])
  const [atividades, setAtividades] = useState<Atividade[]>([])
  const [profile, setProfile] = useState<{ role: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)

  function getSupabase() {
    if (!supabaseRef.current) supabaseRef.current = createClient()
    return supabaseRef.current
  }

  useEffect(() => {
    const supabase = getSupabase()
    async function load() {
      // Try processos first, then licitacoes as fallback
      const { data: proc } = await supabase
        .from('processos')
        .select('*, coordenacoes(nome), status_processo(nome), responsaveis(nome), demandantes(nome), modalidades(nome)')
        .eq('id', id)
        .single()

      if (!proc && typeof window !== 'undefined') {
        // Fallback: extract ID from URL (handles _redirects proxy)
        const m = window.location.pathname.match(/\/processos\/([a-f0-9-]+)/)
        if (m && m[1] !== id) {
          setId(m[1])
          return
        }
      }

      if (proc) {
        setProcesso(proc)

        const { data: crono } = await supabase
          .from('cronograma_atividades')
          .select('*')
          .eq('processo_id', id)
          .order('ordem', { ascending: true })
        setCronograma(crono || [])
      } else {
        // Fallback to licitacoes table
        const { data: lic } = await supabase
          .from('licitacoes')
          .select('*')
          .eq('id', id)
          .single()
        if (lic) {
          setProcesso({
            id: lic.id,
            id_processo: lic.id_processo || null,
            objeto_resumido: lic.objeto_resumido || null,
            data_entrada: lic.data_entrada || null,
            valor_estimado: lic.vlr_estimado_anual || 0,
            valor_homologado: lic.vlr_homologado || 0,
            progresso: lic.progresso || 0,
            prioridade: lic.prioridade || null,
            observacoes: lic.observacoes || null,
            drive: lic.processo_link || null,
            atividade_atual: lic.fase_atual || null,
            data_entrega: lic.data_prevista || null,
            coordenacoes: { nome: lic.coordenacao || '' },
            status_processo: { nome: lic.status || '' },
            responsaveis: { nome: lic.responsavel || '' },
            modalidades: { nome: lic.modalidade || '' },
            demandantes: { nome: lic.demandante || '' },
            data_atividade: null,
            coordenacao_id: null,
            status_id: null,
            responsavel_id: null,
            modalidade_id: null,
            demandante_id: null,
            qtd_itens: null,
            despesa_evitada: null,
            created_by: null,
            houve_recurso: null,
            created_at: lic.created_at || lic.data_entrada,
            updated_at: lic.created_at || lic.data_entrada,
          })
        }
      }

      const { data: atv } = await supabase
        .from('atividades')
        .select('*')
        .eq('processo_id', id)
        .order('created_at', { ascending: false })
      setAtividades(atv || [])

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        setProfile(prof)
      }
      setLoading(false)
    }
    load()
  }, [id])

  async function updateEtapaStatus(etapaId: string, newStatus: string) {
    const supabase = getSupabase()
    const now = new Date().toISOString().split('T')[0]
    const update: Record<string, unknown> = { status: newStatus }
    if (newStatus === 'em_andamento') update.data_inicio_real = now
    if (newStatus === 'concluido') update.data_fim_real = now
    const { error } = await supabase.from('cronograma_atividades').update(update).eq('id', etapaId)
    if (!error) {
      setCronograma(prev => prev.map(e =>
        e.id === etapaId ? { ...e, ...update } as CronogramaAtividade : e
      ))
    }
  }

  async function handleDelete() {
    if (!confirm('Tem certeza que deseja excluir este processo?')) return
    try {
      const { error: err1 } = await getSupabase().from('processos').delete().eq('id', id)
      const { error: err2 } = await getSupabase().from('licitacoes').delete().eq('id', id)
      if (err1 || err2) {
        console.error('Erro ao excluir:', err1 || err2)
        return
      }
      router.push('/pmo-dashboard')
    } catch (err) {
      console.error('Erro inesperado ao excluir:', err)
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Carregando...</div>
  if (!processo) return <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>Processo não encontrado</div>

  const canEdit = profile?.role && ['admin', 'gestor', 'consultor'].includes(profile.role)
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
    padding: 24,
    marginBottom: 24,
  }
  const fieldStyle: React.CSSProperties = {
    background: 'rgba(30,41,59,0.5)',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.06)',
    padding: '12px 16px',
  }
  const etapaStyle = (etapa: CronogramaAtividade): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px',
    background: 'rgba(30,41,59,0.5)',
    borderRadius: 10,
    borderLeft: `3px solid ${
      etapa.status === 'concluido' ? '#10b981' :
      isOverdue(etapa) ? '#ef4444' :
      etapa.status === 'em_andamento' ? '#3b82f6' :
      '#475569'
    }`,
    opacity: etapa.status === 'nao_iniciado' && !isOverdue(etapa) ? 0.6 : 1,
  })

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/pmo-dashboard')}
            className="cursor-pointer bg-transparent border-none text-slate-400 hover:text-slate-200 transition">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f8fafc', margin: 0 }}>{processo.id_processo}</h1>
            <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>{processo.objeto_resumido}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {canEdit && (
            <button
              onClick={() => router.push(`/pmo-dashboard/processos/${id}/edit`)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer border-none bg-amber-600 hover:bg-amber-500 text-white"
            >
              <Edit size={14} /> Editar
            </button>
          )}
          {canDelete && (
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer border-none bg-red-600 hover:bg-red-500 text-white"
            >
              <Trash2 size={14} /> Excluir
            </button>
          )}
        </div>
      </div>

      {/* Info Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
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
          <div style={{ fontSize: 14, fontWeight: 500, color: '#f1f5f9' }}>{processo.responsaveis?.nome || '-'}</div>
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
          <div style={{ fontSize: 14, fontWeight: 500, color: '#22c55e' }}>{processo.valor_estimado ? `R$ ${Number(processo.valor_estimado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}</div>
        </div>
        <div style={fieldStyle}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Valor Homologado</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#22c55e' }}>{processo.valor_homologado ? `R$ ${Number(processo.valor_homologado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}</div>
        </div>
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

      {/* Cronograma de Atividades */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Cronograma do Processo
          </h3>
          <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#64748b' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} /> Concluído
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} /> Em andamento
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} /> Atrasado
            </span>
          </div>
        </div>

        {cronograma.length === 0 ? (
          <p style={{ fontSize: 13, color: '#64748b' }}>
            Nenhuma etapa de cronograma encontrada. Crie o processo novamente para gerar o cronograma.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {cronograma.map((etapa) => {
              const overdue = isOverdue(etapa)
              return (
                <div key={etapa.id} style={etapaStyle(etapa)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 24 }}>
                    {statusIcon(etapa.status)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: '#64748b',
                        background: '#1e293b',
                        padding: '1px 6px',
                        borderRadius: 4,
                      }}>
                        #{etapa.ordem}
                      </span>
                      <span style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: '#3b82f6',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}>
                        {etapa.fase}
                      </span>
                      <span style={{ fontSize: 9, color: '#64748b' }}>
                        {etapa.setor}
                      </span>
                      {etapa.dias_uteis > 0 && (
                        <span style={{ fontSize: 9, color: '#64748b' }}>
                          {etapa.dias_uteis}d úteis
                        </span>
                      )}
                    </div>
                    <p style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: etapa.status === 'concluido' ? '#94a3b8' : '#f1f5f9',
                      margin: 0,
                      textDecoration: etapa.status === 'concluido' ? 'line-through' : 'none',
                    }}>
                      {etapa.descricao}
                    </p>
                    <div style={{ display: 'flex', gap: 16, marginTop: 4, fontSize: 11, color: '#64748b' }}>
                      <span>
                        {etapa.data_inicio ? `${formatDate(etapa.data_inicio)}` : '—'}
                        {etapa.data_fim ? ` → ${formatDate(etapa.data_fim)}` : ''}
                      </span>
                      {overdue && (
                        <span style={{ color: '#ef4444', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <AlertTriangle size={12} /> Atrasado
                        </span>
                      )}
                    </div>
                  </div>
                  {canEdit && etapa.status !== 'concluido' && (
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      {etapa.status === 'nao_iniciado' && (
                        <button
                          onClick={() => updateEtapaStatus(etapa.id, 'em_andamento')}
                          className="cursor-pointer px-2 py-1 rounded text-[9px] font-bold bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 transition border-none"
                        >
                          Iniciar
                        </button>
                      )}
                      {etapa.status === 'em_andamento' && (
                        <button
                          onClick={() => updateEtapaStatus(etapa.id, 'concluido')}
                          className="cursor-pointer px-2 py-1 rounded text-[9px] font-bold bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/40 transition border-none"
                        >
                          Concluir
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
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
    </div>
  )
}
