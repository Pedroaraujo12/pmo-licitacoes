'use client'

import { useEffect, useState } from 'react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [errMsg, setErrMsg] = useState('')

  useEffect(() => {
    setErrMsg(error.message || 'Erro desconhecido')
  }, [error])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#020617',
      color: '#f1f5f9',
      flexDirection: 'column',
      gap: 16,
      padding: 24,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 48 }}>⚠</div>
      <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
        Algo deu errado
      </h1>
      <p style={{ color: '#94a3b8', fontSize: 14, maxWidth: 400, margin: 0 }}>
        Ocorreu um erro inesperado ao carregar esta página.
        Tente recarregar ou voltar ao login.
      </p>
      {errMsg && (
        <pre style={{
          fontSize: 11, color: '#ef4444', background: 'rgba(239,68,68,0.1)',
          padding: '8px 12px', borderRadius: 6, maxWidth: '100%', overflow: 'auto',
        }}>
          {errMsg}
        </pre>
      )}
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={reset}
          style={{
            padding: '10px 24px', background: '#2563eb', color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
            cursor: 'pointer',
          }}>
          Tentar novamente
        </button>
        <a href="/login"
          style={{
            padding: '10px 24px', background: 'transparent', color: '#94a3b8',
            border: '1px solid #334155', borderRadius: 8, fontSize: 14,
            fontWeight: 500, textDecoration: 'none',
          }}>
          Voltar ao login
        </a>
      </div>
    </div>
  )
}
