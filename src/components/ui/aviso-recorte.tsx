'use client'

/**
 * Aviso de que a tela abriu com os filtros da visita anterior.
 *
 * Sem ele, alguém que volte à tela dias depois vê quatro registros onde
 * existem setenta e conclui que o sistema perdeu dados. O recorte precisa ser
 * visível e ter uma saída num clique.
 */
export function AvisoRecorte({
  descricao,
  onVerTodos,
  onManter,
}: {
  descricao: string
  onVerTodos: () => void
  onManter: () => void
}) {
  if (!descricao) return null

  return (
    <div style={{
      marginBottom: 14, padding: '8px 12px', borderRadius: 8,
      background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.25)',
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10,
      fontSize: 12, color: '#cbd5e1',
    }}>
      <span>
        Filtros da sua última visita: <strong style={{ color: '#e2e8f0' }}>{descricao}</strong>
      </span>
      <button
        type="button"
        onClick={onVerTodos}
        style={{
          padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 999,
          cursor: 'pointer', background: 'transparent', color: '#38bdf8',
          border: '1px solid rgba(56,189,248,0.4)',
        }}
      >
        Ver todos
      </button>
      <button
        type="button"
        onClick={onManter}
        style={{
          padding: '4px 10px', fontSize: 11, borderRadius: 999, marginLeft: 'auto',
          cursor: 'pointer', background: 'transparent', color: '#94a3b8',
          border: '1px solid rgba(255,255,255,0.15)',
        }}
      >
        Manter
      </button>
    </div>
  )
}
