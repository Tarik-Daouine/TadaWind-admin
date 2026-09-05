const CATEGORY_FILTERS = {
  hotels: ['tourism', 'hotel|guest_house|hostel|motel'],
  campsites: ['tourism', 'camp_site|caravan_site'],
  restaurants: ['amenity', 'restaurant|cafe|bar'],
  tourism: ['tourism', 'attraction|museum|viewpoint|information'],
  events: ['amenity', 'events_venue|conference_centre'],
  real_estate: ['office', 'estate_agent'],
  architecture: ['office', 'architect'],
  leisure: ['leisure', 'golf_course|marina|horse_riding|water_park|amusement_arcade'],
}

export const DISCOVERY_CATEGORIES = Object.freeze(Object.keys(CATEGORY_FILTERS))

export function buildOverpassQuery({ lat, lng, radiusKm, categories }) {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) throw new Error('INVALID_DISCOVERY_CENTER')
  if (!Number.isFinite(radiusKm) || radiusKm < 1 || radiusKm > 200) throw new Error('INVALID_DISCOVERY_RADIUS')
  const selected = [...new Set(categories ?? [])]
  if (!selected.length || selected.length > 8 || selected.some(value => !CATEGORY_FILTERS[value])) throw new Error('INVALID_DISCOVERY_CATEGORIES')
  const radius = Math.round(radiusKm * 1000)
  const selectors = selected.map(category => {
    const [key, values] = CATEGORY_FILTERS[category]
    return `nwr(around:${radius},${lat},${lng})["${key}"~"^(${values})$"]["name"];`
  }).join('')
  return `[out:json][timeout:25];(${selectors});out center tags 100;`
}

function first(tags, ...keys) {
  for (const key of keys) if (typeof tags?.[key] === 'string' && tags[key].trim()) return tags[key].trim()
  return null
}

function publicWebsite(value) {
  if (!value) return null
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null
  } catch { return null }
}

function categoryFor(tags) {
  for (const [category, [key, pattern]] of Object.entries(CATEGORY_FILTERS)) if (new RegExp(`^(${pattern})$`).test(tags?.[key] ?? '')) return category
  return 'other'
}

export function parseOverpassResponse(payload, { maxResults = 50 } = {}) {
  if (!payload || !Array.isArray(payload.elements)) throw new Error('INVALID_OVERPASS_RESPONSE')
  const candidates = []
  const seen = new Set()
  for (const element of payload.elements) {
    if (candidates.length >= maxResults) break
    const tags = element?.tags ?? {}, name = first(tags, 'name')
    const lat = element?.lat ?? element?.center?.lat, lng = element?.lon ?? element?.center?.lon
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng) || !['node', 'way', 'relation'].includes(element?.type) || !Number.isSafeInteger(element?.id)) continue
    const sourceUrl = `https://www.openstreetmap.org/${element.type}/${element.id}`
    if (seen.has(sourceUrl)) continue
    seen.add(sourceUrl)
    const city = first(tags, 'addr:city', 'addr:town', 'addr:village', 'addr:municipality')
    const street = [first(tags, 'addr:housenumber'), first(tags, 'addr:street')].filter(Boolean).join(' ') || null
    const category = categoryFor(tags), website = publicWebsite(first(tags, 'contact:website', 'website'))
    const observations = [name, tags.tourism, tags.amenity, tags.office, tags.leisure, street, city, website].filter(Boolean)
    candidates.push({
      name, category, address: street, city, postal_code: first(tags, 'addr:postcode'), lat, lng,
      phone: first(tags, 'contact:phone', 'phone'), email: first(tags, 'contact:email', 'email'), website,
      source_url: sourceUrl, source_excerpt: observations.join(' · ').slice(0, 12000),
      source_data: { osm_type: element.type, osm_id: element.id, tags },
    })
  }
  return candidates
}
