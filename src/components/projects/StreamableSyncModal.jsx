import React, { useState } from 'react'
import Button from '../ui/Button.jsx'
import { fetchStreamableMeta } from '../../lib/streamable.js'

// ─────────────────────────────────────────────────────────────────────────────
// Modal de bilan Streamable
// Props :
//   results   — { ok, broken, newVideos, corsBlocked }
//   onClose   — ferme la modal
//   onImport  — (shortcode, meta) → crée un projet depuis une vidéo Streamable
//   onUnlink  — (projectId) → dissocie une vidéo d'un projet
// ─────────────────────────────────────────────────────────────────────────────

function Section({ title, count, color, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{
          fontSize: 12, fontWeight: 700, color,
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>{title}</span>
        <span style={{
          fontSize: 11, background: color + '22', color,
          padding: '1px 7px', borderRadius: 20, fontWeight: 700,
        }}>{count}</span>
      </div>
      {children}
    </div>
  )
}

export default function StreamableSyncModal({ results, onClose, onImport, onUnlink }) {
  const [importing, setImporting]   = useState({})   // shortcode → bool
  const [manualId, setManualId]     = useState('')
  const [manualLoading, setManualLoading] = useState(false)
  const [manualError, setManualError]     = useState('')

  const { ok = [], broken = [], newVideos = [], corsBlocked = false } = results

  const handleImport = async (shortcode, title) => {
    setImporting(p => ({ ...p, [shortcode]: true }))
    const meta = await fetchStreamableMeta(shortcode)
    await onImport(shortcode, meta?.title || title, meta)
    setImporting(p => ({ ...p, [shortcode]: false }))
  }

  const handleManualImport = async () => {
    const id = manualId.trim().replace(/^.*streamable\.com\//, '')
    if (!id) return
    setManualLoading(true)
    setManualError('')
    const meta = await fetchStreamableMeta(id)
    if (!meta) {
      setManualError('Vidéo introuvable ou inaccessible')
      setManualLoading(false)
      return
    }
    await onImport(id, meta.title || id, meta)
    setManualId('')
    setManualLoading(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--s1)', border: '1px solid var(--border-md)',
        borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 560,
        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              width: 22, height: 22, borderRadius: '50%', background: 'var(--blue-dim)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, color: 'var(--blue)',
            }}>▶</span>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Bilan Streamable</span>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--muted)', fontSize: 18, lineHeight: 1, padding: 4,
          }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 8px' }}>

          {/* OK */}
          {ok.length > 0 && (
            <Section title="Vérifiées OK" count={ok.length} color="var(--green)">
              <div style={{
                background: 'var(--s3)', borderRadius: 'var(--radius)',
                padding: '8px 12px', fontSize: 12, color: 'var(--muted)',
              }}>
                {ok.length} vidéo{ok.length > 1 ? 's' : ''} en ligne et à jour.
              </div>
            </Section>
          )}

          {/* Vidéos introuvables */}
          {broken.length > 0 && (
            <Section title="Introuvables" count={broken.length} color="var(--red)">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {broken.map(p => (
                  <div key={p.id} style={{
                    background: 'var(--red-dim)', border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: 'var(--radius)', padding: '8px 12px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{p.title || 'Sans titre'}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                        streamable.com/{p.streamableId}
                      </div>
                    </div>
                    <button
                      onClick={() => onUnlink(p.id)}
                      style={{
                        background: 'var(--red-dim)', border: '1px solid var(--red)',
                        borderRadius: 'var(--radius)', padding: '4px 10px',
                        fontSize: 11, color: 'var(--red)', cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Délier
                    </button>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Nouvelles vidéos à importer */}
          {newVideos.length > 0 && (
            <Section title="Non importées" count={newVideos.length} color="var(--blue)">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {newVideos.map(v => (
                  <div key={v.shortcode} style={{
                    background: 'var(--s3)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)', padding: '8px 12px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                        {v.title || v.shortcode}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                        streamable.com/{v.shortcode}
                      </div>
                    </div>
                    <button
                      onClick={() => handleImport(v.shortcode, v.title)}
                      disabled={importing[v.shortcode]}
                      style={{
                        background: 'var(--blue-dim)', border: '1px solid rgba(79,127,243,0.3)',
                        borderRadius: 'var(--radius)', padding: '4px 10px',
                        fontSize: 11, color: 'var(--blue)', cursor: 'pointer',
                        whiteSpace: 'nowrap', opacity: importing[v.shortcode] ? 0.6 : 1,
                      }}
                    >
                      {importing[v.shortcode] ? '…' : 'Importer'}
                    </button>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Import manuel — toujours affiché (Streamable n'a pas d'endpoint liste) */}
          {true && (
            <Section title="Importer une vidéo" count="" color="var(--blue)">
              <div style={{
                background: 'var(--s3)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', padding: '10px 12px', marginBottom: 12,
                fontSize: 12, color: 'var(--muted)', lineHeight: 1.5,
              }}>
                Colle l'ID ou l'URL d'une vidéo Streamable pour créer un nouveau projet.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={manualId}
                  onChange={e => setManualId(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleManualImport()}
                  placeholder="abc123 ou streamable.com/abc123"
                  style={{
                    flex: 1, height: 36, padding: '0 12px',
                    background: 'var(--s3)', border: '1px solid var(--border-md)',
                    borderRadius: 'var(--radius)', color: 'var(--text)',
                    fontSize: 13, fontFamily: 'var(--sans)', outline: 'none',
                  }}
                />
                <Button variant="ghost" size="sm" loading={manualLoading} onClick={handleManualImport}>
                  Importer
                </Button>
              </div>
              {manualError && (
                <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 6 }}>{manualError}</div>
              )}
            </Section>
          )}

          {/* Tout est OK */}
          {ok.length > 0 && broken.length === 0 && newVideos.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '16px 0',
              fontSize: 13, color: 'var(--muted)',
            }}>
              Toutes les vidéos sont à jour.
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px', borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'flex-end',
        }}>
          <Button variant="ghost" size="sm" onClick={onClose}>Fermer</Button>
        </div>
      </div>
    </div>
  )
}
