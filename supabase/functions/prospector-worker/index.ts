import {runEnrichment} from '../_shared/prospector/enrichment-service.ts'
import {errorCode,json,requireWorkerRequest,serviceClient} from '../_shared/prospector/runtime.ts'

Deno.serve(async request=>{
  try{requireWorkerRequest(request);if(request.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405)}catch(error){return json({error:errorCode(error)},401)}
  const client=serviceClient(),claimed=await client.rpc('prospector_claim_jobs',{p_limit:5,p_lease_seconds:120})
  if(claimed.error)return json({error:'CLAIM_FAILED'},500)
  const outcomes=[]
  for(const job of claimed.data??[]){
    try{
      let result:unknown
      if(job.type==='manual_analyze'||job.type==='enrich')result=await runEnrichment(client,job.prospect_id)
      else throw new Error('JOB_TYPE_NOT_IMPLEMENTED')
      const finish=await client.rpc('prospector_finish_job',{p_id:job.id,p_claim_token:job.claim_token,p_result:result,p_error:null})
      if(finish.error)throw new Error(finish.error.message);outcomes.push({id:job.id,status:'done'})
    }catch(error){
      const code=errorCode(error),finish=await client.rpc('prospector_finish_job',{p_id:job.id,p_claim_token:job.claim_token,p_result:null,p_error:code})
      outcomes.push({id:job.id,status:finish.error?'finish_error':'error',error:code})
    }
  }
  return json({claimed:outcomes.length,outcomes})
})
