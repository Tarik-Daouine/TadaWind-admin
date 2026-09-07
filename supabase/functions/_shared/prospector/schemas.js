import { z } from 'npm:zod@3.25.76'

const text = z.string().trim().min(1).max(12000)
const short = z.string().trim().min(1).max(500)
const list = z.array(short).max(30)
const uuid = z.string().uuid()
const ids = z.array(uuid).min(1).max(100)
const unit = z.number().finite().min(0).max(1)
const grade = z.number().finite().min(0).max(100)
const state = z.enum(['oui', 'non', 'inconnu'])
const obj = shape => z.object(shape).strict()
const objection = obj({ objection: text, response: text })
export const httpUrl = z.string().url().refine(value => {
  const url = new URL(value)
  return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
}, 'URL HTTP(S) sans identifiants requise')

export const SourceSchema = obj({
  id: uuid, prospect_id: uuid, type: short, url: httpUrl.nullable(),
  fetched_at: z.string().datetime({ offset: true }), content_excerpt: text,
  extracted: z.record(z.unknown()).nullable().optional(), confidence: unit,
})

export const AnalysisSchema = obj({
  summary: text, business_type: short,
  positioning: z.enum(['premium', 'milieu_de_gamme', 'entree_de_gamme', 'inconnu']),
  target_customers: list, visual_dependency: z.enum(['faible', 'moyenne', 'forte', 'inconnu']),
  marketing_state: obj({
    website_quality: z.enum(['faible', 'moyenne', 'bonne', 'inconnu']), website_recent: state,
    photos_professional: z.enum(['oui', 'non', 'partiel', 'inconnu']), has_video: state,
    has_drone: state, video_outdated: state, instagram_active: state, reels_used: state, publishing_regular: state,
  }),
  buying_signals: z.array(obj({ type: short, evidence_source_id: uuid, weight: z.enum(['faible', 'moyen', 'fort']) })).max(30),
  opportunities: list, weaknesses: list, recommended_content: list,
  qualitative_scores: obj({ fit_tada_wind: grade, video_need: grade, drone_need: grade, commercial_potential: grade, digital_gap: grade }),
  confidence: unit, sources_considered: ids,
}).superRefine((data, ctx) => {
  for (const [i, signal] of data.buying_signals.entries()) {
    if (!data.sources_considered.includes(signal.evidence_source_id)) ctx.addIssue({ code: 'custom', path: ['buying_signals', i, 'evidence_source_id'], message: 'Source non considérée' })
  }
})

export const ScoreSchema = obj({
  total: grade.int(), label: short, priority: z.enum(['hot', 'good', 'consider', 'low', 'excluded']),
  breakdown: obj({ fit_tada_wind: grade, video_interest: grade, drone_interest: grade, commercial_potential: grade, digital_gap: grade, geo_access: grade, buying_signal: grade, contactability: grade }),
  reasons: z.array(text).min(1).max(30), weights_version: short,
}).superRefine((data, ctx) => {
  const sum = Object.values(data.breakdown).reduce((a, b) => a + b, 0)
  if (sum > 100.05 || Math.round(sum) !== data.total) ctx.addIssue({ code: 'custom', path: ['total'], message: 'Total incohérent avec la ventilation' })
})

export const StrategySchema = obj({
  angles: z.array(obj({ title: short, rationale: text, tada_wind_services: z.array(short).min(1).max(15), estimated_value_eur: z.tuple([z.number().finite().nonnegative(), z.number().finite().nonnegative()]).nullable() })).min(1).max(3),
  primary_angle_index: z.number().int().min(0).max(2),
  recommended_channel: z.enum(['email', 'instagram_dm', 'linkedin', 'phone']),
  objections: z.array(objection).max(10), arguments: list,
}).superRefine((data, ctx) => {
  if (data.primary_angle_index >= data.angles.length) ctx.addIssue({ code: 'custom', path: ['primary_angle_index'], message: 'Angle absent' })
  data.angles.forEach((angle, i) => {
    if (angle.estimated_value_eur && angle.estimated_value_eur[0] > angle.estimated_value_eur[1]) ctx.addIssue({ code: 'custom', path: ['angles', i, 'estimated_value_eur'], message: 'Fourchette inversée' })
  })
})

