'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'
import { useIsMobile } from '@/hooks/useIsMobile'
import { ToastProvider } from '@/components/ui/toast'
import {
  LayoutDashboard, FileText, Users, Calendar, LogOut, Menu, X,
} from 'lucide-react'

const navItems = [
  { href: '/pmo-dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/pmo-dashboard/processos', label: 'Processos', icon: FileText },
  { href: '/pmo-dashboard/cronograma', label: 'Cronograma', icon: Calendar },
  { href: '/pmo-dashboard/usuarios', label: 'Usuários', icon: Users },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    function handleGlobalError(event: ErrorEvent) {
      console.warn('Unhandled error:', event.error || event.message)
    }
    function handleRejection(event: PromiseRejectionEvent) {
      console.warn('Unhandled rejection:', event.reason)
    }
    window.addEventListener('error', handleGlobalError)
    window.addEventListener('unhandledrejection', handleRejection)
    return () => {
      window.removeEventListener('error', handleGlobalError)
      window.removeEventListener('unhandledrejection', handleRejection)
    }
  }, [])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [desktopCollapsed, setDesktopCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [atrasadosCount, setAtrasadosCount] = useState(0)
  const [proximosVencimentos, setProximosVencimentos] = useState(0)
  const isMobile = useIsMobile()
  const sidebarOpen = isMobile ? mobileOpen : !desktopCollapsed
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  function getSupabase() {
    if (!supabaseRef.current) supabaseRef.current = createClient()
    return supabaseRef.current
  }
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const supabase = getSupabase()
    const ac = new AbortController()

    supabase.auth.getUser()
      .then(({ data: { user } }: { data: { user: { id: string } | null } }) => {
        if (!user) {
          router.push('/login')
          return
        }
        supabase.from('profiles').select('*').eq('id', user.id).single()
          .then(({ data }: { data: unknown }) => { if (data) setProfile(data as Profile) })
          .catch(() => {})

        supabase.from('processos').select('id, data_entrega').then(({ data: procs }: { data: { id: string; data_entrega: string | null }[] | null }) => {
          if (!procs) return
          supabase.from('cronograma_atividades').select('processo_id, status, data_fim').then(({ data: crono }: { data: { processo_id: string; status: string; data_fim: string | null }[] | null }) => {
            if (!crono) return
            const today = new Date()
            today.setHours(0, 0, 0, 0)

            const stats = new Map<string, { total: number; concluido: number }>()
            for (const a of crono) {
              const s = stats.get(a.processo_id) || { total: 0, concluido: 0 }
              s.total++
              if (a.status === 'concluido') s.concluido++
              stats.set(a.processo_id, s)
            }
            const concluido: Record<string, boolean> = {}
            for (const [id, s] of stats) concluido[id] = s.total === s.concluido

            const count = procs.filter(p => {
              if (concluido[p.id]) return false
              if (!p.data_entrega) return false
              const d = new Date(p.data_entrega)
              return !isNaN(d.getTime()) && d < today
            }).length
            setAtrasadosCount(count)

            const venc = crono.filter(a => {
              if (a.status === 'concluido' || !a.data_fim) return false
              const fim = new Date(a.data_fim)
              const diff = Math.ceil((fim.getTime() - today.getTime()) / 86400000)
              return diff >= 0 && diff <= 3
            }).length
            setProximosVencimentos(venc)
          })
        })
      })
      .catch(() => router.push('/login'))

    return () => ac.abort()
  }, []) /* eslint-disable-line react-hooks/exhaustive-deps */

  async function handleLogout() {
    await getSupabase().auth.signOut()
    router.push('/login')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#020617' }}>
      {isMobile && sidebarOpen && (
        <div onClick={() => setMobileOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 49 }} />
      )}

      <aside style={{
        width: isMobile ? 240 : (sidebarOpen ? 240 : 64),
        background: '#1e293b', color: '#f1f5f9', display: 'flex', flexDirection: 'column',
        transition: isMobile ? 'transform 0.25s ease' : 'width 0.2s',
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
        transform: isMobile ? (sidebarOpen ? 'translateX(0)' : 'translateX(-100%)') : 'none',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: sidebarOpen ? '16px' : '16px 12px', display: 'flex', alignItems: 'center',
          justifyContent: sidebarOpen ? 'space-between' : 'center',
          borderBottom: '1px solid #334155', minHeight: 52,
        }}>
          {sidebarOpen && <span style={{ fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap' }}>LICITAÇÕES</span>}
          <button onClick={() => { if (isMobile) setMobileOpen(false); else setDesktopCollapsed(true) }}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4, flexShrink: 0 }}
            aria-label="Fechar sidebar">
            <X size={18} />
          </button>
        </div>

        <nav style={{ flex: 1, padding: '8px 4px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map(item => {
            const Icon = item.icon
            const active = pathname === item.href || (item.href !== '/pmo-dashboard' && pathname.startsWith(item.href + '/'))
            return (
              <a key={item.href} href={item.href} onClick={() => { if (isMobile) setMobileOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: sidebarOpen ? 'flex-start' : 'center',
                  gap: 12, padding: '10px 8px', borderRadius: 8, textDecoration: 'none',
                  color: active ? '#fff' : '#94a3b8', background: active ? '#334155' : 'transparent',
                  fontSize: 14, fontWeight: active ? 600 : 400, whiteSpace: 'nowrap',
                }} title={!sidebarOpen ? item.label : undefined}>
                <Icon size={18} />
                {sidebarOpen && <span>{item.label}</span>}
                {sidebarOpen && item.label === 'Processos' && atrasadosCount > 0 && (
                  <span style={{ marginLeft: 'auto', background: '#dc2626', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10, lineHeight: '1.4' }}>{atrasadosCount}</span>
                )}
                {sidebarOpen && item.label === 'Cronograma' && proximosVencimentos > 0 && (
                  <span style={{ marginLeft: 'auto', background: '#eab308', color: '#000', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10, lineHeight: '1.4' }}>{proximosVencimentos}</span>
                )}
              </a>
            )
          })}
        </nav>

        <div style={{ padding: sidebarOpen ? '12px' : '12px 4px', borderTop: '1px solid #334155', display: 'flex', flexDirection: 'column', alignItems: sidebarOpen ? 'stretch' : 'center' }}>
          {sidebarOpen && profile && (
            <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 8 }}>
              <div style={{ color: '#f1f5f9', fontWeight: 500 }}>{profile.name}</div>
              <div style={{ textTransform: 'capitalize' }}>{profile.role}</div>
            </div>
          )}
          <button onClick={handleLogout}
            style={{ display: 'flex', alignItems: 'center', justifyContent: sidebarOpen ? 'flex-start' : 'center', gap: 12, padding: '10px 8px', borderRadius: 8, border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', width: '100%', fontSize: 14 }}
            title={!sidebarOpen ? 'Sair' : undefined}>
            <LogOut size={18} />
            {sidebarOpen && <span>Sair</span>}
          </button>
        </div>
      </aside>

      {isMobile && !sidebarOpen && (
        <button onClick={() => { if (isMobile) setMobileOpen(true); else setDesktopCollapsed(false) }}
          style={{ position: 'fixed', bottom: 20, left: 20, zIndex: 40, width: 48, height: 48, background: '#2563eb', color: '#fff', border: 'none', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(37,99,235,0.4)' }}
          aria-label="Abrir menu">
          <Menu size={22} />
        </button>
      )}

      <main style={{
        marginLeft: isMobile ? 0 : (sidebarOpen ? 240 : 64), padding: isMobile ? 16 : 24,
        paddingBottom: isMobile ? 80 : 24, transition: 'margin-left 0.2s', minHeight: '100vh',
      }}>
        <ToastProvider>{children}</ToastProvider>
      </main>
    </div>
  )
}
