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

test('navigue dans Prospection et sauvegarde les réglages via la RPC protégée', async ({page},testInfo) => {
  let savedPayload
  let createdPayload
  let queuedJob = null
  await page.addInitScript(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key:`sb-${ref}-auth-token`,session:{access_token:accessToken,refresh_token:'local-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user}})
  await page.route('**/rest/v1/**', async route => {
    const request=route.request(), url=new URL(request.url())
    if(request.method()==='GET' && url.pathname.endsWith('/prospector_settings')) return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(settings)})
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
  await expect(page.getByText('Le socle de prospection est prêt')).toBeVisible()
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
