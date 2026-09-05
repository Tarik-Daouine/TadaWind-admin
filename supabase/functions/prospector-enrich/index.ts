import {runEnrichment} from '../_shared/prospector/enrichment-service.ts'
import {errorCode,json,requireServiceRequest,serviceClient} from '../_shared/prospector/runtime.ts'

Deno.serve(async request=>{
  try{
    requireServiceRequest(request)
    if(request.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405)
    const body=await request.json()
    if(typeof body?.prospect_id!=='string')return json({error:'INVALID_INPUT'},400)
    return json(await runEnrichment(serviceClient(),body.prospect_id))
  }catch(error){const code=errorCode(error);return json({error:code},code==='UNAUTHORIZED'?401:code==='INVALID_INPUT'?400:422)}
})
