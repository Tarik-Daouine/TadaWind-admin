import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

// ─────────────────────────────────────────────────────────────────────────────
// RÉFÉRENCE DES COLONNES EN DB (table leads — noms français avec accents)
// ─────────────────────────────────────────────────────────────────────────────
// ID                      text  PK
// Prénom                  text
// Nom                     text
// Email                   text
// Téléphone               text
// Nom entreprise          text
// Type de client          text  'Particulier' | 'Professionnel'
// Prestataire existant ?  bool
// Ville / Lieu mission    text
// Date souhaitée mission  timestamptz
// Type de besoin          text
// Message client          text
// Source                  text  'tadawind_site' | 'Autre' | 'Réseau'
// Statut                  text  'nouveau' | 'Prospect contacté' | 'Opportunité' | 'Relancé' | 'Converti' | 'Perdu'
// Priorite                text  'Haute' | 'Normale' | 'Basse'
// Niveau interet          text  'Fort' | 'Moyen' | 'Faible'
// Probabilite             text  (% en texte, ex: '80')
// Next step               text
// Date de relance         timestamptz
// Date envoi devis        timestamptz
// Montant devis estime    text
// montant_reel            numeric  (nullable — montant réel après conversion)
// type_etablissement      text     (nullable — enum: camping|hotel|auberge|chateau|domaine|site_touristique|entreprise|particulier|autre)
// Commentaires internes   text
// Timestamp               text
// ─────────────────────────────────────────────────────────────────────────────

// ── MAPPER Supabase → UI ──────────────────────────────────────────────────────
function mapLead(row) {
  return {
    id:            row['ID']                       ?? '',
    prenom:        row['Prenom']                   ?? '',
    nom:           row['Nom']                      ?? '',
    email:         row['Email']                    ?? '',
    telephone:     row['Telephone']                ?? '',
    nomEntreprise: row['Nom entreprise']           ?? '',
    typeClient:    row['Type de client']           ?? '',
    prestataire:   row['Prestataire existant']     ?? false,
    ville:         row['Ville / Lieu mission']     ?? '',
    dateMission:   row['Date souhaitee mission']   ?? null,
    typeBesoin:    row['Type de besoin']           ?? '',
    message:       row['Message client']           ?? '',
    source:        row['Source']                   ?? '',
    statut:        row['Statut']                   ?? 'nouveau',
    priorite:      row['Priorite']                 ?? 'Normale',
    niveauInteret: row['Niveau interet']           ?? '',
    probabilite:   row['Probabilite']              ?? '',
    nextStep:      row['Next step']                ?? '',
    dateRelance:   row['Date de relance']          ?? null,
    dateDevis:     row['Date envoi devis']         ?? null,
    montantDevis:  row['Montant devis estime']     ?? '',
    montantReel:        row['montant_reel']             ?? null,
    typeEtablissement:  row['type_etablissement']      ?? '',
    commentaires:       row['Commentaires internes']   ?? '',
    timestamp:     row['Timestamp']                ?? '',
  }
}

// ── MAPPER UI → Supabase ──────────────────────────────────────────────────────
// Ne met à jour que les champs CRM (pas les coordonnées saisies à la source)
function mapToSupabase(data) {
  const out = {}
  const mapping = {
    statut:        'Statut',
    priorite:      'Priorite',
    niveauInteret: 'Niveau interet',
    probabilite:   'Probabilite',
    nextStep:      'Next step',
    dateRelance:   'Date de relance',
    dateDevis:     'Date envoi devis',
    montantDevis:  'Montant devis estime',
    montantReel:       'montant_reel',
    typeEtablissement: 'type_etablissement',
    commentaires:      'Commentaires internes',
    // Coordonnées également éditables
    prenom:        'Prenom',
    nom:           'Nom',
    email:         'Email',
    telephone:     'Telephone',
    nomEntreprise: 'Nom entreprise',
    typeClient:    'Type de client',
    prestataire:   'Prestataire existant',
    ville:         'Ville / Lieu mission',
    dateMission:   'Date souhaitee mission',
    typeBesoin:    'Type de besoin',
    message:       'Message client',
    source:        'Source',
  }
  // Champs numériques nullable : on envoie null si vide
  const nullableNumeric = new Set(['montant_reel'])
  for (const [uiKey, dbKey] of Object.entries(mapping)) {
    const val = data[uiKey]
    if (nullableNumeric.has(dbKey)) {
      out[dbKey] = (val === '' || val === undefined) ? null : Number(val)
    } else if (val !== undefined && val !== null && val !== '') {
      out[dbKey] = val
    }
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────
export function useLeads() {
  const [leads, setLeads]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)

  // ── Fetch initial ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    async function fetchLeads() {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('Timestamp', { ascending: false })

      if (cancelled) return

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      setLeads((data ?? []).map(mapLead))
      setLoading(false)
    }

    fetchLeads()
    return () => { cancelled = true }
  }, [])

  // ── UPDATE ─────────────────────────────────────────────────────────────────
  const updateLead = async (id, data) => {
    const supabaseData = mapToSupabase(data)

    const { error } = await supabase
      .from('leads')
      .update(supabaseData)
      .eq('ID', id)

    if (error) {
      console.error('[updateLead]', error.message)
      return { error: error.message }
    }

    setLeads(prev =>
      prev.map(l => l.id === id ? { ...l, ...data } : l)
    )
    return { error: null }
  }

  // ── DELETE ─────────────────────────────────────────────────────────────────
  const deleteLead = async (id) => {
    const { error } = await supabase.from('leads').delete().eq('ID', id)
    if (error) {
      console.error('[deleteLead]', error.message)
      return { error: error.message }
    }
    setLeads(prev => prev.filter(l => l.id !== id))
    return { error: null }
  }

  // ── CREATE ─────────────────────────────────────────────────────────────────
  const createLead = async (data) => {
    const row = {
      'ID': crypto.randomUUID(),
      ...mapToSupabase(data),
      'Timestamp': new Date().toISOString(),
    }
    const { data: inserted, error } = await supabase
      .from('leads')
      .insert([row])
      .select()
      .single()
    if (error) {
      console.error('[createLead]', error.message)
      return { error: error.message }
    }
    setLeads(prev => [mapLead(inserted), ...prev])
    return { error: null }
  }

  // newLeadsCount = nombre de leads non traités
  const newLeadsCount = leads.filter(l => l.statut === 'nouveau').length

  return {
    leads,
    loading,
    error,
    createLead,
    updateLead,
    deleteLead,
    newLeadsCount,
  }
}
