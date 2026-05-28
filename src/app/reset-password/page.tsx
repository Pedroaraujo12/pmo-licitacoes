'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { translateAuthError } from '@/lib/auth-errors'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

  useEffect(() => {
    let cancelled = false

    async function bootstrapResetSession() {
      try {
        const supabase = createClient()
        const params = new URLSearchParams(window.location.search)
        const code = params.get('code')

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error && !cancelled) setMessage({ type: 'error', text: translateAuthError(error.message) })
          return
        }

        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (error && !cancelled) setMessage({ type: 'error', text: translateAuthError(error.message) })
        }
      } catch {
        if (!cancelled) setMessage({ type: 'error', text: 'Link de redefinição inválido ou expirado.' })
      } finally {
        if (!cancelled) setCheckingSession(false)
      }
    }

    bootstrapResetSession()
    return () => { cancelled = true }
  }, [])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    if (password.length < 8) {
      setMessage({ type: 'error', text: 'A senha deve ter pelo menos 8 caracteres.' })
      return
    }
    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'As senhas informadas não coincidem.' })
      return
    }

    try {
      setLoading(true)
      setMessage(null)
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setMessage({ type: 'error', text: translateAuthError(error.message) })
        return
      }
      setMessage({ type: 'success', text: 'Senha atualizada com sucesso. Redirecionando...' })
      setTimeout(() => router.replace('/pmo-dashboard'), 1200)
    } catch {
      setMessage({ type: 'error', text: 'Não foi possível atualizar a senha agora. Tente novamente.' })
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
            Redefinir senha
          </h1>
          <p style={{ color: '#94a3b8', marginTop: 8, fontSize: 14 }}>
            Informe uma nova senha para sua conta
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label htmlFor="new-password" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Nova senha
            </label>
            <input
              id="new-password"
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              autoComplete="new-password"
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
            <label htmlFor="confirm-password" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Confirmar senha
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={event => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
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

          {message && (
            <div
              role={message.type === 'error' ? 'alert' : 'status'}
              style={{
                padding: '10px 14px',
                background: message.type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.14)',
                color: message.type === 'error' ? '#fca5a5' : '#86efac',
                borderRadius: 8,
                fontSize: 13,
                border: message.type === 'error' ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(34,197,94,0.28)',
              }}
            >
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || checkingSession}
            style={{
              width: '100%',
              padding: '12px',
              background: loading || checkingSession ? '#1d4ed8' : '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
              cursor: loading || checkingSession ? 'not-allowed' : 'pointer',
            }}
          >
            {checkingSession ? 'Validando link...' : loading ? 'Atualizando...' : 'Atualizar senha'}
          </button>
        </form>
      </div>
    </div>
  )
}
