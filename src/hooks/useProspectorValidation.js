import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { prospectorSendError } from '../lib/prospector/emailSend.js'

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
  if (message.includes('SEND_RECONCILIATION_REQUIRED')) return prospectorSendError('SEND_RECONCILIATION_REQUIRED')
  if (message.includes('MESSAGE_CONFLICT')) return 'Ce message a changé, a été modifié ou approuvé. La génération ne peut pas l’écraser.'
  if (message.includes('NO_AVAILABLE_CHANNEL')) return 'Ce canal est désactivé ou ses coordonnées sont manquantes.'
  if (message.includes('PROSPECT_JOB_ACTIVE')) return 'Un autre traitement est déjà en cours pour ce prospect.'
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

    regenerate: (prospect, channel) =>
      call('prospector_request_channel', { p_id: prospect.id, p_channel: channel ?? null }, () => {
        window.dispatchEvent(new CustomEvent('prospector:job-created'))
      }),

    confirmSent: (message, reference) =>
      call('prospector_confirm_message_sent', { p_id: message.id, p_expected_revision: message.revision, p_reference: reference || null },
        () => dropProspect(message.prospect_id)),

    // Envoi réel via Microsoft Graph, déclenché par un clic sur un message déjà
    // approuvé. La réservation côté base empêche le double envoi.
    sendEmail: async (message) => {
      // Fermer immédiatement le bouton, même si la réponse réseau ou le rechargement échoue.
      applyMessage({ ...message, send_lock_at: message.send_lock_at || new Date().toISOString() })
      let result
      try { result = await supabase.functions.invoke('prospector-send-email', {
        body: { message_id: message.id, revision: message.revision },
      }) } catch { return { error: prospectorSendError('SEND_OUTCOME_UNKNOWN') } }
      let { data, error } = result
      // Supabase range le JSON des réponses non-2xx dans FunctionsHttpError.context.
      if (!data && error?.context?.json) {
        try { data = await error.context.json() } catch { /* Issue inconnue. */ }
      }
      if (data?.error) {
        await reload()
        return { error: prospectorSendError(data.error) }
      }
      if (error || (!data?.sent && !data?.accepted)) return { error: prospectorSendError('SEND_OUTCOME_UNKNOWN') }
      if (data?.warning === 'CONFIRM_FAILED') {
        return { error: 'Microsoft a accepté le message, mais le suivi manque. Ne renvoie pas ce message. Vérifie Outlook puis utilise « Je l’ai envoyé ».' }
      }
      dropProspect(message.prospect_id)
      return { data, error: null }
    },

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

/** Sonde serveur : le bouton d'envoi reste désactivé tant que Microsoft Graph
 *  n'est pas configuré. Le front n'apprend jamais les identifiants eux-mêmes. */
export function useGraphSendConfig() {
  const [state, setState] = useState({ checked: false, configured: false, missing: [], sender: null })
  useEffect(() => {
    let live = true
    supabase.functions.invoke('prospector-send-email', { body: { probe: true } })
      .then(({ data }) => { if (live) setState({ checked: true, configured: Boolean(data?.configured), missing: data?.missing ?? [], sender: data?.sender ?? null }) })
      .catch(() => { if (live) setState({ checked: true, configured: false, missing: [], sender: null }) })
    return () => { live = false }
  }, [])
  return state
}
