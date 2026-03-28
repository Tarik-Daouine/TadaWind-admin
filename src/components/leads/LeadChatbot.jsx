import React, { useState, useEffect, useRef } from 'react'
import { parseTranscription } from '../../lib/parseTranscription.js'

// ── Constantes UI ──────────────────────────────────────────────────────────────

const STATUT_OPTIONS    = ['nouveau', 'Prospect contacté', 'Opportunité', 'Relancé', 'Converti', 'Perdu']
const PRIORITE_OPTIONS  = ['Haute', 'Normale', 'Basse']
const INTERET_OPTIONS   = ['', 'Fort', 'Moyen', 'Faible']
const TYPE_CLIENT_OPT   = ['', 'Professionnel', 'Particulier']

// ── Sous-composants ────────────────────────────────────────────────────────────

function Field({ label, children, half, sensitive }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: half ? '0 0 calc(50% - 4px)' : '1 1 100%' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
        {sensitive && <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />}
      </label>
      {children}
    </div>
  )
}

const inputStyle = {
  background: 'var(--s3)',
  border: '1px solid var(--border-md)',
  borderRadius: 6,
  padding: '6px 10px',
  fontSize: 12,
  color: 'var(--text)',
  outline: 'none',
  width: '100%',
  fontFamily: 'var(--sans)',
  boxSizing: 'border-box',
}

function Input({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={inputStyle}
    />
  )
}

function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ ...inputStyle, cursor: 'pointer' }}
    >
      {options.map(o => (
        <option key={o} value={o}>{o || '—'}</option>
      ))}
    </select>
  )
}

// ── Composant principal ────────────────────────────────────────────────────────

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return mobile
}

