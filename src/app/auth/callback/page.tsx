'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [error, setError] = useState('')

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code')
    const next = new URLSearchParams(window.location.search).get('next') || '/pmo-dashboard'

    if (!code) {
      setError('Código de autenticação não encontrado')
      return
    }

    const supabase = createClient()
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        setError(error.message)
      } else {
        router.replace(next)
      }
    })
  }, [router])

  if (error) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>{error}</div>
  }

  return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Autenticando...</div>
}
