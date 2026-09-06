import {runDiscovery} from '../_shared/prospector/discovery-service.ts'
import {runEnrichment} from '../_shared/prospector/enrichment-service.ts'
import {runAnalyze, runStrategize, runCopywrite} from '../_shared/prospector/ai-pipeline.ts'
import {errorCode,json,requireWorkerRequest,serviceClient} from '../_shared/prospector/runtime.ts'

// Un job à la fois (bail de 240 s pour absorber la latence LLM), mais on enchaîne tant
// qu'il reste du temps : à un seul job par cycle de cron, une campagne de 50 prospects
// demanderait plus de 200 cycles, soit plus de 16 h.
// La fenêtre borne le DÉMARRAGE d'un nouveau job, pas sa durée : le plus long (copywrite,
// deux appels de 60 s au plus, plus comptage des tokens) doit tenir dans les 180 s de curl.
const CLAIM_WINDOW_MS = 20_000
// Sans clé, sans taux de change ou hors plafond, tous les jobs IA échoueraient
// définitivement d'affilée : on arrête le cycle au premier signal de ce type.
const STOP_CYCLE = new Set(['LLM_NOT_CONFIGURED','BUDGET_FX_NOT_CONFIGURED','MONTHLY_BUDGET_EXCEEDED','MODEL_PRICING_NOT_CONFIGURED'])

Deno.serve(async request=>{
  try{requireWorkerRequest(request);if(request.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405)}catch(error){return json({error:errorCode(error)},401)}
  const client=serviceClient(),started=Date.now(),outcomes=[]
  while(Date.now()-started<CLAIM_WINDOW_MS){
    const claimed=await client.rpc('prospector_claim_jobs',{p_limit:1,p_lease_seconds:240})
    if(claimed.error){if(!outcomes.length)return json({error:'CLAIM_FAILED'},500);break}
    const job=(claimed.data??[])[0]
    if(!job)break
    try{
      let result:unknown
      if(job.type==='discovery')result=await runDiscovery(client,job.campaign_id)
      else if(job.type==='enrich')result=await runEnrichment(client,job.prospect_id)
      else if(job.type==='manual_analyze')result=await runEnrichment(client,job.prospect_id,{allowNoWebsite:true})
      else if(job.type==='analyze')result=await runAnalyze(client,job.prospect_id)
      else if(job.type==='strategize')result=await runStrategize(client,job.prospect_id)
      else if(job.type==='copywrite')result=await runCopywrite(client,job.prospect_id,job.payload?.channel)
      else throw new Error('JOB_TYPE_NOT_IMPLEMENTED')
      const finish=await client.rpc('prospector_finish_job',{p_id:job.id,p_claim_token:job.claim_token,p_result:result,p_error:null})
      if(finish.error)throw new Error(finish.error.message)
      outcomes.push({id:job.id,status:'done'})
    }catch(error){
      const code=errorCode(error),finish=await client.rpc('prospector_finish_job',{p_id:job.id,p_claim_token:job.claim_token,p_result:null,p_error:code})
      outcomes.push({id:job.id,status:finish.error?'finish_error':'error',error:code})
      if(STOP_CYCLE.has(code))break
    }
  }
  return json({claimed:outcomes.length,outcomes})
})
