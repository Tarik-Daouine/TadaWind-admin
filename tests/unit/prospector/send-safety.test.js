import { beforeEach, afterEach, it, expect, vi } from 'vitest'
const state = vi.hoisted(() => ({ handler: null, user: vi.fn(), service: vi.fn() }))
vi.mock('npm:@supabase/supabase-js@2.100.0', () => ({ createClient: () => ({ rpc: state.user }) }))
vi.mock('../../../supabase/functions/_shared/prospector/runtime.ts', () => ({
  serviceClient: () => ({ rpc: state.service }), errorCode: e => e.message,
  json: (body, status = 200) => Response.json(body, { status }),
}))
const lock = '2026-09-07T18:00:00.123456+00:00'
let network
beforeEach(async () => {
  vi.resetModules(); state.user.mockReset(); state.service.mockReset()
  state.user.mockImplementation(async name => name === 'prospector_begin_send' ? { data: { send_lock_at: lock } } : { data: {} })
  state.service.mockImplementation(async name => name === 'prospector_send_context'
    ? { data: { recipient: 'test@example.invalid', subject: 'Objet', body: 'Bonjour', revision: 1, status: 'approved' } } : { data: null })
  network = vi.fn().mockResolvedValueOnce(Response.json({ access_token: 'fixture' })).mockResolvedValue(new Response(null, { status: 202 }))
  vi.stubGlobal('fetch', network)
  vi.stubGlobal('Deno', { env: { get: () => 'fixture' }, serve: handler => { state.handler = handler } })
  await import('../../../supabase/functions/prospector-send-email/index.ts')
})
afterEach(() => vi.unstubAllGlobals())
const request = () => state.handler(new Request('http://local/', { method: 'POST', headers: { authorization: 'Bearer fixture' }, body: JSON.stringify({ message_id: 'fixture-id', revision: 1 }) }))
const releases = () => state.service.mock.calls.filter(([name]) => name === 'prospector_release_send')

it('ne libère jamais après un timeout sendMail', async () => {
  network.mockReset().mockResolvedValueOnce(Response.json({ access_token: 'fixture' })).mockRejectedValueOnce(new Error('timeout'))
  expect(await (await request()).json()).toEqual({ error: 'SEND_OUTCOME_UNKNOWN' })
  expect(releases()).toHaveLength(0)
})
it.each([408, 500, 503])('conserve le verrou après HTTP %s', async status => {
  network.mockReset().mockResolvedValueOnce(Response.json({ access_token: 'fixture' })).mockResolvedValueOnce(new Response(null, { status }))
  expect(await (await request()).json()).toEqual({ error: 'SEND_OUTCOME_UNKNOWN' })
  expect(releases()).toHaveLength(0)
})
it.each([400, 401, 403, 429])('libère seulement sa tentative après refus explicite HTTP %s', async status => {
  network.mockReset().mockResolvedValueOnce(Response.json({ access_token: 'fixture' })).mockResolvedValueOnce(new Response(null, { status }))
  await request()
  expect(releases()).toEqual([['prospector_release_send', { p_id: 'fixture-id', p_lock_at: lock, p_reason: status === 429 ? 'GRAPH_RATE_LIMITED' : 'GRAPH_REJECTED' }]])
})
it.each([false, true])('conserve le verrou après acceptation puis échec de suivi (exception=%s)', async thrown => {
  state.user.mockImplementation(async name => {
    if (name === 'prospector_begin_send') return { data: { send_lock_at: lock } }
    if (thrown) throw new Error('network')
    return { error: { message: 'db failed' } }
  })
  const res = await request()
  expect(res.status).toBe(207)
  expect(await res.json()).toEqual({ accepted: true, warning: 'CONFIRM_FAILED' })
  expect(releases()).toHaveLength(0)
})
it('autorise une nouvelle tentative si l’auth Microsoft échoue avant sendMail', async () => {
  network.mockReset().mockRejectedValue(new Error('token timeout'))
  await request()
  expect(network).toHaveBeenCalledTimes(1)
  expect(releases()).toHaveLength(1)
})
it('ne contacte pas Microsoft si la réservation est déjà verrouillée', async () => {
  state.user.mockResolvedValue({ error: { message: 'SEND_RECONCILIATION_REQUIRED' } })
  expect((await request()).status).toBe(409)
  expect(network).not.toHaveBeenCalled()
})
it('ne transmet pas un texte dont la révision a changé', async () => {
  state.service.mockResolvedValue({ data: { revision: 2, status: 'draft' } })
  await request()
  expect(network).not.toHaveBeenCalled()
})
it('confirme le suivi après acceptation uniquement', async () => {
  expect(await (await request()).json()).toMatchObject({ sent: true })
  expect(state.user.mock.calls.map(([name]) => name)).toEqual(['prospector_begin_send', 'prospector_confirm_message_sent'])
  expect(releases()).toHaveLength(0)
})

it('répond au preflight admin sans appeler Graph ni réserver un envoi', async () => {
  const response = await state.handler(new Request('http://local/', {method:'OPTIONS', headers:{origin:'https://tarik-daouine.github.io'}}))
  expect(response.status).toBe(204)
  expect(response.headers.get('access-control-allow-origin')).toBe('https://tarik-daouine.github.io')
  expect(network).not.toHaveBeenCalled(); expect(state.user).not.toHaveBeenCalled()
})
it('refuse une origine tierce avant toute action', async () => {
  const response = await state.handler(new Request('http://local/', {method:'POST', headers:{origin:'https://attacker.invalid'}}))
  expect(response.status).toBe(403); expect(network).not.toHaveBeenCalled()
})
it('rend les erreurs authentification lisibles par le navigateur', async () => {
  const response = await state.handler(new Request('http://local/', {method:'POST', headers:{origin:'https://tarik-daouine.github.io'}}))
  expect(response.status).toBe(401)
  expect(response.headers.get('access-control-allow-origin')).toBe('https://tarik-daouine.github.io')
})

it('envoie depuis la boîte déclarée, jamais depuis « la mienne »', async () => {
  // Un seul chemin depuis le retrait du consentement délégué : l'application
  // Microsoft, qui doit nommer explicitement la boîte d'expédition. `/me/`
  // n'aurait plus de titulaire — il désignerait l'application elle-même.
  Deno.env.get = key => key === 'MS_GRAPH_SENDER' ? 'Tada-Wind@outlook.com' : 'fixture'
  expect(await (await request()).json()).toMatchObject({ sent: true })
  expect(network.mock.calls[1][0]).toBe('https://graph.microsoft.com/v1.0/users/Tada-Wind%40outlook.com/sendMail')
  expect(network.mock.calls.some(([url]) => String(url).includes('/me/sendMail'))).toBe(false)
})

it('reste fermé tant qu’un secret Microsoft manque', async () => {
  // Sans consentement délégué possible, rien ne peut plus suppléer un secret
  // absent : la sonde doit le dire, et l'envoi refuser de partir.
  Deno.env.get = key => key === 'MS_GRAPH_CLIENT_SECRET' ? '' : 'fixture'
  const probe = await state.handler(new Request('http://local/', {
    method: 'POST', headers: { authorization: 'Bearer fixture' }, body: JSON.stringify({ probe: true }),
  }))
  expect(await probe.json()).toMatchObject({ configured: false, missing: ['MS_GRAPH_CLIENT_SECRET'] })
  expect(await (await request()).json()).toMatchObject({ error: 'GRAPH_NOT_CONFIGURED' })
  expect(network).not.toHaveBeenCalled()
})
