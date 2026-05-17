'use client'

import { useEffect, useState, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Processo, Atividade } from '@/types/database'
import { ArrowLeft, Edit, Trash2 } from 'lucide-react'

export default function ProcessoViewClient({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [processo, setProcesso] = useState<Processo | null>(null)
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
      const { data: proc } = await supabase
        .from('processos')
        .select('*, coordenacao(nome), status(nome), responsavel(nome), demandante(nome), modalidade(nome)')
        .eq('id', id)
        .single()
      setProcesso(proc)

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

  async function handleDelete() {
    if (!confirm('Tem certeza que deseja excluir este processo?')) return
    const { error } = await getSupabase().from('processos').delete().eq('id', id)
    if (!error) router.push('/pmo-dashboard')
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Carregando...</div>
  if (!processo) return <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>Processo não encontrado</div>

  const canEdit = profile?.role && ['admin', 'gestor', 'consultor'].includes(profile.role)
  const canDelete = profile?.role && ['admin', 'gestor'].includes(profile.role)

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

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={fieldStyle}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Data de Entrada</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#f1f5f9' }}>{processo.data_entrada ? new Date(processo.data_entrada).toLocaleDateString('pt-BR') : '-'}</div>
        </div>
        <div style={fieldStyle}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Coordenação</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#f1f5f9' }}>{processo.coordenacao?.nome || '-'}</div>
        </div>
        <div style={fieldStyle}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#f1f5f9' }}>{processo.status?.nome || '-'}</div>
        </div>
        <div style={fieldStyle}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Responsável</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#f1f5f9' }}>{processo.responsavel?.nome || '-'}</div>
        </div>
        <div style={fieldStyle}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Modalidade</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#f1f5f9' }}>{processo.modalidade?.nome || '-'}</div>
        </div>
        <div style={fieldStyle}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Demandante</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#f1f5f9' }}>{processo.demandante?.nome || '-'}</div>
        </div>
        <div style={fieldStyle}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Qtd Itens</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#f1f5f9' }}>{processo.qtd_itens?.toString() || '-'}</div>
        </div>
        <div style={fieldStyle}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Prioridade</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#f1f5f9' }}>{processo.prioridade || '-'}</div>
        </div>
        <div style={fieldStyle}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Atividade Atual</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#f1f5f9' }}>{processo.atividade_atual || '-'}</div>
        </div>
        <div style={fieldStyle}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Data Atividade</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#f1f5f9' }}>{processo.data_atividade ? new Date(processo.data_atividade).toLocaleDateString('pt-BR') : '-'}</div>
        </div>
        <div style={fieldStyle}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Data Entrega</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#f1f5f9' }}>{processo.data_entrega ? new Date(processo.data_entrega).toLocaleDateString('pt-BR') : '-'}</div>
        </div>
        <div style={fieldStyle}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Progresso</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#f1f5f9' }}>{processo.progresso ? `${processo.progresso}%` : '-'}</div>
        </div>
        <div style={fieldStyle}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Valor Estimado</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#22c55e' }}>{processo.valor_estimado ? `R$ ${Number(processo.valor_estimado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}</div>
        </div>
        <div style={fieldStyle}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Valor Homologado</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#22c55e' }}>{processo.valor_homologado ? `R$ ${Number(processo.valor_homologado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}</div>
        </div>
        <div style={fieldStyle}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Despesa Evitada</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#22c55e' }}>{processo.despesa_evitada ? `R$ ${Number(processo.despesa_evitada).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}</div>
        </div>
        <div style={fieldStyle}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Houve Recurso?</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#f1f5f9' }}>{processo.houve_recurso || '-'}</div>
        </div>
      </div>

      {processo.observacoes && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Observações</h3>
          <p style={{ fontSize: 13, color: '#cbd5e1', margin: 0 }}>{processo.observacoes}</p>
        </div>
      )}

      {processo.drive && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Drive</h3>
          <a href={processo.drive} target="_blank" rel="noopener noreferrer"
            style={{ color: '#60a5fa', fontSize: 13, textDecoration: 'underline' }}>
            {processo.drive}
          </a>
        </div>
      )}

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
                    {a.data ? new Date(a.data).toLocaleDateString('pt-BR') : ''}
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
