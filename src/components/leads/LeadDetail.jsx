import React, { useState, useEffect } from 'react'
import { SectionCard, SectionTitle } from '../ui/SectionCard.jsx'
import ThemedDateInput from '../ui/ThemedDateInput.jsx'

const STATUT_OPTIONS    = ['nouveau', 'Prospect contacté', 'À relancer', 'Opportunité', 'Relancé', 'Converti', 'Perdu']
const PRIORITE_OPTIONS  = ['Haute', 'Normale', 'Basse']
const INTERET_OPTIONS   = ['Fort', 'Moyen', 'Faible']
const NEXT_STEP_OPTIONS = ['RDV sur place', 'Envoyer proposition', 'Relance']
const PROBA_OPTIONS     = ['100', '80', '60', '40', '20', '0']
const ETAB_OPTIONS      = ['camping', 'hotel', 'auberge', 'chateau', 'domaine', 'site_touristique', 'entreprise', 'particulier', 'autre']
const ETAB_LABELS       = { camping: 'Camping', hotel: 'Hôtel', auberge: 'Auberge', chateau: 'Château', domaine: 'Domaine', site_touristique: 'Site touristique', entreprise: 'Entreprise', particulier: 'Particulier', autre: 'Autre' }

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

const fieldControlStyle = {
  width: '100%',
  boxSizing: 'border-box',
  background: 'var(--s3)',
  border: '1px solid var(--border-md)',
  borderRadius: 6,
  padding: '6px 10px',
  fontSize: 12,
  color: 'var(--text)',
  fontFamily: 'var(--sans)',
  outline: 'none',
}

const fieldGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '0 12px',
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
          style={{ ...fieldControlStyle, padding: '7px 10px', resize: 'vertical' }}
          onFocus={e => e.target.style.borderColor = 'var(--border-strong)'}
          onBlur={e => e.target.style.borderColor = 'var(--border-md)'}
        />
      ) : type === 'date' ? (
        <ThemedDateInput
          value={value || ''}
          onChange={onChange}
          style={{ minHeight: 32 }}
        />
      ) : (
        <input
          type={type}
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          style={fieldControlStyle}
          onFocus={e => e.target.style.borderColor = 'var(--border-strong)'}
          onBlur={e => e.target.style.borderColor = 'var(--border-md)'}
        />
      )}
    </div>
  )
}

function FieldSelect({ label, value, onChange, options, labelMap }) {
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
        {options.map(o => <option key={o} value={o}>{labelMap ? labelMap[o] || o : o}</option>)}
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

function quickActionBtn(disabled, tone = 'default') {
  const tones = {
    default: {
      background: 'var(--s3)',
      border: '1px solid var(--border-md)',
      color: 'var(--text)',
    },
    success: {
      background: 'var(--green-dim)',
      border: '1px solid rgba(34,197,94,0.25)',
      color: 'var(--green)',
    },
    danger: {
      background: 'var(--red-dim)',
      border: '1px solid rgba(191,24,24,0.25)',
      color: 'var(--red)',
    },
  }

  return {
    padding: '6px 12px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
    fontFamily: 'var(--sans)',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    ...tones[tone],
  }
}

function formatMoney(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount)
}

function CompactMetaPill({ label, value, tone = 'neutral' }) {
  const tones = {
    neutral: {
      border: '1px solid var(--border)',
      background: 'rgba(255,255,255,0.03)',
      value: 'var(--text)',
      label: 'var(--muted2)',
    },
    blue: {
      border: '1px solid rgba(79,127,243,0.18)',
      background: 'rgba(79,127,243,0.08)',
      value: 'var(--blue)',
      label: 'rgba(79,127,243,0.72)',
    },
    amber: {
      border: '1px solid rgba(245,158,11,0.18)',
      background: 'rgba(245,158,11,0.08)',
      value: 'var(--amber)',
      label: 'rgba(245,158,11,0.72)',
    },
    green: {
      border: '1px solid rgba(34,197,94,0.18)',
      background: 'rgba(34,197,94,0.08)',
      value: 'var(--green)',
      label: 'rgba(34,197,94,0.72)',
    },
  }

  const palette = tones[tone] || tones.neutral

  return (
    <div style={{
      padding: '7px 10px',
      borderRadius: 999,
      border: palette.border,
      background: palette.background,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
    }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: palette.label }}>
        {label}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: palette.value, whiteSpace: 'nowrap' }}>
        {value || '—'}
      </div>
    </div>
  )
}

