import type {SupabaseClient} from 'npm:@supabase/supabase-js@2.100.0'
import {buildAnalyzePrompt, buildStrategizePrompt, buildCopywritePrompt} from './prompts.js'
import {validateAnalysis, validateStrategy, validateMessage} from './schemas.js'
import {requestValidatedJson} from './llm-output.js'
import {makeAnthropicProvider} from './llm-provider.ts'

// Chaque étape : charge un contexte serveur (sources, analyse, stratégie rechargées depuis la base),
// appelle le LLM via un adaptateur qui valide la sortie par schéma, puis stocke via une RPC atomique
// qui enchaîne l'étape suivante. Aucune donnée brute du LLM n'est persistée sans validation.

async function rpc<T>(client: SupabaseClient, name: string, args: Record<string, unknown>): Promise<T> {
  const {data, error} = await client.rpc(name, args)
  if (error) throw new Error(error.message)
  return data as T
}

interface AnalyzeContext {
  sources: unknown[]
  prospect_id: string
  model: string | null
}
export async function runAnalyze(client: SupabaseClient, prospectId: string) {
  const ctx = await rpc<AnalyzeContext>(client, 'prospector_analyze_context', {p_id: prospectId})
  if (!Array.isArray(ctx.sources) || ctx.sources.length === 0) throw new Error('NO_SOURCE_TO_ANALYZE')
  const request = makeAnthropicProvider({client, fn: 'analyze', model: ctx.model, prospectId, maxTokens: 4096})
  const promptContext = {sources: ctx.sources, prospectId}
  const analysis = await requestValidatedJson({
    request,
    prompt: buildAnalyzePrompt(promptContext),
    validate: output => validateAnalysis(output, promptContext),
  })
  const prospect = await rpc(client, 'prospector_store_analysis', {p_id: prospectId, p_analysis: analysis})
  return {stage: 'analyze', prospect}
}

interface StrategyContext {
  sources: unknown[]
  prospect_id: string
  analysis: unknown
  business_profile: {services: string[]; reference_prices?: unknown[]} & Record<string, unknown>
  available_channels: string[]
  model: string | null
}
export async function runStrategize(client: SupabaseClient, prospectId: string) {
  const ctx = await rpc<StrategyContext>(client, 'prospector_strategy_context', {p_id: prospectId})
  if (!ctx.analysis) throw new Error('ANALYSIS_MISSING')
  if (!Array.isArray(ctx.available_channels) || ctx.available_channels.length === 0) throw new Error('NO_AVAILABLE_CHANNEL')
  const request = makeAnthropicProvider({client, fn: 'strategize', model: ctx.model, prospectId, maxTokens: 4096})
  const hasReferencePrices = Array.isArray(ctx.business_profile.reference_prices) && ctx.business_profile.reference_prices.length > 0
  const promptInput = {
    sources: ctx.sources,
    prospectId,
    analysis: ctx.analysis,
    businessProfile: ctx.business_profile,
    availableChannels: ctx.available_channels,
  }
  const strategy = await requestValidatedJson({
    request,
    prompt: buildStrategizePrompt(promptInput),
    validate: output => validateStrategy(output, {
      services: ctx.business_profile.services,
      availableChannels: ctx.available_channels,
      hasReferencePrices,
    }),
  })
  const prospect = await rpc(client, 'prospector_store_strategy', {p_id: prospectId, p_strategy: strategy})
  return {stage: 'strategize', prospect}
}

interface CopywriteContext extends StrategyContext {
  strategy: unknown
  tone: string
}
export async function runCopywrite(client: SupabaseClient, prospectId: string) {
  const ctx = await rpc<CopywriteContext>(client, 'prospector_copywrite_context', {p_id: prospectId})
  if (!ctx.analysis) throw new Error('ANALYSIS_MISSING')
  if (!ctx.strategy) throw new Error('STRATEGY_MISSING')
  if (!Array.isArray(ctx.available_channels) || ctx.available_channels.length === 0) throw new Error('NO_AVAILABLE_CHANNEL')
  const request = makeAnthropicProvider({client, fn: 'copywrite', model: ctx.model, prospectId, maxTokens: 8192})
  const promptContext = {sources: ctx.sources, prospectId}
  const message = await requestValidatedJson({
    request,
    prompt: buildCopywritePrompt({
      sources: ctx.sources,
      prospectId,
      analysis: ctx.analysis,
      strategy: ctx.strategy,
      businessProfile: ctx.business_profile,
      availableChannels: ctx.available_channels,
      tone: ctx.tone,
    }),
    validate: output => validateMessage(output, promptContext),
  })
  const result = await rpc(client, 'prospector_store_messages', {p_id: prospectId, p_message: message})
  return {stage: 'copywrite', result}
}
