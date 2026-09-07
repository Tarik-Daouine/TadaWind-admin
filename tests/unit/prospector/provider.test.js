import {afterEach,describe,expect,it,vi} from 'vitest'
import {makeAnthropicProvider} from '../../../supabase/functions/_shared/prospector/llm-provider.ts'
afterEach(()=>vi.unstubAllGlobals())
function fixture(reservationError=null, options={}){
  vi.stubGlobal('Deno',{env:{get:()=> 'fake-key-for-test'}})
  const fetch=vi.fn().mockResolvedValueOnce(Response.json({input_tokens:100})).mockResolvedValueOnce(Response.json({content:[{type:'text',text:'{}'}],stop_reason:'end_turn',usage:{input_tokens:100,output_tokens:10}}))
  vi.stubGlobal('fetch',fetch)
  const rpc=vi.fn().mockResolvedValueOnce({data:'reservation',error:reservationError}).mockResolvedValue({error:null})
  const insert=vi.fn().mockResolvedValue({error:null})
  const request=makeAnthropicProvider({client:{rpc,from:()=>({insert})},model:'claude-sonnet-5',fn:'analyze',...options})
  return {request,fetch,rpc,insert}
}
describe('budget before paid LLM calls',()=>{
  it('disables hidden thinking only when explicitly requested',async()=>{
    const single=fixture(null,{disableThinking:true})
    await single.request({user:'test'})
    expect(JSON.parse(single.fetch.mock.calls[1][1].body).thinking).toEqual({type:'disabled'})
    const analysis=fixture()
    await analysis.request({user:'test'})
    expect(JSON.parse(analysis.fetch.mock.calls[1][1].body).thinking).toBeUndefined()
  })
  it('does not call Messages when budget is exhausted',async()=>{
    const {request,fetch}=fixture({message:'MONTHLY_BUDGET_EXCEEDED'})
    await expect(request({user:'test'})).rejects.toThrow('MONTHLY_BUDGET_EXCEEDED')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0][0]).toContain('/count_tokens')
  })
  it('records actual usage and settles the reservation',async()=>{
    const {request,rpc,insert}=fixture()
    await expect(request({user:'test'})).resolves.toBe('{}')
    expect(rpc.mock.calls[0][0]).toBe('prospector_reserve_ai')
    expect(insert).toHaveBeenCalledOnce()
    expect(rpc.mock.calls[1]).toEqual(['prospector_settle_ai',{p_id:'reservation',p_actual_usd:0.0003}])
  })
  it('keeps the reservation when the provider response is uncertain',async()=>{
    const {request,fetch,rpc}=fixture()
    fetch.mockReset().mockResolvedValueOnce(Response.json({input_tokens:100})).mockRejectedValueOnce(new Error('network'))
    await expect(request({user:'test'})).rejects.toThrow('LLM_PROVIDER_ERROR')
    expect(rpc).toHaveBeenCalledTimes(1)
  })
})
