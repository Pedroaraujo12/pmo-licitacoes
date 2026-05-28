'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { translateAuthError } from '@/lib/auth-errors'
import { PT_BR } from '@/lib/pt-br'

type Notice = {
  type: 'error' | 'success'
  text: string
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 8000)
    return () => clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    let cancelled = false

    async function restoreExistingSession() {
      const { data } = await supabase.auth.getSession()
      if (cancelled || !data.session) return

      const next = new URLSearchParams(window.location.search).get('next')
      router.replace(next?.startsWith('/pmo-dashboard') ? next : '/pmo-dashboard')
    }

    restoreExistingSession()

    return () => {
      cancelled = true
    }
  }, [router, supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail || !password) {
      setNotice({ type: 'error', text: 'Informe e-mail e senha para entrar.' })
      return
    }
    if (!isValidEmail(normalizedEmail)) {
      setNotice({ type: 'error', text: 'Informe um e-mail válido.' })
      return
    }

    try {
      setLoading(true)
      setNotice(null)
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      })
      if (error) {
        setNotice({ type: 'error', text: translateAuthError(error.message) })
        return
      }
      if (!data.session) {
        setNotice({ type: 'error', text: 'Sessão não criada. Tente novamente.' })
        return
      }
      const next = new URLSearchParams(window.location.search).get('next')
      router.push(next?.startsWith('/pmo-dashboard') ? next : '/pmo-dashboard')
    } catch {
      setNotice({ type: 'error', text: 'Não foi possível autenticar agora. Verifique sua conexão e tente novamente.' })
    } finally {
      setLoading(false)
    }
  }

  async function handlePasswordReset() {
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) {
      setNotice({ type: 'error', text: 'Informe seu e-mail para redefinir a senha.' })
      return
    }
    if (!isValidEmail(normalizedEmail)) {
      setNotice({ type: 'error', text: 'Informe um e-mail válido.' })
      return
    }

    try {
      setLoading(true)
      setNotice(null)
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (resetError) {
        setNotice({ type: 'error', text: translateAuthError(resetError.message) })
      } else {
        setNotice({ type: 'success', text: 'Link de redefinição enviado para seu e-mail.' })
      }
    } catch {
      setNotice({ type: 'error', text: 'Não foi possível solicitar a redefinição agora. Tente novamente.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#020617',
      padding: 16,
    }}>
      <div style={{
        background: 'rgba(30,41,59,0.7)',
        backdropFilter: 'blur(12px)',
        borderRadius: 20,
        padding: 40,
        width: '100%',
        maxWidth: 420,
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
            LICITAÇÕES
          </h1>
          <p style={{ color: '#94a3b8', marginTop: 8, fontSize: 14 }}>
            Acesse sua conta
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label htmlFor="email" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {PT_BR.labels.email}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); if (notice) setNotice(null) }}
              placeholder="seu@email.com"
              autoComplete="email"
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                fontSize: 14,
                outline: 'none',
                background: 'rgba(30,41,59,0.5)',
                color: '#f1f5f9',
              }}
            />
          </div>

          <div>
            <label htmlFor="password" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Senha
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); if (notice) setNotice(null) }}
                placeholder="Sua senha"
                autoComplete="current-password"
                required
                style={{
                  width: '100%',
                  padding: '10px 88px 10px 14px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  fontSize: 14,
                  outline: 'none',
                  background: 'rgba(30,41,59,0.5)',
                  color: '#f1f5f9',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-pressed={showPassword}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer',
                  fontSize: 12, padding: '4px 8px',
                }}
              >
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>

          {notice && (
            <div
              role={notice.type === 'error' ? 'alert' : 'status'}
              style={{
                padding: '10px 14px',
                background: notice.type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.14)',
                color: notice.type === 'error' ? '#fca5a5' : '#86efac',
                borderRadius: 8,
                fontSize: 13,
                border: notice.type === 'error' ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(34,197,94,0.28)',
              }}
            >
              {notice.text}
            </div>
          )}

          <div style={{ textAlign: 'right', marginTop: -8 }}>
            <button
              type="button"
              onClick={handlePasswordReset}
              disabled={loading || !email.trim()}
              style={{
                background: 'none', border: 'none', color: '#94a3b8', cursor: loading || !email.trim() ? 'not-allowed' : 'pointer',
                fontSize: 12, padding: '4px 0', textDecoration: 'underline', opacity: loading || !email.trim() ? 0.5 : 1,
              }}
            >
              {PT_BR.auth.forgotPassword}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              background: loading ? '#1d4ed8' : '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {loading ? PT_BR.auth.signingIn : PT_BR.auth.signIn}
          </button>
        </form>
      </div>
    </div>
  )
}
