import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase.js'

const CLOSED = ['Converti', 'Perdu']
const ACTIVE_PIPELINE = ['nouveau', 'Prospect contacté', 'Opportunité', 'À relancer', 'Relancé']

export const DASHBOARD_PERIODS = [
  { key: '7d', label: '7j', days: 7 },
  { key: '30d', label: '30j', days: 30 },
  { key: '90d', label: '90j', days: 90 },
  { key: '365d', label: '12 mois', days: 365 },
  { key: 'all', label: 'Tout', days: null },
]

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
  'Autre':         'Terrain',
}

const ETAB_ENUM = ['camping', 'hotel', 'auberge', 'chateau', 'domaine', 'site_touristique', 'entreprise', 'particulier', 'autre']
const ETAB_LABELS_MAP = {
  camping: 'Camping',
  hotel: 'Hôtel',
  auberge: 'Auberge',
  chateau: 'Château',
  domaine: 'Domaine',
  site_touristique: 'Site touristique',
  entreprise: 'Entreprise',
  particulier: 'Particulier',
  autre: 'Autre',
}

function mapRow(row) {
  return {
    id:                row['ID']                     ?? '',
    statut:            row['Statut']                 ?? 'nouveau',
    source:            row['Source']                 ?? '',
    typeClient:        row['Type de client']         ?? '',
    typeEtablissement: row['type_etablissement']     ?? '',
    priorite:          row['Priorite']               ?? 'Normale',
    probabilite:       row['Probabilite']            ?? '',
    timestamp:         row['Timestamp']              ?? '',
    dateRelance:       row['Date de relance']        ?? null,
    dateDevis:         row['Date envoi devis']       ?? null,
    montantDevis:      row['Montant devis estime']   ?? '',
    montantReel:       row['montant_reel']           ?? null,
    nextStep:          row['Next step']              ?? '',
    prenom:            row['Prenom']                 ?? '',
    nom:               row['Nom']                    ?? '',
    email:             row['Email']                  ?? '',
    nomEntreprise:     row['Nom entreprise']         ?? '',
  }
}

