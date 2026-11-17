import {beforeEach,describe,expect,it,vi} from 'vitest'

const state=vi.hoisted(()=>({authorized:true,waitUntil:vi.fn(),fetch:vi.fn()}))
vi.mock('../../../supabase/functions/_shared/prospector/automation-runtime.ts',()=>({
  cors:(_request,response)=>response,
  json:(body,status=200)=>Response.json(body,{status}),
  requireAdmin:async()=>{if(!state.authorized)throw new Error('UNAUTHORIZED')},
}))

vi.stubGlobal('Deno',{env:{get:vi.fn(name=>({SUPABASE_URL:'https://example.supabase.co',PROSPECTOR_CRON_SECRET:'secret'})[name])},serve:vi.fn()})
vi.stubGlobal('EdgeRuntime',{waitUntil:state.waitUntil})
vi.stubGlobal('fetch',state.fetch)
const {handle}=await import('../../../supabase/functions/prospector-dispatch/index.ts')

describe('déclenchement immédiat du worker',()=>{
  beforeEach(()=>{
    state.authorized=true;state.waitUntil.mockClear();state.fetch.mockReset()
    state.fetch.mockResolvedValue(new Response('{"claimed":1,"ok":true}',{status:200}))
  })

  it('accepte une campagne authentifiée et confie le travail au runtime',async()=>{
    const response=await handle(new Request('http://local/',{method:'POST',body:JSON.stringify({campaign_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'})}))
    expect(response.status).toBe(202)
    expect(await response.json()).toMatchObject({accepted:true,campaign_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'})
    expect(state.waitUntil).toHaveBeenCalledTimes(1)
    await state.waitUntil.mock.calls[0][0]
    expect(state.fetch).toHaveBeenCalledWith('https://example.supabase.co/functions/v1/prospector-worker',expect.objectContaining({method:'POST'}))
  })

  it('refuse une requête non authentifiée ou mal formée',async()=>{
    state.authorized=false
    expect((await handle(new Request('http://local/',{method:'POST',body:'{}'}))).status).toBe(401)
    state.authorized=true
    expect((await handle(new Request('http://local/',{method:'POST',body:JSON.stringify({campaign_id:'invalide'})}))).status).toBe(400)
    expect(state.waitUntil).not.toHaveBeenCalled()
  })
})
