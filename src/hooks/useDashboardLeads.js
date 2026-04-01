import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase.js'

function mapRow(row) {
  return {
    statut:       row['Statut']            ?? 'nouveau',
    source:       row['Source']            ?? '',
    typeClient:   row['Type de client']    ?? '',
    priorite:     row['Priorite']          ?? 'Normale',
    probabilite:  row['Probabilite']       ?? '',
    timestamp:    row['Timestamp']         ?? '',
    dateRelance:  row['Date de relance']   ?? null,
    montantDevis: row['Montant devis estime'] ?? '',
    montantReel:  row['montant_reel']      ?? null,
    prenom:       row['Prenom']            ?? '',
    nom:          row['Nom']              ?? '',
    email:        row['Email']            ?? '',
  }
}

const CLOSED = ['Converti', 'Perdu']

const FUNNEL_STAGES = [
  { key: 'nouveau',            label: 'Nouveau' },
  { key: 'Prospect contacté',  label: 'Prospect contacté' },
  { key: 'Opportunité',        label: 'Opportunité' },
  { key: 'À relancer',         label: 'À relancer' },
  { key: 'Relancé',            label: 'Relancé' },
  { key: 'Converti',           label: 'Converti' },
  { key: 'Perdu',              label: 'Perdu' },
]

const SOURCE_MAP = {
  'tadawind_site': 'Site web',
  'Réseau':        'Réseau',
  'Autre':         'Autre',
}

export function useDashboardLeads() {
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('leads')
        .select('Statut, Source, "Type de client", Priorite, Probabilite, Timestamp, "Date de relance", "Montant devis estime", montant_reel, Prenom, Nom, Email')
        .order('Timestamp', { ascending: false })

      if (cancelled) return
      if (error) { setError(error.message); setLoading(false); return }
      setRows((data ?? []).map(mapRow))
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [])

  const stats = useMemo(() => {
    const total     = rows.length
    const nouveaux  = rows.filter(r => r.statut === 'nouveau').length
    const convertis = rows.filter(r => r.statut === 'Converti').length
    const perdus    = rows.filter(r => r.statut === 'Perdu').length
    const tauxConversion = total > 0 ? (convertis / total) * 100 : 0

    const funnel = FUNNEL_STAGES.map(s => {
      const count = rows.filter(r => r.statut === s.key).length
      return { ...s, count, pct: total > 0 ? (count / total) * 100 : 0 }
    })

    const sourceCounts = Object.keys(SOURCE_MAP).map(k => ({
      key:   k,
      label: SOURCE_MAP[k],
      count: rows.filter(r => r.source === k).length,
    }))
    const maxSource = Math.max(...sourceCounts.map(s => s.count), 1)
    const sources = sourceCounts.map(s => ({ ...s, pct: (s.count / maxSource) * 100 }))

    const typeKeys = ['Particulier', 'Professionnel']
    const typeCounts = typeKeys.map(k => ({
      key:   k,
      count: rows.filter(r => r.typeClient === k).length,
    }))
    const maxType = Math.max(...typeCounts.map(t => t.count), 1)
    const types = typeCounts.map(t => ({ ...t, pct: (t.count / maxType) * 100 }))

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const relances = rows.filter(r => {
      if (CLOSED.includes(r.statut)) return false
      if (!r.dateRelance) return false
      return new Date(r.dateRelance) < today
    })

    // ── Pipeline financier (conditionnel) ────────────────────────────────────
    // hasMontants = vrai dès qu'au moins un lead a un montant estimé renseigné
    const hasMontants = rows.some(r => r.montantDevis !== '' && r.montantDevis != null)

    // pipeline pondéré = Σ(montant_estime × probabilite/100) pour leads actifs
    const pipelinePondere = rows
      .filter(r => !CLOSED.includes(r.statut) && r.montantDevis)
      .reduce((sum, r) => {
        const montant = parseFloat(r.montantDevis) || 0
        const proba   = parseFloat(r.probabilite)  || 50  // 50% par défaut si vide
        return sum + montant * (proba / 100)
      }, 0)

    // chiffre d'affaires réel = somme des montants_reel des leads convertis
    const caReel = rows
      .filter(r => r.statut === 'Converti' && r.montantReel != null)
      .reduce((sum, r) => sum + (parseFloat(r.montantReel) || 0), 0)

    const finance = { hasMontants, pipelinePondere, caReel }

    return { total, nouveaux, convertis, perdus, tauxConversion, funnel, sources, types, relances, finance }
  }, [rows])

  return { loading, error, stats }
}
