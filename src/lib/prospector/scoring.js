import { normalizeEmail } from './dedupe.js'

export const DEFAULT_SCORING_WEIGHTS = Object.freeze({
  version: '2026-09-05', fit_tada_wind: 25, video_interest: 20, drone_interest: 15,
  commercial_potential: 15, digital_gap: 10, geo_access: 5, buying_signal: 5, contactability: 5,
})
export const DEFAULT_PRIORITY_THRESHOLDS = Object.freeze({ hot: 80, good: 60, consider: 40, low: 20 })
export const DEFAULT_DISTANCE_BANDS = Object.freeze([
  Object.freeze({ max: 30, points: 5 }), Object.freeze({ max: 60, points: 3 }), Object.freeze({ max: 100, points: 1 }),
])
export const PRIORITY_LABELS = Object.freeze({ hot: 'Très intéressant', good: 'Bon prospect', consider: 'À considérer', low: 'Faible priorité', excluded: 'À exclure' })
export const CRITERIA_LABELS = Object.freeze({
  fit_tada_wind: 'Adéquation Tada Wind', video_interest: 'Intérêt vidéo', drone_interest: 'Intérêt drone',
  commercial_potential: 'Potentiel commercial', digital_gap: 'Présence numérique perfectible',
  geo_access: 'Accessibilité géographique', buying_signal: "Signal d'achat", contactability: 'Facilité de contact',
})
const KEYS = Object.keys(CRITERIA_LABELS)
const SIGNAL_POINTS = Object.freeze({ faible: 1, moyen: 3, fort: 5 })
const finite = value => typeof value === 'number' && Number.isFinite(value)
const bounded = value => finite(value) ? Math.min(100, Math.max(0, value)) : 0
const round = value => Math.round((value + Number.EPSILON) * 100) / 100

export function validateScoringSettings(settings = {}) {
  const weights = { ...(settings.scoring_weights ?? DEFAULT_SCORING_WEIGHTS) }
  const thresholds = { ...(settings.priority_thresholds ?? DEFAULT_PRIORITY_THRESHOLDS) }
  const rawBands = settings.distance_bands ?? DEFAULT_DISTANCE_BANDS
  if (!Array.isArray(rawBands) || rawBands.some(band => !band || typeof band !== 'object')) throw new Error('INVALID_SCORING_SETTINGS: bandes invalides')
  const bands = rawBands.map((band, i) => ({ ...band, points: band.points ?? [5, 3, 1][i] }))
  if (!KEYS.every(key => finite(weights[key]) && weights[key] >= 0) || Math.abs(KEYS.reduce((sum, key) => sum + weights[key], 0) - 100) > 1e-8 || typeof weights.version !== 'string' || !weights.version.trim()) {
    throw new Error('INVALID_SCORING_SETTINGS: poids positifs ou nuls, total 100 et version requis')
  }
  const levels = ['hot', 'good', 'consider', 'low'].map(key => thresholds[key])
  if (!levels.every((n, i) => finite(n) && n >= 0 && n <= 100 && (i === 0 || levels[i - 1] > n))) throw new Error('INVALID_SCORING_SETTINGS: seuils décroissants requis')
  if (bands.length !== 3 || !bands.every((band, i) => finite(band.max) && band.max >= 0 && finite(band.points) && band.points >= 0 && band.points <= 5 && (i === 0 || band.max > bands[i - 1].max))) throw new Error('INVALID_SCORING_SETTINGS: trois bandes de distance croissantes requises')
  const radius = settings.radius_max_km ?? 100
  if (!finite(radius) || radius < 0) throw new Error('INVALID_SCORING_SETTINGS: rayon invalide')
  for (const key of ['enabled_categories', 'disabled_categories']) {
    if (settings[key] !== undefined && (!Array.isArray(settings[key]) || !settings[key].every(value => typeof value === 'string'))) throw new Error(`INVALID_SCORING_SETTINGS: ${key}`)
  }
  return { weights, thresholds, bands, radius }
}

