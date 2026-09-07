// Commune contenant le point OSM, jamais la ville la plus proche ni la ville de campagne.
// https://geo.api.gouv.fr/decoupage-administratif/communes#recherche-geographique

export const GEO_PROVIDER = 'geo.api.gouv.fr'

export function hasUsableCoordinates(lat, lng) {
  return Number.isFinite(lat) && Math.abs(lat) <= 90 && Number.isFinite(lng) && Math.abs(lng) <= 180
}

/** Résout un point unique. `null` = pas de commune franche (hors France, en mer, limite ambiguë).
 *  Toute panne du service lève, pour que l'appelant puisse réessayer plus tard. */
export async function resolveLocation(lat, lng, { fetchImpl = fetch, signal, timeoutMs = 10000 } = {}) {
  if (!hasUsableCoordinates(lat, lng)) throw new Error('NO_COORDINATES')
  const url = new URL('https://geo.api.gouv.fr/communes')
  url.search = new URLSearchParams({ lat: String(lat), lon: String(lng), fields: 'nom,code,codesPostaux', format: 'json' }).toString()
  const response = await fetchImpl(url.href, {
    headers: { accept: 'application/json' },
    signal: signal ?? AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) throw new Error('LOCATION_SOURCE_ERROR')
  const body = await response.text()
  if (body.length > 20000) throw new Error('LOCATION_RESPONSE_TOO_LARGE')
  const payload = JSON.parse(body)
  if (!Array.isArray(payload)) throw new Error('INVALID_LOCATION_RESPONSE')
  // Plusieurs communes ou aucun résultat : ne pas choisir arbitrairement.
  if (payload.length !== 1) return null
  const commune = payload[0]
  if (typeof commune?.nom !== 'string' || !commune.nom.trim() || commune.nom.length > 200 || !/^[0-9A-Z]{5}$/.test(commune.code)) throw new Error('INVALID_LOCATION_RESPONSE')
  const postcodes = Array.isArray(commune.codesPostaux) ? commune.codesPostaux.filter(code => typeof code === 'string' && /^\d{5}$/.test(code)) : []
  return {
    city: commune.nom.trim(),
    postal_code: postcodes.length === 1 ? postcodes[0] : null,
    evidence: { provider: GEO_PROVIDER, url: url.href, code_insee: commune.code, city: commune.nom.trim(), lat, lng, fetched_at: new Date().toISOString() },
  }
}

/** Chemin rapide de la découverte : complète en lot, sans jamais faire échouer la campagne.
 *  Ce qui reste manquant est repris ensuite par les jobs `locate`, qui eux réessaient. */
export async function completeLocations(candidates, { fetchImpl = fetch, timeoutMs = 12000 } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const cache = new Map()
  const stats = { resolved: 0, missing: 0, errors: 0 }
  let index = 0
  async function consume() {
    while (index < candidates.length) {
      const candidate = candidates[index++]
      if (candidate.city?.trim()) continue
      if (!hasUsableCoordinates(candidate.lat, candidate.lng)) { stats.missing++; continue }
      try {
        if (controller.signal.aborted) throw new Error('LOCATION_TIMEOUT')
        // Coordonnées exactes uniquement : un arrondi pourrait franchir une limite communale.
        const key = `${candidate.lat},${candidate.lng}`
        if (!cache.has(key)) cache.set(key, resolveLocation(candidate.lat, candidate.lng, { fetchImpl, signal: controller.signal }))
        const result = await cache.get(key)
        if (!result) { stats.missing++; continue }
        candidate.city = result.city
        if (!candidate.postal_code) candidate.postal_code = result.postal_code
        candidate.source_data = { ...candidate.source_data, location: result.evidence }
        stats.resolved++
      } catch { stats.missing++; stats.errors++ }
    }
  }
  try { await Promise.all(Array.from({ length: Math.min(4, candidates.length) }, () => consume())) }
  finally { clearTimeout(timer) }
  return stats
}
