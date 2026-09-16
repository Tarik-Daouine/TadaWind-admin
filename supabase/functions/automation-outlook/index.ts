import {cors,decrypt,encrypt,json,requireAdmin,serviceClient,sha} from '../_shared/prospector/automation-runtime.ts'

const ADMIN='https://tarik-daouine.github.io/TadaWind-admin/'
const ACCOUNT='tada-wind@outlook.com'
const SCOPES='https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access'
const CALLBACK=()=>`${Deno.env.get('SUPABASE_URL')}/functions/v1/automation-outlook`
const missingConfiguration=()=>['MS_OAUTH_CLIENT_ID','MS_OAUTH_CLIENT_SECRET','AUTOMATION_ENCRYPTION_KEY'].filter(name=>!Deno.env.get(name))
const appConfigured=()=>missingConfiguration().length===0
const redirect=(status:string)=>new Response(null,{status:303,headers:{Location:`${ADMIN}?outlook=${status}`,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}})

async function callback(request:Request) {
  const db=serviceClient(),url=new URL(request.url),state=url.searchParams.get('state')||''
  if(!/^[0-9a-f]{64}$/.test(state)||!appConfigured())return redirect('failed')
  const consumed=await db.from('automation_oauth_states').delete().eq('state_hash',await sha(state)).gt('expires_at',new Date().toISOString()).select('verifier_cipher').maybeSingle()
  if(consumed.error||!consumed.data||url.searchParams.has('error'))return redirect('failed')
  try {
    const code=url.searchParams.get('code')
    if(!code||code.length>16000)return redirect('failed')
    const response=await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token',{
      method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},signal:AbortSignal.timeout(20000),
      body:new URLSearchParams({client_id:Deno.env.get('MS_OAUTH_CLIENT_ID')!,client_secret:Deno.env.get('MS_OAUTH_CLIENT_SECRET')!,grant_type:'authorization_code',code,redirect_uri:CALLBACK(),code_verifier:await decrypt(consumed.data.verifier_cipher),scope:SCOPES}),
    })
    if(!response.ok){await response.body?.cancel();return redirect('failed')}
    const tokens=await response.json()
    if(typeof tokens.access_token!=='string'||typeof tokens.refresh_token!=='string'||!String(tokens.scope).toLowerCase().includes('mail.send'))return redirect('failed')
    const profile=await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName',{
      headers:{authorization:`Bearer ${tokens.access_token}`},signal:AbortSignal.timeout(15000),
    })
    if(!profile.ok){await profile.body?.cancel();return redirect('failed')}
    const account=await profile.json(),sender=String(account.mail||account.userPrincipalName||'').toLowerCase()
    if(sender!==ACCOUNT)return redirect('wrong_account')
    const token_cipher=await encrypt(JSON.stringify({...tokens,expires_at:Date.now()+Number(tokens.expires_in)*1000}))
    const saved=await db.from('automation_connections').upsert({id:'outlook',sender,token_cipher,updated_at:new Date().toISOString()})
    return redirect(saved.error?'failed':'connected')
  } catch {return redirect('failed')}
}

async function post(request:Request) {
  const reply=(body:unknown,status=200)=>cors(request,json(body,status))
  if(request.method==='OPTIONS')return cors(request,new Response(null,{status:204}))
  if(request.method!=='POST')return reply({error:'METHOD_NOT_ALLOWED'},405)
  try {
    const user=await requireAdmin(request),payload=await request.json(),db=serviceClient()
    if(payload.action==='status') {
      const connection=await db.from('automation_connections').select('sender,updated_at').eq('id','outlook').maybeSingle()
      if(connection.error)return reply({error:'STATUS_UNAVAILABLE'},503)
      return reply({app_configured:appConfigured(),missing_configuration:missingConfiguration(),connected:Boolean(connection.data),sender:connection.data?.sender||null,updated_at:connection.data?.updated_at||null})
    }
    if(payload.action!=='connect')return reply({error:'INVALID_INPUT'},400)
    if(!appConfigured())return reply({error:'MICROSOFT_APP_NOT_CONFIGURED'},503)
    const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32))).map(v=>v.toString(16).padStart(2,'0')).join('')
    const state=random(),verifier=random()
    const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)))
    const challenge=btoa(String.fromCharCode(...digest)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
    await db.from('automation_oauth_states').delete().lt('expires_at',new Date().toISOString())
    const saved=await db.from('automation_oauth_states').insert({state_hash:await sha(state),verifier_cipher:await encrypt(verifier),created_by:user,expires_at:new Date(Date.now()+10*60000).toISOString()})
    if(saved.error)return reply({error:'CONNECT_UNAVAILABLE'},503)
    const authorization=new URL('https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize')
    authorization.search=new URLSearchParams({client_id:Deno.env.get('MS_OAUTH_CLIENT_ID')!,response_type:'code',redirect_uri:CALLBACK(),response_mode:'query',scope:SCOPES,state,code_challenge:challenge,code_challenge_method:'S256',login_hint:'Tada-Wind@outlook.com',prompt:'select_account'}).toString()
    return reply({url:authorization.href})
  } catch(error) {
    const unauthorized=error instanceof Error&&error.message==='UNAUTHORIZED'
    return reply({error:unauthorized?'UNAUTHORIZED':'REQUEST_FAILED'},unauthorized?401:400)
  }
}

Deno.serve(request=>request.method==='GET'?callback(request):post(request))
