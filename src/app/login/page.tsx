'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { translateAuthError } from '@/lib/auth-errors'
import { PT_BR } from '@/lib/pt-br'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  useEffect(() => {
    if (!error) return
    const timer = setTimeout(() => setError(''), 8000)
    return () => clearTimeout(timer)
  }, [error])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(translateAuthError(error.message))
      setLoading(false)
    } else {
      router.push('/pmo-dashboard')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#020617',
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
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {PT_BR.labels.email}
            </label>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); if (error) setError('') }}
              placeholder="seu@email.com"
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
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Senha
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); if (error) setError('') }}
                placeholder="Sua senha"
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
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
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

          {error && (
            <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.15)', color: '#fca5a5', borderRadius: 8, fontSize: 13, border: '1px solid rgba(239,68,68,0.3)' }}>
              {error}
            </div>
          )}

          <div style={{ textAlign: 'right', marginTop: -8 }}>
            <button
              type="button"
              onClick={async () => {
                if (!email) return
                setLoading(true)
                setError('')
                const { error: resetError } = await supabase.auth.resetPasswordForEmail(email)
                setLoading(false)
                if (resetError) {
                  setError(translateAuthError(resetError.message))
                } else {
                  setError('Link de redefinição enviado para seu e-mail.')
                }
              }}
              disabled={loading || !email}
              style={{
                background: 'none', border: 'none', color: '#94a3b8', cursor: loading || !email ? 'not-allowed' : 'pointer',
                fontSize: 12, padding: '4px 0', textDecoration: 'underline', opacity: loading || !email ? 0.5 : 1,
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
