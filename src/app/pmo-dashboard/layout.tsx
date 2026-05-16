'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'
import {
  LayoutDashboard, FileText, Users, LogOut, Menu, X,
} from 'lucide-react'

const navItems = [
  { href: '/pmo-dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/pmo-dashboard/processos', label: 'Processos', icon: FileText },
  { href: '/pmo-dashboard/usuarios', label: 'Usuários', icon: Users },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/login')
        return
      }
      supabase.from('profiles').select('*').eq('id', user.id).single()
        .then(({ data }) => setProfile(data))
    })
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={{
        width: sidebarOpen ? 240 : 64,
        background: '#1e293b',
        color: '#f1f5f9',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s',
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 50,
      }}>
        <div style={{
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #334155',
        }}>
          {sidebarOpen && (
            <span style={{ fontWeight: 700, fontSize: 16 }}>PMO Licitações</span>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        <nav style={{ flex: 1, padding: '8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map(item => {
            const Icon = item.icon
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <a
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 8,
                  textDecoration: 'none',
                  color: active ? '#fff' : '#94a3b8',
                  background: active ? '#334155' : 'transparent',
                  fontSize: 14,
                  fontWeight: active ? 600 : 400,
                }}
              >
                <Icon size={18} />
                {sidebarOpen && <span>{item.label}</span>}
              </a>
            )
          })}
        </nav>

        <div style={{ padding: '12px', borderTop: '1px solid #334155' }}>
          {sidebarOpen && profile && (
            <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>
              <div style={{ color: '#f1f5f9', fontWeight: 500 }}>{profile.name}</div>
              <div style={{ textTransform: 'capitalize' }}>{profile.role}</div>
            </div>
          )}
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 12px',
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              color: '#94a3b8',
              cursor: 'pointer',
              width: '100%',
              fontSize: 14,
            }}
          >
            <LogOut size={18} />
            {sidebarOpen && <span>Sair</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{
        marginLeft: sidebarOpen ? 240 : 64,
        flex: 1,
        padding: 24,
        transition: 'margin-left 0.2s',
        background: '#f8fafc',
        minHeight: '100vh',
      }}>
        {children}
      </main>
    </div>
  )
}
