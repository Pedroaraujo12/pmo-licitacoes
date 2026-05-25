export function markPerf(label: string) {
  if (typeof window === 'undefined') return
  const now = performance.now()
  console.info(`[PERF] ${label}: ${Math.round(now)}ms`)
}

export function measureAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now()
  return fn().finally(() => {
    const end = performance.now()
    console.info(`[PERF] ${label}: ${Math.round(end - start)}ms`)
  })
}