export function getPriority(total, thresholds = DEFAULT_PRIORITY_THRESHOLDS) {
  const score = bounded(total)
  return ['hot', 'good', 'consider', 'low'].find(key => score >= thresholds[key]) ?? 'excluded'
}

/** context contains verified server-side facts, never flags supplied by a LLM. */
export function scoreProspect({ prospect = {}, analysis = prospect.analysis ?? {}, settings = {}, context = {} } = {}) {
  const { weights, thresholds, bands, radius } = validateScoringSettings(settings)
  const distance = finite(context.distance_km) && context.distance_km >= 0 ? context.distance_km : null
  const exclusions = []
  if (context.is_closed === true) exclusions.push('Entreprise fermée')
  if (context.is_blacklisted === true) exclusions.push('Entreprise sur liste d’exclusion')
  if (context.is_duplicate === true) exclusions.push('Doublon identifié')
  if (prospect.is_client === true) exclusions.push('Entreprise déjà cliente')
  if (distance !== null && distance > radius) exclusions.push(`Hors zone : ${distance} km (maximum ${radius} km)`)
  if (prospect.category && (settings.disabled_categories?.includes(prospect.category) || (settings.enabled_categories?.length && !settings.enabled_categories.includes(prospect.category)))) exclusions.push('Catégorie désactivée')
  const breakdown = Object.fromEntries(KEYS.map(key => [key, 0]))
  if (exclusions.length) return { total: 0, label: PRIORITY_LABELS.excluded, priority: 'excluded', breakdown, reasons: exclusions, weights_version: weights.version }

  const reasons = []
  const qualitative = analysis?.qualitative_scores ?? {}
  for (const [key, input] of Object.entries({ fit_tada_wind: 'fit_tada_wind', video_interest: 'video_need', drone_interest: 'drone_need', commercial_potential: 'commercial_potential', digital_gap: 'digital_gap' })) {
    const value = bounded(qualitative[input])
    breakdown[key] = round(value * weights[key] / 100)
    reasons.push(`${CRITERIA_LABELS[key]} : ${breakdown[key]}/${weights[key]} (${finite(qualitative[input]) ? `note ${value}/100` : 'donnée inconnue'})`)
  }
  const geo = distance === null ? 0 : bands.find(band => distance <= band.max)?.points ?? 0
  breakdown.geo_access = round(geo / 5 * weights.geo_access)
  const signals = Array.isArray(analysis?.buying_signals) ? analysis.buying_signals : []
  const signal = signals.reduce((max, item) => Math.max(max, Object.hasOwn(SIGNAL_POINTS, item?.weight) ? SIGNAL_POINTS[item.weight] : 0), 0)
  breakdown.buying_signal = round(signal / 5 * weights.buying_signal)
  const contact = normalizeEmail(prospect.contact_email) ? 5 : (normalizeEmail(prospect.email) || normalizeEmail(prospect.email_commercial)) ? 3 : context.has_contact_form === true ? 1 : 0
  breakdown.contactability = round(contact / 5 * weights.contactability)
  reasons.push(`Distance : ${distance === null ? 'inconnue' : `${distance} km`} → ${breakdown.geo_access}/${weights.geo_access}`)
  reasons.push(`Signal d'achat : ${({ 0: 'aucun renseigné', 1: 'faible', 3: 'moyen', 5: 'fort' })[signal]} → ${breakdown.buying_signal}/${weights.buying_signal}`)
  reasons.push(`Contact : ${({ 0: 'aucun moyen renseigné', 1: 'formulaire seul', 3: 'email général', 5: 'email direct' })[contact]} → ${breakdown.contactability}/${weights.contactability}`)
  const total = Math.min(100, Math.max(0, Math.round(Object.values(breakdown).reduce((a, b) => a + b, 0))))
  const priority = getPriority(total, thresholds)
  return { total, label: PRIORITY_LABELS[priority], priority, breakdown, reasons, weights_version: weights.version }
}
