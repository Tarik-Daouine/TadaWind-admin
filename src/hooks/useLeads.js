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
// Priorité                text  'Haute' | 'Normale' | 'Basse'
// Niveau d'intérêt        text  'Fort' | 'Moyen' | 'Faible'
// Probabilité             text  (% en texte, ex: '80')
// Next step               text
// Date de relance         timestamptz
// Date d'envoi devis      timestamptz
// Montant devis estimé (€) text
// Commentaires internes   text
// Timestamp               text
// ─────────────────────────────────────────────────────────────────────────────

// ── MAPPER Supabase → UI ──────────────────────────────────────────────────────
function mapLead(row) {
  return {
    id:            row['ID']                        ?? '',
    prenom:        row['Prénom']                    ?? '',
    nom:           row['Nom']                       ?? '',
    email:         row['Email']                     ?? '',
    telephone:     row['Téléphone']                 ?? '',
    nomEntreprise: row['Nom entreprise']            ?? '',
    typeClient:    row['Type de client']            ?? '',
    prestataire:   row['Prestataire existant ?']    ?? false,
    ville:         row['Ville / Lieu mission']      ?? '',
    dateMission:   row['Date souhaitée mission']    ?? null,
    typeBesoin:    row['Type de besoin']            ?? '',
    message:       row['Message client']            ?? '',
    source:        row['Source']                    ?? '',
    statut:        row['Statut']                    ?? 'nouveau',
    priorite:      row['Priorité']                  ?? 'Normale',
    niveauInteret: row["Niveau d\u2019int\u00e9r\u00eat"]          ?? '',
    probabilite:   row['Probabilité']               ?? '',
    nextStep:      row['Next step']                 ?? '',
    dateRelance:   row['Date de relance']           ?? null,
    dateDevis:     row["Date d\u2019envoi devis"]        ?? null,
    montantDevis:  row['Montant devis estimé (€)']  ?? '',
    commentaires:  row['Commentaires internes']     ?? '',
    timestamp:     row['Timestamp']                 ?? '',
  }
}

// ── MAPPER UI → Supabase ──────────────────────────────────────────────────────
// Ne met à jour que les champs CRM (pas les coordonnées saisies à la source)
function mapToSupabase(data) {
  const out = {}
  const mapping = {
    statut:        'Statut',
    priorite:      'Priorité',
    niveauInteret: "Niveau d\u2019int\u00e9r\u00eat",
    probabilite:   'Probabilité',
    nextStep:      'Next step',
    dateRelance:   'Date de relance',
    dateDevis:     "Date d\u2019envoi devis",
    montantDevis:  'Montant devis estimé (€)',
    commentaires:  'Commentaires internes',
    // Coordonnées également éditables
    prenom:        'Prénom',
    nom:           'Nom',
    email:         'Email',
    telephone:     'Téléphone',
    nomEntreprise: 'Nom entreprise',
    typeClient:    'Type de client',
    prestataire:   'Prestataire existant ?',
    ville:         'Ville / Lieu mission',
    dateMission:   'Date souhaitée mission',
    typeBesoin:    'Type de besoin',
    message:       'Message client',
    source:        'Source',
  }
  for (const [uiKey, dbKey] of Object.entries(mapping)) {
    const val = data[uiKey]
    // Skip null et '' : PostgREST n'a pas besoin de valider le nom de colonne
    // pour un champ absent du payload (contourne les bugs de schema cache sur les
    // noms avec apostrophes/accents comme "Niveau d'intérêt", "Date d'envoi devis")
    if (val !== undefined && val !== null && val !== '') {
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
