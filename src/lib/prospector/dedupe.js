/** Pure normalization shared by manual intake and discovery. No network or writes. */
const LEGAL_FORMS = /\b(?:sarl|sas|sasu|eurl|earl|scea|sci|sa|snc|selarl)\b/g
const text = value => typeof value === 'string' ? value.trim() : ''

export function normalizeText(value) {
  return text(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae').replace(/[^a-z0-9]+/g, ' ').trim() || null
}

export function normalizeName(value) {
  // Join dotted legal forms before removing punctuation: S.A.R.L. → SARL.
  const joined = text(value).replace(/\b(?:[a-z]\.){2,}(?:[a-z]\.?)?/gi, match => match.replace(/\./g, ''))
  return normalizeText(joined)?.replace(LEGAL_FORMS, '').replace(/\s+/g, ' ').trim() || null
}

export function normalizeDomain(value) {
  const raw = text(value)
  if (!raw) return null
  try {
    const url = new URL(raw.startsWith('//') ? `https:${raw}` : /^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : `https://${raw}`)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null
    const domain = url.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '')
    return domain.includes('.') && !/\s/.test(domain) ? domain : null
  } catch { return null }
}

export function normalizePhone(value) {
  let raw = text(value)
  if (!raw || /[^\d+\s().-]/.test(raw)) return null
  raw = raw.replace(/^(?:\+33|0033)\s*\(0\)/, '+33').replace(/[\s().-]/g, '')
  if (raw.startsWith('00')) raw = `+${raw.slice(2)}`
  if (/^0[1-9]\d{8}$/.test(raw)) raw = `+33${raw.slice(1)}`
  if (raw.startsWith('+33')) return /^\+33[1-9]\d{8}$/.test(raw) ? raw : null
  return /^\+[1-9]\d{7,14}$/.test(raw) ? raw : null
}

export function normalizeEmail(value) {
  const email = text(value).toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
}

export function normalizeProspect(prospect = {}) {
  return {
    normalized_name: normalizeName(prospect.name ?? prospect.normalized_name),
    city: normalizeText(prospect.city),
    website_domain: normalizeDomain(prospect.website_domain) ?? normalizeDomain(prospect.website),
    phone: normalizePhone(prospect.phone),
    email: normalizeEmail(prospect.email),
  }
}

export function buildDedupeHash(prospect = {}) {
  const p = normalizeProspect(prospect)
  if (p.website_domain) return `domain:${p.website_domain}`
  if (p.phone) return `phone:${p.phone}`
  return p.normalized_name && p.city ? `name_city:${JSON.stringify([p.normalized_name, p.city])}` : null
}

export function matchProspects(left, right) {
  if (!left || !right || left.deleted_at || right.deleted_at) return null
  const a = normalizeProspect(left), b = normalizeProspect(right)
  if (a.website_domain && a.website_domain === b.website_domain) return 'domain'
  if (a.phone && a.phone === b.phone) return 'phone'
  if (a.normalized_name && a.city && a.normalized_name === b.normalized_name && a.city === b.city) return 'name_city'
  return null
}

/** Return every match. Callers must resolve collisions instead of merging arbitrarily. */
export function findDuplicates(candidate, existing = []) {
  return existing.flatMap(prospect => {
    const matched_by = matchProspects(candidate, prospect)
    return matched_by ? [{ prospect, matched_by }] : []
  })
}
