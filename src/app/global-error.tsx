'use client'

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, background: '#020617', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexDirection: 'column', gap: 16,
          padding: 24, textAlign: 'center',
        }}>
          <div style={{ fontSize: 48 }}>⚠</div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
            Algo deu errado
          </h1>
          <p style={{ color: '#94a3b8', fontSize: 14, maxWidth: 400, margin: 0 }}>
            Ocorreu um erro inesperado. Tente recarregar a página.
          </p>
          <button onClick={reset}
            style={{
              padding: '10px 24px', background: '#2563eb', color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
              cursor: 'pointer', marginTop: 12,
            }}>
            Recarregar
          </button>
        </div>
      </body>
    </html>
  )
}
