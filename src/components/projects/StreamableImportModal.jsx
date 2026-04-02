import React, { useState } from 'react'
import Button from '../ui/Button.jsx'
import { fetchStreamableVideoMeta } from '../../lib/streamable.js'

function Section({ title, count, color, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{
          fontSize: 12,
          fontWeight: 700,
          color,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}>
          {title}
        </span>
        {count !== undefined && count !== null && count !== '' && (
          <span style={{
            fontSize: 11,
            background: color + '22',
            color,
            padding: '1px 7px',
            borderRadius: 20,
            fontWeight: 700,
          }}>
            {count}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

function VideoRow({ title, subtitle, action }) {
  return (
    <div style={{
      background: 'var(--s3)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: '8px 12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{subtitle}</div>
      </div>
      {action}
    </div>
  )
}

export default function StreamableImportModal({ session, onClose, onImport, onOpenProject }) {
  const [importing, setImporting] = useState({})
  const [importAllLoading, setImportAllLoading] = useState(false)

  const {
    receivedIds = [],
    invalidEntries = [],
    alreadyImported = [],
    videosToImport = [],
  } = session || {}

  const hasBookmarkletPayload = receivedIds.length > 0 || invalidEntries.length > 0

  const handleImport = async (streamableId) => {
    setImporting(prev => ({ ...prev, [streamableId]: true }))
    const meta = await fetchStreamableVideoMeta(streamableId)
    await onImport(streamableId, meta?.title || streamableId, meta)
    setImporting(prev => ({ ...prev, [streamableId]: false }))
  }

  const handleImportAll = async () => {
    setImportAllLoading(true)
    for (const video of videosToImport) {
      // sequential import keeps the UI/session state easy to follow
      // and avoids hammering Streamable with parallel metadata fetches.
      // eslint-disable-next-line no-await-in-loop
      await handleImport(video.streamableId)
    }
    setImportAllLoading(false)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: 'var(--s1)',
        border: '1px solid var(--border-md)',
        borderRadius: 'var(--radius-lg)',
        width: '100%',
        maxWidth: 560,
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>
        <div style={{
          padding: '18px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: 'var(--blue-dim)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              color: 'var(--blue)',
            }}>
              ▶
            </span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Import Streamable</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                Source unique: bookmarklet Streamable → `?streamable_ids=...`
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--muted)',
              fontSize: 18,
              lineHeight: 1,
              padding: 4,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 8px' }}>
          <div style={{
            background: 'var(--s3)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '10px 12px',
            marginBottom: 18,
            fontSize: 12,
            color: 'var(--muted)',
            lineHeight: 1.6,
          }}>
            L'admin ne liste plus les vidéos Streamable via une API serveur. Cette modale affiche
            uniquement les IDs recus depuis le bookmarklet, puis les compare aux projets existants.
          </div>

          {!hasBookmarkletPayload && (
            <Section title="Utiliser le bookmarklet" color="var(--blue)">
              <div style={{
                background: 'var(--s3)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '12px 14px',
                fontSize: 12,
                color: 'var(--muted)',
                lineHeight: 1.6,
              }}>
                Aucune video n'a ete recue dans l'URL.
                <br />
                1. Ouvre <strong style={{ color: 'var(--text)' }}>streamable.com/my-videos</strong>
                <br />
                2. Lance le bookmarklet depuis la barre de favoris
                <br />
                3. L'admin se rouvrira avec les IDs a importer
              </div>
            </Section>
          )}

          {videosToImport.length > 0 && (
            <Section title="A importer" count={videosToImport.length} color="var(--blue)">
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                <Button variant="ghost" size="sm" loading={importAllLoading} onClick={handleImportAll}>
                  Importer tout
                </Button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {videosToImport.map(video => (
                  <VideoRow
                    key={video.streamableId}
                    title={video.streamableId}
                    subtitle={`streamable.com/${video.streamableId}`}
                    action={
                      <button
                        onClick={() => handleImport(video.streamableId)}
                        disabled={importing[video.streamableId]}
                        style={{
                          background: 'var(--blue-dim)',
                          border: '1px solid rgba(79,127,243,0.3)',
                          borderRadius: 'var(--radius)',
                          padding: '4px 10px',
                          fontSize: 11,
                          color: 'var(--blue)',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          opacity: importing[video.streamableId] ? 0.6 : 1,
                        }}
                      >
                        {importing[video.streamableId] ? '…' : 'Importer'}
                      </button>
                    }
                  />
                ))}
              </div>
            </Section>
          )}

          {alreadyImported.length > 0 && (
            <Section title="Deja importees" count={alreadyImported.length} color="var(--green)">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {alreadyImported.map(entry => (
                  <VideoRow
                    key={entry.streamableId}
                    title={entry.project?.title || entry.streamableId}
                    subtitle={`streamable.com/${entry.streamableId}`}
                    action={entry.project ? (
                      <button
                        onClick={() => onOpenProject?.(entry.project.id)}
                        style={{
                          background: 'var(--green-dim)',
                          border: '1px solid rgba(34,197,94,0.25)',
                          borderRadius: 'var(--radius)',
                          padding: '4px 10px',
                          fontSize: 11,
                          color: 'var(--green)',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Ouvrir
                      </button>
                    ) : null}
                  />
                ))}
              </div>
            </Section>
          )}

          {invalidEntries.length > 0 && (
            <Section title="Ignorees" count={invalidEntries.length} color="var(--amber)">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {invalidEntries.map(entry => (
                  <VideoRow
                    key={entry}
                    title={entry}
                    subtitle="Entree invalide ignoree pendant la normalisation"
                  />
                ))}
              </div>
            </Section>
          )}

          {hasBookmarkletPayload && videosToImport.length === 0 && invalidEntries.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '16px 0',
              fontSize: 13,
              color: 'var(--muted)',
            }}>
              Tous les IDs recus via le bookmarklet sont deja associes a des projets.
            </div>
          )}
        </div>

        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          gap: 8,
        }}>
          <span style={{ fontSize: 11, color: 'var(--muted2)' }}>
            {videosToImport.length > 0 ? 'Tu peux fermer maintenant et reprendre plus tard.' : 'Import termine.'}
          </span>
          <Button variant="ghost" size="sm" onClick={onClose}>
            {videosToImport.length > 0 ? 'Fermer et reprendre plus tard' : 'Fermer'}
          </Button>
        </div>
      </div>
    </div>
  )
}
