'use client'

import { useReportWebVitals } from 'next/web-vitals'

export function WebVitals() {
  useReportWebVitals((metric) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[Perf] ${metric.name}: ${metric.value.toFixed(2)}ms (${metric.rating})`)
    }
    // TODO: enviar para analytics em produção
  })
  return null
}
