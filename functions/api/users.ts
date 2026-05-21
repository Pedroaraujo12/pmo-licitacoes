interface Env {
  NEXT_PUBLIC_SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
}

export async function onRequest(context: { request: Request; env: Env }): Promise<Response> {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  }

  if (context.request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers })
  }

  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers })
  }

  if (!context.env.SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), { status: 500, headers })
  }

  try {
    const { email, password, name, role } = await context.request.json() as {
      email: string; password: string; name: string; role: string
    }

    if (!email || !password || !name) {
      return new Response(JSON.stringify({ error: 'Email, password e nome são obrigatórios' }), { status: 400, headers })
    }

    const res = await fetch(`${context.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${context.env.SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: context.env.SUPABASE_SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, role: role || 'visualizador', email },
      }),
    })

    if (!res.ok) {
      const err = await res.json() as { msg?: string }
      return new Response(JSON.stringify({ error: err.msg || 'Falha ao criar usuário' }), {
        status: res.status, headers,
      })
    }

    const userData = await res.json() as { id: string }

    // Also create profile row with email
    await fetch(`${context.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${context.env.SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: context.env.SUPABASE_SERVICE_ROLE_KEY,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        id: userData.id,
        name,
        email,
        role: role || 'visualizador',
      }),
    })

    return new Response(JSON.stringify({ id: userData.id }), { status: 200, headers })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message || 'Erro interno' }), {
      status: 500, headers,
    })
  }
}
