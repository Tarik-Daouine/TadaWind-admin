import { normalizeStreamableId } from './streamable.js'

// Source officielle d'import Streamable:
// le bookmarklet ouvre l'admin avec ?streamable_ids=id1,id2,...
// Aucun listing serveur / edge function n'est utilise par ce flux.

export const STREAMABLE_IDS_QUERY_PARAM = 'streamable_ids'

export function parseStreamableBookmarkletPayload(search) {
  const params = new URLSearchParams(search)
  const rawValue = params.get(STREAMABLE_IDS_QUERY_PARAM)
  if (rawValue == null) return null

  const receivedIds = []
  const invalidEntries = []
  const seen = new Set()

  for (const chunk of rawValue.split(',')) {
    const rawEntry = chunk.trim()
    if (!rawEntry) continue

    const streamableId = normalizeStreamableId(rawEntry)
    if (!streamableId) {
      invalidEntries.push(rawEntry)
      continue
    }

    if (seen.has(streamableId)) continue
    seen.add(streamableId)
    receivedIds.push(streamableId)
  }

  return { receivedIds, invalidEntries }
}

export function matchStreamableIdsToProjects(receivedIds, projects) {
  const projectByStreamableId = new Map()

  for (const project of projects) {
    const streamableId = normalizeStreamableId(project.streamableId)
    if (!streamableId || projectByStreamableId.has(streamableId)) continue
    projectByStreamableId.set(streamableId, project)
  }

  const alreadyImported = []
  const videosToImport = []

  for (const streamableId of receivedIds) {
    const project = projectByStreamableId.get(streamableId)
    if (project) alreadyImported.push({ streamableId, project })
    else videosToImport.push({ streamableId })
  }

  return { alreadyImported, videosToImport }
}

export function createStreamableImportSession({ search, projects }) {
  const payload = parseStreamableBookmarkletPayload(search)
  if (!payload) return null

  return {
    source: 'bookmarklet',
    ...payload,
    ...matchStreamableIdsToProjects(payload.receivedIds, projects),
  }
}

