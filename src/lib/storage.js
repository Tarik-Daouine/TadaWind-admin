import { supabase } from './supabase.js'

function uniqueName(file) {
  const ext = file.name.split('.').pop().toLowerCase()
  return `${crypto.randomUUID()}.${ext}`
}

/**
 * Upload un fichier image dans le bucket `media`.
 * @param {File}   file       - Fichier sélectionné par l'utilisateur
 * @param {'covers'|'gallery'} type - Détermine le sous-dossier
 * @param {string} projectId  - UUID du projet (utilisé comme dossier)
 * @returns {Promise<{ url: string|null, error: string|null }>}
 */
export async function uploadMedia(file, type, projectId) {
  const path = `${type}/${projectId}/${uniqueName(file)}`

  const { error } = await supabase.storage
    .from('media')
    .upload(path, file, { upsert: false })

  if (error) return { url: null, error: error.message }

  const { data } = supabase.storage.from('media').getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}
