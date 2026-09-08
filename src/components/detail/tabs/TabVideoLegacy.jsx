import React, { useState } from 'react'
import Button from '../../ui/Button.jsx'
import Badge from '../../ui/Badge.jsx'
import { SectionCard, SectionTitle } from '../../ui/SectionCard.jsx'
import { fetchStreamableVideoMeta, formatStreamableDuration, normalizeStreamableId } from '../../../lib/streamable.js'

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

// ─────────────────────────────────────────────────────────────────────────────

export default function TabVideo({ project, projects = [], onChange, onToast }) {
  const [loading, setLoading]   = useState(false)
  const [localId, setLocalId]   = useState(project.streamableId || '')
  const [meta, setMeta]         = useState(null)
  const [dupWarning, setDupWarning] = useState(null)

  const handleVerify = async () => {
    const id = normalizeStreamableId(localId)
    if (!id) {
      onToast?.('Identifiant Streamable invalide', 'error')
      return
    }

    setLocalId(id)

    const duplicate = projects.find(p => p.id !== project.id && p.streamableId === id)
    if (duplicate) {
      setDupWarning(duplicate.title || duplicate.id)
    } else {
      setDupWarning(null)
    }

    setLoading(true)
    setMeta(null)

    const result = await fetchStreamableVideoMeta(id)

    setLoading(false)

    if (result === null) {
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
      {/* ── Identifiant ──────────────────────────────────────────── */}
      <SectionCard borderColor="var(--blue-dim)">
        <SectionTitle accent="var(--blue)" accentDim="var(--blue-dim)">Identifiant Streamable</SectionTitle>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={localId}
            onChange={e => setLocalId(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleVerify()}
            placeholder="ex: abc123 ou streamable.com/abc123"
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
      </SectionCard>

      {/* ── Aperçu ───────────────────────────────────────────────── */}
      <SectionCard borderColor="var(--amber-dim)">
        <SectionTitle accent="var(--amber)" accentDim="var(--amber-dim)">Aperçu</SectionTitle>

        {/* Avertissement doublon */}
        {dupWarning && (
          <div style={{
            background: 'var(--red-dim)', border: '1px solid var(--red)',
            borderRadius: 'var(--radius)', padding: '10px 14px',
            marginBottom: 12, fontSize: 12, color: 'var(--red)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span>⚠️</span>
            <span>
              Cet ID Streamable est déjà utilisé par le projet <strong>"{dupWarning}"</strong>.
              Vérifie que ce n'est pas une erreur.
            </span>
          </div>
        )}

        {/* Badge statut + lien */}
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
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
          {hasVideo && (
            <a href={project.streamableUrl} target="_blank" rel="noreferrer"
              style={{ fontSize: 12, color: 'var(--blue)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              <IconLink /> streamable.com/{project.streamableId}
            </a>
          )}
        </div>

        {/* Métadonnées */}
        {hasVideo && (currentTitle || currentMeta?.duration) && (
          <div style={{
            background: 'var(--s3)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '10px 14px',
            marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            {currentTitle && (
              <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
                {currentTitle}
              </span>
            )}
            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--muted)' }}>
              {currentMeta?.duration && <span>⏱ {formatStreamableDuration(currentMeta.duration)}</span>}
              {currentMeta?.width && currentMeta?.height && (
                <span>📐 {currentMeta.width}×{currentMeta.height}</span>
              )}
              {currentMeta?.source === 'oembed' && (
                <span style={{ color: 'var(--muted2)' }}>métadonnées partielles</span>
              )}
            </div>
          </div>
        )}

        {/* Iframe / empty state */}
        {hasVideo ? (
          <div style={{
            aspectRatio: '16 / 9',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-md)',
            overflow: 'hidden',
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
            color: 'var(--muted2)', gap: 10,
          }}>
            <IconUpload />
            <span style={{ fontSize: 13 }}>Aucune vidéo associée</span>
            <span style={{ fontSize: 11 }}>Renseignez l'identifiant Streamable ci-dessus</span>
          </div>
        )}
      </SectionCard>

      {/* ── Workflow ─────────────────────────────────────────────── */}
      <SectionCard>
        <SectionTitle>Workflow Streamable</SectionTitle>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
          Ce champ sert à lier ou corriger la vidéo d'un projet existant.
          <br />
          Pour importer de nouveaux projets depuis Streamable, utilise le bookmarklet disponible
          dans les réglages: c'est le seul flux d'import officiel.
        </div>
      </SectionCard>
    </div>
  )
}
