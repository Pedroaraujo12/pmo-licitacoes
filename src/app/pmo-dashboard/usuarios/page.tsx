'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'
import { useIsMobile } from '@/hooks/useIsMobile'
import { Shield, ShieldAlert, Eye, UserCheck, Plus, X, Pencil, Trash2 } from 'lucide-react'
import { formatDateBR } from '@/lib/utils'
import { PT_BR } from '@/lib/pt-br'
import { translateAuthError } from '@/lib/auth-errors'

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
  const [currentUserRole, setCurrentUserRole] = useState<string>('')
  const [showCreate, setShowCreate] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createEmail, setCreateEmail] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createRole, setCreateRole] = useState('visualizador')
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState('')

  const [editUser, setEditUser] = useState<Profile | null>(null)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')

  const [deleteUser, setDeleteUser] = useState<Profile | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  async function loadProfiles() {
    const { data, error } = await getSupabase().rpc('list_users_with_email')
    if (error) {
      console.warn('Erro ao listar usuários:', error.message)
    }
    if (data) {
      setProfiles(data as unknown as Profile[])
    }
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await getSupabase().auth.getUser()
      if (user) {
        const { data: prof } = await getSupabase().from('profiles')
          .select('id, name, email, role, avatar_url, created_at, updated_at')
          .eq('id', user.id).single()
        if (prof) setCurrentUserRole(prof.role)
      }
      await loadProfiles()
    }
    load()
  }, []) /* eslint-disable-line react-hooks/exhaustive-deps */

  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (showCreate) { setShowCreate(false); return }
      if (editUser) { setEditUser(null); return }
      if (deleteUser) { setDeleteUser(null); setDeleteError(''); return }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [showCreate, editUser, deleteUser])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateLoading(true)
    setCreateError('')

    try {
      const supabase = getSupabase()
      const { data: { session } } = await supabase.auth.getSession()

      const { error: signUpError } = await supabase.auth.signUp({
        email: createEmail,
        password: createPassword,
        options: { data: { name: createName, role: createRole, email: createEmail } },
      })

      if (signUpError) {
        setCreateError(translateAuthError(signUpError.message))
        setCreateLoading(false)
        return
      }

      try { if (session) await supabase.auth.setSession(session) } catch { /* ok */ }

      setShowCreate(false)
      setCreateName('')
      setCreateEmail('')
      setCreatePassword('')
      setCreateRole('visualizador')
      await loadProfiles()
    } catch (err) {
      setCreateError((err as Error)?.message || 'Erro de conexão')
    }
    setCreateLoading(false)
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editUser) return
    setEditLoading(true)
    setEditError('')

    const { error } = await getSupabase()
      .from('profiles')
      .update({ name: editName, role: editRole as Profile['role'] })
      .eq('id', editUser.id)

    if (error) {
      setEditError(translateAuthError(error.message))
    } else {
      setProfiles(prev => prev.map(p => p.id === editUser.id ? { ...p, name: editName, role: editRole as Profile['role'] } : p))
      setEditUser(null)
    }
    setEditLoading(false)
  }

  async function handleDelete() {
    if (!deleteUser) return
    setDeleteLoading(true)

    const { error } = await getSupabase().rpc('admin_delete_user', { user_id: deleteUser.id })

    if (error) {
      console.error('Delete error:', error)
      setDeleteError(translateAuthError(error.message))
      setDeleteLoading(false)
      return
    }

    setProfiles(prev => prev.filter(p => p.id !== deleteUser.id))
    setDeleteUser(null)
    setDeleteLoading(false)
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

  const baseStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    fontSize: 13,
    background: 'rgba(30,41,59,0.5)',
    color: '#cbd5e1',
    outline: 'none',
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#f8fafc', margin: 0 }}>Gerenciar Usuários</h1>
          <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>Controle de níveis de acesso</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer border-none">
            <Plus size={14} /> Novo Usuário
          </button>
        )}
      </div>

      {/* Create user modal */}
      {showCreate && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)', padding: 16,
        }}>
          <div style={{
            background: '#1e293b', borderRadius: 20, padding: isMobile ? 20 : 28,
            width: '100%', maxWidth: 440,
            border: '1px solid rgba(255,255,255,0.1)',
            maxHeight: '90vh', overflow: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f8fafc', margin: 0 }}>Novo Usuário</h2>
              <button onClick={() => setShowCreate(false)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            {createError && (
              <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.15)', color: '#fca5a5', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
                {createError}
              </div>
            )}

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{PT_BR.labels.name}</label>
                <input type="text" value={createName} onChange={e => setCreateName(e.target.value)} required style={baseStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{PT_BR.labels.email}</label>
                <input type="email" value={createEmail} onChange={e => setCreateEmail(e.target.value)} required style={baseStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Senha</label>
                <input type="password" value={createPassword} onChange={e => setCreatePassword(e.target.value)} required minLength={6} style={baseStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{PT_BR.labels.accessLevel}</label>
                <select value={createRole} onChange={e => setCreateRole(e.target.value)} style={{ ...baseStyle, cursor: 'pointer' }}>
                  <option value="visualizador">Visualizador</option>
                  <option value="consultor">Consultor</option>
                  <option value="gestor">Gestor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={() => setShowCreate(false)}
                  className="bg-slate-700 hover:bg-slate-600 text-white px-5 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer border-none">
                  Cancelar
                </button>
                <button type="submit" disabled={createLoading}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer border-none disabled:opacity-50"
                  style={{ opacity: createLoading ? 0.5 : 1 }}>
                  {createLoading ? 'Criando...' : 'Criar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit user modal */}
      {editUser && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)', padding: 16,
        }}>
          <div style={{
            background: '#1e293b', borderRadius: 20, padding: isMobile ? 20 : 28,
            width: '100%', maxWidth: 440,
            border: '1px solid rgba(255,255,255,0.1)',
            maxHeight: '90vh', overflow: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f8fafc', margin: 0 }}>Editar Usuário</h2>
              <button onClick={() => setEditUser(null)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            {editError && (
              <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.15)', color: '#fca5a5', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
                {editError}
              </div>
            )}

            <form onSubmit={handleEdit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nome</label>
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)} required style={baseStyle} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{PT_BR.labels.accessLevel}</label>
                <select value={editRole} onChange={e => setEditRole(e.target.value)} style={{ ...baseStyle, cursor: 'pointer' }}>
                  <option value="visualizador">Visualizador</option>
                  <option value="consultor">Consultor</option>
                  <option value="gestor">Gestor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={() => setEditUser(null)}
                  className="bg-slate-700 hover:bg-slate-600 text-white px-5 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer border-none">
                  Cancelar
                </button>
                <button type="submit" disabled={editLoading}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer border-none disabled:opacity-50"
                  style={{ opacity: editLoading ? 0.5 : 1 }}>
                  {editLoading ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteUser && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)', padding: 16,
        }}>
          <div style={{
            background: '#1e293b', borderRadius: 20, padding: isMobile ? 20 : 28,
            width: '100%', maxWidth: 400,
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f8fafc', margin: 0, marginBottom: 12 }}>Excluir Usuário</h2>
            <p style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 1.5, marginBottom: 20 }}>
              Tem certeza que deseja excluir <strong style={{ color: '#f8fafc' }}>{deleteUser.name}</strong>{deleteUser.email ? ` (${deleteUser.email})` : ''}? Esta ação não pode ser desfeita.
            </p>
            {deleteError && <p style={{ color: '#ef4444', fontSize: 13, margin: 0, marginBottom: 12 }}>{deleteError}</p>}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => { setDeleteUser(null); setDeleteError('') }}
                className="bg-slate-700 hover:bg-slate-600 text-white px-5 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer border-none">
                Cancelar
              </button>
              <button onClick={handleDelete} disabled={deleteLoading}
                className="bg-red-600 hover:bg-red-500 text-white px-5 py-2.5 rounded-lg text-xs font-bold transition cursor-pointer border-none disabled:opacity-50"
                style={{ opacity: deleteLoading ? 0.5 : 1 }}>
                {deleteLoading ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={tableCard}>
        <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: isMobile ? 600 : 'auto' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <th style={thStyle}>{PT_BR.labels.name}</th>
              <th style={thStyle}>{PT_BR.labels.email}</th>
              <th style={thStyle}>{PT_BR.labels.accessLevel}</th>
              <th style={thStyle}>Criado em</th>
              {isAdmin && <th style={thStyle}>Ações</th>}
            </tr>
          </thead>
          <tbody>
            {profiles.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={tdStyle}>{p.name}</td>
                <td style={{ ...tdStyle, color: '#64748b', fontSize: 11, fontFamily: 'monospace' }}>
                  {p.email || p.id.substring(0, 8) + '...'}
                </td>
                <td style={tdStyle}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                    background: (roleColors[p.role] || '#6b7280') + '20',
                    color: roleColors[p.role] || '#6b7280',
                    textTransform: 'capitalize',
                  }}>
                    {roleIcons[p.role]}
                    {p.role}
                  </span>
                </td>
                <td style={{ ...tdStyle, color: '#64748b' }}>
                  {formatDateBR(p.created_at)}
                </td>
                {isAdmin && (
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => {
                          setEditUser(p)
                          setEditName(p.name)
                          setEditRole(p.role)
                          setEditError('')
                        }}
                        className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border-none"
                      >
                        <Pencil size={12} /> Editar
                      </button>
                      <button
                        onClick={() => setDeleteUser(p)}
                        className="flex items-center gap-1 bg-red-700 hover:bg-red-600 text-red-100 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border-none"
                      >
                        <Trash2 size={12} /> Excluir
                      </button>
                    </div>
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
        <RoleCard icon={<ShieldAlert size={18} />} role="Admin" desc={PT_BR.roles.admin} color="#dc2626" />
        <RoleCard icon={<Shield size={18} />} role="Gestor" desc={PT_BR.roles.gestor} color="#2563eb" />
        <RoleCard icon={<UserCheck size={18} />} role="Consultor" desc={PT_BR.roles.consultor} color="#f59e0b" />
        <RoleCard icon={<Eye size={18} />} role="Visualizador" desc={PT_BR.roles.visualizador} color="#6b7280" />
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
