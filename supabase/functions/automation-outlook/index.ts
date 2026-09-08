import {json,cors,requireAdmin,serviceClient,sha,encrypt,decrypt} from '../_shared/prospector/automation-runtime.ts'
const ADMIN='https://tarik-daouine.github.io/TadaWind-admin/'
const SCOPES='https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access'
const CALLBACK=()=>Deno.env.get('SUPABASE_URL')+'/functions/v1/automation-outlook'
const configured=()=>!!(Deno.env.get('MS_OAUTH_CLIENT_ID') && Deno.env.get('MS_OAUTH_CLIENT_SECRET') && Deno.env.get('AUTOMATION_ENCRYPTION_KEY'))
const redirect=(status:string)=>new Response(null,{status:303,headers:{Location:ADMIN+'?outlook='+status,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}})
Deno.serve(async request=>{
  const db=serviceClient();const url=new URL(request.url)
  // Public OAuth return: one-time random state, expiry and PKCE verifier held server-side.
  if(request.method==='GET') {
    const state=url.searchParams.get('state') || ''
    if(!/^[0-9a-f]{64}$/.test(state) || !configured()) return redirect('failed')
    const hash=await sha(state)
    const consumed=await db.from('automation_oauth_states').delete().eq('state_hash',hash).gt('expires_at',new Date().toISOString()).select('verifier_cipher').maybeSingle()
    if(consumed.error || !consumed.data || url.searchParams.has('error'))return redirect('failed')
    try {
      const code=url.searchParams.get('code');if(!code || code.length>16000)return redirect('failed')
      const response=await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token',{
        method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},signal:AbortSignal.timeout(20000),
        body:new URLSearchParams({client_id:Deno.env.get('MS_OAUTH_CLIENT_ID')!,client_secret:Deno.env.get('MS_OAUTH_CLIENT_SECRET')!,grant_type:'authorization_code',code,redirect_uri:CALLBACK(),code_verifier:await decrypt(consumed.data.verifier_cipher),scope:SCOPES}),
      })
      if(!response.ok){await response.body?.cancel();return redirect('failed')}
      const tokens=await response.json()
      if(!tokens.access_token || !tokens.refresh_token || !String(tokens.scope).toLowerCase().includes('mail.send'))return redirect('failed')
      const profile=await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName',{
        headers:{authorization:`Bearer ${tokens.access_token}`},signal:AbortSignal.timeout(15000),
      })
      if(!profile.ok){await profile.body?.cancel();return redirect('failed')}
      const account=await profile.json();const sender=String(account.mail || account.userPrincipalName || '').toLowerCase()
      // Do not accidentally authorize another mailbox from the browser's accounts.
      if(sender!=='tada-wind@outlook.com')return redirect('wrong_account')
      const token_cipher=await encrypt(JSON.stringify({...tokens,expires_at:Date.now()+tokens.expires_in*1000}))
      const saved=await db.from('automation_connections').upsert({id:'outlook',sender,token_cipher,updated_at:new Date().toISOString()})
      return redirect(saved.error?'failed':'connected')
    } catch {return redirect('failed')}
  }
  const reply=(body:unknown,status=200)=>cors(request,json(body,status))
  if(request.method==='OPTIONS')return cors(request,new Response(null,{status:204}))
  if(request.method!=='POST')return reply({error:'METHOD_NOT_ALLOWED'},405)
  try {
    const user=await requireAdmin(request)
    const payload=await request.json()
    if(payload.action==='status') {
      const connection=await db.from('automation_connections').select('sender,updated_at').eq('id','outlook').maybeSingle()
      if(connection.error)return reply({error:'STATUS_UNAVAILABLE'},503)
      return reply({configured:configured(),connected:!!connection.data,sender:connection.data?.sender || null,contact_enabled:Deno.env.get('CONTACT_INTERNAL_ENABLED')==='true'})
    }
    if(payload.action!=='connect')return reply({error:'INVALID_INPUT'},400)
    if(!configured())return reply({error:'MICROSOFT_APP_NOT_CONFIGURED'},503)
    const state=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(v=>v.toString(16).padStart(2,'0')).join('')
    const verifier=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(v=>v.toString(16).padStart(2,'0')).join('')
    const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)))
    const challenge=btoa(String.fromCharCode(...digest)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
    await db.from('automation_oauth_states').delete().lt('expires_at',new Date().toISOString())
    const saved=await db.from('automation_oauth_states').insert({state_hash:await sha(state),verifier_cipher:await encrypt(verifier),created_by:user,expires_at:new Date(Date.now()+10*60000).toISOString()})
    if(saved.error)return reply({error:'CONNECT_UNAVAILABLE'},503)
    const authorization=new URL('https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize')
    authorization.search=new URLSearchParams({client_id:Deno.env.get('MS_OAUTH_CLIENT_ID')!,response_type:'code',redirect_uri:CALLBACK(),response_mode:'query',scope:SCOPES,state,code_challenge:challenge,code_challenge_method:'S256',login_hint:'Tada-Wind@outlook.com',prompt:'select_account'}).toString()
    return reply({url:authorization.href})
  } catch(error) {return reply({error:error instanceof Error && error.message==='UNAUTHORIZED'?'UNAUTHORIZED':'REQUEST_FAILED'},error instanceof Error && error.message==='UNAUTHORIZED'?401:400)}
})
