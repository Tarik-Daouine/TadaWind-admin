import React, { useState } from 'react'
import Button from '../../ui/Button.jsx'
import Input from '../../ui/Input.jsx'
import Badge from '../../ui/Badge.jsx'

const IconPlay = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
    <circle cx="12" cy="12" r="10"/>
    <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"/>
  </svg>
)

const IconUpload = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
    <polyline points="16 16 12 12 8 16"/>
    <line x1="12" y1="12" x2="12" y2="21"/>
    <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
  </svg>
)

export default function TabVideo({ project, onChange, onToast }) {
  const [loading, setLoading] = useState(false)
  const [localId, setLocalId] = useState(project.streamableId || '')

  const handleVerify = async () => {
    setLoading(true)
    await new Promise(r => setTimeout(r, 1500))
    setLoading(false)
    const ok = Math.random() > 0.2
    if (ok) {
      onChange({
        streamableId: localId,
        streamableUrl: localId ? `https://streamable.com/${localId}` : '',
        streamableStatus: 'ok',
      })
      onToast && onToast('Vidéo vérifiée avec succès', 'success')
    } else {
      onChange({ streamableStatus: 'ko' })
      onToast && onToast('Vidéo introuvable sur Streamable', 'error')
    }
  }

  const hasVideo = project.streamableStatus === 'ok' && project.streamableId

  return (
    <div>
      {/* Input + Verify */}
      <div style={{ marginBottom: 24 }}>
        <label style={{
          display: 'block',
          fontSize: 11,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--muted)',
          marginBottom: 6,
          fontWeight: 500,
        }}>
          Identifiant Streamable
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={localId}
            onChange={e => setLocalId(e.target.value)}
            placeholder="ex: abc123"
            style={{
              flex: 1,
              height: 38,
              padding: '0 12px',
              background: 'var(--s3)',
              border: '1px solid var(--border-md)',
              borderRadius: 'var(--radius)',
              color: 'var(--text)',
              fontSize: 13,
              fontFamily: 'var(--sans)',
              outline: 'none',
            }}
            onFocus={e => { e.target.style.borderColor = 'var(--red)'; e.target.style.boxShadow = '0 0 0 3px var(--red-dim)' }}
            onBlur={e => { e.target.style.borderColor = 'var(--border-md)'; e.target.style.boxShadow = 'none' }}
          />
          <Button variant="ghost" size="sm" loading={loading} onClick={handleVerify}>
            Vérifier
          </Button>
        </div>
      </div>

      {/* Status badge */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
        {project.streamableStatus === 'ok' && project.streamableId ? (
          <>
            <Badge variant="custom" value="Vidéo liée ✓" bg="var(--green-dim)" color="var(--green)" />
            {project.streamableUrl && (
              <a
                href={project.streamableUrl}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 12, color: 'var(--blue)', textDecoration: 'underline' }}
              >
                {project.streamableUrl}
              </a>
            )}
          </>
        ) : project.streamableStatus === 'ko' ? (
          <Badge variant="custom" value="Vidéo introuvable" bg="var(--red-dim)" color="var(--red)" />
        ) : (
          <Badge variant="custom" value="Aucune vidéo" bg="var(--gray-dim)" color="var(--gray)" />
        )}
      </div>

      {/* Video preview area */}
      {hasVideo ? (
        <div>
          {/* Mock iframe placeholder */}
          <div style={{
            aspectRatio: '16 / 9',
            background: 'var(--s3)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--muted)',
            marginBottom: 12,
            overflow: 'hidden',
            position: 'relative',
          }}>
            {project.cover && (
              <img
                src={project.cover}
                alt="cover"
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  opacity: 0.3,
                }}
              />
            )}
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <IconPlay />
              <span style={{ fontSize: 12 }}>streamable.com/{project.streamableId}</span>
            </div>
          </div>
        </div>
      ) : (
        /* Empty state */
        <div style={{
          aspectRatio: '16 / 9',
          border: '2px dashed var(--border-md)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--muted2)',
          gap: 10,
          marginBottom: 12,
        }}>
          <IconUpload />
          <span style={{ fontSize: 13 }}>Aucune vidéo associée</span>
          <span style={{ fontSize: 11 }}>Renseignez l'identifiant Streamable ci-dessus</span>
        </div>
      )}

      {/* Instructions */}
      <div style={{
        background: 'var(--s3)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '12px 14px',
        fontSize: 12,
        color: 'var(--muted)',
        lineHeight: 1.6,
      }}>
        <strong style={{ color: 'var(--text)', display: 'block', marginBottom: 4 }}>Workflow Streamable</strong>
        Uploadez la vidéo sur <span style={{ color: 'var(--blue)' }}>streamable.com</span>, récupérez l'identifiant depuis l'URL
        (ex: streamable.com/<strong>abc123</strong>), collez-le ci-dessus, puis cliquez sur "Vérifier" pour valider le lien.
      </div>
    </div>
  )
}
