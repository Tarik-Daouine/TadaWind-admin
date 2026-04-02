// OBSOLETE.
// L'import Streamable n'utilise plus d'Edge Function de listing.
// Le flux officiel est: bookmarklet Streamable -> ?streamable_ids=... -> import cote admin.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  return new Response(
    JSON.stringify({
      error: 'streamable-list is obsolete. Use the Streamable bookmarklet import flow instead.',
    }),
    { status: 410, headers: { ...CORS, 'Content-Type': 'application/json' } },
  )
})
