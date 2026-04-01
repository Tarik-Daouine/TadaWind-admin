import React, { useState, useEffect } from 'react'

const STATUT_OPTIONS    = ['nouveau', 'Prospect contacté', 'À relancer', 'Opportunité', 'Relancé', 'Converti', 'Perdu']
const PRIORITE_OPTIONS  = ['Haute', 'Normale', 'Basse']
const INTERET_OPTIONS   = ['Fort', 'Moyen', 'Faible']
const NEXT_STEP_OPTIONS = ['RDV sur place', 'Envoyer proposition', 'Relance']
const PROBA_OPTIONS     = ['100', '80', '60', '40', '20', '0']

const STATUT_COLORS = {
  'nouveau':           '#4f7ff3',
  'Prospect contacté': '#f59e0b',
  'À relancer':        '#f97316',
  'Opportunité':       '#22c55e',
  'Relancé':           '#f59e0b',
  'Converti':          '#16a34a',
  'Perdu':             '#6b7280',
}

function formatDateInput(isoStr) {
  if (!isoStr) return ''
  try { return new Date(isoStr).toISOString().split('T')[0] } catch { return '' }
}

function formatDateDisplay(isoStr) {
  if (!isoStr) return '—'
  try {
    return new Date(isoStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch { return isoStr }
}

function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.08em', color: 'var(--muted2)',
      marginBottom: 10, paddingBottom: 6,
      borderBottom: '1px solid var(--border)',
    }}>
      {children}
    </div>
  )
}

function InfoRow({ label, children }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 11, color: 'var(--muted2)', width: 130, flexShrink: 0, paddingTop: 1 }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--text)', flex: 1 }}>{children || '—'}</span>
    </div>
  )
}

function FieldInput({ label, value, onChange, type = 'text', multiline }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: 'block', fontSize: 10, color: 'var(--muted2)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </label>
      {multiline ? (
        <textarea
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          rows={4}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'var(--s3)', border: '1px solid var(--border-md)',
            borderRadius: 6, padding: '7px 10px',
            fontSize: 12, color: 'var(--text)', fontFamily: 'var(--sans)',
            resize: 'vertical', outline: 'none',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--border-strong)'}
          onBlur={e => e.target.style.borderColor = 'var(--border-md)'}
        />
      ) : (
        <input
          type={type}
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'var(--s3)', border: '1px solid var(--border-md)',
            borderRadius: 6, padding: '6px 10px',
            fontSize: 12, color: 'var(--text)', fontFamily: 'var(--sans)', outline: 'none',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--border-strong)'}
          onBlur={e => e.target.style.borderColor = 'var(--border-md)'}
        />
      )}
    </div>
  )
}

function FieldSelect({ label, value, onChange, options }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: 'block', fontSize: 10, color: 'var(--muted2)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </label>
      <select
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%', boxSizing: 'border-box',
          background: 'var(--s3)', border: '1px solid var(--border-md)',
          borderRadius: 6, padding: '6px 10px',
          fontSize: 12, color: 'var(--text)', fontFamily: 'var(--sans)', outline: 'none',
          cursor: 'pointer',
        }}
      >
        <option value="">—</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

const IconClose = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

const SOURCE_LABELS = { 'tadawind_site': 'Site web', 'Autre': 'Terrain', 'Réseau': 'Réseau' }

