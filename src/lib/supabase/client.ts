import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | null = null
const LEGACY_ACCESS_TOKEN_COOKIE = 'pmo_sb_access_token'

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error('Configuração do Supabase ausente: verifique NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.')
  }

  return { url, anonKey }
}

function clearLegacyAccessTokenCookie() {
  document.cookie = `${LEGACY_ACCESS_TOKEN_COOKIE}=; Path=/; SameSite=Lax; Secure; Max-Age=0`
  document.cookie = `${LEGACY_ACCESS_TOKEN_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`
}

export function createClient(): SupabaseClient {
  if (typeof window === 'undefined') {
    // Client Components are evaluated during static prerender; the real
    // browser client is created after hydration.
    return null as unknown as SupabaseClient
  }
  if (!browserClient) {
    const { url, anonKey } = getSupabaseConfig()
    clearLegacyAccessTokenCookie()
    browserClient = createSupabaseClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  }
  return browserClient
}
