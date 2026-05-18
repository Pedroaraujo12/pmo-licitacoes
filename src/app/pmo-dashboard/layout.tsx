'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'
import {
  LayoutDashboard, FileText, Users, Calendar, LogOut, Menu, X,
} from 'lucide-react'

const navItems = [
  { href: '/pmo-dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/pmo-dashboard/processos', label: 'Processos', icon: FileText },
  { href: '/pmo-dashboard/cronograma', label: 'Cronograma', icon: Calendar },
  { href: '/pmo-dashboard/usuarios', label: 'Usuários', icon: Users },
]

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(true)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [breakpoint])
  return isMobile
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isMobile = useIsMobile()
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser()
      .then(({ data: { user } }: { data: { user: { id: string } | null } }) => {
        if (!user) {
          router.push('/login')
          return
        }
        supabase.from('profiles').select('*').eq('id', user.id).single()
          .then(({ data }: { data: Profile | null }) => setProfile(data))
          .catch((err: unknown) => console.error('Erro ao carregar perfil:', err))
      })
      .catch((err: unknown) => {
        console.error('Erro ao verificar autenticação:', err)
        router.push('/login')
      })
  }, [])

  useEffect(() => {
    if (!isMobile) setSidebarOpen(true)
    else setSidebarOpen(false)
  }, [isMobile])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#020617' }}>
      {/* Mobile overlay backdrop */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            zIndex: 49, transition: 'opacity 0.2s',
          }}
        />
      )}

      {/* Mobile overlay backdrop */}
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            zIndex: 49,
          }}
        />
      )}

      {/* Sidebar */}
      <aside style={{
        width: isMobile ? 240 : (sidebarOpen ? 240 : 64),
        background: '#1e293b',
        color: '#f1f5f9',
        display: 'flex',
        flexDirection: 'column',
        transition: isMobile ? 'transform 0.25s ease' : 'width 0.2s',
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 50,
        transform: isMobile ? (sidebarOpen ? 'translateX(0)' : 'translateX(-100%)') : 'none',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: sidebarOpen ? '16px' : '16px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: sidebarOpen ? 'space-between' : 'center',
          borderBottom: '1px solid #334155',
          minHeight: 52,
        }}>
          {sidebarOpen && <span style={{ fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap' }}>LICITAÇÕES</span>}
          <button
            onClick={() => setSidebarOpen(false)}
            style={{
              background: 'none', border: 'none', color: '#94a3b8',
              cursor: 'pointer', padding: 4, flexShrink: 0,
            }}
          >
            <X size={18} />
          </button>
        </div>

        <nav style={{ flex: 1, padding: '8px 4px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map(item => {
            const Icon = item.icon
            const active = pathname === item.href || (item.href !== '/pmo-dashboard' && pathname.startsWith(item.href + '/'))
            return (
              <a
                key={item.href}
                href={item.href}
                onClick={() => { if (isMobile) setSidebarOpen(false) }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: sidebarOpen ? 'flex-start' : 'center',
                  gap: 12,
                  padding: '10px 8px',
                  borderRadius: 8,
                  textDecoration: 'none',
                  color: active ? '#fff' : '#94a3b8',
                  background: active ? '#334155' : 'transparent',
                  fontSize: 14,
                  fontWeight: active ? 600 : 400,
                  whiteSpace: 'nowrap',
                }}
                title={!sidebarOpen ? item.label : undefined}
              >
                <Icon size={18} />
                {sidebarOpen && <span>{item.label}</span>}
              </a>
            )
          })}
        </nav>

        <div style={{
          padding: sidebarOpen ? '12px' : '12px 4px',
          borderTop: '1px solid #334155',
          display: 'flex',
          flexDirection: 'column',
          alignItems: sidebarOpen ? 'stretch' : 'center',
        }}>
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
              justifyContent: sidebarOpen ? 'flex-start' : 'center',
              gap: 12,
              padding: '10px 8px',
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              color: '#94a3b8',
              cursor: 'pointer',
              width: '100%',
              fontSize: 14,
            }}
            title={!sidebarOpen ? 'Sair' : undefined}
          >
            <LogOut size={18} />
            {sidebarOpen && <span>Sair</span>}
          </button>
        </div>
      </aside>

      {/* Floating menu button (mobile) */}
      {isMobile && !sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          style={{
            position: 'fixed', bottom: 20, left: 20, zIndex: 40,
            width: 48, height: 48,
            background: '#2563eb', color: '#fff',
            border: 'none', borderRadius: '50%',
            cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(37,99,235,0.4)',
          }}
        >
          <Menu size={22} />
        </button>
      )}

      {/* Main */}
      <main style={{
        marginLeft: isMobile ? 0 : (sidebarOpen ? 240 : 64),
        padding: isMobile ? 16 : 24,
        paddingBottom: isMobile ? 80 : 24,
        transition: 'margin-left 0.2s',
        minHeight: '100vh',
      }}>
        {children}
      </main>
    </div>
  )
}