// Do not trim message segments: exact byte-for-byte coverage is checked below.
const copy = z.string().min(1).max(12000).refine(value => value.trim().length > 0)
export const MessageSchema = obj({
  variants: obj({
    email: obj({ subject: copy, body: copy }), instagram_dm: obj({ body: copy }), linkedin: obj({ body: copy }),
    phone_script: obj({ opening: copy, reason: copy, proposal: copy, objections: z.array(obj({ objection: copy, response: copy })).max(10), cta: copy }),
  }),
  sources_used: z.array(obj({ source_id: uuid, type: short, url: httpUrl.nullable(), claim: copy, path: short, evidence_quote: copy })).min(1).max(200),
  grounding: z.array(obj({ path: short, text: copy, kind: z.enum(['fact', 'proposal', 'generic']), source_ids: z.array(uuid).max(100) })).min(1).max(200),
  tone_check: obj({ generic: z.literal(false), fake_compliment: z.literal(false), corporate: z.literal(false) }), confidence: unit,
})

export function messageFields(variants) {
  const entries = []
  function visit(value, path) {
    if (typeof value === 'string') entries.push([path, value])
    else for (const [key, child] of Object.entries(value)) visit(child, path ? `${path}.${key}` : key)
  }
  visit(variants, '')
  return Object.fromEntries(entries)
}

/** Load these rows with the service-side prospect filter; never use LLM/client rows. */
export function validateSourceContext(sources, prospectId) {
  uuid.parse(prospectId)
  const parsed = z.array(SourceSchema).min(1).max(100).parse(sources)
  if (new Set(parsed.map(source => source.id)).size !== parsed.length || parsed.some(source => source.prospect_id !== prospectId)) throw new Error('INVALID_SOURCE_CONTEXT')
  return new Map(parsed.map(source => [source.id, source]))
}

export function validateAnalysis(output, { sources, prospectId }) {
  const sourceMap = validateSourceContext(sources, prospectId)
  const result = AnalysisSchema.parse(output)
  if (result.sources_considered.some(id => !sourceMap.has(id))) throw new Error('UNKNOWN_ANALYSIS_SOURCE')
  return result
}

export function validateStrategy(output, { services, availableChannels, hasReferencePrices = false }) {
  const result = StrategySchema.parse(output)
  if (!availableChannels.includes(result.recommended_channel)) throw new Error('UNAVAILABLE_CHANNEL')
  for (const angle of result.angles) {
    if (angle.tada_wind_services.some(service => !services.includes(service))) throw new Error('UNKNOWN_TADA_WIND_SERVICE')
    if (!hasReferencePrices && angle.estimated_value_eur !== null) throw new Error('UNSUPPORTED_PRICE_ESTIMATE')
  }
  return result
}

/** Structural traceability only: human review must still check meaning and truth. */
export function validateCopywriteSelection(output, context) {
  const sourceMap=validateSourceContext(context.sources,context.prospectId)
  const selected=obj({source_id:uuid,evidence_quote:z.string().min(15).max(350),confidence:unit}).parse(output)
  const source=sourceMap.get(selected.source_id)
  if(!source)throw new Error('INVALID_CITATION_SOURCE')
  if(!source.content_excerpt.includes(selected.evidence_quote))throw new Error('INVALID_CITATION_QUOTE')
  return {confidence:selected.confidence,
    grounding:[{path:'evidence',text:selected.evidence_quote,kind:'fact',source_ids:[source.id]}],
    sources_used:[{path:'evidence',claim:selected.evidence_quote,source_id:source.id,type:source.type,url:source.url,evidence_quote:selected.evidence_quote}]}
}

