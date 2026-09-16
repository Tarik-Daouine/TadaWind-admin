import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'

const env = Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).filter(line=>line.includes('=')).map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1).replace(/^['"]|['"]$/g,'')]}))
const ref = new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
const accessToken = `${encode({alg:'HS256',typ:'JWT'})}.${encode({aud:'authenticated',role:'authenticated',sub:'11111111-1111-4111-8111-111111111111',email:'test@local.invalid',exp:Math.floor(Date.now()/1000)+3600})}.test-signature`
const user = {id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'test@local.invalid',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-09-05T00:00:00Z'}

test('the OAuth return opens settings but the panel still uses server state',async({page})=>{
  await page.addInitScript(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key:`sb-${ref}-auth-token`,session:{access_token:accessToken,refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+3600,user}})
  await page.route('**/*',route=>{
    const url=new URL(route.request().url())
    if(['localhost','127.0.0.1'].includes(url.hostname))return route.continue()
    let data=[]
    if(url.pathname.endsWith('/auth/v1/user'))data=user
    if(url.pathname.endsWith('/rest/v1/settings'))data={id:'main'}
    if(url.pathname.endsWith('/functions/v1/automation-status'))data={provider:'brevo',configured:false,contact_enabled:false,attempts_24h:300,limit_24h:300}
    if(url.pathname.endsWith('/functions/v1/automation-outlook'))data={app_configured:true,connected:true,sender:'tada-wind@outlook.com'}
    if(url.pathname.endsWith('/rest/v1/automation_outbox'))data=[{id:'fixture',kind:'contact_receipt',recipient:'test@example.invalid',status:'unknown',provider:'brevo',error_code:'SEND_OUTCOME_UNKNOWN'}]
    return route.fulfill({status:200,contentType:'application/json',headers:{'content-range':'0-0/0'},body:JSON.stringify(data)})
  })
  await page.goto('/?outlook=connected')
  await expect(page.getByRole('heading',{name:'Automatisations internes'})).toBeVisible()
  await expect(page.getByText('Emails du formulaire : Brevo — configuration en attente',{exact:false})).toBeVisible()
  await expect(page.getByRole('button',{name:'Reconnecter Outlook',exact:true})).toBeEnabled()
  await expect(page.getByText('La boîte Outlook personnelle est connectée.')).toBeVisible()
  await expect(page.getByText('connectée — tada-wind@outlook.com',{exact:false})).toBeVisible()
  await expect(page.getByText('Tentatives sur 24 heures : 300 / 300.',{exact:false})).toBeVisible()
  await expect(page.getByText('Résultat incertain — vérifier le journal du service',{exact:false})).toBeVisible()
  await page.screenshot({path:'test-results/automations-panel.png',fullPage:true})
})

test('an unrelated automation failure does not hide the Outlook connection',async({page})=>{
  await page.addInitScript(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key:`sb-${ref}-auth-token`,session:{access_token:accessToken,refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+3600,user}})
  await page.route('**/*',route=>{
    const url=new URL(route.request().url())
    if(['localhost','127.0.0.1'].includes(url.hostname))return route.continue()
    if(url.pathname.endsWith('/auth/v1/user'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(user)})
    if(url.pathname.endsWith('/rest/v1/settings'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:'main'})})
    if(url.pathname.endsWith('/functions/v1/automation-status'))return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'STATUS_UNAVAILABLE'})})
    if(url.pathname.endsWith('/functions/v1/automation-outlook'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({app_configured:true,connected:false,sender:null})})
    if(url.pathname.endsWith('/rest/v1/automation_outbox'))return route.fulfill({status:200,contentType:'application/json',headers:{'content-range':'*/0'},body:'[]'})
    return route.fulfill({status:200,contentType:'application/json',body:'[]'})
  })
  await page.goto('/')
  await page.getByRole('button',{name:'Réglages',exact:true}).click()
  await expect(page.getByRole('alert')).toContainText('Le suivi Brevo est momentanément indisponible.')
  await expect(page.getByRole('button',{name:'Connecter Outlook',exact:true})).toBeEnabled()
  await expect(page.getByText('application prête, boîte à connecter',{exact:false})).toBeVisible()
})
