'use client'

/**
 * Paginação compartilhada por todas as telas de lista.
 *
 * O cinza anterior (#64748b em 11px) media 3,8:1 sobre o cartão — abaixo do
 * mínimo de 4,5:1 do WCAG AA, e valia tanto para o texto quanto para os
 * números de página, que são clicáveis. Subiu para #94a3b8 (6,4:1) em 12px.
 * O estado desabilitado fica mais apagado de propósito: precisa ler como
 * indisponível, e texto desabilitado não entra no piso de contraste.
 */

interface Props {
  page: number
  totalPages: number
  total: number
  showingFrom: number
  showingTo: number
  onPageChange: (page: number) => void
  compact?: boolean
}

const TINTA = '#94a3b8'
const TINTA_DESABILITADA = '#5b6879'
const DESTAQUE = '#a78bfa'

export default function Pagination({ page, totalPages, total, showingFrom, showingTo, onPageChange, compact }: Props) {
  if (totalPages <= 1) return null

  const btnStyle = (desabilitado: boolean) => ({
    padding: '5px 10px',
    borderRadius: 6,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'transparent',
    color: desabilitado ? TINTA_DESABILITADA : TINTA,
    fontSize: 12,
    cursor: desabilitado ? ('not-allowed' as const) : ('pointer' as const),
    fontWeight: 600,
  })

  const anterior = (
    <button
      type="button"
      onClick={() => onPageChange(Math.max(1, page - 1))}
      disabled={page === 1}
      aria-label="Página anterior"
      style={btnStyle(page === 1)}
    >‹ Anterior</button>
  )

  const proxima = (
    <button
      type="button"
      onClick={() => onPageChange(Math.min(totalPages, page + 1))}
      disabled={page === totalPages}
      aria-label="Próxima página"
      style={btnStyle(page === totalPages)}
    >Próxima ›</button>
  )

  if (compact) {
    return (
      <nav
        aria-label="Paginação"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, padding: '10px 14px' }}
      >
        {anterior}
        <span style={{ fontSize: 12, color: TINTA }}>Página {page} de {totalPages}</span>
        {proxima}
      </nav>
    )
  }

  return (
    <nav
      aria-label="Paginação"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div style={{ fontSize: 12, color: TINTA }}>
        {showingFrom}–{showingTo} de {total} processos · Página {page} de {totalPages}
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {anterior}
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          const start = Math.max(1, Math.min(page - 2, totalPages - 4))
          const p = start + i
          if (p > totalPages) return null
          const atual = p === page
          return (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              aria-label={`Página ${p}`}
              aria-current={atual ? 'page' : undefined}
              style={{
                ...btnStyle(false),
                background: atual ? 'rgba(139,92,246,0.2)' : 'transparent',
                color: atual ? DESTAQUE : TINTA,
                fontWeight: atual ? 700 : 500,
                minWidth: 28,
              }}
            >{p}</button>
          )
        })}
        {proxima}
      </div>
    </nav>
  )
}
