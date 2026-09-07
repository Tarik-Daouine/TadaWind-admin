// Règles d'envoi Outlook, sans dépendance au réseau ni au navigateur : ce qui
// décide qu'un message peut partir, et comment un échec est raconté à l'humain.
//
// Le front ne connaît jamais les identifiants Microsoft. Il ne connaît que le
// verdict renvoyé par la sonde de l'Edge Function : configuré, ou pas.

const SEND_ERRORS = {
  SEND_OUTCOME_UNKNOWN: 'Issue de l’envoi inconnue. Ne renvoie pas ce message, même manuellement. Vérifie les éléments envoyés dans Outlook.',
  SEND_RECONCILIATION_REQUIRED: 'Envoi en cours ou à vérifier. Ne renvoie pas ce message. Vérifie les éléments envoyés dans Outlook avant de confirmer son envoi.',
  GRAPH_RATE_LIMITED: 'Microsoft a refusé l’envoi temporairement (limite de débit). Réessaie plus tard.',
  APPROVAL_REQUIRED: 'Ce message doit être approuvé avant de partir.',
  MESSAGE_CONFLICT: 'Le message a changé. Recharge la file avant d’envoyer.',
  GRAPH_NOT_CONFIGURED: 'L’envoi Outlook n’est pas encore configuré sur le serveur.',
  GRAPH_AUTH_FAILED: 'Microsoft a refusé les identifiants d’envoi. Vérifie la configuration serveur.',
  GRAPH_REJECTED: 'Microsoft a refusé ce message. Vérifie l’adresse du destinataire et le contenu.',
  GRAPH_UNAVAILABLE: 'Microsoft est momentanément indisponible. Réessaie dans quelques minutes.',
  SEND_CONTEXT_FAILED: 'Impossible de relire le message à envoyer. Recharge la file.',
  SEND_ALREADY_IN_PROGRESS: 'Un envoi est déjà en cours pour ce message.',
  MESSAGE_ALREADY_SENT: 'Ce message a déjà été envoyé.',
  MESSAGE_NOT_APPROVED: 'Ce message doit être approuvé avant de partir.',
  REVISION_MISMATCH: 'Le message a changé depuis l’affichage. Recharge la file avant d’envoyer.',
  NO_RECIPIENT_EMAIL: 'Ce prospect n’a pas d’adresse email exploitable.',
  CHANNEL_NOT_SENDABLE: 'Seul le canal email peut être envoyé depuis l’admin.',
}

export function prospectorSendError(code) {
  return SEND_ERRORS[code] ?? SEND_ERRORS.SEND_OUTCOME_UNKNOWN
}

/**
 * Décide si le bouton d'envoi est actionnable, et sinon pourquoi.
 * Tant que la sonde n'a pas répondu, l'envoi reste fermé : le défaut est
 * l'inaction, jamais un premier contact envoyé par optimisme.
 */
export function describeSendAvailability({ channel, sendConfig, recipient, approved, sendLockAt } = {}) {
  if (sendLockAt) return { sendable: false, reason: SEND_ERRORS.SEND_RECONCILIATION_REQUIRED }
  if (channel !== 'email') return { sendable: false, reason: 'Seul le canal email part depuis l’admin.' }
  if (!approved) return { sendable: false, reason: 'Approuve le message avant de l’envoyer.' }
  if (!sendConfig?.checked) return { sendable: false, reason: 'Vérification de la configuration d’envoi…' }
  if (sendConfig.configured !== true) {
    return {
      sendable: false,
      reason: 'Envoi automatique indisponible : Microsoft Graph n’est pas configuré côté serveur. Utilise « Copier » puis Outlook.',
    }
  }
  if (!recipient) return { sendable: false, reason: 'Aucune adresse email connue pour ce prospect.' }
  return { sendable: true, reason: '' }
}

/** Même ordre de priorité que `prospector_send_context` : ce que le bouton
 *  annonce est exactement l'adresse que le serveur utilisera. */
export function recipientEmail(prospect) {
  return [prospect?.contact_email, prospect?.email, prospect?.email_commercial]
    .map(value => (typeof value === 'string' ? value.trim() : ''))
    .find(Boolean) ?? null
}
