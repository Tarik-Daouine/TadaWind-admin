import { validateScoringSettings } from './scoring.js'

const fields = ['business_profile','reference_address','reference_lat','reference_lng','radius_preferred_km','radius_max_km',
  'min_score','priority_thresholds','distance_bands','enabled_categories','disabled_categories','followup_delays_days',
  'ai_model_simple','ai_model_complex','monthly_budget_usd','tone','channels','scoring_weights']
const uniqueLines = value => [...new Set(value.map(item => item.trim()).filter(Boolean))]
const number = (value, label, optional = false) => {
  if ((value === '' || value == null) && optional) return null
  if (value === '' || value == null || !Number.isFinite(Number(value))) throw new Error(`${label} : renseigne un nombre.`)
  return Number(value)
}

export function prepareSettingsForSave(form, previous, now = new Date()) {
  const result = structuredClone(Object.fromEntries(fields.map(key => [key, form[key]])))
  const p = result.business_profile
  if (!p || !p.business?.trim() || !p.positioning?.trim()) throw new Error('Renseigne le nom et le positionnement de Tada Wind.')
  p.services = uniqueLines(p.services)
  if (!p.services.length) throw new Error('Renseigne au moins une prestation.')
  p.targetCustomers = uniqueLines(p.targetCustomers ?? [])
  p.preferredAreas = uniqueLines(p.preferredAreas ?? [])
  if (p.contactInfo?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.contactInfo.email)) throw new Error('Vérifie l’email de contact Tada Wind.')
  for (const entry of p.portfolio ?? []) {
    const raw = typeof entry === 'string' ? entry : entry.url
    try { if (!['http:', 'https:'].includes(new URL(raw).protocol)) throw new Error() }
    catch { throw new Error('Chaque référence du portfolio doit avoir une URL HTTP ou HTTPS complète.') }
  }
  result.reference_address = result.reference_address?.trim()
  if (!result.reference_address) throw new Error('Renseigne une adresse de référence.')
  for (const key of ['radius_preferred_km','radius_max_km','min_score']) result[key] = number(result[key], 'Zone et score')
  if (!['radius_preferred_km','radius_max_km','min_score'].every(key => Number.isInteger(result[key]))) throw new Error('Les rayons et le score minimum doivent être des entiers.')
  if (result.radius_preferred_km < 0 || result.radius_preferred_km > result.radius_max_km || result.radius_max_km > 2000) throw new Error('Le rayon préféré doit être inférieur ou égal au rayon maximal (2 000 km maximum).')
  if (result.min_score < 0 || result.min_score > 100) throw new Error('Le score minimum doit être compris entre 0 et 100.')
  for (const key of ['reference_lat','reference_lng','monthly_budget_usd']) result[key] = number(result[key], 'Coordonnées ou budget', true)
  if ((result.reference_lat === null) !== (result.reference_lng === null) || (result.reference_lat !== null && (Math.abs(result.reference_lat)>90 || Math.abs(result.reference_lng)>180))) throw new Error('Renseigne les deux coordonnées GPS valides ou laisse-les toutes les deux vides.')
  if (result.monthly_budget_usd !== null && result.monthly_budget_usd <= 0) throw new Error('Le budget doit être positif ou laissé vide.')
  for (const key of ['enabled_categories','disabled_categories']) result[key] = uniqueLines(result[key])
  if (result.enabled_categories.some(category => result.disabled_categories.includes(category))) throw new Error('Une catégorie ne peut pas être activée et exclue simultanément.')
  result.followup_delays_days = result.followup_delays_days.map(value => number(value, 'Délais de relance'))
  if (result.followup_delays_days.length>5 || !result.followup_delays_days.every((value,i) => Number.isInteger(value) && value>0 && value<=365 && (i===0 || value>result.followup_delays_days[i-1]))) throw new Error('Les délais de relance doivent être croissants, entre 1 et 365 jours (5 maximum).')
  for (const key of Object.keys(result.priority_thresholds)) result.priority_thresholds[key] = number(result.priority_thresholds[key], 'Seuils de priorité')
  for (const key of Object.keys(result.scoring_weights).filter(key => key !== 'version')) result.scoring_weights[key] = number(result.scoring_weights[key], 'Poids du score')
  result.distance_bands = result.distance_bands.map((band,i) => ({ ...band, max: number(band.max, 'Bandes de distance'), points: number(band.points ?? [5,3,1][i], 'Points de distance') }))
  try { validateScoringSettings(result) } catch { throw new Error('Vérifie le barème : total des poids égal à 100, seuils décroissants et bandes de distance croissantes.') }
  if (Object.keys(result.scoring_weights).some(key => key !== 'version' && result.scoring_weights[key] !== previous.scoring_weights[key])) result.scoring_weights.version = now.toISOString()
  result.tone = result.tone?.trim()
  if (!result.tone) throw new Error('Renseigne le ton des messages.')
  for (const key of ['ai_model_simple','ai_model_complex']) result[key] = result[key]?.trim() || null
  return result
}

export function prospectorErrorMessage(error) {
  const message = error?.message ?? ''
  if (message.includes('SETTINGS_CONFLICT')) return 'Ces réglages ont été modifiés dans une autre session. Tes changements sont conservés ici ; recharge la version enregistrée avant de recommencer.'
  if (['42P01','PGRST205','PGRST202'].includes(error?.code)) return 'La prospection n’est pas encore disponible sur cet environnement.'
  if (error?.code === '42501' || message.includes('USER_ACTION_REQUIRED')) return 'Ta session ne permet pas cette action. Reconnecte-toi à l’admin.'
  if (message.includes('INVALID_') || message.includes('check constraint')) return 'Certains réglages ne sont pas valides. Vérifie les champs avant de réessayer.'
  return 'Impossible de joindre la prospection. Vérifie ta connexion et réessaie.'
}
