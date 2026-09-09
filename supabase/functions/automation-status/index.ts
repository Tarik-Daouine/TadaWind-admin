import {json,cors,requireAdmin,serviceClient} from '../_shared/prospector/automation-runtime.ts'
import {brevoConfig} from '../_shared/prospector/brevo.js'
Deno.serve(async request=>{
  const reply=(body:unknown,status=200)=>cors(request,json(body,status))
  if(request.method==='OPTIONS')return cors(request,new Response(null,{status:204}))
  if(request.method!=='POST')return reply({error:'METHOD_NOT_ALLOWED'},405)
  try {await requireAdmin(request)} catch {return reply({error:'UNAUTHORIZED'},401)}
  const config=brevoConfig((name:string)=>Deno.env.get(name))
  const usage=await serviceClient().from('automation_email_attempts').select('attempt_id',{count:'exact',head:true}).gt('created_at',new Date(Date.now()-86400000).toISOString())
  if(usage.error)return reply({error:'STATUS_UNAVAILABLE'},503)
  return reply({provider:'brevo',configured:!!config,sender:config?.sender || null,
    contact_enabled:Deno.env.get('CONTACT_INTERNAL_ENABLED')==='true',
    attempts_24h:usage.count || 0,limit_24h:300})
})
