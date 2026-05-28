'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { listFornecedores } from '@/lib/fornecedores'
import { formatBRL } from '@/lib/utils'
import type { FornecedorResumo } from '@/types/fornecedores'
import { useIsMobile } from '@/hooks/useIsMobile'
import { Search, Building2, FileText, DollarSign, ArrowRight } from 'lucide-react'

const baseInput: React.CSSProperties = {
  padding: '8px 10px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
  fontSize: 13, background: 'rgba(30,41,59,0.5)', color: '#cbd5e1', outline: 'none',
}

export default function FornecedoresPage() {
  const router = useRouter()
  const supabase = createClient()
  const isMobile = useIsMobile()

  const [fornecedores, setFornecedores] = useState<FornecedorResumo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const filters = search.trim() ? { search: search.trim() } : undefined
        const data = await listFornecedores(supabase, filters)
        if (!cancelled) setFornecedores(data)
      } catch {
        if (!cancelled) setFornecedores([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{
        display: 'flex', flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center',
        marginBottom: 20, gap: 12,
      }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f8fafc', margin: 0 }}>
            <Building2 size={20} style={{ marginRight: 8, verticalAlign: 'middle', color: '#60a5fa' }} />
            Fornecedores
          </h1>
          <p style={{ color: '#64748b', fontSize: 14, margin: '4px 0 0' }}>
            {fornecedores.length} fornecedor{fornecedores.length !== 1 ? 'es' : ''} cadastrado{fornecedores.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: '#64748b' }} />
          <input placeholder="Buscar por nome, CNPJ ou representante..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...baseInput, paddingLeft: 32, width: '100%' }} />
        </div>
      </div>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{
              height: 72, background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)',
              borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)',
            }} />
          ))}
        </div>
      )}

      {!loading && fornecedores.length === 0 && (
        <div style={{
          textAlign: 'center', padding: 60, color: '#64748b',
          background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)',
          borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)',
        }}>
          <Building2 size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p style={{ fontSize: 14, margin: '0 0 4px', fontWeight: 500 }}>Nenhum fornecedor encontrado</p>
          <p style={{ fontSize: 12, margin: 0 }}>Os fornecedores são extraídos automaticamente dos contratos cadastrados.</p>
        </div>
      )}

      {!loading && fornecedores.length > 0 && (isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {fornecedores.map(f => (
            <div key={f.nome} onClick={() => router.push(`/pmo-dashboard/fornecedores/detalhe?nome=${encodeURIComponent(f.nome)}`)}
              style={{
                padding: '14px 16px', background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)',
                borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer',
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontWeight: 600, fontSize: 14, color: '#f1f5f9' }}>{f.nome}</span>
                <ArrowRight size={14} style={{ color: '#475569' }} />
              </div>
              {f.cnpj && <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 2 }}>CNPJ: {f.cnpj}</div>}
              <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#64748b', marginTop: 4 }}>
                <span><FileText size={11} style={{ marginRight: 3, verticalAlign: 'middle' }} />{f.total_contratos} contratos</span>
                <span><DollarSign size={11} style={{ marginRight: 3, verticalAlign: 'middle' }} />{formatBRL(f.valor_total)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          background: 'rgba(30,41,59,0.7)', backdropFilter: 'blur(12px)',
          borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)',
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                {['Fornecedor', 'CNPJ', 'Contratos', 'Valor Total', 'Executado', 'Representante', 'Contato'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '12px 16px', color: '#64748b',
                    fontWeight: 600, fontSize: 11, textTransform: 'uppercase',
                    letterSpacing: '0.05em', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fornecedores.map(f => (
                <tr key={f.nome} onClick={() => router.push(`/pmo-dashboard/fornecedores/detalhe?nome=${encodeURIComponent(f.nome)}`)}
                  style={{
                    cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#f1f5f9' }}>
                    <Building2 size={14} style={{ marginRight: 6, verticalAlign: 'middle', color: '#60a5fa' }} />
                    {f.nome}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 12 }}>{f.cnpj || '-'}</td>
                  <td style={{ padding: '12px 16px', color: '#cbd5e1' }}>{f.total_contratos}</td>
                  <td style={{ padding: '12px 16px', color: '#22c55e', fontWeight: 500 }}>{formatBRL(f.valor_total)}</td>
                  <td style={{ padding: '12px 16px', color: '#60a5fa', fontWeight: 500 }}>{formatBRL(f.valor_executado)}</td>
                  <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 12 }}>{f.representante || '-'}</td>
                  <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 12 }}>
                    {f.email && <div>{f.email}</div>}
                    {f.telefone && <div>{f.telefone}</div>}
                    {!f.email && !f.telefone && '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
