const cache = new Map<string, { data: unknown; timestamp: number }>()
const DEFAULT_TTL = 10 * 60 * 1000

export async function cachedQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl = DEFAULT_TTL,
): Promise<T> {
  const cached = cache.get(key)
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data as T
  }
  const data = await fetcher()
  cache.set(key, { data, timestamp: Date.now() })
  return data
}

export function invalidateCache(key?: string) {
  if (key) {
    cache.delete(key)
  } else {
    cache.clear()
  }
}
