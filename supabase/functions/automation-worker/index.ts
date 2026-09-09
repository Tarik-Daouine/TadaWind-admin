import {json,serviceClient} from '../_shared/prospector/automation-runtime.ts'
import {requireWorkerRequest} from '../_shared/prospector/runtime.ts'
import {brevoConfig,brevoMessage,brevoOutcome} from '../_shared/prospector/brevo.js'
Deno.serve(async request=>{
  try {requireWorkerRequest(request)} catch {return json({error:'UNAUTHORIZED'},401)}
  if(request.method!=='POST') return json({error:'METHOD_NOT_ALLOWED'},405)
  const db=serviceClient();const started=Date.now();let processed=0
  const stale=await db.from('automation_outbox').update({status:'unknown',error_code:'WORKER_INTERRUPTED',updated_at:new Date().toISOString()}).eq('status','dispatching').lt('updated_at',new Date(Date.now()-300000).toISOString())
  if(stale.error)return json({error:'RECONCILIATION_FAILED'},500)
  const pending=await db.from('automation_outbox').select('id').eq('status','pending').limit(1)
  if(pending.error) return json({error:'QUEUE_READ_FAILED'},500)
  if(!pending.data?.length) return json({processed:0})
  const config=brevoConfig((name:string)=>Deno.env.get(name))
  if(!config)return json({error:'BREVO_NOT_CONFIGURED',processed:0},503)
  while(Date.now()-started<20000 && processed<5) {
    const claim=await db.rpc('automation_claim_brevo_email')
    if(claim.error)return json({error:claim.error.message?.includes('BREVO_LOCAL_QUOTA_REACHED')?'BREVO_LOCAL_QUOTA_REACHED':'CLAIM_FAILED',processed},claim.error.message?.includes('BREVO_LOCAL_QUOTA_REACHED')?429:500)
    const email=claim.data?.[0];if(!email)break
    let outcome:{status:string;error:string|null;messageId:string|null}={status:'unknown',error:'SEND_OUTCOME_UNKNOWN',messageId:null}
    try {
      const response=await fetch('https://api.brevo.com/v3/smtp/email',{
        method:'POST',headers:{'api-key':config.apiKey,'content-type':'application/json','accept':'application/json'},signal:AbortSignal.timeout(30000),
        body:JSON.stringify(brevoMessage(email,config.sender)),
      })
      let body=null
      try {body=await response.json()} catch { /* A malformed success is uncertain. */ }
      outcome=brevoOutcome(response.status,body)
    } catch { /* Ambiguous transport outcome is never retried automatically. */ }
    const finish=await db.rpc('automation_finish_brevo_email',{p_id:email.id,p_attempt:email.attempt_id,p_status:outcome.status,p_error:outcome.error,p_message_id:outcome.messageId})
    if(finish.error)return json({error:'OUTCOME_SAVE_FAILED',processed},500)
    processed++
    if(outcome.status!=='accepted')return json({processed,error:outcome.error},502)
  }
  return json({processed})
})