export default function LeadDetail({ lead, onUpdate, onDelete, onClose }) {
  const [crm, setCrm] = useState({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [actionLoading, setActionLoading] = useState('')

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
      typeEtablissement: lead.typeEtablissement,
      montantDevis:  lead.montantDevis,
      montantReel:   lead.montantReel ?? '',
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
    const { error } = await onUpdate(lead.id, {
      ...crm,
      dateRelance:  crm.dateRelance  || null,
      dateDevis:    crm.dateDevis    || null,
      dateMission:  crm.dateMission  || null,
    })
    setSaving(false)
    if (!error) setDirty(false)
  }

  const runQuickAction = async (key, patch) => {
    setActionLoading(key)
    const nextState = {
      ...crm,
      ...patch,
      dateRelance: patch.dateRelance !== undefined ? (patch.dateRelance || null) : (crm.dateRelance || null),
      dateDevis: patch.dateDevis !== undefined ? (patch.dateDevis || null) : (crm.dateDevis || null),
      dateMission: crm.dateMission || null,
    }
    const { error } = await onUpdate(lead.id, nextState)
    if (!error) {
      setCrm(nextState)
      setDirty(false)
    }
    setActionLoading('')
  }

  const today = new Date().toISOString().split('T')[0]
  const plusSevenDays = (() => {
    const date = new Date()
    date.setDate(date.getDate() + 7)
    return date.toISOString().split('T')[0]
  })()

  const currentStatut = crm.statut || lead.statut
  const displayName = [crm.prenom || lead.prenom, crm.nom || lead.nom].filter(Boolean).join(' ') || crm.email || lead.email || crm.nomEntreprise || lead.nomEntreprise || 'Sans nom'
  const statutColor = STATUT_COLORS[currentStatut] || 'var(--muted)'
  const createdAtLabel = lead.timestamp
    ? new Date(lead.timestamp).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—'
  const sourceLabel = SOURCE_LABELS[lead.source] || lead.source || '—'
  const followUpLabel = crm.dateRelance || formatDateInput(lead.dateRelance) || '—'
  const amountLabel = formatMoney(crm.montantDevis || lead.montantDevis)
  const metaItems = [
    { key: 'source', label: 'Source', value: sourceLabel, tone: 'blue' },
    { key: 'created', label: 'Créé', value: createdAtLabel, tone: 'neutral' },
    { key: 'follow-up', label: 'Relance', value: followUpLabel, tone: followUpLabel !== '—' ? 'amber' : 'neutral' },
    { key: 'amount', label: 'Montant', value: amountLabel, tone: amountLabel !== '—' ? 'green' : 'neutral' },
  ]

  const quickActions = [
    {
      key: 'follow-up',
      label: 'À relancer',
      onClick: () => runQuickAction('follow-up', { statut: 'À relancer', nextStep: crm.nextStep || 'Relancer le lead' }),
    },
    {
      key: 'follow-up-7d',
      label: 'Relance +7j',
      onClick: () => runQuickAction('follow-up-7d', {
        statut: 'À relancer',
        dateRelance: plusSevenDays,
        nextStep: crm.nextStep || 'Relancer le lead',
      }),
    },
    {
      key: 'converted',
      label: 'Converti',
      onClick: () => runQuickAction('converted', { statut: 'Converti' }),
    },
    {
      key: 'lost',
      label: 'Perdu',
      onClick: () => runQuickAction('lost', { statut: 'Perdu' }),
    },
    {
      key: 'quote-sent',
      label: 'Devis envoyé',
      onClick: () => runQuickAction('quote-sent', {
        dateDevis: today,
        nextStep: crm.nextStep || 'Relancer après envoi du devis',
      }),
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'linear-gradient(180deg, rgba(79,127,243,0.04), rgba(13,17,17,0) 32%), var(--bg)' }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px 12px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.005))',
      }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--blue)', marginBottom: 6 }}>
            Fiche lead
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 6, lineHeight: 1.15 }}>
            {displayName}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 11, fontWeight: 600, color: statutColor,
              padding: '4px 10px', borderRadius: 20,
              background: `${statutColor}18`, border: `1px solid ${statutColor}33`,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: statutColor }} />
              {currentStatut}
            </span>
            {(crm.nomEntreprise || lead.nomEntreprise) && (
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{crm.nomEntreprise || lead.nomEntreprise}</span>
            )}
            {(crm.email || lead.email) && (
              <span style={{ fontSize: 11, color: 'var(--muted2)' }}>{crm.email || lead.email}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {metaItems.map(item => (
              <CompactMetaPill key={item.key} label={item.label} value={item.value} tone={item.tone} />
            ))}
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

      {/* Action bar */}
      <div style={{
        padding: '10px 20px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        background: 'rgba(255,255,255,0.015)',
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted2)', marginBottom: 8 }}>
          Actions rapides
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button
          onClick={() => crm.telephone && (window.location.href = `tel:${crm.telephone}`)}
          disabled={!crm.telephone}
          style={quickActionBtn(!crm.telephone)}
        >
          Appeler
        </button>
        <button
          onClick={() => crm.email && (window.location.href = `mailto:${crm.email}`)}
          disabled={!crm.email}
          style={quickActionBtn(!crm.email)}
        >
          Email
        </button>
        {quickActions.map(action => (
          <button
            key={action.key}
            onClick={action.onClick}
            disabled={saving || !!actionLoading}
            style={quickActionBtn(saving || !!actionLoading, action.key === 'converted' ? 'success' : action.key === 'lost' ? 'danger' : 'default')}
          >
            {actionLoading === action.key ? '…' : action.label}
          </button>
        ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px 18px' }}>
        {/* Section Coordonnées */}
        <SectionCard borderColor="var(--blue-dim)">
          <SectionTitle accent="var(--blue)" accentDim="var(--blue-dim)">Coordonnées</SectionTitle>
          <div style={fieldGridStyle}>
            <FieldInput label="Prénom"    value={crm.prenom} onChange={v => setCrmField('prenom', v)} />
            <FieldInput label="Nom"       value={crm.nom}    onChange={v => setCrmField('nom', v)} />
          </div>
          <FieldInput  label="Email"           value={crm.email}         onChange={v => setCrmField('email', v)}         type="email" />
          <FieldInput  label="Téléphone"        value={crm.telephone}     onChange={v => setCrmField('telephone', v)} />
          <FieldInput  label="Nom entreprise"   value={crm.nomEntreprise} onChange={v => setCrmField('nomEntreprise', v)} />
          <div style={fieldGridStyle}>
            <FieldSelect label="Type de client"       value={crm.typeClient}  onChange={v => setCrmField('typeClient', v)}  options={['Particulier', 'Professionnel']} />
            <FieldSelect label="Prestataire existant" value={crm.prestataire ? 'Oui' : 'Non'} onChange={v => setCrmField('prestataire', v === 'Oui')} options={['Oui', 'Non']} />
          </div>
          <FieldSelect
            label="Type d'établissement"
            value={crm.typeEtablissement || ''}
            onChange={v => setCrmField('typeEtablissement', v)}
            options={ETAB_OPTIONS}
            labelMap={ETAB_LABELS}
          />
        </SectionCard>

        {/* Section Mission */}
        <SectionCard borderColor="var(--amber-dim)">
          <SectionTitle accent="var(--amber)" accentDim="var(--amber-dim)">Mission</SectionTitle>
          <div style={fieldGridStyle}>
            <FieldInput label="Ville / Lieu"   value={crm.ville}       onChange={v => setCrmField('ville', v)} />
            <FieldInput label="Date souhaitée" value={crm.dateMission} onChange={v => setCrmField('dateMission', v)} type="date" />
          </div>
          <FieldInput label="Type de besoin" value={crm.typeBesoin} onChange={v => setCrmField('typeBesoin', v)} />
          <FieldInput label="Message client"  value={crm.message}   onChange={v => setCrmField('message', v)}   multiline />
        </SectionCard>

        {/* Section Suivi CRM */}
        <SectionCard borderColor="var(--red-dim)">
          <SectionTitle accent="var(--red)" accentDim="var(--red-dim)">Suivi CRM</SectionTitle>
          <div style={fieldGridStyle}>
            <FieldSelect label="Statut"           value={crm.statut}       onChange={v => setCrmField('statut', v)}       options={STATUT_OPTIONS} />
            <FieldSelect label="Priorité"         value={crm.priorite}     onChange={v => setCrmField('priorite', v)}     options={PRIORITE_OPTIONS} />
            <FieldSelect label="Niveau d'intérêt" value={crm.niveauInteret} onChange={v => setCrmField('niveauInteret', v)} options={INTERET_OPTIONS} />
            <FieldSelect label="Probabilité (%)" value={crm.probabilite} onChange={v => setCrmField('probabilite', v)} options={PROBA_OPTIONS} />
          </div>
          <FieldSelect label="Next step" value={crm.nextStep} onChange={v => setCrmField('nextStep', v)} options={NEXT_STEP_OPTIONS} />
          <div style={fieldGridStyle}>
            <FieldInput label="Date de relance"    value={crm.dateRelance} onChange={v => setCrmField('dateRelance', v)} type="date" />
            <FieldInput label="Date d'envoi devis" value={crm.dateDevis}   onChange={v => setCrmField('dateDevis', v)}   type="date" />
          </div>
          {/* ── Financier ── */}
          <div style={fieldGridStyle}>
            <FieldInput label="Montant estimé (€)" value={crm.montantDevis} onChange={v => setCrmField('montantDevis', v)} type="number" />
            <FieldInput label="Montant réel (€)"   value={crm.montantReel  ?? ''} onChange={v => setCrmField('montantReel', v)}  type="number" />
          </div>

          {/* Suggestion probabilité */}
          {(() => {
            const suggested =
              crm.priorite === 'Haute' && crm.niveauInteret === 'Fort'  ? '80' :
              crm.priorite === 'Haute' && crm.niveauInteret === 'Moyen' ? '70' :
              crm.niveauInteret === 'Fort'                              ? '60' :
              crm.niveauInteret === 'Faible' || crm.priorite === 'Basse' ? '30' : '40'
            const current = crm.probabilite
            if (!current || current === suggested) return null
            return (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--s3)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '6px 10px', marginBottom: 10, gap: 8,
              }}>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                  Suggestion probabilité : <strong style={{ color: 'var(--text)' }}>{suggested} %</strong>
                  <span style={{ color: 'var(--muted2)' }}> (selon priorité + intérêt)</span>
                </span>
                <button
                  onClick={() => setCrmField('probabilite', suggested)}
                  style={{
                    fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 4,
                    background: 'var(--red-dim)', border: '1px solid var(--red-glow)',
                    color: 'var(--red)', cursor: 'pointer', flexShrink: 0, fontFamily: 'var(--sans)',
                  }}
                >
                  Appliquer
                </button>
              </div>
            )
          })()}

          <FieldInput label="Commentaires internes" value={crm.commentaires} onChange={v => setCrmField('commentaires', v)} multiline />
        </SectionCard>
      </div>

      {/* Footer */}
      <div style={{
        flexShrink: 0, borderTop: '1px solid var(--border)',
        padding: '12px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.005))',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, color: 'var(--muted2)', padding: '6px 8px', borderRadius: 999, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
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
              padding: '10px 18px', borderRadius: 10, fontSize: 12, fontWeight: 700,
              fontFamily: 'var(--sans)', cursor: dirty && !saving ? 'pointer' : 'default',
              background: dirty ? 'linear-gradient(180deg, #cf2424, #a81414)' : 'var(--s3)',
              color: dirty ? '#fff' : 'var(--muted2)',
              border: dirty ? '1px solid rgba(191,24,24,0.32)' : '1px solid var(--border)',
              boxShadow: dirty ? '0 12px 28px rgba(191,24,24,0.22)' : 'none',
            }}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}
