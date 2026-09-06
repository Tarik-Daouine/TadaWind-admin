import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'

// File « À valider » : prospects dont un brouillon de premier contact attend une décision.
// Toutes les écritures passent par les RPC vérifiées ; aucun envoi n'est déclenché ici.

const REVIEWABLE = ['draft', 'edited', 'approved']
const SNOOZE_DAYS = 7

export const REJECTION_REASONS = [
  ['pas_interessant', 'Pas intéressant'],
  ['trop_loin', 'Trop loin'],
  ['mauvaise_categorie', 'Mauvaise catégorie'],
  ['trop_petit', 'Trop petit'],
  ['deja_equipe', 'Déjà équipé'],
  ['pas_assez_premium', 'Pas assez premium'],
  ['mauvais_contact', 'Mauvais contact'],
  ['autre', 'Autre'],
]

export function prospectorReviewError(error) {
  const message = error?.message ?? ''
  if (message.includes('MESSAGE_CONFLICT')) return 'Ce message a changé depuis son affichage. Recharge la file avant de recommencer.'
  if (message.includes('MESSAGE_VALIDATION_REQUIRED')) return 'La traçabilité de ce message doit être revalidée. Enregistre une modification puis réessaie.'
  if (message.includes('INVALID_MESSAGE_EVIDENCE')) return 'Une citation ne correspond plus à sa source. Retire-la avant d’approuver.'
  if (message.includes('MESSAGE_BODY_REQUIRED')) return 'Le message ne peut pas être vide.'
  if (message.includes('PROSPECT_NOT_CONTACTABLE')) return 'Ce prospect ne peut plus être contacté (exclu, client ou sur liste d’opposition).'
  if (message.includes('APPROVAL_REQUIRED')) return 'Approuve le message avant de le marquer comme envoyé.'
  if (message.includes('REJECTION_REASON_REQUIRED') || message.includes('BLACKLIST_REASON_REQUIRED')) return 'Choisis un motif.'
  if (message.includes('STRATEGY_MISSING')) return 'Il faut d’abord une analyse et des angles commerciaux pour régénérer.'
  if (message.includes('PROSPECT_NOT_ANALYZABLE')) return 'Ce prospect est sorti du périmètre de prospection.'
  if (message.includes('QUEUE_CAPACITY_REACHED')) return 'La file de traitement est pleine. Réessaie dans quelques minutes.'
  if (message.includes('PROSPECT_CONFLICT')) return 'Cette fiche a été modifiée ailleurs. Recharge la file.'
  if (error?.code === '42501' || message.includes('USER_ACTION_REQUIRED')) return 'Ta session ne permet pas cette action. Reconnecte-toi à l’admin.'
  if (['42P01', 'PGRST202', 'PGRST205'].includes(error?.code)) return 'La prospection n’est pas encore disponible sur cet environnement.'
  return 'Action impossible pour le moment. Vérifie ta connexion et réessaie.'
}

export function useProspectorValidation() {
  const [prospects, setProspects] = useState([])
  const [messages, setMessages] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const generation = useRef(0)

  const reload = useCallback(async () => {
    const current = ++generation.current
    setLoading(true)
    setError(null)
    const now = new Date().toISOString()
    const queue = await supabase.from('prospects').select('*')
      .eq('status', 'to_validate').is('deleted_at', null)
      .or(`next_action_at.is.null,next_action_at.lte.${now}`)
      .order('score', { ascending: false, nullsFirst: false })
      .order('discovered_at', { ascending: true })
      .limit(50)
    if (current !== generation.current) return
    if (queue.error) {
      setError(prospectorReviewError(queue.error)); setProspects([]); setMessages({}); setLoading(false); return
    }
    const rows = queue.data ?? []
    let byProspect = {}
    if (rows.length) {
      const drafts = await supabase.from('prospect_messages').select('*')
        .in('prospect_id', rows.map(row => row.id))
        .eq('kind', 'first_touch').in('status', REVIEWABLE)
        .order('created_at', { ascending: true })
      if (current !== generation.current) return
      if (drafts.error) { setError(prospectorReviewError(drafts.error)) }
      for (const message of drafts.data ?? []) {
        byProspect[message.prospect_id] = [...(byProspect[message.prospect_id] ?? []), message]
      }
    }
    setProspects(rows)
    setMessages(byProspect)
    setLoading(false)
  }, [])

  useEffect(() => { reload(); return () => { generation.current++ } }, [reload])

  // Remplace un message en place ; retire le prospect quand il quitte la file.
  const applyMessage = (updated) => setMessages(previous => ({
    ...previous,
    [updated.prospect_id]: (previous[updated.prospect_id] ?? []).map(item => item.id === updated.id ? updated : item),
  }))
  const dropProspect = (id) => {
    setProspects(previous => previous.filter(item => item.id !== id))
    setMessages(previous => { const next = { ...previous }; delete next[id]; return next })
  }

  const call = async (name, args, onSuccess) => {
    const result = await supabase.rpc(name, args)
    if (result.error) return { error: prospectorReviewError(result.error) }
    onSuccess?.(result.data)
    return { data: result.data, error: null }
  }

  return {
    prospects, messages, loading, error, reload,

    approve: (message) =>
      call('prospector_review_message', { p_id: message.id, p_action: 'approve', p_expected_revision: message.revision }, applyMessage),

    saveEdit: (message, patch) =>
      call('prospector_review_message', { p_id: message.id, p_action: 'edit', p_expected_revision: message.revision, p_patch: patch }, applyMessage),

    reject: (prospect, reason) =>
      call('prospector_reject_prospect', { p_id: prospect.id, p_reason: reason }, () => dropProspect(prospect.id)),

    blacklist: (prospect, reason) =>
      call('prospector_blacklist_prospect', { p_id: prospect.id, p_reason: reason }, () => dropProspect(prospect.id)),

    regenerate: (prospect) =>
      call('prospector_request_regeneration', { p_id: prospect.id }, () => {
        window.dispatchEvent(new CustomEvent('prospector:job-created'))
      }),

    confirmSent: (message, reference) =>
      call('prospector_confirm_message_sent', { p_id: message.id, p_expected_revision: message.revision, p_reference: reference || null },
        () => dropProspect(message.prospect_id)),

    // « Plus tard » : trace la décision puis repousse la fiche hors de la file du jour.
    snooze: async (prospect, message) => {
      if (message) {
        const reviewed = await supabase.rpc('prospector_review_message', { p_id: message.id, p_action: 'later', p_expected_revision: message.revision })
        if (reviewed.error) return { error: prospectorReviewError(reviewed.error) }
      }
      const until = new Date(Date.now() + SNOOZE_DAYS * 86400000).toISOString()
      const moved = await supabase.rpc('prospector_update_prospect', {
        p_id: prospect.id, p_expected_updated_at: prospect.updated_at, p_patch: { next_action_at: until },
      })
      if (moved.error) return { error: prospectorReviewError(moved.error) }
      dropProspect(prospect.id)
      return { error: null }
    },
  }
}