export default function LeadChatbot({ onCreateLead }) {
  const mobile = useIsMobile()
  const [open, setOpen]         = useState(false)
  const [step, setStep]         = useState('input')   // 'input' | 'preview'
  const [text, setText]         = useState('')
  const [etablissement, setEtablissement] = useState(null)
  const [form, setForm]         = useState({})
  const [saving, setSaving]     = useState(false)
  const drawerRef               = useRef()

  // Fermeture Escape
  useEffect(() => {
    if (!open) return
    const handler = e => { if (e.key === 'Escape' && !saving) handleClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, saving])

  function handleClose() {
    if (saving) return
    setOpen(false)
    setStep('input')
    setText('')
    setForm({})
    setEtablissement(null)
  }

  function handleAnalyser() {
    const { lead, etablissement: etab } = parseTranscription(text)
    setForm(lead)
    setEtablissement(etab)
    setStep('preview')
  }

  function setField(key, val) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  async function handleCreate() {
    setSaving(true)
    const { error } = await onCreateLead(form)
    setSaving(false)
    if (!error) handleClose()
  }

  return (
    <>
      {/* Bouton flottant */}
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          bottom: mobile ? 32 : 24,
          right: mobile ? 16 : 24,
          zIndex: 200,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 16px',
          background: 'var(--red)',
          color: '#fff',
          border: 'none',
          borderRadius: 28,
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 600,
          fontFamily: 'var(--sans)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
          transition: 'opacity 0.15s, transform 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        Analyser une transcription
      </button>

      {/* Overlay + Drawer */}
      {open && (
        <>
          {/* Overlay */}
          <div
            onClick={() => !saving && handleClose()}
            style={{
              position: 'fixed', inset: 0, zIndex: 300,
              background: 'rgba(0,0,0,0.55)',
              animation: 'fadeIn 0.15s ease',
            }}
          />

          {/* Drawer */}
          <div
            ref={drawerRef}
            style={{
              position: 'fixed',
              top: 0, right: 0,
              width: mobile ? '100vw' : 480,
              height: '100vh',
              zIndex: 301,
              background: 'var(--s2)',
              borderLeft: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              animation: 'slideRight 0.2s ease both',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                  {step === 'input' ? 'Analyser une transcription' : 'Prévisualisation du lead'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  {step === 'input'
                    ? 'Colle ta note terrain — les informations seront extraites automatiquement'
                    : 'Vérifie et corrige les informations avant de créer le lead'}
                </div>
              </div>
              <button
                onClick={handleClose}
                disabled={saving}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, borderRadius: 4 }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>

            {/* Corps */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

              {/* ── Step input ── */}
              {step === 'input' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <p style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6, margin: 0 }}>
                    Colle ici tes notes de prospection terrain. Le système va détecter automatiquement
                    le type de client, la ville, le besoin, l'intérêt et les prochaines actions.
                  </p>
                  <textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    placeholder="Ex: Camping du lac à Sarlat, très intéressé par un reportage drone pour l'été. Contact : M. Dupont. Rappeler en mai."
                    rows={14}
                    style={{
                      ...inputStyle,
                      resize: 'vertical',
                      lineHeight: 1.6,
                      minHeight: 250,
                    }}
                    autoFocus
                  />
                  <div style={{ fontSize: 10, color: 'var(--muted2)', textAlign: 'right' }}>
                    {text.length} caractère{text.length !== 1 ? 's' : ''}
                  </div>
                </div>
              )}

              {/* ── Step preview ── */}
              {step === 'preview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                  {/* ── Section champs sensibles ── */}
                  <div style={{
                    borderRadius: 8,
                    border: '1px solid #f59e0b44',
                    borderLeft: '3px solid #f59e0b',
                    background: '#f59e0b08',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}>
                    {/* En-tête section sensible */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                        Noms propres — vérifie avant création
                      </span>
                      <span style={{ fontSize: 9, color: 'var(--muted2)' }}>· La dictée est fragile sur ces champs</span>
                    </div>

                    {/* Établissement + Ville */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      <Field label="Nom établissement" half sensitive>
                        <Input value={form.nomEntreprise || ''} onChange={v => setField('nomEntreprise', v)} placeholder="—" />
                      </Field>
                      <Field label="Ville / Lieu" half sensitive>
                        <Input value={form.ville || ''} onChange={v => setField('ville', v)} placeholder="—" />
                      </Field>
                    </div>

                    {/* Contact */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      <Field label="Prénom" half sensitive>
                        <Input value={form.prenom || ''} onChange={v => setField('prenom', v)} placeholder="—" />
                      </Field>
                      <Field label="Nom" half sensitive>
                        <Input value={form.nom || ''} onChange={v => setField('nom', v)} placeholder="—" />
                      </Field>
                      <Field label="Email" half sensitive>
                        <Input value={form.email || ''} onChange={v => setField('email', v)} placeholder="—" type="email" />
                      </Field>
                      <Field label="Téléphone" half sensitive>
                        <Input value={form.telephone || ''} onChange={v => setField('telephone', v)} placeholder="—" />
                      </Field>
                    </div>

                    {/* Badge établissement détecté */}
                    {etablissement && (
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        fontSize: 10, color: 'var(--muted)',
                      }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
                        Établissement détecté : <strong style={{ color: 'var(--text)', marginLeft: 3 }}>{etablissement}</strong>
                      </div>
                    )}
                  </div>

                  {/* ── Section champs détectés ── */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted2)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      Informations détectées
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      <Field label="Type de client" half>
                        <Select value={form.typeClient || ''} onChange={v => setField('typeClient', v)} options={TYPE_CLIENT_OPT} />
                      </Field>
                      <Field label="Type de besoin" half>
                        <Input value={form.typeBesoin || ''} onChange={v => setField('typeBesoin', v)} placeholder="—" />
                      </Field>
                      <Field label="Statut" half>
                        <Select value={form.statut || 'nouveau'} onChange={v => setField('statut', v)} options={STATUT_OPTIONS} />
                      </Field>
                      <Field label="Priorité" half>
                        <Select value={form.priorite || 'Normale'} onChange={v => setField('priorite', v)} options={PRIORITE_OPTIONS} />
                      </Field>
                      <Field label="Niveau d'intérêt" half>
                        <Select value={form.niveauInteret || ''} onChange={v => setField('niveauInteret', v)} options={INTERET_OPTIONS} />
                      </Field>
                      <Field label="Next step">
                        <Input value={form.nextStep || ''} onChange={v => setField('nextStep', v)} placeholder="Ex: Rappeler en mai" />
                      </Field>
                      <Field label="Commentaires internes">
                        <textarea
                          value={form.commentaires || ''}
                          onChange={e => setField('commentaires', e.target.value)}
                          rows={3}
                          placeholder="Notes internes…"
                          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
                        />
                      </Field>
                    </div>
                  </div>

                  {/* Message (transcription tronquée, readonly) */}
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                      Transcription source <span style={{ fontWeight: 400, fontSize: 9 }}>(Message client)</span>
                    </div>
                    <textarea
                      value={form.message || ''}
                      onChange={e => setField('message', e.target.value)}
                      rows={4}
                      style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5, color: 'var(--muted)' }}
                    />
                  </div>

                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              gap: 8,
              flexShrink: 0,
            }}>
              {step === 'input' ? (
                <>
                  <button
                    onClick={handleClose}
                    style={{ ...btnStyle, background: 'var(--s3)', color: 'var(--muted)' }}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleAnalyser}
                    disabled={!text.trim()}
                    style={{
                      ...btnStyle,
                      background: text.trim() ? 'var(--red)' : 'var(--s4)',
                      color: text.trim() ? '#fff' : 'var(--muted2)',
                      cursor: text.trim() ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Analyser →
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setStep('input')}
                    disabled={saving}
                    style={{ ...btnStyle, background: 'var(--s3)', color: 'var(--muted)' }}
                  >
                    ← Modifier la transcription
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={saving}
                    style={{ ...btnStyle, background: 'var(--red)', color: '#fff', opacity: saving ? 0.7 : 1 }}
                  >
                    {saving ? 'Création…' : 'Créer le lead'}
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}

const btnStyle = {
  padding: '8px 16px',
  borderRadius: 7,
  border: 'none',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
  fontFamily: 'var(--sans)',
  transition: 'opacity 0.15s',
}
