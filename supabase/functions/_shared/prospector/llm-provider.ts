import type {SupabaseClient} from 'npm:@supabase/supabase-js@2.100.0'

// Adaptateur LLM. Aucune clé dans le front : ANTHROPIC_API_KEY vit dans les secrets Supabase.
// Sans clé ni modèle configuré, l'étape IA échoue proprement (LLM_NOT_CONFIGURED, terminal).
// Chaque appel — retry inclus — est comptabilisé dans ai_usage.

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

// Estimation de coût seulement (USD par million de tokens). À ajuster si la grille évolue.
const PRICING: Record<string, {input: number; output: number}> = {
  'claude-sonnet-5': {input: 3, output: 15},
  'claude-haiku-4-5-20251001': {input: 0.8, output: 4},
}
function costUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = PRICING[model] ?? {input: 3, output: 15}
  return Number(((inputTokens / 1e6) * price.input + (outputTokens / 1e6) * price.output).toFixed(4))
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
  const maxTokens = options.maxTokens ?? 4096
  const timeoutMs = options.timeoutMs ?? 60000

  return async function request(prompt: {system?: string; user?: string}): Promise<string> {
    const body = {
      model,
      max_tokens: maxTokens,
      system: prompt.system ?? '',
      messages: [{role: 'user', content: prompt.user ?? ''}],
    }
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
    await options.client.from('ai_usage').insert({
      function: options.fn,
      model,
      prospect_id: options.prospectId ?? null,
      campaign_id: options.campaignId ?? null,
      input_tokens: Math.max(0, Math.trunc(usage.input_tokens ?? 0)),
      output_tokens: Math.max(0, Math.trunc(usage.output_tokens ?? 0)),
      cost_estimate_usd: costUsd(model, usage.input_tokens ?? 0, usage.output_tokens ?? 0),
    }).then(() => {}, () => {})
    if (!data) throw new Error('LLM_INVALID_OUTPUT')
    if (data.stop_reason === 'refusal') throw new Error('LLM_REFUSAL')
    if (data.stop_reason === 'max_tokens') throw new Error('LLM_TRUNCATED')
    const text = (data.content ?? []).filter(part => part.type === 'text').map(part => part.text ?? '').join('')
    if (!text.trim()) throw new Error('LLM_INVALID_OUTPUT')
    return stripFences(text)
  }
}
