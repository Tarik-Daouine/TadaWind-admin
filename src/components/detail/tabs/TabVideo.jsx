import React, { useState } from 'react'
import Button from '../../ui/Button.jsx'
import Badge from '../../ui/Badge.jsx'

const IconUpload = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
    <polyline points="16 16 12 12 8 16"/>
    <line x1="12" y1="12" x2="12" y2="21"/>
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
  </svg>
)

const IconLink = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/>
    <line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
)

function formatDuration(seconds) {
  if (!seconds) return null
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ── Fetch métadonnées Streamable ──────────────────────────────────────────────
// Tente d'abord l'API principale (status + durée), puis oEmbed en fallback.
// Les deux sont des GET publics sans auth.
async function fetchStreamableMeta(id) {
  // 1. API principale → title, status, duration, thumbnail
  try {
    const res = await fetch(`https://api.streamable.com/videos/${id}`, {
      headers: { Accept: 'application/json' },
    })
    if (res.ok) {
      const d = await res.json()
      const mp4 = d.files?.mp4 || d.files?.['mp4-mobile'] || {}
      return {
        title:     d.title        || '',
        thumbnail: d.thumbnail_url|| '',
        duration:  mp4.duration   || null,
        width:     mp4.width      || null,
        height:    mp4.height     || null,
        status:    d.status,      // 2 = prête
        ready:     d.status === 2,
        source:    'api',
      }
    }
  } catch (_) { /* CORS ou réseau → fallback */ }

  // 2. oEmbed fallback → title + thumbnail uniquement
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
        ready:     true,           // si oEmbed répond, la vidéo existe
        source:    'oembed',
      }
    }
  } catch (_) { /* CORS complet → on se rabat sur l'iframe seule */ }

  // 3. Ni l'un ni l'autre → on retourne null (iframe sera quand même affichée)
  return null
}

// ─────────────────────────────────────────────────────────────────────────────

