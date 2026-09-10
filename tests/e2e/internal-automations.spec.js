import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'

const env = Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).filter(line=>line.includes('=')).map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1).replace(/^['"]|['"]$/g,'')]}))
const ref = new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
const accessToken = `${encode({alg:'HS256',typ:'JWT'})}.${encode({aud:'authenticated',role:'authenticated',sub:'11111111-1111-4111-8111-111111111111',email:'test@local.invalid',exp:Math.floor(Date.now()/1000)+3600})}.test-signature`
const user = {id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'test@local.invalid',app_metadata:{provider:'email'},user_metadata:{},created_at:'2026-09-05T00:00:00Z'}

// Plus rien ne redirige avec ?outlook= depuis le retrait du consentement
// délégué. Le test reste : une URL ne doit jamais pouvoir prétendre à une
// connexion, et le panneau doit montrer l'état réel du service d'envoi.
test('a URL parameter never claims a connection; the panel shows the real provider state',async({page})=>{
  await page.addInitScript(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key:`sb-${ref}-auth-token`,session:{access_token:accessToken,refresh_token:'fixture',expires_at:Math.floor(Date.now()/1000)+3600,user}})
  await page.route('**/*',route=>{
    const url=new URL(route.request().url())
    if(['localhost','127.0.0.1'].includes(url.hostname))return route.continue()
    let data=[]
    if(url.pathname.endsWith('/auth/v1/user'))data=user
    if(url.pathname.endsWith('/rest/v1/settings'))data={id:'main'}
    if(url.pathname.endsWith('/functions/v1/automation-status'))data={provider:'brevo',configured:false,contact_enabled:false,attempts_24h:300,limit_24h:300}
    if(url.pathname.endsWith('/rest/v1/automation_outbox'))data=[{id:'fixture',kind:'contact_receipt',recipient:'test@example.invalid',status:'unknown',provider:'brevo',error_code:'SEND_OUTCOME_UNKNOWN'}]
    return route.fulfill({status:200,contentType:'application/json',headers:{'content-range':'0-0/0'},body:JSON.stringify(data)})
  })
  // On atteint le panneau comme un humain, par la navigation : plus aucune URL
  // n'y conduit toute seule. Le paramètre est conservé dans l'adresse pour
  // vérifier qu'il reste sans effet.
  await page.goto('/?outlook=connected')
  await page.getByRole('button',{name:'Réglages'}).click()
  await expect(page.getByRole('heading',{name:'Automatisations internes'})).toBeVisible()
  await expect(page.getByText('Emails du formulaire : Brevo — configuration en attente',{exact:false})).toBeVisible()
  await expect(page.getByRole('button',{name:'Connecter Outlook',exact:true})).toHaveCount(0)
  await expect(page.getByText('Tentatives sur 24 heures : 300 / 300.',{exact:false})).toBeVisible()
  await expect(page.getByText('Résultat incertain — vérifier le journal du service',{exact:false})).toBeVisible()
  await page.screenshot({path:'test-results/automations-panel.png',fullPage:true})
})
