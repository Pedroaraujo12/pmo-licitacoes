'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'
import { useIsMobile } from '@/hooks/useIsMobile'
import { ToastProvider } from '@/components/ui/toast'
import { WebVitals } from '@/components/ui/web-vitals'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import {
  LayoutDashboard, FileText, Users, Calendar, LogOut, Menu, X, FileEdit, Contact2, StickyNote, Sun, FileSignature, Building2,
} from 'lucide-react'

const DEFAULT_ALERTS = {
  processos_atrasados: 0,
  proximos_vencimentos: 0,
  contratos_alertas: 0,
  sem_colaborador: false,
}

const navItems = [
  { href: '/pmo-dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/pmo-dashboard/processos', label: 'Processos', icon: FileText },
  { href: '/pmo-dashboard/contratos', label: 'Contratos', icon: FileSignature },
  { href: '/pmo-dashboard/fornecedores', label: 'Fornecedores', icon: Building2 },
  { href: '/pmo-dashboard/cronograma', label: 'Cronograma', icon: Calendar },
  { href: '/pmo-dashboard/documentos', label: 'Documentos', icon: FileEdit },
  { href: '/pmo-dashboard/colaboradores', label: 'Colaboradores', icon: Contact2 },
  { href: '/pmo-dashboard/notas', label: 'Notas', icon: StickyNote },
  { href: '/pmo-dashboard/notas/hoje', label: 'Painel do Dia', icon: Sun },
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
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [desktopCollapsed, setDesktopCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [layoutAlerts, setLayoutAlerts] = useState<{
    processos_atrasados: number
    proximos_vencimentos: number
    contratos_alertas: number
    sem_colaborador: boolean
  }>(DEFAULT_ALERTS)
  const isMobile = useIsMobile()
  const sidebarOpen = isMobile ? mobileOpen : !desktopCollapsed
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null)
  const getSupabase = useCallback(() => {
    if (!supabaseRef.current) supabaseRef.current = createClient()
    return supabaseRef.current
  }, [])
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const authTimeout = window.setTimeout(() => {
        if (!cancelled) {
          console.warn('Dashboard auth check timeout; redirecting to login')
          router.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`)
        }
      }, 12000)
      try {
        const supabase = getSupabase()
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (cancelled) return
        const user = session?.user
        if (sessionError || !user) {
          window.clearTimeout(authTimeout)
          router.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`)
          return
        }

        const { data: profileData, error: profileError } = await supabase.from('profiles')
          .select('id, name, email, role, avatar_url, created_at, updated_at')
          .eq('id', user.id).maybeSingle()
        if (cancelled) return
        if (profileError || !profileData) {
          console.warn('Profile load error:', profileError)
          window.clearTimeout(authTimeout)
          return
        }
        setProfile(profileData as Profile)

        const { data: alerts, error: alertsError } = await supabase.rpc('get_layout_alerts', { p_user_id: user.id })
        if (alertsError) console.warn('Layout alerts unavailable:', alertsError)
        if (!cancelled && alerts) {
          const normalizedAlerts = alerts as {
            processos_atrasados: number
            proximos_vencimentos: number
            contratos_alertas: number
            sem_colaborador: boolean
          }
          setLayoutAlerts(normalizedAlerts)
        }
      } catch (err) {
        console.error('Dashboard layout init error:', err)
        if (!cancelled) {
          router.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`)
        }
        return
      } finally {
        window.clearTimeout(authTimeout)
        if (!cancelled) setCheckingAuth(false)
      }
    })()
    return () => { cancelled = true }
  }, []) /* eslint-disable-line react-hooks/exhaustive-deps */

  async function handleLogout() {
    await getSupabase().auth.signOut()
    router.push('/login')
  }

  const alertas = layoutAlerts

  return (
    <div style={{ minHeight: '100vh', background: '#020617' }}>
      <WebVitals />
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
              <Link key={item.href} href={item.href} onClick={() => { if (isMobile) setMobileOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: sidebarOpen ? 'flex-start' : 'center',
                  gap: 12, padding: '10px 8px', borderRadius: 8, textDecoration: 'none',
                  color: active ? '#fff' : '#94a3b8', background: active ? '#334155' : 'transparent',
                  fontSize: 14, fontWeight: active ? 600 : 400, whiteSpace: 'nowrap',
                }} title={!sidebarOpen ? item.label : undefined}>
                <Icon size={18} />
                {sidebarOpen && <span>{item.label}</span>}
                {sidebarOpen && item.label === 'Processos' && alertas.processos_atrasados > 0 && (
                  <span style={{ marginLeft: 'auto', background: '#dc2626', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10, lineHeight: '1.4' }}>{alertas.processos_atrasados}</span>
                )}
                {sidebarOpen && item.label === 'Cronograma' && alertas.proximos_vencimentos > 0 && (
                  <span style={{ marginLeft: 'auto', background: '#eab308', color: '#000', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10, lineHeight: '1.4' }}>{alertas.proximos_vencimentos}</span>
                )}
                {sidebarOpen && item.label === 'Contratos' && alertas.contratos_alertas > 0 && (
                  <span style={{ marginLeft: 'auto', background: '#dc2626', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10, lineHeight: '1.4' }}>{alertas.contratos_alertas}</span>
                )}
              </Link>
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
        <ToastProvider>
          {checkingAuth ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
              <div style={{ textAlign: 'center' }}>
                <div className="loading-spinner" />
                <p style={{ color: '#64748b', fontSize: 14, marginTop: 12 }}>Carregando...</p>
              </div>
            </div>
          ) : (
            <ErrorBoundary>{children}</ErrorBoundary>
          )}
        </ToastProvider>
      </main>
    </div>
  )
}
