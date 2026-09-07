import {createClient} from 'npm:@supabase/supabase-js@2.100.0'
import {buildTadaWindEmailHtml, buildTadaWindEmailPlainText} from '../_shared/prospector/email-signature.js'
import {errorCode, json, serviceClient} from '../_shared/prospector/runtime.ts'

// Envoi Outlook via Microsoft Graph.
//
// Règle de conception : aucun premier contact ne part automatiquement. Cette
// fonction n'est atteignable que sur un message DÉJÀ approuvé, à la suite d'un
// clic humain, et la réservation comme la confirmation sont faites avec le JWT
// de l'utilisateur — c'est donc son identité qui est inscrite dans `sent_by`.
//
// Les identifiants Microsoft vivent exclusivement dans les secrets Supabase.
// Rien n'est exposé au navigateur : le front n'apprend que « configuré ou non ».

const GRAPH = 'https://graph.microsoft.com/v1.0'
const CONFIG_KEYS = ['MS_GRAPH_TENANT_ID', 'MS_GRAPH_CLIENT_ID', 'MS_GRAPH_CLIENT_SECRET', 'MS_GRAPH_SENDER'] as const

function readConfig() {
  const values = Object.fromEntries(CONFIG_KEYS.map(key => [key, (Deno.env.get(key) ?? '').trim()]))
  const missing = CONFIG_KEYS.filter(key => !values[key])
  return {values, missing, configured: missing.length === 0}
}

async function graphToken(cfg: Record<string, string>) {
  const body = new URLSearchParams({
    client_id: cfg.MS_GRAPH_CLIENT_ID,
    client_secret: cfg.MS_GRAPH_CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  })
  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(cfg.MS_GRAPH_TENANT_ID)}/oauth2/v2.0/token`, {
    method: 'POST', headers: {'content-type': 'application/x-www-form-urlencoded'}, body,
    signal: AbortSignal.timeout(20000),
  })
  if (!response.ok) { await response.body?.cancel(); throw new Error('GRAPH_AUTH_FAILED') }
  const data = await response.json()
  if (typeof data?.access_token !== 'string') throw new Error('GRAPH_AUTH_FAILED')
  return data.access_token as string
}

async function graphSend(token: string, sender: string, to: string, subject: string, html: string, text: string) {
  const response = await fetch(`${GRAPH}/users/${encodeURIComponent(sender)}/sendMail`, {
    method: 'POST',
    headers: {authorization: `Bearer ${token}`, 'content-type': 'application/json'},
    body: JSON.stringify({
      message: {
        subject: subject || '(sans objet)',
        body: {contentType: 'HTML', content: html},
        toRecipients: [{emailAddress: {address: to}}],
        // Repli lisible pour les clients qui refusent le HTML.
        internetMessageHeaders: [{name: 'x-tadawind-plain-length', value: String(text.length)}],
      },
      saveToSentItems: true,
    }),
    signal: AbortSignal.timeout(30000),
  })
  if (response.status === 202) return
  const detail = await response.text().catch(() => '')
  await response.body?.cancel().catch(() => {})
  // 4xx : la requête est en cause, réessayer à l'identique ne servirait à rien.
  throw new Error(response.status >= 500 || response.status === 429 ? 'GRAPH_UNAVAILABLE' : 'GRAPH_REJECTED')
}

Deno.serve(async request => {
  if (request.method !== 'POST') return json({error: 'METHOD_NOT_ALLOWED'}, 405)
  const authorization = request.headers.get('authorization') ?? ''
  if (!authorization.toLowerCase().startsWith('bearer ')) return json({error: 'UNAUTHORIZED'}, 401)

  let payload: {probe?: boolean; message_id?: string; revision?: number}
  try { payload = await request.json() } catch { return json({error: 'INVALID_INPUT'}, 400) }

  const cfg = readConfig()
  // Sonde : permet au front de désactiver le bouton sans jamais rien apprendre
  // des identifiants eux-mêmes.
  // `sender` est l'adresse d'expédition publique, pas un secret : elle sert au
  // libellé du bouton. Aucun identifiant n'est jamais renvoyé.
  if (payload.probe) return json({configured: cfg.configured, missing: cfg.missing, sender: cfg.values.MS_GRAPH_SENDER || null})
  if (!cfg.configured) return json({error: 'GRAPH_NOT_CONFIGURED', missing: cfg.missing}, 503)

  if (typeof payload.message_id !== 'string' || !Number.isInteger(payload.revision)) return json({error: 'INVALID_INPUT'}, 400)

  // Client portant le JWT de l'utilisateur : les RPC de décision restent soumises
  // à prospector_require_user(), et l'envoi est attribué à la bonne personne.
  const asUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: {headers: {authorization}}, auth: {persistSession: false, autoRefreshToken: false},
  })

  const claimed = await asUser.rpc('prospector_begin_send', {p_id: payload.message_id, p_expected_revision: payload.revision})
  if (claimed.error) return json({error: errorCode(new Error(claimed.error.message))}, 409)

  try {
    const context = await serviceClient().rpc('prospector_send_context', {p_id: payload.message_id})
    if (context.error) throw new Error('SEND_CONTEXT_FAILED')
    const {recipient, subject, body} = context.data as {recipient: string | null; subject: string | null; body: string}
    if (!recipient) throw new Error('NO_RECIPIENT_EMAIL')

    const token = await graphToken(cfg.values)
    await graphSend(token, cfg.values.MS_GRAPH_SENDER, recipient, subject ?? '', buildTadaWindEmailHtml(body), buildTadaWindEmailPlainText(body))

    // Le message ne passe à `sent` qu'après un accusé de Graph.
    const confirmed = await asUser.rpc('prospector_confirm_message_sent', {
      p_id: payload.message_id, p_expected_revision: payload.revision, p_reference: `graph:${cfg.values.MS_GRAPH_SENDER}`,
    })
    if (confirmed.error) return json({sent: true, warning: 'CONFIRM_FAILED', detail: confirmed.error.message}, 207)
    return json({sent: true, recipient})
  } catch (error) {
    const code = errorCode(error)
    // On libère la réservation pour qu'une nouvelle tentative explicite reste possible.
    await asUser.rpc('prospector_release_send', {p_id: payload.message_id, p_reason: code})
    return json({error: code}, code === 'GRAPH_UNAVAILABLE' ? 503 : 502)
  }
})
