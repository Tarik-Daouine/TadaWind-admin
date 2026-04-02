import React, { useState, useRef } from 'react'
import Button from '../../ui/Button.jsx'
import { SectionCard, SectionTitle } from '../../ui/SectionCard.jsx'
import { uploadMedia } from '../../../lib/storage.js'

const IconStar = ({ filled }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? '#f59e0b' : 'none'} stroke={filled ? '#f59e0b' : 'currentColor'} strokeWidth="1.5">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
)

const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
)

const IconImage = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>
)

export default function TabGallery({ project, onChange }) {
  const [showAdd, setShowAdd] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [uploading, setUploading] = useState(false)
  const dragIdx = useRef(null)
  const [draggingIdx, setDraggingIdx] = useState(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)
  const galleryInputRef = useRef(null)
  const coverInputRef = useRef(null)

  const gallery = project.gallery || []
  const cover = project.cover || ''
  const isPersistedProject = !!project.id && !String(project.id).startsWith('local_')

  const addImage = () => {
    const url = urlInput.trim()
    if (!url) return
    onChange({ gallery: [...gallery, url] })
    setUrlInput('')
    setShowAdd(false)
  }

  const removeImage = (idx) => {
    const newGallery = gallery.filter((_, i) => i !== idx)
    onChange({ gallery: newGallery })
  }

  const setCover = (url) => {
    onChange({ cover: url })
  }

  const handleFileUpload = async (e, type) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!isPersistedProject) {
      return
    }
    setUploading(true)
    const { url, error } = await uploadMedia(file, type, project.id)
    setUploading(false)
    e.target.value = ''
    if (error) {
      console.error('[upload]', error)
      return
    }
    if (type === 'covers') {
      onChange({ cover: url })
    } else {
      onChange({ gallery: [...gallery, url] })
    }
  }

  const handleDragStart = (idx) => {
    dragIdx.current = idx
    setDraggingIdx(idx)
  }

  const handleDragOver = (e, idx) => {
    e.preventDefault()
    setDragOverIdx(idx)
  }

  const handleDrop = (e, idx) => {
    e.preventDefault()
    if (dragIdx.current === null || dragIdx.current === idx) {
      setDragOverIdx(null)
      return
    }
    const newGallery = [...gallery]
    const [removed] = newGallery.splice(dragIdx.current, 1)
    newGallery.splice(idx, 0, removed)
    onChange({ gallery: newGallery })
    dragIdx.current = null
    setDragOverIdx(null)
  }

  const handleDragEnd = () => {
    dragIdx.current = null
    setDraggingIdx(null)
    setDragOverIdx(null)
  }

  return (
    <div>
      {/* ── Couverture ───────────────────────────────────────────── */}
      <SectionCard borderColor="var(--amber-dim)">
        <SectionTitle accent="var(--amber)" accentDim="var(--amber-dim)">Couverture</SectionTitle>
        {!isPersistedProject && (
          <div style={{
            marginBottom: 12,
            padding: '10px 12px',
            borderRadius: 'var(--radius)',
            background: 'var(--amber-dim)',
            border: '1px solid rgba(245,158,11,0.25)',
            fontSize: 12,
            color: 'var(--amber)',
            lineHeight: 1.5,
          }}>
            Sauvegarde d'abord le projet pour activer l'upload des images.
          </div>
        )}
        {cover ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src={cover} alt="cover" style={{ width: 48, height: 36, objectFit: 'cover', borderRadius: 4 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {cover}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              loading={uploading}
              disabled={uploading || !isPersistedProject}
              onClick={() => coverInputRef.current?.click()}
            >
              Changer
            </Button>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => handleFileUpload(e, 'covers')}
            />
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: 'var(--muted2)', flex: 1 }}>Aucune image de couverture</span>
            <Button
              variant="ghost"
              size="sm"
              loading={uploading}
              disabled={uploading || !isPersistedProject}
              onClick={() => coverInputRef.current?.click()}
            >
              Uploader
            </Button>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => handleFileUpload(e, 'covers')}
            />
          </div>
        )}
      </SectionCard>

      {/* ── Galerie ──────────────────────────────────────────────── */}
      <SectionCard borderColor="var(--blue-dim)">
        <SectionTitle accent="var(--blue)" accentDim="var(--blue-dim)">
          Galerie
          <span style={{
            fontSize: 11, fontWeight: 600,
            padding: '1px 7px', borderRadius: 20,
            background: 'var(--s3)', color: 'var(--muted)',
            marginLeft: 4,
          }}>
            {gallery.length}
          </span>
        </SectionTitle>

        {/* Boutons d'ajout */}
        <div style={{ display: 'flex', gap: 6, marginBottom: showAdd ? 12 : 0 }}>
          <Button variant="ghost" size="sm" onClick={() => setShowAdd(!showAdd)}>
            + URL
          </Button>
          <Button
            variant="ghost"
            size="sm"
            loading={uploading}
            disabled={uploading || !isPersistedProject}
            onClick={() => galleryInputRef.current?.click()}
          >
            + Fichier
          </Button>
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={e => handleFileUpload(e, 'gallery')}
          />
        </div>

        {/* Add image row (URL) */}
        {showAdd && (
          <div style={{
            display: 'flex',
            gap: 8,
            marginBottom: 12,
            animation: 'slideDown 0.15s ease both',
          }}>
            <input
              type="url"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addImage() }}
              placeholder="https://images.unsplash.com/…"
              autoFocus
              style={{
                flex: 1,
                height: 36,
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
            <Button variant="primary" size="sm" onClick={addImage}>Ajouter</Button>
            <Button variant="ghost" size="sm" onClick={() => { setShowAdd(false); setUrlInput('') }}>Annuler</Button>
          </div>
        )}

        {/* Image grid */}
        {gallery.length === 0 ? (
          <div
            onClick={() => isPersistedProject && galleryInputRef.current?.click()}
            style={{
              border: '2px dashed var(--border-md)',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 40,
              color: 'var(--muted2)',
              gap: 10,
              cursor: isPersistedProject ? 'pointer' : 'not-allowed',
              marginTop: 10,
              opacity: isPersistedProject ? 1 : 0.7,
            }}>
            <IconImage />
            <span style={{ fontSize: 13 }}>Aucune image</span>
            <span style={{ fontSize: 11 }}>
              {isPersistedProject
                ? 'Cliquez pour uploader ou utilisez les boutons ci-dessus'
                : 'Enregistre le projet avant de pouvoir uploader des images'}
            </span>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 10,
            marginTop: 10,
          }}>
            {gallery.map((url, idx) => {
              const isCover = url === cover
              const isDraggingOver = dragOverIdx === idx

              return (
                <div
                  key={url + idx}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={e => handleDragOver(e, idx)}
                  onDrop={e => handleDrop(e, idx)}
                  onDragEnd={handleDragEnd}
                  style={{
                    position: 'relative',
                    borderRadius: 'var(--radius)',
                    overflow: 'hidden',
                    border: isDraggingOver
                      ? '2px solid var(--blue)'
                      : isCover
                        ? '2px solid var(--amber)'
                        : '1px solid var(--border)',
                    cursor: 'grab',
                    opacity: draggingIdx === idx ? 0.4 : 1,
                    transition: 'border-color 0.15s, opacity 0.15s',
                  }}
                >
                  <div style={{ aspectRatio: '16 / 9' }}>
                    <img
                      src={url}
                      alt={`Gallery ${idx + 1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      draggable={false}
                    />
                  </div>

                  {isCover && (
                    <div style={{
                      position: 'absolute',
                      top: 5,
                      left: 5,
                      background: 'rgba(245,158,11,0.9)',
                      borderRadius: 4,
                      padding: '2px 6px',
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#000',
                      letterSpacing: '0.06em',
                    }}>
                      COVER
                    </div>
                  )}

                  <GalleryOverlay
                    onDelete={() => removeImage(idx)}
                    onSetCover={() => setCover(url)}
                    isCover={isCover}
                  />
                </div>
              )
            })}
          </div>
        )}
      </SectionCard>
    </div>
  )
}

function GalleryOverlay({ onDelete, onSetCover, isCover }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        opacity: hovered ? 1 : 0,
        transition: 'opacity 0.15s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        onClick={e => { e.stopPropagation(); onSetCover() }}
        title={isCover ? 'Image de couverture' : 'Définir comme couverture'}
        style={{
          width: 30,
          height: 30,
          borderRadius: 6,
          border: `1px solid ${isCover ? '#f59e0b' : 'rgba(255,255,255,0.3)'}`,
          background: isCover ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'white',
          transition: 'all 0.12s',
        }}
      >
        <IconStar filled={isCover} />
      </button>
      <button
        onClick={e => { e.stopPropagation(); onDelete() }}
        title="Supprimer"
        style={{
          width: 30,
          height: 30,
          borderRadius: 6,
          border: '1px solid rgba(191,24,24,0.5)',
          background: 'rgba(191,24,24,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'white',
          transition: 'all 0.12s',
        }}
      >
        <IconTrash />
      </button>
    </div>
  )
}
