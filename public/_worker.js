const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; script-src 'self' 'unsafe-inline'; connect-src 'self' https://qakrpkwmhlpynrphucfl.supabase.co wss://qakrpkwmhlpynrphucfl.supabase.co",
}

function withHeaders(response, request) {
  const url = new URL(request.url)
  const headers = new Headers(response.headers)

  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value)
  }

  if (url.pathname.startsWith('/_next/static/') || url.pathname.endsWith('.woff2')) {
    headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  }

  if (url.pathname.startsWith('/pmo-dashboard')) {
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    headers.set('Pragma', 'no-cache')
    headers.set('Expires', '0')
  }

  headers.delete('Access-Control-Allow-Origin')
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

const worker = {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request)
    return withHeaders(response, request)
  },
}

export default worker
