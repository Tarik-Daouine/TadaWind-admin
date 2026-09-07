import { describe, it, expect, vi } from 'vitest'
import { completeLocations, resolveLocation } from '../../../supabase/functions/_shared/prospector/location.js'

const candidate = (extra = {}) => ({ city: null, lat: 44.9350426, lng: 1.0151907, source_data: { osm_id: 123 }, ...extra })
const response = (data) => new Response(JSON.stringify(data))
const commune = { nom: 'Les Eyzies', code: '24172', codesPostaux: ['24620'] }

describe('communes manquantes', () => {
  it('complète depuis les coordonnées exactes et conserve la preuve et les données OSM', async () => {
    const row = candidate()
    const fetchImpl = vi.fn(async () => response([commune]))
    expect(await completeLocations([row], { fetchImpl })).toEqual({ resolved: 1, missing: 0, errors: 0 })
    expect(row.city).toBe('Les Eyzies')
    expect(row.postal_code).toBe('24620')
    expect(row.source_data).toMatchObject({ osm_id: 123, location: { provider: 'geo.api.gouv.fr', code_insee: '24172', lat: row.lat, lng: row.lng } })
    const url = new URL(fetchImpl.mock.calls[0][0])
    expect(url.searchParams.get('lat')).toBe(String(row.lat))
    expect(url.searchParams.get('lon')).toBe(String(row.lng))
  })
  it('préserve les villes connues sans appel réseau, et les codes postaux existants', async () => {
    const known = candidate({ city: 'Commune vérifiée' })
    const missing = candidate({ postal_code: '24200' })
    const fetchImpl = vi.fn(async () => response([commune]))
    await completeLocations([known, missing], { fetchImpl })
    expect(known.city).toBe('Commune vérifiée')
    expect(missing.postal_code).toBe('24200')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
  it.each([[[]], [[commune, { ...commune, code: '24500' }]]])('ne devine pas la commune si le résultat est absent ou ambigu', async (data) => {
    const row = candidate()
    const stats = await completeLocations([row], { fetchImpl: async () => response(data) })
    expect(row.city).toBeNull()
    expect(stats.missing).toBe(1)
  })
  it('ne choisit pas un code postal parmi plusieurs et mutualise les coordonnées identiques', async () => {
    const rows = [candidate(), candidate()]
    const fetchImpl = vi.fn(async () => response([{ ...commune, codesPostaux: ['24620', '24200'] }]))
    await completeLocations(rows, { fetchImpl })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(rows.every(row => row.city === 'Les Eyzies' && row.postal_code === null)).toBe(true)
  })
  it.each([429, 503])('continue la découverte sur erreur HTTP %s', async (status) => {
    expect(await completeLocations([candidate()], { fetchImpl: async () => new Response('', { status }) })).toEqual({ resolved: 0, missing: 1, errors: 1 })
  })
  it('borne le temps total et ne fait pas échouer les prospects', async () => {
    const fetchImpl = vi.fn((_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('timeout')), { once: true })))
    const stats = await completeLocations(Array.from({ length: 10 }, () => candidate()), { fetchImpl, timeoutMs: 10 })
    expect(stats).toEqual({ resolved: 0, missing: 10, errors: 10 })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
  it('rejette coordonnées invalides et réponse malformée', async () => {
    const fetchImpl = vi.fn(async () => response({ nom: 'invalide' }))
    const stats = await completeLocations([candidate({ lat: null }), candidate()], { fetchImpl })
    expect(stats).toEqual({ resolved: 0, missing: 2, errors: 1 })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})

// Résolution unitaire : c'est ce que rejoue le job `locate` après un échec de la découverte.
describe('reprise d’un point isolé', () => {
  it('retourne la commune et la preuve pour un point valide', async () => {
    const found = await resolveLocation(44.9350426, 1.0151907, { fetchImpl: async () => response([commune]) })
    expect(found.city).toBe('Les Eyzies')
    expect(found.postal_code).toBe('24620')
    expect(found.evidence).toMatchObject({ provider: 'geo.api.gouv.fr', code_insee: '24172', lat: 44.9350426, lng: 1.0151907 })
  })
  it.each([[[]], [[commune, { ...commune, code: '24500' }]]])('retourne null sans commune franche, pour ne pas relancer indéfiniment', async (data) => {
    expect(await resolveLocation(44.9, 1.0, { fetchImpl: async () => response(data) })).toBeNull()
  })
  it('lève sur panne du service, pour que la file réessaie', async () => {
    await expect(resolveLocation(44.9, 1.0, { fetchImpl: async () => new Response('', { status: 503 }) }))
      .rejects.toThrow('LOCATION_SOURCE_ERROR')
  })
  it.each([[null, 1.0], [44.9, null], [200, 1.0]])('refuse des coordonnées inexploitables (%s, %s)', async (lat, lng) => {
    await expect(resolveLocation(lat, lng, { fetchImpl: async () => response([commune]) })).rejects.toThrow('NO_COORDINATES')
  })
})
