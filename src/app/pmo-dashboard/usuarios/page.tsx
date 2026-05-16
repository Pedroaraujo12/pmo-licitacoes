'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'
import { Shield, ShieldAlert, Eye, UserCheck } from 'lucide-react'

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
  const supabase = createClient()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newRole, setNewRole] = useState<string>('')
  const [currentUserRole, setCurrentUserRole] = useState<string>('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        if (prof) setCurrentUserRole(prof.role)
      }

      const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
      if (data) setProfiles(data)
    }
    load()
  }, [])

  async function updateRole(userId: string, role: string) {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', userId)
    if (!error) {
      setProfiles(prev => prev.map(p => p.id === userId ? { ...p, role: role as Profile['role'] } : p))
      setEditingId(null)
    }
  }

  const isAdmin = currentUserRole === 'admin'

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f8fafc', margin: 0 }}>Gerenciar Usuários</h1>
        <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>Controle de níveis de acesso</p>
      </div>

      <div style={{
        background: '#fff',
        borderRadius: 12,
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0', background: '#f8fafc' }}>
              <Th>Nome</Th>
              <Th>Email</Th>
              <Th>Nível de Acesso</Th>
              <Th>Criado em</Th>
              {isAdmin && <Th>Ações</Th>}
            </tr>
          </thead>
          <tbody>
            {profiles.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <Td style={{ fontWeight: 500 }}>{p.name}</Td>
                <Td style={{ color: '#64748b' }}>{p.id}</Td>
                <Td>
                  {editingId === p.id ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <select
                        value={newRole}
                        onChange={e => setNewRole(e.target.value)}
                        style={{ padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12 }}
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
                        style={{ padding: '4px 10px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
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
                </Td>
                <Td style={{ color: '#64748b' }}>
                  {new Date(p.created_at).toLocaleDateString('pt-BR')}
                </Td>
                {isAdmin && (
                  <Td>
                    <button
                      onClick={() => { setEditingId(p.id); setNewRole(p.role) }}
                      style={{
                        padding: '4px 12px',
                        background: '#f1f5f9',
                        color: '#475569',
                        border: 'none',
                        borderRadius: 6,
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      Alterar Nível
                    </button>
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Role info */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 24 }}>
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
    <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ color }}>{icon}</span>
        <span style={{ fontWeight: 600, fontSize: 14, color: '#0f172a', textTransform: 'capitalize' }}>{role}</span>
      </div>
      <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>{desc}</p>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>{children}</th>
}

function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ padding: '10px 14px', color: '#334155', ...style }}>{children}</td>
}
