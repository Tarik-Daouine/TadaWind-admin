import {createClient} from 'npm:@supabase/supabase-js@2.100.0'
import {json,serviceClient} from '../_shared/prospector/runtime.ts'
import {brevoConfig,brevoOutcome} from '../_shared/prospector/brevo.js'
import {buildTadaWindEmailHtml,buildTadaWindEmailPlainText} from '../_shared/prospector/email-signature.js'

// Opt-in owner previews only. Never sends to a prospect or changes CRM status.
async function handle(request:Request) {
  if(request.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405)
  const authorization=request.headers.get('authorization')??''
  if(!authorization.startsWith('Bearer '))return json({error:'UNAUTHORIZED'},401)
  const asUser=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{authorization}},auth:{persistSession:false,autoRefreshToken:false}})
  const {data:auth,error:authError}=await asUser.auth.getUser()
  if(authError||!auth?.user||auth.user.is_anonymous)return json({error:'UNAUTHORIZED'},401)
  let payload
  try {payload=await request.json()}catch{return json({error:'INVALID_INPUT'},400)}
  if(!payload||typeof payload!=='object'||Object.keys(payload).some(k=>!['probe','message_id','revision'].includes(k)))return json({error:'INVALID_INPUT'},400)
  const recipient=Deno.env.get('PROSPECTOR_PREVIEW_RECIPIENT')??''
  const config=brevoConfig((name:string)=>Deno.env.get(name))
  const configured=Boolean(config&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(recipient))
  if(payload.probe===true)return json({configured,recipient:configured?recipient:null})
  if(!configured||!config)return json({error:'PREVIEW_NOT_CONFIGURED'},503)
  if(typeof payload.message_id!=='string'||!Number.isInteger(payload.revision))return json({error:'INVALID_INPUT'},400)
  const reserved=await asUser.rpc('prospector_reserve_preview',{p_id:payload.message_id,p_revision:payload.revision})
  if(reserved.error)return json({error:reserved.error.message.includes('PREVIEW_RATE_LIMITED')?'PREVIEW_RATE_LIMITED':'MESSAGE_CONFLICT'},409)
  const item=reserved.data
  if(item.duplicate)return item.status==='accepted'?json({accepted:true,duplicate:true,recipient}):json({error:'PREVIEW_ALREADY_ATTEMPTED'},409)
  let outcome:{status:string;error:string|null;messageId:string|null}={status:'unknown',error:'SEND_OUTCOME_UNKNOWN',messageId:null}
  try {
    const response=await fetch('https://api.brevo.com/v3/smtp/email',{
      method:'POST',headers:{'api-key':config.apiKey,'content-type':'application/json'},signal:AbortSignal.timeout(30000),
      body:JSON.stringify({sender:{name:'Tada Wind',email:config.sender},to:[{email:recipient}],replyTo:{email:'Tada-Wind@outlook.com'},
        subject:'[APERÇU] '+(item.subject||'Message de prospection'),htmlContent:buildTadaWindEmailHtml(item.body),textContent:buildTadaWindEmailPlainText(item.body),tags:['tadawind-owner-preview']}),
    })
    let data=null;try{data=await response.json()}catch{/* Unknown success is not retried. */}
    outcome=brevoOutcome(response.status,data)
  }catch{/* A timeout leaves an uncertain reservation. */}
  const status=outcome.status==='pending'?'failed':outcome.status
  const saved=await serviceClient().from('prospector_email_previews').update({status,provider_message_id:outcome.messageId}).eq('id',item.id).eq('status','reserved')
  if(saved.error)return json({error:'PREVIEW_RECONCILIATION_REQUIRED'},502)
  return status==='accepted'?json({accepted:true,recipient}):json({error:status==='unknown'?'SEND_OUTCOME_UNKNOWN':'PREVIEW_REJECTED'},502)
}
Deno.serve(async request=>{
  const origin=request.headers.get('origin')
  if(origin&&origin!=='https://tarik-daouine.github.io'&&!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))return json({error:'ORIGIN_NOT_ALLOWED'},403)
  const headers={'Access-Control-Allow-Origin':origin||'https://tarik-daouine.github.io','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Vary':'Origin'}
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers})
  let response;try{response=await handle(request)}catch{response=json({error:'PREVIEW_RECONCILIATION_REQUIRED'},500)}
  for(const [key,value]of Object.entries(headers))response.headers.set(key,value)
  return response
})
