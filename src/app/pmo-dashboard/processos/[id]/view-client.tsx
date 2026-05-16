'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { use } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Processo, Atividade } from '@/types/database'
import { ArrowLeft, Edit, Trash2 } from 'lucide-react'

export default function ProcessoViewClient({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()
  const [processo, setProcesso] = useState<Processo | null>(null)
  const [atividades, setAtividades] = useState<Atividade[]>([])
  const [profile, setProfile] = useState<{ role: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: proc } = await supabase
        .from('processos')
        .select('*, coordenacao:nome, status:nome, responsavel:nome, demandante:nome, modalidade:nome')
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
    const { error } = await supabase.from('processos').delete().eq('id', id)
    if (!error) router.push('/pmo-dashboard')
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Carregando...</div>
  if (!processo) return <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>Processo não encontrado</div>

  const canEdit = profile?.role && ['admin', 'gestor', 'consultor'].includes(profile.role)
  const canDelete = profile?.role && ['admin', 'gestor'].includes(profile.role)

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.push('/pmo-dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>{processo.id_processo}</h1>
            <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>{processo.objeto_resumido}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {canEdit && (
            <button
              onClick={() => router.push(`/pmo-dashboard/processos/${id}/edit`)}
              style={{ padding: '8px 16px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Edit size={14} /> Editar
            </button>
          )}
          {canDelete && (
            <button
              onClick={handleDelete}
              style={{ padding: '8px 16px', background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Trash2 size={14} /> Excluir
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <Field label="Data de Entrada" value={processo.data_entrada ? new Date(processo.data_entrada).toLocaleDateString('pt-BR') : '-'} />
        <Field label="Coordenação" value={processo.coordenacao?.nome || '-'} />
        <Field label="Status" value={processo.status?.nome || '-'} />
        <Field label="Responsável" value={processo.responsavel?.nome || '-'} />
        <Field label="Modalidade" value={processo.modalidade?.nome || '-'} />
        <Field label="Demandante" value={processo.demandante?.nome || '-'} />
        <Field label="Qtd Itens" value={processo.qtd_itens?.toString() || '-'} />
        <Field label="Prioridade" value={processo.prioridade || '-'} />
        <Field label="Atividade Atual" value={processo.atividade_atual || '-'} />
        <Field label="Data Atividade" value={processo.data_atividade ? new Date(processo.data_atividade).toLocaleDateString('pt-BR') : '-'} />
        <Field label="Data Entrega" value={processo.data_entrega ? new Date(processo.data_entrega).toLocaleDateString('pt-BR') : '-'} />
        <Field label="Progresso" value={processo.progresso ? `${processo.progresso}%` : '-'} />
        <Field label="Valor Estimado" value={processo.valor_estimado ? `R$ ${Number(processo.valor_estimado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'} />
        <Field label="Valor Homologado" value={processo.valor_homologado ? `R$ ${Number(processo.valor_homologado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'} />
        <Field label="Despesa Evitada" value={processo.despesa_evitada ? `R$ ${Number(processo.despesa_evitada).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'} />
        <Field label="Houve Recurso?" value={processo.houve_recurso || '-'} />
      </div>

      {processo.observacoes && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 16, marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', margin: '0 0 8px' }}>Observações</h3>
          <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>{processo.observacoes}</p>
        </div>
      )}

      {processo.drive && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 16, marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', margin: '0 0 8px' }}>Drive</h3>
          <a href={processo.drive} target="_blank" rel="noopener noreferrer"
            style={{ color: '#2563eb', fontSize: 13, textDecoration: 'underline' }}>
            {processo.drive}
          </a>
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', margin: '0 0 16px' }}>Histórico de Atividades</h3>
        {atividades.length === 0 ? (
          <p style={{ fontSize: 13, color: '#94a3b8' }}>Nenhuma atividade registrada</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {atividades.map(a => (
              <div key={a.id} style={{ padding: '12px', background: '#f8fafc', borderRadius: 8, borderLeft: '3px solid #2563eb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{a.atividade}</span>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>
                    {a.data ? new Date(a.data).toLocaleDateString('pt-BR') : ''}
                    {a.responsavel && ` - ${a.responsavel}`}
                  </span>
                </div>
                {a.observacao && <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>{a.observacao}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '12px 16px' }}>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 500, color: '#0f172a' }}>{value}</div>
    </div>
  )
}
