import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useIsMobile } from '../../hooks/useIsMobile.js'

const IconCopy = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
)

const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
)

const IconRefresh = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23 4 23 10 17 10"/>
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
)

const IconImage = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>
)

function formatBytes(bytes) {
  if (!bytes) return '–'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function MediaCard({ file, onDelete, onCopy, copied, isActiveCover, mobile = false }) {
  const [imgError, setImgError] = useState(false)
  const [hovered, setHovered] = useState(false)

  const isCover = file.type === 'covers' || file.path.startsWith('covers/')
  const typeLabel = isCover ? 'Cover' : 'Galerie'
  const typeColor = isCover ? 'var(--amber)' : 'var(--blue)'
  const typeBg    = isCover ? 'var(--amber-dim)' : 'var(--blue-dim)'

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        background: 'var(--s2)',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Thumbnail */}
      <div style={{ position: 'relative', aspectRatio: '16/9', background: 'var(--s3)' }}>
        {!imgError ? (
          <img
            src={file.url}
            alt={file.name}
            onError={() => setImgError(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted2)' }}>
            <IconImage />
          </div>
        )}

        {/* Type badge */}
        <span style={{
          position: 'absolute', top: 6, left: 6,
          fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
          padding: '2px 6px', borderRadius: 20,
          background: typeBg, color: typeColor,
        }}>
          {typeLabel}
        </span>

        {/* Active cover star */}
        {isActiveCover && (
          <span title="Cover active d'un projet" style={{
            position: 'absolute', top: 6, right: 6,
            fontSize: 13, lineHeight: 1,
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))',
          }}>
            ⭐
          </span>
        )}

        {/* Hover overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: mobile ? 'linear-gradient(180deg, rgba(0,0,0,0.05), rgba(0,0,0,0.72))' : 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: mobile ? 'flex-end' : 'center', justifyContent: 'center', gap: 8,
          opacity: mobile || hovered ? 1 : 0,
          transition: 'opacity 0.15s',
          pointerEvents: mobile || hovered ? 'auto' : 'none',
          paddingBottom: mobile ? 10 : 0,
        }}>
          <button
            onClick={() => onCopy(file.url)}
            title="Copier l'URL"
            style={{
              width: 32, height: 32, borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.3)',
              background: copied === file.url ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)',
              color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {copied === file.url
              ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              : <IconCopy />}
          </button>
          <button
            onClick={() => onDelete && onDelete(file)}
            title="Supprimer"
            style={{
              width: 32, height: 32, borderRadius: 6,
              border: '1px solid rgba(191,24,24,0.5)',
              background: 'rgba(191,24,24,0.3)',
              color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <IconTrash />
          </button>
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: '8px 10px' }}>
        <div style={{ fontSize: 11, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 2 }}>
          {file.name}
        </div>
        <div style={{ fontSize: 10, color: 'var(--muted2)' }}>
          {formatBytes(file.size)}
        </div>
      </div>
    </div>
  )
}

export default function MediaLibrary() {
  const mobile = useIsMobile()
  const [files, setFiles]           = useState([])
  const [coverUrls, setCoverUrls]   = useState(new Set())
  const [usedUrls, setUsedUrls]     = useState(new Set())
  const [projectNames, setProjectNames] = useState({})
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [filter, setFilter]         = useState('all')
  const [search, setSearch]         = useState('')
  const [sortBy, setSortBy]         = useState('project')
  const [copied, setCopied]         = useState(null)
  const [deleting, setDeleting]     = useState(null)
  const [confirmFile, setConfirmFile] = useState(null)
  const [deleteError, setDeleteError] = useState(null)

  const loadFiles = useCallback(async () => {
    setLoading(true)
    setError(null)
    const collected = []
    const seen = new Set()

    const addFile = (path, name, size, projectId, type) => {
      if (seen.has(path)) return
      seen.add(path)
      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path)
      collected.push({ name, path, url: publicUrl, size, projectId, type })
    }

    // List bucket root
    const { data: rootItems, error: rootErr } = await supabase.storage.from('media').list('', { limit: 200 })
    if (rootErr) { setError(rootErr.message); setLoading(false); return }
    if (!rootItems) { setFiles([]); setLoading(false); return }

    for (const item of rootItems) {
      if (item.name === '.emptyFolderPlaceholder') continue

      if (item.name === 'covers' || item.name === 'gallery') {
        // Structure: {type}/{projectId}/{file}
        const type = item.name
        const { data: projectFolders } = await supabase.storage.from('media').list(type, { limit: 200 })
        if (!projectFolders) continue
        for (const pf of projectFolders) {
          if (pf.name === '.emptyFolderPlaceholder') continue
          if (!pf.id) {
            const { data: fileList } = await supabase.storage.from('media').list(`${type}/${pf.name}`, { limit: 200 })
            if (!fileList) continue
            for (const f of fileList) {
              if (!f.id || f.name === '.emptyFolderPlaceholder') continue
              addFile(`${type}/${pf.name}/${f.name}`, f.name, f.metadata?.size, pf.name, type)
            }
          } else {
            addFile(`${type}/${pf.name}`, pf.name, pf.metadata?.size, null, type)
          }
        }
      } else if (!item.id) {
        // Structure: {projectId}/{type}/{file}
        const projectId = item.name
        for (const type of ['covers', 'gallery']) {
          const { data: fileList } = await supabase.storage.from('media').list(`${projectId}/${type}`, { limit: 200 })
          if (!fileList) continue
          for (const f of fileList) {
            if (!f.id || f.name === '.emptyFolderPlaceholder') continue
            addFile(`${projectId}/${type}/${f.name}`, f.name, f.metadata?.size, projectId, type)
          }
        }
      }
    }

    // Fetch project info (covers + titles)
    const { data: projects } = await supabase.from('projects').select('id, title, cover, gallery')
    const covers = new Set((projects || []).map(p => p.cover).filter(Boolean))
    const used = new Set(
      (projects || []).flatMap(project => [project.cover, ...(project.gallery || [])]).filter(Boolean)
    )
    const names = Object.fromEntries((projects || []).map(p => [p.id, p.title]))
    setCoverUrls(covers)
    setUsedUrls(used)
    setProjectNames(names)

    setFiles(collected)
    setLoading(false)
  }, [])

  useEffect(() => { loadFiles() }, [loadFiles])

  const handleCopy = (url) => {
    navigator.clipboard.writeText(url)
    setCopied(url)
    setTimeout(() => setCopied(null), 1500)
  }

  const handleDelete = async () => {
    if (!confirmFile) return
    setDeleting(confirmFile.path)
    setDeleteError(null)
    const { error: delErr } = await supabase.storage.from('media').remove([confirmFile.path])
    if (delErr) {
      setDeleteError(delErr.message)
      setDeleting(null)
      return
    }
    setFiles(prev => prev.filter(f => f.path !== confirmFile.path))
    setDeleting(null)
    setConfirmFile(null)
  }

  const isActiveCover = (f) => coverUrls.has(f.url)
  const isUsed = (f) => usedUrls.has(f.url)
  const filtered = files
    .filter(file => {
      if (filter === 'covers') return isActiveCover(file)
      if (filter === 'gallery') return !isActiveCover(file)
      if (filter === 'unused') return !isUsed(file)
      return true
    })
    .filter(file => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      const projectLabel = projectNames[file.projectId] || file.projectId || ''
      return [file.name, file.path, projectLabel].some(value => value.toLowerCase().includes(q))
    })
    .sort((a, b) => {
      if (sortBy === 'size') return (b.size || 0) - (a.size || 0)
      if (sortBy === 'name') return a.name.localeCompare(b.name, 'fr')
      const aProject = projectNames[a.projectId] || a.projectId || ''
      const bProject = projectNames[b.projectId] || b.projectId || ''
      return aProject.localeCompare(bProject, 'fr')
    })

  const covers  = files.filter(isActiveCover).length
  const gallery = files.filter(f => !isActiveCover(f)).length
  const unused  = files.filter(f => !isUsed(f)).length
  const totalSize = files.reduce((acc, f) => acc + (f.size || 0), 0)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: mobile ? '14px 12px 12px' : '20px 24px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: mobile ? 'stretch' : 'center', justifyContent: 'space-between', marginBottom: 14, flexDirection: mobile ? 'column' : 'row', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>Médiathèque</span>
            <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 20, background: 'var(--s3)', color: 'var(--muted)' }}>
              {filtered.length}/{files.length} fichiers · {formatBytes(totalSize)}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: mobile ? '100%' : 'auto' }}>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              style={{
                height: mobile ? 38 : 30,
                padding: '0 10px',
                borderRadius: 6,
                border: '1px solid var(--border-md)',
                background: 'var(--s3)',
                color: 'var(--text)',
                fontSize: 12,
                fontFamily: 'var(--sans)',
                flex: mobile ? 1 : '0 0 auto',
              }}
            >
              <option value="project">Trier: projet</option>
              <option value="name">Trier: nom</option>
              <option value="size">Trier: taille</option>
            </select>
            <button
              onClick={loadFiles}
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 10px', borderRadius: 6,
                border: '1px solid var(--border-md)',
                background: 'transparent', color: 'var(--muted)',
                fontSize: 12, cursor: 'pointer', fontFamily: 'var(--sans)',
                flexShrink: 0,
              }}
            >
              <IconRefresh /> Actualiser
            </button>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {[
            { value: 'all',     label: `Tout (${files.length})` },
            { value: 'covers',  label: `⭐ Covers actives (${covers})` },
            { value: 'gallery', label: `Galerie (${gallery})` },
            { value: 'unused',  label: `Non utilisés (${unused})` },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              style={{
                fontSize: 11, padding: '3px 10px', borderRadius: 20,
                border: '1px solid var(--border-md)',
                background: filter === opt.value ? 'var(--s3)' : 'transparent',
                color: filter === opt.value ? 'var(--text)' : 'var(--muted)',
                cursor: 'pointer', fontFamily: 'var(--sans)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un fichier, un projet ou un chemin…"
          style={{
            width: '100%',
            height: 34,
            padding: '0 12px',
            borderRadius: 8,
            border: '1px solid var(--border-md)',
            background: 'var(--s3)',
            color: 'var(--text)',
            fontSize: 12,
            fontFamily: 'var(--sans)',
            outline: 'none',
          }}
        />
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: mobile ? 12 : 24 }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 12, color: 'var(--muted)' }}>
            <div style={{
              width: 20, height: 20,
              border: '2px solid var(--border-md)', borderTopColor: 'var(--red)',
              borderRadius: '50%', animation: 'spin 0.8s linear infinite',
            }} />
            <span style={{ fontSize: 13 }}>Chargement des assets…</span>
          </div>
        ) : error ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 8, color: 'var(--red)', fontSize: 13 }}>
            <span>Erreur de chargement</span>
            <span style={{ fontSize: 11, color: 'var(--muted)', maxWidth: 400, textAlign: 'center' }}>{error}</span>
            <button onClick={loadFiles} style={{ marginTop: 8, padding: '4px 12px', borderRadius: 6, border: '1px solid var(--border-md)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: 12, fontFamily: 'var(--sans)' }}>
              Réessayer
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 10, color: 'var(--muted2)' }}>
            <IconImage />
            <span style={{ fontSize: 13 }}>Aucun fichier</span>
          </div>
        ) : (() => {
          // Group by projectId
          const groups = {}
          for (const f of filtered) {
            const key = f.projectId || '__unknown__'
            if (!groups[key]) groups[key] = []
            groups[key].push(f)
          }
          const entries = Object.entries(groups)
          return entries.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 10, color: 'var(--muted2)' }}>
              <IconImage />
              <span style={{ fontSize: 13 }}>Aucun fichier</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
              {entries.map(([projectId, group]) => (
                <div key={projectId}>
                  {/* Section header */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    marginBottom: 12,
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                      {projectId === '__unknown__' ? 'Sans projet' : (projectNames[projectId] || projectId.slice(0, 8) + '…')}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--muted2)', padding: '1px 6px', borderRadius: 20, background: 'var(--s3)' }}>
                      {group.length} fichier{group.length > 1 ? 's' : ''}
                    </span>
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  </div>
                  {/* Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                    {group.map(file => (
                      <MediaCard
                        key={file.path}
                        file={file}
                        onCopy={handleCopy}
                        onDelete={f => setConfirmFile(f)}
                        copied={copied}
                        isActiveCover={coverUrls.has(file.url)}
                        mobile={mobile}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        })()}
      </div>

      {/* Confirm delete modal */}
      {confirmFile && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
          onClick={() => { if (!deleting) { setConfirmFile(null); setDeleteError(null) } }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--s2)', border: '1px solid var(--border-md)',
              borderRadius: 12, padding: '24px 28px', width: 360,
              boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Supprimer ce fichier ?</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4, wordBreak: 'break-all' }}>
              {confirmFile.name}
            </div>
            {deleteError && (
              <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 8 }}>{deleteError}</div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setConfirmFile(null); setDeleteError(null) }}
                disabled={!!deleting}
                style={{
                  padding: '6px 14px', borderRadius: 7, fontSize: 12,
                  border: '1px solid var(--border-md)', background: 'transparent',
                  color: 'var(--muted)', cursor: 'pointer', fontFamily: 'var(--sans)',
                }}
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={!!deleting}
                style={{
                  padding: '6px 14px', borderRadius: 7, fontSize: 12,
                  border: '1px solid rgba(191,24,24,0.4)', background: 'var(--red-dim)',
                  color: 'var(--red)', cursor: deleting ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--sans)', fontWeight: 600,
                  opacity: deleting ? 0.6 : 1,
                }}
              >
                {deleting ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
