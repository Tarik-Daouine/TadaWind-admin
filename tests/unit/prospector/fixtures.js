export const prospectId = '11111111-1111-4111-8111-111111111111'
export const sourceId = '22222222-2222-4222-8222-222222222222'
export const otherId = '33333333-3333-4333-8333-333333333333'
export const sources = [{ id: sourceId, prospect_id: prospectId, type: 'website_page', url: 'https://hotel.example/', fetched_at: '2026-09-05T12:00:00Z', content_excerpt: 'Notre hôtel est situé à Sarlat. Ouverture de notre terrasse en septembre 2026.', confidence: 0.8 }]
export function analysisFixture() {
  return { summary: 'Un hôtel à Sarlat. Une terrasse ouvre en septembre 2026. Les extraits ne décrivent pas les contenus vidéo.', business_type: 'hôtel', positioning: 'inconnu', target_customers: [], visual_dependency: 'forte', marketing_state: { website_quality: 'inconnu', website_recent: 'inconnu', photos_professional: 'inconnu', has_video: 'inconnu', has_drone: 'inconnu', video_outdated: 'inconnu', instagram_active: 'inconnu', reels_used: 'inconnu', publishing_regular: 'inconnu' }, buying_signals: [{ type: 'Ouverture de terrasse septembre 2026', evidence_source_id: sourceId, weight: 'fort' }], opportunities: ['Présentation de la terrasse'], weaknesses: [], recommended_content: ['Vidéo promotionnelle'], qualitative_scores: { fit_tada_wind: 80, video_need: 70, drone_need: 0, commercial_potential: 0, digital_gap: 0 }, confidence: 0.5, sources_considered: [sourceId] }
}
export const businessProfile = { business: 'Tada Wind', services: ['vidéo promotionnelle'], positioning: 'Prestations visuelles', portfolio: [], contactInfo: {}, pitchNotes: '' }
export function strategyFixture() {
  return { angles: [{ title: 'Présentation de la terrasse', rationale: 'Accompagner son ouverture', tada_wind_services: ['vidéo promotionnelle'], estimated_value_eur: null }], primary_angle_index: 0, recommended_channel: 'email', objections: [], arguments: ['Montrer le nouvel espace'] }
}
export function messageFixture() {
  const fact = 'Votre hôtel est situé à Sarlat.'
  const proposal = ' Je vous propose une vidéo de présentation.'
  const generic = ' Un échange vous conviendrait-il ?'
  const message = { variants: { email: { subject: 'Une idée de vidéo', body: fact + proposal + generic }, instagram_dm: { body: fact + proposal }, linkedin: { body: fact + proposal }, phone_script: { opening: fact, reason: 'Je vous appelle pour une idée de vidéo.', proposal: 'Je vous propose une vidéo de présentation.', objections: [{ objection: 'Et si le budget est limité ?', response: 'Nous pouvons discuter du périmètre.' }], cta: 'Un échange vous conviendrait-il ?' } }, sources_used: [], grounding: [], tone_check: { generic: false, fake_compliment: false, corporate: false }, confidence: 0.7 }
  function add(path, text, kind) {
    message.grounding.push({ path, text, kind, source_ids: kind === 'fact' ? [sourceId] : [] })
    if (kind === 'fact') message.sources_used.push({ source_id: sourceId, type: 'website_page', url: sources[0].url, path, claim: text, evidence_quote: 'Notre hôtel est situé à Sarlat.' })
  }
  add('email.subject', message.variants.email.subject, 'proposal')
  for (const channel of ['email', 'instagram_dm', 'linkedin']) { add(`${channel}.body`, fact, 'fact'); add(`${channel}.body`, proposal, 'proposal') }
  add('email.body', generic, 'generic')
  for (const [key, value] of Object.entries(message.variants.phone_script)) {
    if (key === 'objections') for (const [i, objection] of value.entries()) for (const [field, copy] of Object.entries(objection)) add(`phone_script.objections.${i}.${field}`, copy, 'proposal')
    else add(`phone_script.${key}`, value, key === 'opening' ? 'fact' : 'proposal')
  }
  return message
}