export default function TabVideo({ project, onChange, onToast }) {
  const [loading, setLoading]   = useState(false)
  const [localId, setLocalId]   = useState(project.streamableId || '')
  const [meta, setMeta]         = useState(null)   // métadonnées récupérées

  const handleVerify = async () => {
    const id = localId.trim()
    if (!id) return

    setLoading(true)
    setMeta(null)

    const result = await fetchStreamableMeta(id)

    setLoading(false)

    if (result === null) {
      // CORS total : on sauvegarde quand même l'iframe (elle chargera côté client)
      onChange({
        streamableId:     id,
        streamableUrl:    `https://streamable.com/${id}`,
        streamableStatus: 'iframe-only',
        streamableMeta: null,
      })
      onToast?.('Vidéo sauvegardée (aperçu iframe uniquement)', 'success')
      return
    }

    if (!result.ready && result.status !== null) {
      onChange({ streamableStatus: 'ko' })
      onToast?.('Vidéo introuvable ou non prête sur Streamable', 'error')
      return
    }

    setMeta(result)
    onChange({
      streamableId:     id,
      streamableUrl:    `https://streamable.com/${id}`,
      streamableStatus: 'ok',
      streamableMeta: {
        duration: result.duration,
        width:    result.width,
        height:   result.height,
        source:   result.source,
      },
    })
    onToast?.('Vidéo vérifiée avec succès', 'success')
  }

  const hasVideo = ['ok', 'iframe-only'].includes(project.streamableStatus) && project.streamableId
  const currentMeta = meta || (project.streamableMeta ? project.streamableMeta : null)
  const currentTitle = meta?.title || project.title || ''

  return (
    <div>
      {/* ── Input + Vérifier ─────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <label style={{
          display: 'block', fontSize: 11, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6, fontWeight: 500,
        }}>
          Identifiant Streamable
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={localId}
            onChange={e => setLocalId(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleVerify()}
            placeholder="ex: abc123"
            style={{
              flex: 1, height: 38, padding: '0 12px',
              background: 'var(--s3)', border: '1px solid var(--border-md)',
              borderRadius: 'var(--radius)', color: 'var(--text)',
              fontSize: 13, fontFamily: 'var(--sans)', outline: 'none',
            }}
            onFocus={e => { e.target.style.borderColor = 'var(--red)'; e.target.style.boxShadow = '0 0 0 3px var(--red-dim)' }}
            onBlur={e =>  { e.target.style.borderColor = 'var(--border-md)'; e.target.style.boxShadow = 'none' }}
          />
          <Button variant="ghost" size="sm" loading={loading} onClick={handleVerify}>
            Vérifier
          </Button>
        </div>
      </div>

      {/* ── Badge statut + métadonnées ───────────────────────────── */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {project.streamableStatus === 'ok' && (
          <Badge variant="custom" value="Vidéo liée ✓" bg="var(--green-dim)" color="var(--green)" />
        )}
        {project.streamableStatus === 'iframe-only' && (
          <Badge variant="custom" value="Vidéo liée (aperçu)" bg="var(--yellow-dim)" color="var(--yellow)" />
        )}
        {project.streamableStatus === 'ko' && (
          <Badge variant="custom" value="Vidéo introuvable" bg="var(--red-dim)" color="var(--red)" />
        )}
        {!project.streamableStatus && (
          <Badge variant="custom" value="Aucune vidéo" bg="var(--gray-dim)" color="var(--muted)" />
        )}

        {/* Lien externe */}
        {hasVideo && (
          <a href={project.streamableUrl} target="_blank" rel="noreferrer"
            style={{ fontSize: 12, color: 'var(--blue)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
            <IconLink /> streamable.com/{project.streamableId}
          </a>
        )}
      </div>

      {/* ── Métadonnées (titre, durée, résolution) ───────────────── */}
      {hasVideo && (currentTitle || currentMeta?.duration) && (
        <div style={{
          background: 'var(--s3)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '10px 14px',
          marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          {currentTitle && (
            <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
              {currentTitle}
            </span>
          )}
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--muted)' }}>
            {currentMeta?.duration && <span>⏱ {formatDuration(currentMeta.duration)}</span>}
            {currentMeta?.width && currentMeta?.height && (
              <span>📐 {currentMeta.width}×{currentMeta.height}</span>
            )}
            {currentMeta?.source === 'oembed' && (
              <span style={{ color: 'var(--muted2)' }}>métadonnées partielles</span>
            )}
          </div>
        </div>
      )}

      {/* ── Iframe / empty state ─────────────────────────────────── */}
      {hasVideo ? (
        <div style={{
          aspectRatio: '16 / 9',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-md)',
          overflow: 'hidden',
          marginBottom: 12,
          background: '#000',
        }}>
          <iframe
            src={`https://streamable.com/e/${project.streamableId}`}
            frameBorder="0"
            allowFullScreen
            allow="autoplay; fullscreen"
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
        </div>
      ) : (
        <div style={{
          aspectRatio: '16 / 9',
          border: '2px dashed var(--border-md)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          color: 'var(--muted2)', gap: 10, marginBottom: 12,
        }}>
          <IconUpload />
          <span style={{ fontSize: 13 }}>Aucune vidéo associée</span>
          <span style={{ fontSize: 11 }}>Renseignez l'identifiant Streamable ci-dessus</span>
        </div>
      )}

      {/* ── Instructions ─────────────────────────────────────────── */}
      <div style={{
        background: 'var(--s3)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', padding: '12px 14px',
        fontSize: 12, color: 'var(--muted)', lineHeight: 1.6,
      }}>
        <strong style={{ color: 'var(--text)', display: 'block', marginBottom: 4 }}>Workflow Streamable</strong>
        Uploadez la vidéo sur <span style={{ color: 'var(--blue)' }}>streamable.com</span>, récupérez
        l'identifiant depuis l'URL (ex: streamable.com/<strong>abc123</strong>), collez-le ci-dessus
        et cliquez sur "Vérifier".
      </div>
    </div>
  )
}
