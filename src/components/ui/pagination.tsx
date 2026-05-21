'use client'

interface Props {
  page: number
  totalPages: number
  total: number
  showingFrom: number
  showingTo: number
  onPageChange: (page: number) => void
  compact?: boolean
}

export default function Pagination({ page, totalPages, total, showingFrom, showingTo, onPageChange, compact }: Props) {
  if (totalPages <= 1) return null

  const btnStyle = (disabled: boolean) => ({
    padding: '5px 10px',
    borderRadius: 6,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'transparent',
    color: disabled ? '#475569' : '#94a3b8',
    fontSize: 11,
    cursor: disabled ? 'not-allowed' as const : 'pointer' as const,
    fontWeight: 600,
  })

  if (compact) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, padding: '10px 14px' }}>
        <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1} style={btnStyle(page === 1)}>‹ Anterior</button>
        <span style={{ fontSize: 11, color: '#64748b' }}>Página {page} de {totalPages}</span>
        <button onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages} style={btnStyle(page === totalPages)}>Próxima ›</button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ fontSize: 11, color: '#64748b' }}>{showingFrom}–{showingTo} de {total} processos · Página {page} de {totalPages}</div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1} style={btnStyle(page === 1)}>‹ Anterior</button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          const start = Math.max(1, Math.min(page - 2, totalPages - 4))
          const p = start + i
          if (p > totalPages) return null
          return (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              style={{
                ...btnStyle(p === page),
                background: p === page ? 'rgba(139,92,246,0.2)' : 'transparent',
                color: p === page ? '#a78bfa' : '#64748b',
                fontWeight: p === page ? 700 : 400,
                minWidth: 28,
              }}
            >{p}</button>
          )
        })}
        <button onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages} style={btnStyle(page === totalPages)}>Próxima ›</button>
      </div>
    </div>
  )
}
