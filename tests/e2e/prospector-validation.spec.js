import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'

// File « À valider » : parcours complet édition -> approbation -> envoi confirmé,
// avec la couche REST Supabase simulée (aucun appel IA, aucun message envoyé).

const env = Object.fromEntries(readFileSync('.env', 'utf8').split(/\r?\n/).filter(line => line.includes('=')).map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1).replace(/^['"]|['"]$/g, '')] }))
const ref = new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
const accessToken = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ aud: 'authenticated', role: 'authenticated', sub: '11111111-1111-4111-8111-111111111111', email: 'test@local.invalid', exp: Math.floor(Date.now() / 1000) + 3600 })}.test-signature`
const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'test@local.invalid', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-09-05T00:00:00Z' }

const PROSPECT_ID = 'aaaaaaaa-0000-4000-8000-00000000e001'
const SOURCE_ID = 'aaaaaaaa-0000-4000-8000-00000000e5f1'
const FACT = 'Votre domaine met en avant les mariages.'

const prospect = {
  id: PROSPECT_ID, name: 'Domaine de la Vézère', category: 'hotels', city: 'Sarlat',
  distance_km: 32, score: 87, priority: 'hot', status: 'to_validate',
  score_reasons: ['Adéquation Tada Wind : 21.25/25 (note 85/100)', 'Distance : 32 km → 3.00/5', 'Contact : email direct → 5.00/5'],
  strategy: { recommended_channel: 'email' }, analysis: { summary: 'Domaine événementiel.' },
  next_action_at: null, deleted_at: null, discovered_at: '2026-09-05T08:00:00Z', updated_at: '2026-09-05T09:00:00Z',
}

const citation = { source_id: SOURCE_ID, type: 'website_page', url: 'https://domaine.invalid/', path: 'email.body', claim: FACT, evidence_quote: 'Nos mariages au domaine' }
function message(channel, extra = {}) {
  return {
    id: `aaaaaaaa-0000-4000-8000-0000000m${channel.slice(0, 4).padEnd(4, '0')}`.slice(0, 36),
    prospect_id: PROSPECT_ID, channel, kind: 'first_touch',
    subject: channel === 'email' ? 'Une idée de vidéo pour le domaine' : null,
    body: `${FACT} Je vous propose une visite drone.`,
    sources_used: [{ ...citation, path: `${channel}.body` }],
    variables: { grounding: [], tone_check: { generic: false, fake_compliment: false, corporate: false }, confidence: 0.7 },
    status: 'draft', revision: 1, validated_revision: 1, created_at: '2026-09-05T10:00:00Z', ...extra,
  }
}

test('valide un brouillon : édition, approbation, puis envoi confirmé manuellement', async ({ page }, testInfo) => {
  let messages = [message('email'), message('instagram_dm'), message('linkedin'), message('phone_script')]
  const calls = []

  await page.addInitScript(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)),
    { key: `sb-${ref}-auth-token`, session: { access_token: accessToken, refresh_token: 'local-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user } })

  // Sonde de configuration : le serveur répond « non configuré », comme en
  // l'absence de secrets Microsoft.
  await page.route('**/functions/v1/prospector-send-email', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ configured: false, missing: ['MS_GRAPH_TENANT_ID'], sender: null }),
  }))
  await page.route('**/rest/v1/**', async route => {
    const request = route.request(), url = new URL(request.url())
    const json = body => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/1' }, body: JSON.stringify(body) })

    if (request.method() === 'GET' && url.pathname.endsWith('/prospects')) {
      // Le compteur de la sidebar demande seulement l'id ; la file demande la fiche complète.
      return url.searchParams.get('select') === 'id' ? json([]) : json([prospect])
    }
    if (request.method() === 'GET' && url.pathname.endsWith('/prospect_messages')) return json(messages)

    if (request.method() === 'POST' && url.pathname.endsWith('/rpc/prospector_review_message')) {
      const body = JSON.parse(request.postData() || '{}')
      calls.push(body)
      const index = messages.findIndex(item => item.id === body.p_id)
      const target = messages[index]
      if (body.p_expected_revision !== target.revision) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'MESSAGE_CONFLICT' }) })
      let updated = target
      if (body.p_action === 'edit') {
        const patched = { ...target, ...body.p_patch, revision: target.revision + 1, status: 'draft' }
        // Le serveur retire les citations dont le constat a disparu du texte.
        const hay = `${patched.subject ?? ''}\n${patched.body ?? ''}`
        patched.sources_used = target.sources_used.filter(item => hay.includes(item.claim))
        patched.validated_revision = patched.revision
        updated = patched
      }
      if (body.p_action === 'approve') updated = { ...target, status: 'approved' }
      messages = messages.map(item => item.id === updated.id ? updated : item)
      return json(updated)
    }
    if (request.method() === 'POST' && url.pathname.endsWith('/rpc/prospector_confirm_message_sent')) {
      calls.push(JSON.parse(request.postData() || '{}'))
      return json({ ...messages[0], status: 'sent' })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: '[]' })
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Prospection' }).click()
  await page.getByRole('tab', { name: 'À valider' }).click()

  // Le prospect, son score et la justification sont visibles d'emblée.
  await expect(page.getByRole('heading', { name: 'Domaine de la Vézère' })).toBeVisible()
  await expect(page.getByText('87/100')).toBeVisible()
  await expect(page.getByText('🔥 Très chaud')).toBeVisible()
  await expect(page.getByText('Distance : 32 km → 3.00/5')).toBeVisible()

  // Les quatre canaux sont proposés, l'email (recommandé) est ouvert par défaut.
  for (const label of ['Email', 'DM Instagram', 'LinkedIn', 'Script téléphone']) {
    await expect(page.getByRole('tab', { name: new RegExp(label) })).toBeVisible()
  }
  await expect(page.getByLabel('Objet du message')).toHaveValue('Une idée de vidéo pour le domaine')

  // La preuve derrière le constat est affichée.
  await expect(page.getByText(`« ${FACT} »`)).toBeVisible()
  await expect(page.getByText('Source website_page : « Nos mariages au domaine »')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('validation-queue.png') })

  // Approuver est bloqué tant qu'une modification n'est pas enregistrée.
  const body = page.getByLabel('Corps du message')
  await body.fill(`${FACT} Je vous propose une visite drone du domaine au printemps.`)
  await expect(page.getByRole('button', { name: /Approuver/ })).toBeDisabled()
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('Message enregistré')).toBeVisible()

  // Après enregistrement, l'humain est l'auteur : la révision monte et l'approbation redevient possible.
  await expect(page.getByText(/rév\. 2/)).toBeVisible()
  await page.getByRole('button', { name: /Approuver/ }).click()
  await expect(page.getByText('Message approuvé')).toBeVisible()

  // L'envoi reste manuel et explicite.
  await expect(page.getByText('Rien ne part sans ton clic.', { exact: false })).toBeVisible()

  // Tant que le serveur ne déclare pas Microsoft Graph configuré, l'envoi direct
  // reste fermé : c'est la garantie qu'aucun premier contact ne peut partir seul.
  const sendButton = page.getByRole('button', { name: /Envoyer depuis Outlook/ })
  await expect(sendButton).toBeDisabled()
  await expect(page.getByText(/Microsoft Graph n’est pas configuré/)).toBeVisible()

  await page.getByLabel('Référence de l’envoi').fill('thread-142')
  await page.screenshot({ path: testInfo.outputPath('validation-approved.png'), fullPage: true })
  await page.getByRole('button', { name: 'Je l’ai envoyé' }).click()
  await expect(page.getByText('Prospect passé en « Contacté »')).toBeVisible()

  const actions = calls.map(call => call.p_action ?? 'confirm_sent')
  expect(actions).toEqual(['edit', 'approve', 'confirm_sent'])
  expect(calls[1].p_expected_revision).toBe(2)
})

test('refuser un prospect exige un motif et le sort de la file', async ({ page }) => {
  let rejected = null
  await page.addInitScript(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)),
    { key: `sb-${ref}-auth-token`, session: { access_token: accessToken, refresh_token: 'local-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user } })
  await page.route('**/rest/v1/**', async route => {
    const request = route.request(), url = new URL(request.url())
    const json = body => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/1' }, body: JSON.stringify(body) })
    if (request.method() === 'GET' && url.pathname.endsWith('/prospects')) {
      return url.searchParams.get('select') === 'id' ? json([]) : json(rejected ? [] : [prospect])
    }
    if (request.method() === 'GET' && url.pathname.endsWith('/prospect_messages')) return json(rejected ? [] : [message('email')])
    if (request.method() === 'POST' && url.pathname.endsWith('/rpc/prospector_reject_prospect')) {
      rejected = JSON.parse(request.postData() || '{}')
      return json({ ...prospect, status: 'archived' })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: '[]' })
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Prospection' }).click()
  await page.getByRole('tab', { name: 'À valider' }).click()
  await page.getByRole('button', { name: /Refuser/ }).click()
  await expect(page.getByRole('button', { name: 'Écarter' })).toBeDisabled()
  await page.getByRole('button', { name: 'Trop loin' }).click()
  await page.getByRole('button', { name: 'Écarter' }).click()

  await expect(page.getByText('Aucun message à valider')).toBeVisible()
  expect(rejected.p_reason).toBe('trop_loin')
})

test('génère un autre canal à la demande sans remplacer le brouillon affiché', async ({ page }) => {
  const calls = []
  await page.addInitScript(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)),
    { key: 'sb-'+ref+'-auth-token', session: { access_token: accessToken, refresh_token: 'local-refresh', expires_at: Math.floor(Date.now()/1000)+3600, expires_in:3600, token_type:'bearer', user } })
  await page.route('**/rest/v1/**', async route => {
    const request=route.request(), url=new URL(request.url())
    const json=body=>route.fulfill({status:200,contentType:'application/json',headers:{'content-range':'0-0/1'},body:JSON.stringify(body)})
    if(url.pathname.endsWith('/prospector_settings')) return json({channels:{email:true,instagram:true,linkedin:false,phone:false}})
    if(url.pathname.endsWith('/prospects')) return json([{...prospect,email:'test@local.invalid',instagram:'https://instagram.com/test'}])
    if(url.pathname.endsWith('/prospect_messages')) return json([message('email',{status:'approved'})])
    if(url.pathname.endsWith('/rpc/prospector_request_channel')) {calls.push(request.postDataJSON());return json({id:'test-job',status:'queued'})}
    return json([])
  })
  await page.goto('/')
  await page.getByRole('button',{name:'Prospection'}).click()
  await page.getByRole('tab',{name:'À valider'}).click()
  await expect(page.getByRole('tab',{name:/Email/})).toBeVisible()
  await expect(page.getByRole('tab',{name:'DM Instagram'})).toHaveCount(0)
  await expect(page.getByRole('button',{name:'Régénérer ce canal'})).toBeDisabled()
  await page.getByLabel('Canal à générer').selectOption('instagram_dm')
  await page.getByRole('button',{name:'Générer ce canal',exact:true}).click()
  await expect.poll(()=>calls).toEqual([{p_id:PROSPECT_ID,p_channel:'instagram_dm'}])
  await expect(page.getByLabel('Corps du message')).toHaveValue(message('email').body)
})
