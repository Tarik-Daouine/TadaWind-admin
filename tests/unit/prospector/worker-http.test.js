import {beforeEach, afterEach, it, expect, vi} from 'vitest'
const state=vi.hoisted(()=>({handler:null,rpc:vi.fn(),copywrite:vi.fn()}))
vi.mock('../../../supabase/functions/_shared/prospector/runtime.ts',()=>({
  requireWorkerRequest:()=>{},serviceClient:()=>({rpc:state.rpc}),
  errorCode:e=>e.message,json:(body,status=200)=>Response.json(body,{status}),
}))
vi.mock('../../../supabase/functions/_shared/prospector/ai-pipeline.ts',()=>({runCopywrite:state.copywrite,runAnalyze:vi.fn(),runStrategize:vi.fn()}))
vi.mock('../../../supabase/functions/_shared/prospector/discovery-service.ts',()=>({runDiscovery:vi.fn()}))
vi.mock('../../../supabase/functions/_shared/prospector/enrichment-service.ts',()=>({runEnrichment:vi.fn()}))
beforeEach(async()=>{
  vi.resetModules();state.rpc.mockReset();state.copywrite.mockReset()
  vi.stubGlobal('Deno',{serve:handler=>{state.handler=handler}})
  await import('../../../supabase/functions/prospector-worker/index.ts')
})
afterEach(()=>vi.unstubAllGlobals())
const request=()=>state.handler(new Request('http://localhost/',{method:'POST'}))
it('returns success for an empty queue',async()=>{
  state.rpc.mockResolvedValue({data:[]})
  expect((await request()).status).toBe(200)
})
it('makes a recorded application failure visible to the scheduler',async()=>{
  state.rpc.mockResolvedValueOnce({data:[{id:'job',type:'copywrite',prospect_id:'p',claim_token:'token'}]})
    .mockResolvedValueOnce({data:{status:'error'}}).mockResolvedValue({data:[]})
  state.copywrite.mockRejectedValue(new Error('LLM_INVALID_OUTPUT'))
  const response=await request()
  expect(response.status).toBe(502)
  expect((await response.json()).outcomes[0]).toMatchObject({status:'error',error:'LLM_INVALID_OUTPUT'})
  expect(state.rpc.mock.calls[1][0]).toBe('prospector_finish_job')
})
it('reports a claim failure even after a successful job',async()=>{
  state.rpc.mockResolvedValueOnce({data:[{id:'job',type:'copywrite',prospect_id:'p',claim_token:'token'}]})
    .mockResolvedValueOnce({data:{status:'done'}}).mockResolvedValueOnce({error:{message:'db unavailable'}})
  state.copywrite.mockResolvedValue({})
  const response=await request()
  expect(response.status).toBe(500)
  expect(await response.json()).toMatchObject({error:'CLAIM_FAILED',claimed:1})
})
