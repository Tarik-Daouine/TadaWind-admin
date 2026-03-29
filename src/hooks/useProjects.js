import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

// ─────────────────────────────────────────────────────────────────────────────
// RÉFÉRENCE DES COLONNES RÉELLES EN DB
// ─────────────────────────────────────────────────────────────────────────────
// id           uuid       PK
// title        text
// status       text       'draft' | 'published' | 'archived'
// category     text
// order        int8
// location     text       → UI: lieu
// objectif     text       → UI: shortDesc
// livrables    text
// streamableid    text       → UI: streamableId
// streamableurl   text       → UI: streamableUrl
// streamabletitle text       → UI: streamableTitle  (titre récupéré via API)
// streamablemeta  jsonb      → UI: streamableMeta   ({ duration, width, height, source })
// cover        text
// gallery      text[]
// thumb        text       (fallback cover)
// url          text       (URL projet / page publique)
// published    bool       (legacy, remplacé par status)
// created_at   timestamptz
// updated_at   timestamptz
// ─────────────────────────────────────────────────────────────────────────────

// ── MAPPER Supabase → UI ──────────────────────────────────────────────────────
function mapProject(row) {
  return {
    // Champs directs
    id:        row.id,
    title:     row.title     ?? '',
    status:    row.status    ?? 'draft',
    category:  row.category  ?? '',
    order:     row.order     ?? 0,
    livrables: row.livrables ?? '',
    objectif:  row.objectif  ?? '',
    url:       row.url       ?? '',
    cover:     row.cover     ?? row.thumb ?? '',
    gallery:   row.gallery   ?? [],
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',

    // Mapping renommage DB → UI
    lieu:             row.location         ?? '',
    streamableId:     row.streamableid     ?? '',
    streamableUrl:    row.streamableurl    ?? '',
    streamableTitle:  row.streamabletitle  ?? '',
    streamableMeta:   row.streamablemeta   ?? null,

    // Champs dérivés (calculés, pas en DB)
    streamableStatus: row.streamableid ? 'ok' : 'missing',
    shortDesc:        row.objectif ?? '',
    date:             row.created_at ? row.created_at.split('T')[0] : '',

    // Champs UI-only (pas encore en DB — defaults vides)
    region:     '',
    tags:       [],
    longDesc:   '',
    featured:   false,
    notionId:   '',
    notionSync: false,
    seoTitle:   '',
    seoDesc:    '',
    slug:       '',
  }
}