export default function LeadDetail({ lead, onUpdate, onDelete, onClose }) {
  const [crm, setCrm] = useState({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setCrm({
      // CRM
      statut:        lead.statut,
      priorite:      lead.priorite,
      niveauInteret: lead.niveauInteret,
      probabilite:   lead.probabilite,
      nextStep:      lead.nextStep,
      dateRelance:   formatDateInput(lead.dateRelance),
      dateDevis:     formatDateInput(lead.dateDevis),
      montantDevis:  lead.montantDevis,
      commentaires:  lead.commentaires,
      // Coordonnées
      prenom:        lead.prenom,
      nom:           lead.nom,
      email:         lead.email,
      telephone:     lead.telephone,
      nomEntreprise: lead.nomEntreprise,
      typeClient:    lead.typeClient,
      prestataire:   lead.prestataire,
      // Mission
      ville:        lead.ville,
      dateMission:  formatDateInput(lead.dateMission),
      typeBesoin:   lead.typeBesoin,
      message:      lead.message,
    })
    setDirty(false)
  }, [lead.id])

  const setCrmField = (key, val) => {
    setCrm(prev => ({ ...prev, [key]: val }))
    setDirty(true)
  }

  const handleSave = async () => {
    setSaving(true)
    await onUpdate(lead.id, {
      ...crm,
      dateRelance:  crm.dateRelance  || null,
      dateDevis:    crm.dateDevis    || null,
      dateMission:  crm.dateMission  || null,
    })
    setSaving(false)
    setDirty(false)
  }

  const displayName = [lead.prenom, lead.nom].filter(Boolean).join(' ') || lead.email || lead.nomEntreprise || 'Sans nom'
  const statutColor = STATUT_COLORS[lead.statut] || 'var(--muted)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bg)' }}>
      {/* Header */}
      <div style={{
        padding: '14px 20px 12px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
            {displayName}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 11, fontWeight: 500, color: statutColor,
              padding: '2px 8px', borderRadius: 20,
              background: `${statutColor}18`, border: `1px solid ${statutColor}33`,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: statutColor }} />
              {lead.statut}
            </span>
            {lead.nomEntreprise && (
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>{lead.nomEntreprise}</span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, flexShrink: 0, marginTop: 2 }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--muted)'}
        >
          <IconClose />
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

        {/* Section Coordonnées */}
        <div style={{ marginBottom: 24 }}>
          <SectionTitle>Coordonnées</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <FieldInput label="Prénom"    value={crm.prenom} onChange={v => setCrmField('prenom', v)} />
            <FieldInput label="Nom"       value={crm.nom}    onChange={v => setCrmField('nom', v)} />
          </div>
          <FieldInput  label="Email"           value={crm.email}         onChange={v => setCrmField('email', v)}         type="email" />
          <FieldInput  label="Téléphone"        value={crm.telephone}     onChange={v => setCrmField('telephone', v)} />
          <FieldInput  label="Nom entreprise"   value={crm.nomEntreprise} onChange={v => setCrmField('nomEntreprise', v)} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <FieldSelect label="Type de client"       value={crm.typeClient}  onChange={v => setCrmField('typeClient', v)}  options={['Particulier', 'Professionnel']} />
            <FieldSelect label="Prestataire existant" value={crm.prestataire ? 'Oui' : 'Non'} onChange={v => setCrmField('prestataire', v === 'Oui')} options={['Oui', 'Non']} />
          </div>
        </div>

        {/* Section Mission */}
        <div style={{ marginBottom: 24 }}>
          <SectionTitle>Mission</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <FieldInput label="Ville / Lieu"   value={crm.ville}       onChange={v => setCrmField('ville', v)} />
            <FieldInput label="Date souhaitée" value={crm.dateMission} onChange={v => setCrmField('dateMission', v)} type="date" />
          </div>
          <FieldInput label="Type de besoin" value={crm.typeBesoin} onChange={v => setCrmField('typeBesoin', v)} />
          <FieldInput label="Message client"  value={crm.message}   onChange={v => setCrmField('message', v)}   multiline />
        </div>

        {/* Section Suivi CRM */}
        <div style={{ marginBottom: 24 }}>
          <SectionTitle>Suivi CRM</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <FieldSelect label="Statut"           value={crm.statut}       onChange={v => setCrmField('statut', v)}       options={STATUT_OPTIONS} />
            <FieldSelect label="Priorité"         value={crm.priorite}     onChange={v => setCrmField('priorite', v)}     options={PRIORITE_OPTIONS} />
            <FieldSelect label="Niveau d'intérêt" value={crm.niveauInteret} onChange={v => setCrmField('niveauInteret', v)} options={INTERET_OPTIONS} />
            <FieldSelect label="Probabilité (%)" value={crm.probabilite} onChange={v => setCrmField('probabilite', v)} options={PROBA_OPTIONS} />
          </div>
          <FieldSelect label="Next step" value={crm.nextStep} onChange={v => setCrmField('nextStep', v)} options={NEXT_STEP_OPTIONS} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <FieldInput label="Date de relance"    value={crm.dateRelance} onChange={v => setCrmField('dateRelance', v)} type="date" />
            <FieldInput label="Date d'envoi devis" value={crm.dateDevis}   onChange={v => setCrmField('dateDevis', v)}   type="date" />
          </div>
          <FieldInput label="Montant devis estimé (€)" value={crm.montantDevis} onChange={v => setCrmField('montantDevis', v)} />
          <FieldInput label="Commentaires internes" value={crm.commentaires} onChange={v => setCrmField('commentaires', v)} multiline />
        </div>
      </div>

      {/* Footer */}
      <div style={{
        flexShrink: 0, borderTop: '1px solid var(--border)',
        padding: '10px 20px', display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, color: 'var(--muted2)' }}>
              {SOURCE_LABELS[lead.source] || lead.source}
              {lead.timestamp && ` · ${new Date(lead.timestamp).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })}`}
            </span>
            <button
              onClick={() => onDelete && onDelete(lead.id)}
              style={{ fontSize: 11, color: 'var(--muted2)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--sans)' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--muted2)'}
            >
              Supprimer
            </button>
          </div>
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            style={{
              padding: '6px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600,
              fontFamily: 'var(--sans)', cursor: dirty && !saving ? 'pointer' : 'default',
              background: dirty ? 'var(--red)' : 'var(--s3)',
              color: dirty ? '#fff' : 'var(--muted2)',
              border: 'none', transition: 'all 0.15s',
            }}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
