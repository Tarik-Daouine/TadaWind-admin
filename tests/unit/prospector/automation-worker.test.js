import {it,expect,vi,beforeEach,afterEach} from 'vitest'
const state=vi.hoisted(()=>({handler:null,rpc:vi.fn(),token:vi.fn()}))
vi.mock('../../../supabase/functions/_shared/prospector/automation-runtime.ts',()=>({
  json:(data,status=200)=>Response.json(data,{status}),outlookToken:state.token,
  serviceClient:()=>({rpc:state.rpc,from:()=>({
    update:()=>({eq:()=>({lt:async()=>({error:null})})}),
    select:()=>({eq:()=>({limit:async()=>({data:[{id:'fixture'}]})})}),
  })}),
}))
vi.mock('../../../supabase/functions/_shared/prospector/runtime.ts',()=>({requireWorkerRequest:r=>{if(r.headers.get('x-prospector-cron-secret')!=='fixture')throw new Error('UNAUTHORIZED')}}))
const email={id:'email',attempt_id:'attempt',recipient:'test@example.invalid',subject:'Fixture',body:'Fixture'}
beforeEach(async()=>{
  vi.resetModules();state.rpc.mockReset();state.token.mockReset().mockResolvedValue({token:'fixture',sender:'test@example.invalid'})
  let claimed=false
  state.rpc.mockImplementation(async name=>name==='automation_claim_email'?{data:claimed?[]:(claimed=true,[email])}:{error:null})
  vi.stubGlobal('Deno',{serve:fn=>{state.handler=fn}})
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(null,{status:202})))
  await import('../../../supabase/functions/automation-worker/index.ts')
})
afterEach(()=>vi.unstubAllGlobals())
const run=()=>state.handler(new Request('http://local',{method:'POST',headers:{'x-prospector-cron-secret':'fixture'}}))
it('rejects unauthenticated scheduler calls',async()=>{
  expect((await state.handler(new Request('http://local',{method:'POST'}))).status).toBe(401)
  expect(state.token).not.toHaveBeenCalled()
})
it('does not claim emails when Outlook is not connected',async()=>{
  state.token.mockRejectedValue(new Error('OUTLOOK_NOT_CONNECTED'))
  expect((await run()).status).toBe(503);expect(state.rpc).not.toHaveBeenCalled()
})
it('records acceptance using the exact attempt identifier',async()=>{
  expect((await run()).status).toBe(200)
  expect(state.rpc).toHaveBeenCalledWith('automation_finish_email',{p_id:'email',p_attempt:'attempt',p_status:'accepted',p_error:null})
})
it('never requeues a transport failure',async()=>{
  fetch.mockRejectedValue(new Error('network timeout'))
  expect((await run()).status).toBe(502)
  expect(state.rpc).toHaveBeenCalledWith('automation_finish_email',{p_id:'email',p_attempt:'attempt',p_status:'unknown',p_error:'SEND_OUTCOME_UNKNOWN'})
  expect(fetch).toHaveBeenCalledTimes(1)
})
it('stops if acceptance cannot be saved',async()=>{
  state.rpc.mockImplementation(async name=>name==='automation_claim_email'?{data:[email]}:{error:{message:'db down'}})
  expect((await run()).status).toBe(500);expect(fetch).toHaveBeenCalledTimes(1)
})