// ── MAPPER UI → Supabase ──────────────────────────────────────────────────────
// Ne transmet QUE les colonnes qui existent réellement en base.
// Tout champ UI-only (slug, tags, seoTitle…) est silencieusement ignoré.
function mapToSupabase(data) {
  const out = {}

  // Colonnes directes (même nom UI et DB)
  const direct = ['title', 'status', 'category', 'order', 'cover', 'gallery', 'livrables', 'objectif', 'url']
  direct.forEach(key => {
    if (data[key] !== undefined) out[key] = data[key]
  })

  // Renommage UI → DB
  if (data.lieu !== undefined)          out.location      = data.lieu
  if (data.shortDesc !== undefined)     out.objectif      = data.shortDesc
  if (data.streamableId    !== undefined) out.streamableid    = data.streamableId
  if (data.streamableUrl   !== undefined) out.streamableurl   = data.streamableUrl
  if (data.streamableTitle !== undefined) out.streamabletitle = data.streamableTitle
  if (data.streamableMeta  !== undefined) out.streamablemeta  = data.streamableMeta

  // Timestamp de mise à jour systématique
  out.updated_at = new Date().toISOString()

  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────
export function useProjects() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  // ── Fetch initial ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    async function fetchProjects() {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('order', { ascending: true, nullsFirst: false })

      if (cancelled) return

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      setProjects((data ?? []).map(mapProject))
      setLoading(false)
    }

    fetchProjects()
    return () => { cancelled = true }
  }, [])

  // ── CREATE ─────────────────────────────────────────────────────────────────
  const createProject = async (initialData = {}) => {
    // Shift all existing projects order+1 so new project can take order=1
    if (projects.length > 0) {
      await Promise.all(
        projects.map(p =>
          supabase.from('projects').update({ order: (p.order ?? 0) + 1 }).eq('id', p.id)
        )
      )
    }

    const { data: inserted, error } = await supabase
      .from('projects')
      .insert({
        title:         initialData.title    || 'Nouveau projet',
        category:      initialData.category || 'Nature',
        status:        'draft',
        order:         1,
        // Champs texte optionnels → null (évite les conflits de contrainte UNIQUE sur '')
        location:      null,
        streamableid:  null,
        streamableurl: null,
        cover:         null,
        gallery:       [],
        livrables:     null,
        objectif:      null,
        url:           null,
      })
      .select()
      .single()

    if (error) {
      console.error('[createProject]', error.message)
      return null
    }

    const mapped = mapProject(inserted)
    setProjects(prev => [mapped, ...prev.map(p => ({ ...p, order: (p.order ?? 0) + 1 }))])
    return mapped
  }

  // ── UPDATE ─────────────────────────────────────────────────────────────────
  const updateProject = async (id, data) => {
    // Filet de sécurité : projet local non encore persisté
    if (String(id).startsWith('local_')) {
      setProjects(prev =>
        prev.map(p =>
          p.id === id ? { ...p, ...data, updatedAt: new Date().toISOString() } : p
        )
      )
      return { error: null }
    }

    const supabaseData = mapToSupabase(data)

    const { error } = await supabase
      .from('projects')
      .update(supabaseData)
      .eq('id', id)

    if (error) {
      console.error('[updateProject]', error.message)
      return { error: error.message }
    }

    setProjects(prev =>
      prev.map(p =>
        p.id === id
          ? { ...p, ...data, updatedAt: supabaseData.updated_at }
          : p
      )
    )
    return { error: null }
  }

  // ── DELETE ─────────────────────────────────────────────────────────────────
  const deleteProject = async (id) => {
    if (!String(id).startsWith('local_')) {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('[deleteProject]', error.message)
        return { error: error.message }
      }
    }

    setProjects(prev => prev.filter(p => p.id !== id))
    return { error: null }
  }

  // ── DUPLICATE ──────────────────────────────────────────────────────────────
  const duplicateProject = async (id) => {
    const src = projects.find(p => p.id === id)
    if (!src) return null

    // Shift all existing projects order+1 so duplicate can take order=1
    if (projects.length > 0) {
      await Promise.all(
        projects.map(p =>
          supabase.from('projects').update({ order: (p.order ?? 0) + 1 }).eq('id', p.id)
        )
      )
    }

    const { data: inserted, error } = await supabase
      .from('projects')
      .insert({
        title:         src.title + ' (copie)',
        category:      src.category                      || 'Nature',
        status:        'draft',
        order:         1,
        // null si vide pour éviter les conflits UNIQUE sur ''
        location:      src.lieu          || null,
        streamableid:  src.streamableId  || null,
        streamableurl: src.streamableUrl || null,
        cover:         src.cover         || null,
        gallery:       src.gallery       || [],
        livrables:     src.livrables     || null,
        objectif:      src.shortDesc     || src.objectif || null,
        url:           src.url           || null,
      })
      .select()
      .single()

    if (error) {
      console.error('[duplicateProject]', error.message)
      return null
    }

    const mapped = mapProject(inserted)
    setProjects(prev => [mapped, ...prev.map(p => ({ ...p, order: (p.order ?? 0) + 1 }))])
    return mapped
  }

  // ── REORDER ────────────────────────────────────────────────────────────────
  const reorderProjects = async (orderedItems) => {
    // orderedItems = [{id, order}, ...]
    // Mise à jour locale immédiate (optimiste)
    setProjects(prev => {
      const map = Object.fromEntries(orderedItems.map(x => [x.id, x.order]))
      return prev.map(p => map[p.id] !== undefined ? { ...p, order: map[p.id] } : p)
    })
    // Persistance en Supabase
    await Promise.all(
      orderedItems.map(({ id, order }) =>
        supabase.from('projects').update({ order }).eq('id', id)
      )
    )
  }

  return {
    projects,
    loading,
    error,
    createProject,
    updateProject,
    deleteProject,
    duplicateProject,
    reorderProjects,
  }
}
