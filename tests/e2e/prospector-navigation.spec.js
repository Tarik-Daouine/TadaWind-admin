import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'

const env = Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).filter(line=>line.includes('=')).map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1).replace(/^['"]|['"]$/g,'')]}))
const ref = new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
const accessToken = `${encode({alg:'HS256',typ:'JWT'})}.${encode({aud:'authenticated',role:'authenticated',sub:'11111111-1111-4111-8111-111111111111',email:'test@local.invalid',exp:Math.floor(Date.now()/1000)+3600})}.test-signature`
const user = {id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'test@local.invalid',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-09-05T00:00:00Z'}
const settings = {
  id:'main',business_profile:{business:'Tada Wind',services:['vidéo promotionnelle','drone'],positioning:'prestations visuelles locales',targetCustomers:[],preferredAreas:[],portfolio:[],contactInfo:{},pitchNotes:''},
  reference_address:'Sarlat-la-Canéda',reference_lat:null,reference_lng:null,radius_preferred_km:40,radius_max_km:100,min_score:40,
  priority_thresholds:{hot:80,good:60,consider:40,low:20},distance_bands:[{max:30,points:5},{max:60,points:3},{max:100,points:1}],enabled_categories:[],disabled_categories:[],followup_delays_days:[3,7,14],
  ai_model_simple:null,ai_model_complex:null,monthly_budget_usd:null,tone:'naturel, humain, direct, sympathique, sobre',channels:{email:true,instagram:true,linkedin:true,phone:true},
  scoring_weights:{version:'2026-09-05',fit_tada_wind:25,video_interest:20,drone_interest:15,commercial_potential:15,digital_gap:10,geo_access:5,buying_signal:5,contactability:5},updated_at:'2026-09-05T12:00:00Z',
}

test('tableau de bord, relances dues et enregistrement d’une opportunité',async({page},testInfo)=>{
  let record={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',name:'Domaine suivi',status:'contacted',is_client:false,last_contacted_at:'2026-09-01T10:00:00Z',next_followup_at:'2026-09-02T10:00:00Z',updated_at:'2026-09-01T10:00:00Z',score:80,score_reasons:[],tags:[]}
  let outcome,scope
  await page.addInitScript(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key:`sb-${ref}-auth-token`,session:{access_token:accessToken,refresh_token:'local-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user}})
  await page.route('**/rest/v1/**',async route=>{
    const request=route.request(),url=new URL(request.url())
    // PostgREST expose content-range en CORS ; sans cet en-tete supabase-js lit un count nul.
    if(request.method()==='HEAD')return route.fulfill({status:200,headers:{'content-range':'0-0/1','access-control-expose-headers':'content-range'},body:''})
    if(url.pathname.endsWith('/rpc/prospector_record_outcome')){
      outcome=JSON.parse(request.postData())
      record={...record,status:outcome.p_status,next_followup_at:null,updated_at:'2026-09-06T12:00:00Z'}
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(record)})
    }
    if(url.pathname.endsWith('/prospects')){
      scope=url.searchParams
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([record])})
    }
    return route.fulfill({status:200,contentType:'application/json',body:'[]'})
  })
  await page.goto('/')
  await page.getByRole('button',{name:'Prospection',exact:true}).click()
  await page.getByRole('button',{name:'Traiter les relances dues (1)'}).click()
  await expect(page.getByText('Domaine suivi', {exact:true})).toBeVisible()
  expect(scope.get('status')).toBe('in.(contacted,followup_1,followup_2)')
  expect(scope.get('next_followup_at')).toMatch(/^lte\./)
  await page.getByText('Domaine suivi',{exact:true}).click()
  await page.getByLabel('Résultat de l’échange').selectOption('interested')
  await page.getByLabel('Compte rendu de l’échange').fill('Souhaite un rendez-vous pour discuter de la vidéo.')
  await page.getByRole('button',{name:'Enregistrer l’échange'}).click()
  await expect(page.getByText('Suivi commercial enregistré')).toBeVisible()
  expect(outcome.p_expected_updated_at).toBe('2026-09-01T10:00:00Z')
  expect(outcome.p_status).toBe('interested')
  // « Opportunités » existe aussi dans les onglets de la fiche ouverte : on cible la nav.
  await page.getByLabel('Navigation Prospection').getByRole('tab',{name:'Opportunités',exact:true}).click()
  await expect.poll(()=>scope.get('status')).toBe('in.(interested,meeting,quote)')
  await page.screenshot({path:testInfo.outputPath('prospector-followup.png'),fullPage:true})
})

test('navigue dans Prospection et sauvegarde les réglages via la RPC protégée', async ({page},testInfo) => {
  let savedPayload
  let campaignPayload
  let campaignFilter
  let createdPayload
  let queuedJob = null
  await page.addInitScript(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key:`sb-${ref}-auth-token`,session:{access_token:accessToken,refresh_token:'local-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user}})
  await page.route('**/rest/v1/**', async route => {
    const request=route.request(), url=new URL(request.url())
    if(request.method()==='GET' && url.pathname.endsWith('/prospects')) campaignFilter=url.searchParams.get('campaign_id')
    if(request.method()==='GET' && url.pathname.endsWith('/prospect_campaigns')) return route.fulfill({status:200,contentType:'application/json',headers:{'content-range':'0-1/2'},body:JSON.stringify([
      {id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',name:'Campagne hôtels',status:'done',created_at:'2026-09-06T10:00:00Z',filters:{categories:['hotels'],radius_km:40},stats:{found:12,inserted:8,skipped:4,queued_for_enrichment:6},prospect_jobs:[{type:'discovery',status:'done',updated_at:'2026-09-06T10:01:00Z'}]},
      {id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',name:'Recherche interrompue',status:'running',created_at:'2026-09-06T09:00:00Z',filters:{categories:['leisure'],radius_km:20},stats:{},prospect_jobs:[{type:'discovery',status:'error',error:'DISCOVERY_SOURCE_ERROR',updated_at:'2026-09-06T09:01:00Z'}]}
    ])})
    if(request.method()==='GET' && url.pathname.endsWith('/prospector_settings')) return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(settings)})
    if(request.method()==='POST' && url.pathname.endsWith('/rpc/prospector_start_campaign')) {
      campaignPayload=JSON.parse(request.postData()||'{}')
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',name:campaignPayload.p_name,status:'running'})})
    }
    if(request.method()==='GET' && url.pathname.endsWith('/prospect_jobs')) return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(queuedJob?[queuedJob]:[])})
    if(request.method()==='POST' && url.pathname.endsWith('/rpc/prospector_save_settings')) {
      savedPayload=JSON.parse(request.postData() || '{}')
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({...settings,...savedPayload.p_settings,min_score:45,updated_at:'2026-09-05T12:01:00Z'})})
    }
    if(request.method()==='POST' && url.pathname.endsWith('/rpc/prospector_create_prospect')) {
      createdPayload=JSON.parse(request.postData()||'{}')
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',...createdPayload.p_input,normalized_name:'hotel test',website_domain:'hotel-test.invalid',status:'new',priority:null,score:null,score_reasons:[],tags:[],updated_at:'2026-09-05T12:02:00Z',created_at:'2026-09-05T12:02:00Z'})})
    }
    if(request.method()==='POST' && url.pathname.endsWith('/rpc/prospector_request_analysis')) {
      queuedJob={id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',type:'manual_analyze',status:'queued',error:null,attempts:0,max_attempts:3,prospect_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',created_at:'2026-09-05T12:03:00Z',updated_at:'2026-09-05T12:03:00Z',run_after:'2026-09-05T12:03:00Z'}
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(queuedJob)})
    }
    return route.fulfill({status:200,contentType:'application/json',headers:{'content-range':'0-0/0'},body:'[]'})
  })
  await page.goto('/')
  await expect(page.getByRole('button',{name:'Prospection'})).toBeVisible()
  await page.getByRole('button',{name:'Prospection'}).click()
  await expect(page.getByRole('heading',{name:'Prospection'})).toBeVisible()
  await expect(page.getByRole('heading',{name:'Ce que je dois faire maintenant'})).toBeVisible()
  await page.getByRole('tab',{name:'Campagnes',exact:true}).click()
  const completed=page.getByRole('article',{name:'Campagne hôtels',exact:true})
  await expect(completed).toContainText('Recherche terminée')
  await expect(completed.locator('dd')).toHaveText(['12','8','4','6'])
  await expect(page.getByRole('article',{name:'Recherche interrompue'})).toContainText('Recherche en échec')
  await completed.getByRole('button',{name:'Voir les prospects'}).click()
  await expect(page.getByText('Aucun prospect enregistré.')).toBeVisible()
  expect(campaignFilter).toBe('eq.cccccccc-cccc-4ccc-8ccc-cccccccccccc')
  await page.getByRole('button',{name:'Afficher tous les prospects'}).click()
  await expect(page.getByRole('button',{name:'Ajouter',exact:true})).toBeVisible()
  await expect.poll(()=>campaignFilter).toBeNull()
  await page.getByRole('tab',{name:'Recherche',exact:true}).click()
  await expect(page.getByRole('button',{name:'Lancer la recherche'})).toBeDisabled()
  await page.getByLabel('Nom de la recherche').fill('Hôtels Sarlat')
  await page.getByLabel('Hôtels et hébergements').check()
  await expect(page.getByLabel('Rayon de recherche (km)')).toHaveValue('40')
  await page.getByRole('button',{name:'Lancer la recherche'}).click()
  await expect(page.getByText('Recherche « Hôtels Sarlat » enregistrée.',{exact:false})).toBeVisible()
  expect(campaignPayload).toEqual({p_name:'Hôtels Sarlat',p_filters:{categories:['hotels'],radius_km:40}})
  await expect(page.getByRole('button',{name:'Lancer la recherche'})).toBeDisabled()
  await page.getByRole('tab',{name:'Réglages'}).click()
  await expect(page.getByRole('heading',{name:'Réglages Prospection'})).toBeVisible()
  await expect(page.getByLabel('Adresse de référence')).toHaveValue('Sarlat-la-Canéda')
  await page.getByLabel('Score minimum').fill('45')
  await page.getByRole('button',{name:'Sauvegarder les réglages'}).click()
  await expect(page.getByText('Réglages Prospection sauvegardés')).toBeVisible()
  expect(savedPayload.p_expected_updated_at).toBe(settings.updated_at)
  expect(savedPayload.p_settings.min_score).toBe(45)
  expect(savedPayload.p_settings).not.toHaveProperty('id')
  await page.getByRole('tab',{name:'Prospects'}).click()
  await expect(page.getByText('Aucun prospect enregistré.')).toBeVisible()
  await page.getByRole('button',{name:'Ajouter'}).click()
  await page.getByLabel('Entreprise *').fill('Hôtel Test')
  await page.getByLabel('Ville').fill('Sarlat')
  await page.getByLabel('Site web').fill('https://hotel-test.invalid/')
  await page.getByRole('button',{name:'Ajouter',exact:true}).last().click()
  await expect(page.getByRole('heading',{name:'Hôtel Test'})).toBeVisible()
  await expect(page.getByText('Ce prospect n’a pas encore été scoré.')).toBeVisible()
  expect(createdPayload.p_input).toEqual(expect.objectContaining({name:'Hôtel Test',city:'Sarlat',website:'https://hotel-test.invalid/'}))
  await page.getByRole('button',{name:'Analyser'}).click()
  await expect(page.getByRole('status')).toContainText('Analyse du prospect en attente')
  await page.screenshot({path:testInfo.outputPath('prospector-settings.png'),fullPage:true})
})
