import {createClient} from 'npm:@supabase/supabase-js@2.100.0'
import {buildTadaWindEmailHtml, buildTadaWindEmailPlainText} from '../_shared/prospector/email-signature.js'
import {outlookToken} from '../_shared/prospector/automation-runtime.ts'
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
//
// La boîte est un compte Outlook personnel : l'envoi utilise exclusivement la
// permission déléguée Mail.Send accordée par son propriétaire.

const GRAPH = 'https://graph.microsoft.com/v1.0'
async function readConfig() {
  const app_configured=Boolean(Deno.env.get('MS_OAUTH_CLIENT_ID')&&Deno.env.get('MS_OAUTH_CLIENT_SECRET')&&Deno.env.get('AUTOMATION_ENCRYPTION_KEY'))
  const connection=await serviceClient().from('automation_connections').select('sender').eq('id','outlook').maybeSingle()
  if(connection.error)return {configured:false,app_configured,connected:false,sender:null}
  return {configured:app_configured&&Boolean(connection.data),app_configured,connected:Boolean(connection.data),sender:connection.data?.sender||null}
}

async function graphSend(token: string, to: string, subject: string, html: string, text: string) {
  const response = await fetch(`${GRAPH}/me/sendMail`, {
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
  await response.body?.cancel().catch(() => {})
  // Seul un refus explicite autorise à libérer la réservation. 408/5xx sont ambigus.
  throw new Error(response.status === 429 ? 'GRAPH_RATE_LIMITED'
    : response.status >= 400 && response.status < 500 && response.status !== 408 ? 'GRAPH_REJECTED' : 'SEND_OUTCOME_UNKNOWN')
}

async function handleRequest(request: Request) {
  if (request.method !== 'POST') return json({error: 'METHOD_NOT_ALLOWED'}, 405)
  const authorization = request.headers.get('authorization') ?? ''
  if (!authorization.toLowerCase().startsWith('bearer ')) return json({error: 'UNAUTHORIZED'}, 401)

  let payload: {probe?: boolean; message_id?: string; revision?: number}
  try { payload = await request.json() } catch { return json({error: 'INVALID_INPUT'}, 400) }

  const cfg = await readConfig()
  // Sonde : permet au front de désactiver le bouton sans jamais rien apprendre
  // des identifiants eux-mêmes.
  // `sender` est l'adresse d'expédition publique, pas un secret : elle sert au
  // libellé du bouton. Aucun identifiant n'est jamais renvoyé.
  if (payload.probe) return json(cfg)
  if (!cfg.configured) return json({error: cfg.app_configured?'OUTLOOK_NOT_CONNECTED':'GRAPH_NOT_CONFIGURED'}, 503)

  if (typeof payload.message_id !== 'string' || !Number.isInteger(payload.revision)) return json({error: 'INVALID_INPUT'}, 400)

  // Client portant le JWT de l'utilisateur : les RPC de décision restent soumises
  // à prospector_require_user(), et l'envoi est attribué à la bonne personne.
  const asUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: {headers: {authorization}}, auth: {persistSession: false, autoRefreshToken: false},
  })

  const claimed = await asUser.rpc('prospector_begin_send', {p_id: payload.message_id, p_expected_revision: payload.revision})
  if (claimed.error) return json({error: errorCode(new Error(claimed.error.message))}, 409)

  let dispatchStarted = false
  let accepted = false
  try {
    const context = await serviceClient().rpc('prospector_send_context', {p_id: payload.message_id})
    if (context.error) throw new Error('SEND_CONTEXT_FAILED')
    if (context.data.revision !== payload.revision || context.data.status !== 'approved') throw new Error('MESSAGE_CONFLICT')
    const {recipient, subject, body} = context.data as {recipient: string | null; subject: string | null; body: string}
    if (!recipient) throw new Error('NO_RECIPIENT_EMAIL')

    const outlook = await outlookToken()
    const html = buildTadaWindEmailHtml(body), text = buildTadaWindEmailPlainText(body)
    dispatchStarted = true
    await graphSend(outlook.token, recipient, subject ?? '', html, text)
    accepted = true

    // Le message ne passe à `sent` qu'après un accusé de Graph.
    const confirmed = await asUser.rpc('prospector_confirm_message_sent', {
      p_id: payload.message_id, p_expected_revision: payload.revision, p_reference: `graph:${outlook.sender}`,
    })
    if (confirmed.error) return json({accepted: true, warning: 'CONFIRM_FAILED'}, 207)
    return json({sent: true, recipient})
  } catch (error) {
    const code = errorCode(error)
    if (accepted) return json({accepted: true, warning: 'CONFIRM_FAILED'}, 207)
    if (dispatchStarted && !['GRAPH_REJECTED','GRAPH_RATE_LIMITED'].includes(code)) {
      return json({error: 'SEND_OUTCOME_UNKNOWN'}, 502)
    }
    // Aucune requête sendMail émise, ou refus HTTP explicite. Libération liée à cette tentative.
    try {
      const released = await serviceClient().rpc('prospector_release_send', {
        p_id: payload.message_id, p_lock_at: claimed.data.send_lock_at, p_reason: code,
      })
      if (released.error) return json({error: 'SEND_RECONCILIATION_REQUIRED'}, 502)
    } catch { return json({error: 'SEND_RECONCILIATION_REQUIRED'}, 502) }
    return json({error: code}, 502)
  }
 }

// The browser preflight never reaches authentication or Graph. Actual POSTs
// retain their JWT/RPC authorization; CORS is not an authorization mechanism.
Deno.serve(async request => {
  const origin = request.headers.get('origin');
  const allowed = !origin || origin === 'https://tarik-daouine.github.io'
    || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
  if (!allowed) return json({error: 'ORIGIN_NOT_ALLOWED'}, 403);
  const headers = {
    'Access-Control-Allow-Origin': origin || 'https://tarik-daouine.github.io',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Vary': 'Origin',
  };
  if (request.method === 'OPTIONS') return new Response(null, {status: 204, headers});
  let response: Response;
  try { response = await handleRequest(request); }
  catch { response = json({error: 'INTERNAL_ERROR'}, 500); }
  for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
  return response;
});
