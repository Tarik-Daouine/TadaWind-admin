// Streamable: ce module ne gère que des actions unitaires autour d'une vidéo.
// L'import multi-vidéo repose exclusivement sur le bookmarklet + ?streamable_ids=...

const STREAMABLE_ID_PATTERN = /^[a-zA-Z0-9]{4,8}$/

export function normalizeStreamableId(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''

  const urlMatch = raw.match(/streamable\.com\/(?:e\/)?([a-zA-Z0-9]{4,8})(?:[/?#]|$)/i)
  const candidate = (urlMatch?.[1] || raw)
    .replace(/^\/+|\/+$/g, '')
    .split(/[?#]/)[0]

  return STREAMABLE_ID_PATTERN.test(candidate) ? candidate.toLowerCase() : ''
}

export function formatStreamableDuration(seconds) {
  if (!seconds) return null
  const minutes = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

// Vérifie une seule vidéo Streamable à partir d'un ID ou d'une URL.
// Tente d'abord l'API principale, puis oEmbed en fallback si nécessaire.
export async function fetchStreamableVideoMeta(value) {
  const streamableId = normalizeStreamableId(value)
  if (!streamableId) return null

  try {
    const res = await fetch(`https://api.streamable.com/videos/${streamableId}`, {
      headers: { Accept: 'application/json' },
    })

    if (res.ok) {
      const data = await res.json()
      const mp4 = data.files?.mp4 || data.files?.['mp4-mobile'] || {}

      return {
        title:     data.title         || '',
        thumbnail: data.thumbnail_url || '',
        duration:  mp4.duration       || null,
        width:     mp4.width          || null,
        height:    mp4.height         || null,
        status:    data.status,
        ready:     data.status === 2,
        source:    'api',
      }
    }
  } catch (_) { /* API bloquee → fallback */ }

  try {
    const url = encodeURIComponent(`https://streamable.com/${streamableId}`)
    const res = await fetch(`https://api.streamable.com/oembed.json?url=${url}`)

    if (res.ok) {
      const data = await res.json()
      return {
        title:     data.title         || '',
        thumbnail: data.thumbnail_url || '',
        duration:  null,
        width:     data.width         || null,
        height:    data.height        || null,
        status:    null,
        ready:     true,
        source:    'oembed',
      }
    }
  } catch (_) { /* oEmbed bloque */ }

  return null
}

// Alias de compatibilite: a supprimer si tout le code interne est renomme.
export const fetchStreamableMeta = fetchStreamableVideoMeta
export const formatDuration = formatStreamableDuration
