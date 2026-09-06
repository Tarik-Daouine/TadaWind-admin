import { describe, expect, it } from 'vitest'
import { DEFAULT_SCORING_WEIGHTS, scoreProspect, getPriority } from '../../../src/lib/prospector/scoring.js'
import { ScoreSchema } from '../../../supabase/functions/_shared/prospector/schemas.js'

const analysis = { qualitative_scores: { fit_tada_wind: 100, video_need: 100, drone_need: 100, commercial_potential: 100, digital_gap: 100 }, buying_signals: [{ weight: 'fort' }] }
describe('score déterministe', () => {
  it('atteint 100 avec ventilation et motifs cohérents', () => {
    const score = scoreProspect({ analysis, prospect: { contact_email: 'direction@hotel.fr' }, context: { distance_km: 30 } })
    expect(score.total).toBe(100)
    expect(score.priority).toBe('hot')
    expect(score.reasons).toHaveLength(8)
    expect(ScoreSchema.parse(score)).toEqual(score)
  })
  it.each([[0, 5], [30, 5], [30.01, 3], [60, 3], [60.01, 1], [100, 1], [100.01, 0], [null, 0], [undefined, 0], [-1, 0], [NaN, 0], ['0', 0]])('distance %s → %s points', (distance_km, points) => {
    expect(scoreProspect({ context: { distance_km }, settings: { radius_max_km: 200 } }).breakdown.geo_access).toBe(points)
  })
  it.each([[80, 'hot'], [79, 'good'], [60, 'good'], [59, 'consider'], [40, 'consider'], [39, 'low'], [20, 'low'], [19, 'excluded']])('seuil %s → %s', (total, expected) => expect(getPriority(total)).toBe(expected))
  it.each(['is_closed', 'is_blacklisted', 'is_duplicate'])('applique l’exclusion %s avant le score', flag => {
    const score = scoreProspect({ analysis, context: { [flag]: true } })
    expect(score.total).toBe(0)
    expect(score.priority).toBe('excluded')
    expect(Object.values(score.breakdown).every(value => value === 0)).toBe(true)
  })
  it('exclut clients, catégories désactivées et hors zone', () => {
    for (const input of [{ prospect: { is_client: true } }, { prospect: { category: 'hotel' }, settings: { disabled_categories: ['hotel'] } }, { prospect: { category: 'hotel' }, settings: { enabled_categories: ['gite'] } }, { context: { distance_km: 101 } }]) {
      expect(scoreProspect({ analysis, ...input }).total).toBe(0)
    }
    expect(scoreProspect({ analysis, context: { distance_km: null } }).total).toBe(90)
  })
  it('borne les sous-notes sans coercition et ne cumule pas les signaux', () => {
    const result = scoreProspect({ analysis: { qualitative_scores: { fit_tada_wind: 500, video_need: -1, drone_need: '100', commercial_potential: Infinity, digital_gap: null }, buying_signals: [{ weight: 'faible' }, { weight: 'moyen' }, { weight: 'moyen' }] } })
    expect(result.total).toBe(28)
    expect(result.breakdown.buying_signal).toBe(3)
    expect(scoreProspect().total).toBe(0)
    expect(scoreProspect({ analysis: { buying_signals: [{ weight: 'toString' }, null] } }).total).toBe(0)
  })
  it.each([[{ contact_email: 'a@b.fr' }, {}, 5], [{ email: 'info@b.fr' }, {}, 3], [{ email_commercial: 'sales@b.fr' }, {}, 3], [{ email: 'invalide' }, {}, 0], [{ phone: '0612345678' }, { has_contact_form: true }, 1]])('classe les contacts %j', (prospect, context, points) => expect(scoreProspect({ prospect, context }).breakdown.contactability).toBe(points))
  it('supporte barème et seuils configurables sans les muter', () => {
    const settings = { scoring_weights: { ...DEFAULT_SCORING_WEIGHTS, version: 'custom', fit_tada_wind: 20, geo_access: 10 }, priority_thresholds: { hot: 90, good: 70, consider: 50, low: 10 }, distance_bands: [{ max: 40 }, { max: 80 }, { max: 120 }], radius_max_km: 120 }
    const snapshot = structuredClone(settings)
    const result = scoreProspect({ analysis, settings, context: { distance_km: 40 } })
    expect(result.breakdown.geo_access).toBe(10)
    expect(result.weights_version).toBe('custom')
    expect(settings).toEqual(snapshot)
  })
  it.each([{ scoring_weights: { ...DEFAULT_SCORING_WEIGHTS, geo_access: 100 } }, { priority_thresholds: { hot: 20, good: 80, consider: 40, low: 0 } }, { distance_bands: [{ max: 100 }, { max: 60 }, { max: 30 }] }, { radius_max_km: -1 }])('rejette la configuration invalide %j', settings => expect(() => scoreProspect({ settings })).toThrow('INVALID_SCORING_SETTINGS'))
  it('garantit score borné, arrondi et somme pour de nombreuses valeurs', () => {
    for (let i = -10; i < 130; i++) {
      const scores = Object.fromEntries(Object.keys(analysis.qualitative_scores).map(key => [key, i + 0.37]))
      const result = scoreProspect({ analysis: { qualitative_scores: scores } })
      expect(result.total).toBeGreaterThanOrEqual(0)
      expect(result.total).toBeLessThanOrEqual(100)
      expect(ScoreSchema.safeParse(result).success).toBe(true)
    }
  })
})
