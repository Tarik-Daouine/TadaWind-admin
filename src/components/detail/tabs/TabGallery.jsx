import React, { useState, useRef } from 'react'
import Button from '../../ui/Button.jsx'
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
    if (!project.id || String(project.id).startsWith('local_')) {
      console.warn('[upload] Sauvegardez le projet avant d\'uploader des fichiers.')
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

  // Drag-and-drop
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
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Galerie</span>
          <span style={{
            fontSize: 11,
            padding: '1px 7px',
            borderRadius: 20,
            background: 'var(--s3)',
            color: 'var(--muted)',
          }}>
            {gallery.length}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Button variant="ghost" size="sm" onClick={() => setShowAdd(!showAdd)}>
            + URL
          </Button>
          <Button
            variant="ghost"
            size="sm"
            loading={uploading}
            disabled={uploading}
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
      </div>

      {/* Cover indicator */}
      {cover && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 12px',
          background: 'var(--amber-dim)',
          border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: 'var(--radius)',
          marginBottom: 16,
        }}>
          <img src={cover} alt="cover" style={{ width: 40, height: 30, objectFit: 'cover', borderRadius: 4 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--amber)' }}>
              Image de couverture
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {cover}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            loading={uploading}
            disabled={uploading}
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
      )}

      {/* Add image row (URL) */}
      {showAdd && (
        <div style={{
          display: 'flex',
          gap: 8,
          marginBottom: 16,
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
          onClick={() => galleryInputRef.current?.click()}
          style={{
            border: '2px dashed var(--border-md)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 48,
            color: 'var(--muted2)',
            gap: 10,
            cursor: 'pointer',
          }}>
          <IconImage />
          <span style={{ fontSize: 13 }}>Aucune image</span>
          <span style={{ fontSize: 11 }}>Cliquez pour uploader ou utilisez les boutons ci-dessus</span>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
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

                {/* Cover badge */}
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

                {/* Hover overlay */}
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
