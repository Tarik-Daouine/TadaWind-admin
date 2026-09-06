import type {SupabaseClient} from 'npm:@supabase/supabase-js@2.100.0'

// Adaptateur LLM. Aucune clé dans le front : ANTHROPIC_API_KEY vit dans les secrets Supabase.
// Sans clé ni modèle configuré, l'étape IA échoue proprement (LLM_NOT_CONFIGURED, terminal).
// Chaque appel — retry inclus — est comptabilisé dans ai_usage.

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

// Estimation de coût seulement (USD par million de tokens). À ajuster si la grille évolue.
const PRICING: Record<string, {input: number; output: number}> = {
  'claude-sonnet-5': {input: 2, output: 10},
  'claude-haiku-4-5-20251001': {input: 1, output: 5},
  'claude-haiku-4-5': {input: 1, output: 5},
}
function costUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = PRICING[model]
  if(!price)throw new Error('MODEL_PRICING_NOT_CONFIGURED')
  return Math.ceil(((inputTokens / 1e6) * price.input + (outputTokens / 1e6) * price.output)*1e6)/1e6
}

function stripFences(text: string): string {
  return text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
}

export interface ProviderOptions {
  client: SupabaseClient
  fn: string
  model: string | null
  prospectId?: string | null
  campaignId?: string | null
  maxTokens?: number
  timeoutMs?: number
}

/** Retourne une fonction `request({system, user})` compatible avec requestValidatedJson. */
export function makeAnthropicProvider(options: ProviderOptions) {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
  const model = (options.model ?? '').trim()
  if (!apiKey || !model) throw new Error('LLM_NOT_CONFIGURED')
  if(!PRICING[model])throw new Error('MODEL_PRICING_NOT_CONFIGURED')
  const maxTokens = options.maxTokens ?? 4096
  const timeoutMs = options.timeoutMs ?? 60000

  return async function request(prompt: {system?: string; user?: string}): Promise<string> {
    const body = {
      model,
      max_tokens: maxTokens,
      system: prompt.system ?? '',
      messages: [{role: 'user', content: prompt.user ?? ''}],
    }
    // Count tokens before the paid request; reserve maximum output cost atomically.
    const headers={'content-type':'application/json','x-api-key':apiKey,'anthropic-version':ANTHROPIC_VERSION}
    const counted=await fetch(ANTHROPIC_URL+'/count_tokens',{method:'POST',headers,body:JSON.stringify({model,system:body.system,messages:body.messages}),signal:AbortSignal.timeout(15000)})
    if(!counted.ok){await counted.body?.cancel();throw new Error('LLM_TOKEN_COUNT_FAILED')}
    const tokenData=await counted.json()
    if(!Number.isSafeInteger(tokenData.input_tokens)||tokenData.input_tokens<0)throw new Error('LLM_TOKEN_COUNT_FAILED')
    const reserved=await options.client.rpc('prospector_reserve_ai',{p_max_usd:costUsd(model,Math.ceil(tokenData.input_tokens*1.1)+1024,maxTokens)})
    if(reserved.error)throw new Error(reserved.error.message)
    const reservationId=reserved.data
    let response: Response
    try {
      response = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch {
      throw new Error('LLM_PROVIDER_ERROR')
    }
    if (response.status === 401 || response.status === 403) throw new Error('LLM_NOT_CONFIGURED')
    if (response.status === 429) throw new Error('LLM_PROVIDER_ERROR')
    if (!response.ok) {
      await response.body?.cancel()
      throw new Error(response.status >= 500 ? 'LLM_PROVIDER_ERROR' : 'LLM_REQUEST_REJECTED')
    }
    const data = await response.json().catch(() => null) as
      | {content?: {type: string; text?: string}[]; stop_reason?: string; usage?: {input_tokens?: number; output_tokens?: number}}
      | null
    const usage = data?.usage ?? {}
    // Comptabilisation systématique, y compris si la sortie sera rejetée ensuite.
    const recorded=await options.client.from('ai_usage').insert({
      function: options.fn,
      model,
      prospect_id: options.prospectId ?? null,
      campaign_id: options.campaignId ?? null,
      input_tokens: Math.max(0, Math.trunc(usage.input_tokens ?? 0)),
      output_tokens: Math.max(0, Math.trunc(usage.output_tokens ?? 0)),
      cost_estimate_usd: costUsd(model, usage.input_tokens ?? 0, usage.output_tokens ?? 0),
    })
    if(recorded.error)throw new Error('LLM_USAGE_RECORD_FAILED')
    if(Number.isSafeInteger(usage.input_tokens)&&Number.isSafeInteger(usage.output_tokens)){
      const settled=await options.client.rpc('prospector_settle_ai',{p_id:reservationId,p_actual_usd:costUsd(model,usage.input_tokens!,usage.output_tokens!)})
      if(settled.error)throw new Error('LLM_USAGE_RECORD_FAILED')
    }
    if (!data) throw new Error('LLM_INVALID_OUTPUT')
    if (data.stop_reason === 'refusal') throw new Error('LLM_REFUSAL')
    if (data.stop_reason === 'max_tokens') throw new Error('LLM_TRUNCATED')
    const text = (data.content ?? []).filter(part => part.type === 'text').map(part => part.text ?? '').join('')
    if (!text.trim()) throw new Error('LLM_INVALID_OUTPUT')
    return stripFences(text)
  }
}
