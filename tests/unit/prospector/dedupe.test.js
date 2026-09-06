import { describe, expect, it } from 'vitest'
import { normalizeName, normalizeDomain, normalizePhone, buildDedupeHash, matchProspects, findDuplicates } from '../../../src/lib/prospector/dedupe.js'

describe('normalisation et déduplication', () => {
  it.each([
    [' SARL Château de l’Œuvre ', 'chateau de l oeuvre'], ['S.A.R.L. Hôtel Étoilé SASU', 'hotel etoile'],
    ['SAS Domaine   des Vignes', 'domaine des vignes'], ['Sassafras', 'sassafras'],
    ['S.A. Café', 'cafe'], ['', null], [null, null], ['SARL', null],
  ])('normalise le nom %s', (raw, result) => expect(normalizeName(raw)).toBe(result))
  it.each([
    ['HTTPS://WWW.Example.fr/page?q=1', 'example.fr'], ['www.example.fr/', 'example.fr'],
    ['//EXAMPLE.FR/path', 'example.fr'], ['https://example.fr./', 'example.fr'],
    ['https://Hôtel.fr', 'xn--htel-vqa.fr'], ['mailto:contact@example.fr', null],
    ['https://user:pass@example.fr', null], ['pas un site', null], ['', null],
  ])('normalise le domaine %s', (raw, result) => expect(normalizeDomain(raw)).toBe(result))
  it.each([
    ['06 12 34 56 78', '+33612345678'], ['05.53.00.12.34', '+33553001234'],
    ['0033 6 12 34 56 78', '+33612345678'], ['+33 (0)6 12 34 56 78', '+33612345678'],
    ['+44 20 7946 0958', '+442079460958'], ['+33 06 12 34 56 78', null],
    ['06 12 34 56 78 poste 2', null], ['123', null], [612345678, null], ['', null],
  ])('normalise le téléphone %s', (raw, result) => expect(normalizePhone(raw)).toBe(result))
  it('ne rapproche pas des valeurs vides ni un email seul', () => {
    expect(matchProspects({}, {})).toBeNull()
    expect(matchProspects({ name: 'Hôtel' }, { name: 'Hôtel' })).toBeNull()
    expect(matchProspects({ email: 'info@example.fr' }, { email: 'info@example.fr' })).toBeNull()
    expect(buildDedupeHash({})).toBeNull()
  })
  it('compare les signaux secondaires et remonte toutes les collisions', () => {
    const candidate = { website: 'https://a.fr', phone: '0612345678', name: 'SAS Étoile', city: 'Sarlat' }
    const existing = [{ id: '1', website: 'https://a.fr' }, { id: '2', website: 'https://b.fr', phone: '+33612345678' }, { id: '3', name: 'etoile', city: 'SARLAT' }]
    expect(findDuplicates(candidate, existing).map(match => match.matched_by)).toEqual(['domain', 'phone', 'name_city'])
    expect(buildDedupeHash(candidate)).not.toBe(buildDedupeHash(existing[1]))
  })
  it('ignore les supprimés, distingue villes et suffixes de domaines', () => {
    expect(matchProspects({ website: 'https://a.fr' }, { website: 'https://a.fr', deleted_at: '2026-09-05' })).toBeNull()
    expect(matchProspects({ name: 'Étoile', city: 'Sarlat' }, { name: 'Étoile', city: 'Bergerac' })).toBeNull()
    expect(matchProspects({ website: 'https://a.fr' }, { website: 'https://a.fr.evil.test' })).toBeNull()
  })
})
