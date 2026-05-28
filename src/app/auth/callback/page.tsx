'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { translateAuthError } from '@/lib/auth-errors'

function getSafeNext(value: string | null) {
  return value?.startsWith('/pmo-dashboard') ? value : '/pmo-dashboard'
}

export default function AuthCallbackPage() {
  const router = useRouter()
  const [error, setError] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const next = getSafeNext(params.get('next'))

    if (!code) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError('Código de autenticação não encontrado')
      return
    }

    const supabase = createClient()
    supabase.auth.exchangeCodeForSession(code).then(({ error }: { error: { message: string } | null }) => {
      if (error) {
        setError(translateAuthError(error.message))
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
