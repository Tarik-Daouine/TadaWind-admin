import {validateContact,contactEmails} from '../_shared/prospector/automation-contact.js'
import {json,cors,sha,serviceClient} from '../_shared/prospector/automation-runtime.ts'
Deno.serve(async request=>{
  const reply=(data:unknown,status=200)=>cors(request,json(data,status),true)
  if(request.method==='GET') return reply({enabled:Deno.env.get('CONTACT_INTERNAL_ENABLED')==='true'})
  if(request.method==='OPTIONS') return cors(request,new Response(null,{status:204}),true)
  if(request.method!=='POST') return reply({error:'METHOD_NOT_ALLOWED'},405)
  if(Deno.env.get('CONTACT_INTERNAL_ENABLED')!=='true') return reply({error:'CONTACT_NOT_ENABLED'},503)
  const origin=request.headers.get('origin')
  if(origin && !['https://www.tadawind.com','https://tadawind.com'].includes(origin)) return reply({error:'ORIGIN_NOT_ALLOWED'},403)
  try {
    // Enforce a bounded body even when Content-Length is absent or false.
    const reader=request.body?.getReader(); if(!reader) return reply({error:'INVALID_INPUT'},400)
    const chunks:Uint8Array[]=[];let size=0
    while(true) {const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16000){await reader.cancel();return reply({error:'PAYLOAD_TOO_LARGE'},413)}chunks.push(value)}
    const body=new Uint8Array(size);let pos=0;for(const chunk of chunks){body.set(chunk,pos);pos+=chunk.length}
    const validated=validateContact(JSON.parse(new TextDecoder().decode(body)))
    if(validated.honeypot) return reply({accepted:true},202)
    if(!validated.data || !validated.request_id)throw new Error('INVALID_INPUT')
    const {data,request_id}=validated
    const mail=contactEmails(data,request_id)
    const salt=Deno.env.get('AUTOMATION_ENCRYPTION_KEY');if(!salt) throw new Error('AUTOMATION_NOT_CONFIGURED')
    const result=await serviceClient().rpc('automation_accept_contact',{
      p_id:request_id,p_fingerprint:await sha(JSON.stringify(data)),p_email_hash:await sha(salt+data.email),p_data:data,
      p_internal:'Tada-Wind@outlook.com',p_internal_body:mail.internal,p_receipt_body:mail.receipt,
    })
    if(result.error) throw new Error(result.error.message)
    if (!result.data?.duplicate) {
      const runtime=(globalThis as unknown as {EdgeRuntime?:{waitUntil:(p:Promise<unknown>)=>void}}).EdgeRuntime
      if(runtime) runtime.waitUntil(fetch(Deno.env.get('SUPABASE_URL')+'/functions/v1/automation-worker',{
        method:'POST',headers:{'content-type':'application/json','x-prospector-cron-secret':Deno.env.get('PROSPECTOR_CRON_SECRET') || ''},body:'{}',signal:AbortSignal.timeout(60000),
      }).then(response=>response.body?.cancel()).catch(()=>{}))
    }
    return reply(result.data,202)
  } catch(error) {
    const message=error instanceof Error?error.message:''
    const code=['RATE_LIMITED','IDEMPOTENCY_CONFLICT','INVALID_INPUT'].find(x=>message.includes(x))
    return reply({error:code || (error instanceof SyntaxError?'INVALID_INPUT':'CONTACT_UNAVAILABLE')},code==='RATE_LIMITED'?429:code==='IDEMPOTENCY_CONFLICT'?409:code==='INVALID_INPUT'||error instanceof SyntaxError?400:503)
  }
})