function parseMoney(value) {
  if (value == null || value === '') return null
  const parsed = parseFloat(String(value).replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function startOfToday(referenceDate = new Date()) {
  const date = new Date(referenceDate)
  date.setHours(0, 0, 0, 0)
  return date
}

function startOfDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  date.setHours(0, 0, 0, 0)
  return date
}

function diffDays(from, to = new Date()) {
  if (!from) return null
  const start = new Date(from)
  if (Number.isNaN(start.getTime())) return null
  return Math.max(0, Math.floor((to.getTime() - start.getTime()) / 86400000))
}

function getPeriodConfig(periodKey) {
  return DASHBOARD_PERIODS.find(period => period.key === periodKey) || DASHBOARD_PERIODS[1]
}

function filterRowsForPeriod(rows, periodKey, referenceDate = new Date()) {
  const period = getPeriodConfig(periodKey)
  if (!period.days) return rows

  const since = new Date(referenceDate)
  since.setDate(since.getDate() - period.days)

  return rows.filter(row => {
    const ts = new Date(row.timestamp)
    return !Number.isNaN(ts.getTime()) && ts >= since && ts <= referenceDate
  })
}

function previousPeriodRows(rows, periodKey, referenceDate = new Date()) {
  const period = getPeriodConfig(periodKey)
  if (!period.days) return []

  const end = new Date(referenceDate)
  end.setDate(end.getDate() - period.days)

  const start = new Date(end)
  start.setDate(start.getDate() - period.days)

  return rows.filter(row => {
    const ts = new Date(row.timestamp)
    return !Number.isNaN(ts.getTime()) && ts >= start && ts < end
  })
}

function makeDelta(current, previous) {
  return {
    current,
    previous,
    delta: current - previous,
    pct: previous > 0 ? ((current - previous) / previous) * 100 : null,
  }
}

function computeCoreStats(rows) {
  const total = rows.length
  const nouveaux = rows.filter(row => row.statut === 'nouveau').length
  const convertis = rows.filter(row => row.statut === 'Converti').length
  const perdus = rows.filter(row => row.statut === 'Perdu').length
  const tauxConversion = total > 0 ? (convertis / total) * 100 : 0
  return { total, nouveaux, convertis, perdus, tauxConversion }
}

export function useDashboardLeads(periodKey = '30d') {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('leads')
        .select('ID, Statut, Source, "Type de client", type_etablissement, Priorite, Probabilite, Timestamp, "Date de relance", "Date envoi devis", "Montant devis estime", montant_reel, "Next step", Prenom, Nom, Email, "Nom entreprise"')
        .order('Timestamp', { ascending: false })

      if (cancelled) return
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      setRows((data ?? []).map(mapRow))
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [])

  const stats = useMemo(() => {
    const now = new Date()
    const period = getPeriodConfig(periodKey)
    const periodRows = filterRowsForPeriod(rows, periodKey, now)
    const previousRows = previousPeriodRows(rows, periodKey, now)
    const today = startOfToday(now)

    const current = computeCoreStats(periodRows)
    const previous = computeCoreStats(previousRows)

    const funnel = FUNNEL_STAGES.map(stage => {
      const count = periodRows.filter(row => row.statut === stage.key).length
      return { ...stage, count, pct: current.total > 0 ? (count / current.total) * 100 : 0 }
    })

    const sourceCounts = Object.keys(SOURCE_MAP).map(key => ({
      key,
      label: SOURCE_MAP[key],
      count: periodRows.filter(row => row.source === key).length,
    }))
    const maxSource = Math.max(...sourceCounts.map(source => source.count), 1)
    const sources = sourceCounts.map(source => ({ ...source, pct: (source.count / maxSource) * 100 }))

    const typeKeys = ['Particulier', 'Professionnel']
    const typeCounts = typeKeys.map(key => ({
      key,
      count: periodRows.filter(row => row.typeClient === key).length,
    }))
    const maxType = Math.max(...typeCounts.map(type => type.count), 1)
    const types = typeCounts.map(type => ({ ...type, pct: (type.count / maxType) * 100 }))

    const relances = rows.filter(row => {
      if (CLOSED.includes(row.statut)) return false
      if (!row.dateRelance) return false
      const followUpDate = startOfDate(row.dateRelance)
      if (!followUpDate) return false
      return followUpDate <= today
    })

    const activeRows = rows.filter(row => !CLOSED.includes(row.statut))
    const activePeriodRows = periodRows.filter(row => !CLOSED.includes(row.statut))
    const estimatedRows = activePeriodRows.filter(row => parseMoney(row.montantDevis) != null)
    const convertedRows = periodRows.filter(row => row.statut === 'Converti')
    const convertedWithRealAmount = convertedRows.filter(row => parseMoney(row.montantReel) != null)

    const hasMontants = periodRows.some(row => parseMoney(row.montantDevis) != null || parseMoney(row.montantReel) != null)
    const pipelinePondere = estimatedRows.reduce((sum, row) => {
      const montant = parseMoney(row.montantDevis) || 0
      const proba = parseFloat(row.probabilite) || 50
      return sum + montant * (proba / 100)
    }, 0)
    const caReel = convertedWithRealAmount.reduce((sum, row) => sum + (parseMoney(row.montantReel) || 0), 0)
    const montantTotalEstime = estimatedRows.reduce((sum, row) => sum + (parseMoney(row.montantDevis) || 0), 0)
    const ticketMoyenEstime = estimatedRows.length > 0 ? montantTotalEstime / estimatedRows.length : 0
    const ticketMoyenConverti = convertedWithRealAmount.length > 0 ? caReel / convertedWithRealAmount.length : 0
    const leadsSansMontantCount = activePeriodRows.filter(row => parseMoney(row.montantDevis) == null).length

    const finance = {
      hasMontants,
      pipelinePondere,
      caReel,
      montantTotalEstime,
      ticketMoyenEstime,
      ticketMoyenConverti,
      leadsSansMontantCount,
    }

    const parEtab = ETAB_ENUM
      .map(key => {
        const rowsForType = periodRows.filter(row => row.typeEtablissement === key)
        const count = rowsForType.length
        const convertis = rowsForType.filter(row => row.statut === 'Converti').length
        const taux = count > 0 ? Math.round((convertis / count) * 100) : 0
        return { key, label: ETAB_LABELS_MAP[key], count, convertis, taux }
      })
      .filter(entry => entry.count > 0)
      .sort((a, b) => b.count - a.count)

    const maxEtabCount = Math.max(...parEtab.map(entry => entry.count), 1)
    const parEtabWithPct = parEtab.map(entry => ({ ...entry, pct: (entry.count / maxEtabCount) * 100 }))

    const sourcePerformance = Object.keys(SOURCE_MAP)
      .map(key => {
        const rowsForSource = periodRows.filter(row => row.source === key)
        const total = rowsForSource.length
        const convertis = rowsForSource.filter(row => row.statut === 'Converti').length
        const pipeline = rowsForSource
          .filter(row => !CLOSED.includes(row.statut) && parseMoney(row.montantDevis) != null)
          .reduce((sum, row) => sum + ((parseMoney(row.montantDevis) || 0) * ((parseFloat(row.probabilite) || 50) / 100)), 0)
        const ca = rowsForSource
          .filter(row => row.statut === 'Converti' && parseMoney(row.montantReel) != null)
          .reduce((sum, row) => sum + (parseMoney(row.montantReel) || 0), 0)

        return {
          key,
          label: SOURCE_MAP[key],
          count: total,
          convertis,
          taux: total > 0 ? (convertis / total) * 100 : 0,
          pipeline,
          ca,
        }
      })
      .sort((a, b) => b.count - a.count)

    const actionItems = [
      {
        key: 'overdue_follow_up',
        label: 'Relances en retard',
        count: relances.length,
        tone: 'var(--red)',
        quickView: 'follow_up',
      },
      {
        key: 'new_stale',
        label: 'Nouveaux > 3 jours',
        count: rows.filter(row => row.statut === 'nouveau' && (diffDays(row.timestamp, now) ?? 0) >= 3).length,
        tone: 'var(--amber)',
        quickView: 'new_stale',
      },
      {
        key: 'missing_next_step',
        label: 'Sans prochaine action',
        count: activeRows.filter(row => !String(row.nextStep || '').trim()).length,
        tone: 'var(--blue)',
        quickView: 'no_next_step',
      },
      {
        key: 'missing_probability',
        label: 'Opportunités sans probabilité',
        count: activeRows.filter(row => ['Opportunité', 'Prospect contacté', 'Relancé', 'À relancer'].includes(row.statut) && !String(row.probabilite || '').trim()).length,
        tone: 'var(--amber)',
        quickView: 'missing_probability',
      },
      {
        key: 'quote_no_follow_up',
        label: 'Devis sans relance',
        count: activeRows.filter(row => row.dateDevis && !row.dateRelance).length,
        tone: 'var(--muted)',
        quickView: 'quote_no_follow_up',
      },
    ].filter(item => item.count > 0)

    const quality = [
      {
        key: 'missing_probability',
        label: 'Sans probabilité',
        count: activeRows.filter(row => !String(row.probabilite || '').trim()).length,
        tone: 'var(--amber)',
        quickView: 'missing_probability',
      },
      {
        key: 'missing_next_step',
        label: 'Sans prochaine action',
        count: activeRows.filter(row => !String(row.nextStep || '').trim()).length,
        tone: 'var(--blue)',
        quickView: 'no_next_step',
      },
      {
        key: 'missing_amount',
        label: 'Sans montant estimé',
        count: activeRows.filter(row => parseMoney(row.montantDevis) == null).length,
        tone: 'var(--muted)',
        quickView: 'missing_amount',
      },
      {
        key: 'missing_etab',
        label: 'Sans type d’établissement',
        count: activeRows.filter(row => !String(row.typeEtablissement || '').trim()).length,
        tone: 'var(--muted)',
        quickView: 'missing_etab',
      },
      {
        key: 'missing_source',
        label: 'Sans source claire',
        count: rows.filter(row => !String(row.source || '').trim()).length,
        tone: 'var(--muted)',
        quickView: 'missing_source',
      },
    ]

    const ages = activeRows
      .map(row => diffDays(row.timestamp, now))
      .filter(value => value != null)

    const pipelineHealth = {
      averageActiveAgeDays: ages.length > 0 ? Math.round(ages.reduce((sum, value) => sum + value, 0) / ages.length) : 0,
      staleOpportunitiesCount: activeRows.filter(row => ['Opportunité', 'Prospect contacté'].includes(row.statut) && (diffDays(row.timestamp, now) ?? 0) >= 14).length,
      staleRelancesCount: activeRows.filter(row => ['À relancer', 'Relancé'].includes(row.statut) && (diffDays(row.timestamp, now) ?? 0) >= 14).length,
    }

    return {
      period,
      totalAllTime: rows.length,
      total: current.total,
      nouveaux: current.nouveaux,
      convertis: current.convertis,
      perdus: current.perdus,
      tauxConversion: current.tauxConversion,
      comparisons: {
        total: makeDelta(current.total, previous.total),
        nouveaux: makeDelta(current.nouveaux, previous.nouveaux),
        convertis: makeDelta(current.convertis, previous.convertis),
        caReel: makeDelta(caReel, previousRows
          .filter(row => row.statut === 'Converti' && parseMoney(row.montantReel) != null)
          .reduce((sum, row) => sum + (parseMoney(row.montantReel) || 0), 0)),
      },
      funnel,
      sources,
      sourcePerformance,
      types,
      relances,
      actionItems,
      quality,
      finance,
      parEtab: parEtabWithPct,
      pipelineHealth,
    }
  }, [periodKey, rows])

  return { loading, error, stats }
}