export function validateCopywrite(output, context) {
  const shape = MessageSchema.shape.variants.shape
  if (!Object.hasOwn(shape, context.channel)) throw new Error('INVALID_MESSAGE_CHANNEL')
  const sourceMap = validateSourceContext(context.sources, context.prospectId)
  const wireSchema = MessageSchema.omit({sources_used:true}).extend({
    variants: obj({ [context.channel]: shape[context.channel] }),
    grounding: z.array(obj({path:short,text:copy,kind:z.enum(['fact','proposal','generic']),
      evidence:z.array(obj({source_id:uuid,evidence_quote:copy})).max(8)})).min(1).max(24),
  })
  const wire = wireSchema.parse(output)
  const citations = []
  const grounding = wire.grounding.map(({evidence,...segment}) => {
    if ((segment.kind==='fact') !== (evidence.length>0)) throw new Error('INVALID_GROUNDING')
    for (const proof of evidence) {
      const source = sourceMap.get(proof.source_id)
      if (!source) throw new Error('INVALID_CITATION_SOURCE')
      if (!source.content_excerpt.includes(proof.evidence_quote)) throw new Error('INVALID_CITATION_QUOTE')
      // New AI drafts quote facts verbatim. A related quote cannot justify extra claims.
      if (!proof.evidence_quote.includes(segment.text.trim())) throw new Error('FACT_NOT_EXTRACTIVE')
      // Provenance comes from the server; claim and path come from this exact segment.
      citations.push({...proof,type:source.type,url:source.url,path:segment.path,claim:segment.text})
    }
    return {...segment,source_ids:evidence.map(proof=>proof.source_id)}
  })
  return validateMessage({...wire,grounding,sources_used:citations},context)
}

export function validateMessage(output, { sources, prospectId, channel }) {
  const sourceMap = validateSourceContext(sources, prospectId)
  if(channel && !Object.hasOwn(MessageSchema.shape.variants.shape,channel))throw new Error('INVALID_MESSAGE_CHANNEL')
  const schema=channel ? MessageSchema.extend({variants:obj({[channel]:MessageSchema.shape.variants.shape[channel]})}) : MessageSchema
  const result = schema.parse(output)
  if(channel && (Object.values(messageFields(result.variants)).join('').length>2400 || result.grounding.length>24 || result.sources_used.length>8))throw new Error('MESSAGE_TOO_LONG')
  const fields = messageFields(result.variants)
  for (const segment of result.grounding) {
    if (!Object.hasOwn(fields, segment.path) || (segment.kind === 'fact' && !segment.source_ids.length) || segment.source_ids.some(id => !sourceMap.has(id))) throw new Error('INVALID_GROUNDING')
    if (segment.kind !== 'fact' && segment.source_ids.length) throw new Error('NON_FACT_WITH_SOURCES')
  }
  for (const [path, value] of Object.entries(fields)) {
    if (result.grounding.filter(segment => segment.path === path).map(segment => segment.text).join('') !== value) throw new Error(`INCOMPLETE_GROUNDING: ${path}`)
  }
  for (const citation of result.sources_used) {
    const source = sourceMap.get(citation.source_id)
    if (!source || citation.url !== source.url || citation.type !== source.type) throw new Error('INVALID_CITATION_SOURCE')
    if (!source.content_excerpt.includes(citation.evidence_quote) || !fields[citation.path]?.includes(citation.claim)) throw new Error('INVALID_CITATION_QUOTE')
    if (!result.grounding.some(segment => segment.kind === 'fact' && segment.path === citation.path && segment.text === citation.claim && segment.source_ids.includes(citation.source_id))) throw new Error('UNUSED_CITATION')
  }
  for (const segment of result.grounding.filter(segment => segment.kind === 'fact')) {
    if (segment.source_ids.some(id => !result.sources_used.some(citation => citation.source_id === id && citation.path === segment.path && citation.claim === segment.text))) throw new Error('UNCITED_FACT')
  }
  for (const variant of Object.keys(result.variants)) {
    if (!result.grounding.some(segment => segment.path.startsWith(`${variant}.`) && segment.kind === 'fact')) throw new Error(`UNPERSONALIZED_VARIANT: ${variant}`)
  }
  return result
}
