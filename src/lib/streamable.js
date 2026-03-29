// ─────────────────────────────────────────────────────────────────────────────
// Helpers Streamable — utilisés par TabVideo et le bulk sync (Topbar)
// ─────────────────────────────────────────────────────────────────────────────

export function formatDuration(seconds) {
  if (!seconds) return null
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// Fetch métadonnées d'une vidéo Streamable par son shortcode.
// Tente d'abord l'API principale (status + durée + résolution),
// puis oEmbed en fallback si CORS bloque.
// Retourne null si les deux échouent.
export async function fetchStreamableMeta(id) {
  // 1. API principale
  try {
    const res = await fetch(`https://api.streamable.com/videos/${id}`, {
      headers: { Accept: 'application/json' },
    })
    if (res.ok) {
      const d = await res.json()
      const mp4 = d.files?.mp4 || d.files?.['mp4-mobile'] || {}
      return {
        title:     d.title         || '',
        thumbnail: d.thumbnail_url || '',
        duration:  mp4.duration    || null,
        width:     mp4.width       || null,
        height:    mp4.height      || null,
        status:    d.status,
        ready:     d.status === 2,
        source:    'api',
      }
    }
  } catch (_) { /* CORS → fallback */ }

  // 2. oEmbed fallback
  try {
    const url = encodeURIComponent(`https://streamable.com/${id}`)
    const res = await fetch(`https://api.streamable.com/oembed.json?url=${url}`)
    if (res.ok) {
      const d = await res.json()
      return {
        title:     d.title         || '',
        thumbnail: d.thumbnail_url || '',
        duration:  null,
        width:     d.width         || null,
        height:    d.height        || null,
        status:    null,
        ready:     true,
        source:    'oembed',
      }
    }
  } catch (_) { /* CORS total */ }

  return null
}
