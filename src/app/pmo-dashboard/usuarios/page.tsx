'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'
import { Shield, ShieldAlert, Eye, UserCheck, Users } from 'lucide-react'

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [breakpoint])
  return isMobile
}

const roleIcons: Record<string, React.ReactNode> = {
  admin: <ShieldAlert size={16} />,
  gestor: <Shield size={16} />,
  consultor: <UserCheck size={16} />,
  visualizador: <Eye size={16} />,
}

const roleColors: Record<string, string> = {
  admin: '#dc2626',
  gestor: '#2563eb',
  consultor: '#f59e0b',
  visualizador: '#6b7280',
}

export default function UsuariosPage() {
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  const isMobile = useIsMobile()

  function getSupabase() {
    if (!supabaseRef.current) supabaseRef.current = createClient()
    return supabaseRef.current
  }

  const [profiles, setProfiles] = useState<Profile[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newRole, setNewRole] = useState<string>('')
  const [currentUserRole, setCurrentUserRole] = useState<string>('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await getSupabase().auth.getUser()
      if (user) {
        const { data: prof } = await getSupabase().from('profiles').select('*').eq('id', user.id).single()
        if (prof) setCurrentUserRole(prof.role)
      }

      const { data } = await getSupabase().from('profiles').select('*').order('created_at', { ascending: false })
      if (data) setProfiles(data)
    }
    load()
  }, [])

  async function updateRole(userId: string, role: string) {
    const { error } = await getSupabase().from('profiles').update({ role }).eq('id', userId)
    if (!error) {
      setProfiles(prev => prev.map(p => p.id === userId ? { ...p, role: role as Profile['role'] } : p))
      setEditingId(null)
    }
  }

  const isAdmin = currentUserRole === 'admin'

  const tableCard: React.CSSProperties = {
    background: 'rgba(30,41,59,0.7)',
    backdropFilter: 'blur(12px)',
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.1)',
    overflow: 'hidden',
  }
  const thStyle: React.CSSProperties = {
    padding: '10px 14px',
    textAlign: 'left',
    fontWeight: 700,
    color: '#64748b',
    whiteSpace: 'nowrap',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  }
  const tdStyle: React.CSSProperties = {
    padding: '10px 14px',
    color: '#cbd5e1',
    fontSize: 13,
  }

  const inputStyle: React.CSSProperties = {
    padding: '4px 8px',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6,
    fontSize: 12,
    background: 'rgba(30,41,59,0.5)',
    color: '#cbd5e1',
    outline: 'none',
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f8fafc', margin: 0 }}>Gerenciar Usuários</h1>
        <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>Controle de níveis de acesso</p>
      </div>

      <div style={tableCard}>
        <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: isMobile ? 600 : 'auto' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <th style={thStyle}>Nome</th>
              <th style={thStyle}>Email</th>
              <th style={thStyle}>Nível de Acesso</th>
              <th style={thStyle}>Criado em</th>
              {isAdmin && <th style={thStyle}>Ações</th>}
            </tr>
          </thead>
          <tbody>
            {profiles.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={tdStyle}>{p.name}</td>
                <td style={{ ...tdStyle, color: '#64748b', fontSize: 11 }}>{p.id.substring(0, 8)}...</td>
                <td style={tdStyle}>
                  {editingId === p.id ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <select
                        value={newRole}
                        onChange={e => setNewRole(e.target.value)}
                        style={inputStyle}
                      >
                        <option value="admin">Admin</option>
                        <option value="gestor">Gestor</option>
                        <option value="consultor">Consultor</option>
                        <option value="visualizador">Visualizador</option>
                      </select>
                      <button onClick={() => updateRole(p.id, newRole)}
                        style={{ padding: '4px 10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                        OK
                      </button>
                      <button onClick={() => setEditingId(null)}
                        className="text-slate-300 bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer border-none">
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 500,
                      background: (roleColors[p.role] || '#6b7280') + '20',
                      color: roleColors[p.role] || '#6b7280',
                      textTransform: 'capitalize',
                    }}>
                      {roleIcons[p.role]}
                      {p.role}
                    </span>
                  )}
                </td>
                <td style={{ ...tdStyle, color: '#64748b' }}>
                  {new Date(p.created_at).toLocaleDateString('pt-BR')}
                </td>
                {isAdmin && (
                  <td style={tdStyle}>
                    <button
                      onClick={() => { setEditingId(p.id); setNewRole(p.role) }}
                      className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border-none"
                    >
                      Alterar Nível
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Role info */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12, marginTop: 24,
      }}>
        <RoleCard icon={<ShieldAlert size={18} />} role="Admin" desc="Acesso total ao sistema" color="#dc2626" />
        <RoleCard icon={<Shield size={18} />} role="Gestor" desc="CRUD + gerenciar usuários" color="#2563eb" />
        <RoleCard icon={<UserCheck size={18} />} role="Consultor" desc="CRUD de processos" color="#f59e0b" />
        <RoleCard icon={<Eye size={18} />} role="Visualizador" desc="Apenas leitura" color="#6b7280" />
      </div>
    </div>
  )
}

function RoleCard({ icon, role, desc, color }: { icon: React.ReactNode; role: string; desc: string; color: string }) {
  return (
    <div style={{
      background: 'rgba(30,41,59,0.7)',
      backdropFilter: 'blur(12px)',
      borderRadius: 16,
      border: '1px solid rgba(255,255,255,0.1)',
      padding: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ color }}>{icon}</span>
        <span style={{ fontWeight: 600, fontSize: 14, color: '#f1f5f9', textTransform: 'capitalize' }}>{role}</span>
      </div>
      <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>{desc}</p>
    </div>
  )
}
