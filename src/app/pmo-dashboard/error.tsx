'use client'

import { useState } from 'react'

/**
 * Tela de erro do dashboard.
 *
 * Mostra os detalhes técnicos do erro. Sem isso, quem usa o sistema pelo
 * celular — onde não há console acessível — só conseguia relatar "algo deu
 * errado", e o diagnóstico virava tentativa e erro.
 */
export default function DashboardError({
  error,
  reset: resetFn,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [aberto, setAberto] = useState(false)
  const [copiado, setCopiado] = useState(false)

  const detalhes = [
    `Mensagem: ${error?.message || '(sem mensagem)'}`,
    error?.digest ? `Digest: ${error.digest}` : null,
    `Tela: ${typeof window !== 'undefined' ? window.location.pathname : '-'}`,
    `Largura: ${typeof window !== 'undefined' ? window.innerWidth : '-'}px`,
    `Navegador: ${typeof navigator !== 'undefined' ? navigator.userAgent : '-'}`,
    error?.stack ? `\nPilha:\n${error.stack.split('\n').slice(0, 6).join('\n')}` : null,
  ].filter(Boolean).join('\n')

  async function copiar() {
    try {
      await navigator.clipboard.writeText(detalhes)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    } catch {
      setAberto(true)
    }
  }

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

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={resetFn}
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

      <div style={{ width: '100%', maxWidth: 560, marginTop: 8 }}>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => setAberto(v => !v)}
            style={{
              padding: '6px 12px', background: 'transparent', color: '#64748b',
              border: '1px solid #1e293b', borderRadius: 6, fontSize: 12,
              cursor: 'pointer',
            }}>
            {aberto ? 'Ocultar detalhes' : 'Ver detalhes do erro'}
          </button>
          <button onClick={copiar}
            style={{
              padding: '6px 12px', background: 'transparent', color: '#64748b',
              border: '1px solid #1e293b', borderRadius: 6, fontSize: 12,
              cursor: 'pointer',
            }}>
            {copiado ? 'Copiado' : 'Copiar detalhes'}
          </button>
        </div>

        {aberto && (
          <pre style={{
            marginTop: 12,
            padding: 12,
            background: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: 8,
            color: '#cbd5e1',
            fontSize: 11,
            lineHeight: 1.5,
            textAlign: 'left',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: '40vh',
            overflowY: 'auto',
          }}>
            {detalhes}
          </pre>
        )}
      </div>
    </div>
  )
}
