'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthSession } from '@/lib/hooks/use-auth-session'
import type { UserRole } from '@/types/database'

interface PageShellProps {
  children: (ctx: { role: UserRole | null; userId: string | null }) => React.ReactNode
  requireAuth?: boolean
  loadingFallback?: React.ReactNode
  errorFallback?: React.ReactNode
}

export function PageShell({
  children,
  requireAuth = false,
  loadingFallback,
  errorFallback,
}: PageShellProps) {
  const { role, userId, isLoading, error, retry } = useAuthSession()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && requireAuth && !userId) {
      router.replace('/login')
    }
  }, [isLoading, requireAuth, userId, router])

  if (isLoading) {
    return (
      loadingFallback ?? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
          }}
        >
          <div className="loading-spinner" />
        </div>
      )
    )
  }

  if (error) {
    if (errorFallback) return errorFallback

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          gap: 16,
          padding: 24,
        }}
      >
        <div
          style={{
            borderRadius: 16,
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.25)',
            padding: '24px 32px',
            maxWidth: 440,
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontSize: 14,
              color: '#fca5a5',
              margin: '0 0 16px',
              lineHeight: 1.5,
            }}
          >
            {error}
          </p>
          <button
            onClick={retry}
            style={{
              padding: '8px 20px',
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  if (requireAuth && !userId) {
    return null
  }

  return <>{children({ role, userId })}</>
}
