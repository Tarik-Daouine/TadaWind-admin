// Edge Function — Liste les vidéos du compte Streamable
// Credentials stockés dans les secrets Supabase (jamais exposés au navigateur)
// Déploiement : Supabase Dashboard → Edge Functions → streamable-list

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  const email    = Deno.env.get('STREAMABLE_EMAIL')
  const password = Deno.env.get('STREAMABLE_PASSWORD')

  if (!email || !password) {
    return new Response(
      JSON.stringify({ error: 'Secrets STREAMABLE_EMAIL / STREAMABLE_PASSWORD manquants' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  }

  const auth = btoa(`${email}:${password}`)

  try {
    const res = await fetch('https://api.streamable.com/videos', {
      headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
    })

    if (res.status === 401) {
      return new Response(
        JSON.stringify({ error: 'Identifiants Streamable incorrects' }),
        { status: 401, headers: { ...CORS, 'Content-Type': 'application/json' } },
      )
    }

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: `Streamable API ${res.status}` }),
        { status: res.status, headers: { ...CORS, 'Content-Type': 'application/json' } },
      )
    }

    const data = await res.json()
    // Normalise la réponse : on retourne toujours { videos: [...] }
    const videos = Array.isArray(data) ? data : (data.videos || data.results || [])

    return new Response(
      JSON.stringify({ videos }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  }
})
