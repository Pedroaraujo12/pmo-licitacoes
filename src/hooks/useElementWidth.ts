'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Largura atual de um elemento, acompanhada por ResizeObserver.
 *
 * Os gráficos do dashboard são SVG desenhados na escala real do contêiner —
 * precisam da largura em pixels para posicionar marcas e rótulos sem que o
 * viewBox estique a tipografia. `fallback` cobre o primeiro render e os
 * ambientes de teste, onde não há layout.
 */
export function useElementWidth<T extends HTMLElement>(fallback = 480) {
  const ref = useRef<T | null>(null)
  const [width, setWidth] = useState(fallback)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    /* Só aceita mudança relevante: o elemento observado contém o SVG que esta
       medida dimensiona, e re-renderizar por fração de pixel é trabalho jogado
       fora a cada arrasto de janela. */
    const aplicar = (w: number) => {
      if (w > 0) setWidth(atual => (Math.abs(w - atual) > 1 ? w : atual))
    }

    aplicar(node.getBoundingClientRect().width)

    if (typeof ResizeObserver === 'undefined') {
      const aoRedimensionar = () => aplicar(node.getBoundingClientRect().width)
      window.addEventListener('resize', aoRedimensionar)
      return () => window.removeEventListener('resize', aoRedimensionar)
    }

    // contentRect vem pronto do observer — ler o DOM aqui forçaria novo layout
    const obs = new ResizeObserver(entradas => {
      for (const e of entradas) aplicar(e.contentRect.width)
    })
    obs.observe(node)
    return () => obs.disconnect()
  }, [])

  return [ref, width] as const
}
