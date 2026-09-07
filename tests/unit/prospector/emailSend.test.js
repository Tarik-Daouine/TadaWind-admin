import { describe, expect, it } from 'vitest'
import { describeSendAvailability, prospectorSendError, recipientEmail } from '../../../src/lib/prospector/emailSend.js'

const READY = { checked: true, configured: true, missing: [], sender: 'Tada-Wind@outlook.com' }
const base = { channel: 'email', sendConfig: READY, recipient: 'contact@exemple.fr', approved: true }

describe('ouverture de l’envoi', () => {
  it('autorise un message email approuvé, serveur configuré, destinataire connu', () => {
    expect(describeSendAvailability(base)).toEqual({ sendable: true, reason: '' })
  })

  it.each([
    ['aucun argument', undefined],
    ['canal non email', { ...base, channel: 'instagram_dm' }],
    ['message non approuvé', { ...base, approved: false }],
    ['sonde en attente', { ...base, sendConfig: { checked: false, configured: false } }],
    ['sonde en attente affirmant être configurée', { ...base, sendConfig: { checked: false, configured: true } }],
    ['serveur non configuré', { ...base, sendConfig: { checked: true, configured: false, missing: ['MS_GRAPH_TENANT_ID'] } }],
    ['configuration inconnue', { ...base, sendConfig: undefined }],
    ['destinataire absent', { ...base, recipient: null } ],
    ['destinataire vide', { ...base, recipient: '' }],
  ])('refuse : %s', (_, input) => {
    const verdict = describeSendAvailability(input)
    expect(verdict.sendable).toBe(false)
    // Un refus muet laisserait l'utilisateur devant un bouton grisé sans cause.
    expect(verdict.reason.length).toBeGreaterThan(10)
  })

  it('ne présente jamais la liste des secrets manquants comme motif affiché', () => {
    const verdict = describeSendAvailability({ ...base, sendConfig: { checked: true, configured: false, missing: ['MS_GRAPH_CLIENT_SECRET'] } })
    expect(verdict.reason).not.toContain('MS_GRAPH')
  })
})

describe('destinataire retenu', () => {
  it('suit la priorité de prospector_send_context', () => {
    expect(recipientEmail({ contact_email: 'a@x.fr', email: 'b@x.fr', email_commercial: 'c@x.fr' })).toBe('a@x.fr')
    expect(recipientEmail({ email: 'b@x.fr', email_commercial: 'c@x.fr' })).toBe('b@x.fr')
    expect(recipientEmail({ email_commercial: 'c@x.fr' })).toBe('c@x.fr')
  })

  it('ignore les valeurs blanches et les types inattendus', () => {
    expect(recipientEmail({ contact_email: '   ', email: '\n', email_commercial: 'c@x.fr' })).toBe('c@x.fr')
    expect(recipientEmail({ contact_email: 42, email: null })).toBe(null)
    expect(recipientEmail(undefined)).toBe(null)
  })

  it('supprime les espaces autour de l’adresse', () => {
    expect(recipientEmail({ contact_email: '  a@x.fr ' })).toBe('a@x.fr')
  })
})

describe('échecs d’envoi expliqués', () => {
  it.each([
    ['GRAPH_NOT_CONFIGURED', 'configuré'],
    ['GRAPH_AUTH_FAILED', 'identifiants'],
    ['GRAPH_REJECTED', 'refusé'],
    ['GRAPH_UNAVAILABLE', 'Réessaie'],
    ['SEND_ALREADY_IN_PROGRESS', 'déjà en cours'],
    ['MESSAGE_ALREADY_SENT', 'déjà été envoyé'],
    ['REVISION_MISMATCH', 'Recharge'],
    ['NO_RECIPIENT_EMAIL', 'adresse email'],
  ])('traduit %s', (code, fragment) => {
    expect(prospectorSendError(code)).toContain(fragment)
  })

  it('reste compréhensible pour un code inconnu, sans le recracher tel quel', () => {
    const message = prospectorSendError('PGRST301: JWT expired')
    expect(message).toContain('Outlook')
    expect(message).not.toContain('PGRST301')
  })

  it('gère un code absent', () => {
    expect(prospectorSendError(undefined)).toContain('échoué')
  })
})
