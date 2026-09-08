import {json,serviceClient,outlookToken} from '../_shared/prospector/automation-runtime.ts'
import {requireWorkerRequest} from '../_shared/prospector/runtime.ts'
import {emailOutcome} from '../_shared/prospector/automation-contact.js'
Deno.serve(async request=>{
  try {requireWorkerRequest(request)} catch {return json({error:'UNAUTHORIZED'},401)}
  if(request.method!=='POST') return json({error:'METHOD_NOT_ALLOWED'},405)
  const db=serviceClient();const started=Date.now();let processed=0
  const stale=await db.from('automation_outbox').update({status:'unknown',error_code:'WORKER_INTERRUPTED',updated_at:new Date().toISOString()}).eq('status','dispatching').lt('updated_at',new Date(Date.now()-300000).toISOString())
  if(stale.error)return json({error:'RECONCILIATION_FAILED'},500)
  const pending=await db.from('automation_outbox').select('id').eq('status','pending').limit(1)
  if(pending.error) return json({error:'QUEUE_READ_FAILED'},500)
  if(!pending.data?.length) return json({processed:0})
  let credentials
  try {credentials=await outlookToken()} catch {return json({error:'OUTLOOK_NOT_READY',processed:0},503)}
  while(Date.now()-started<20000 && processed<5) {
    const claim=await db.rpc('automation_claim_email');if(claim.error)return json({error:'CLAIM_FAILED'},500)
    const email=claim.data?.[0];if(!email)break
    let outcome:{status:string;error:string|null}={status:'unknown',error:'SEND_OUTCOME_UNKNOWN'}
    try {
      const response=await fetch('https://graph.microsoft.com/v1.0/me/sendMail',{
        method:'POST',headers:{authorization:`Bearer ${credentials.token}`,'content-type':'application/json'},signal:AbortSignal.timeout(30000),
        body:JSON.stringify({message:{subject:email.subject,body:{contentType:'Text',content:email.body},toRecipients:[{emailAddress:{address:email.recipient}}],internetMessageHeaders:[{name:'x-tadawind-outbox-id',value:email.id}]},saveToSentItems:true}),
      })
      outcome=emailOutcome(response.status);await response.body?.cancel()
    } catch { /* Ambiguous transport outcome is never retried automatically. */ }
    const finish=await db.rpc('automation_finish_email',{p_id:email.id,p_attempt:email.attempt_id,p_status:outcome.status,p_error:outcome.error})
    if(finish.error)return json({error:'OUTCOME_SAVE_FAILED',processed},500)
    processed++
    if(outcome.status!=='accepted')return json({processed,error:outcome.error},502)
  }
  return json({processed})
})
