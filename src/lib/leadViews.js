const CLOSED_STATUSES = new Set(['Converti', 'Perdu'])

export const LEAD_QUICK_VIEWS = [
  { key: 'all',          label: 'Tous' },
  { key: 'new',          label: 'Nouveaux' },
  { key: 'follow_up',    label: 'Relance due' },
  { key: 'high_priority', label: 'Haute priorité' },
  { key: 'converted',    label: 'Convertis' },
  { key: 'no_next_step', label: 'Sans prochaine action' },
]

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

function hasOverdueFollowUp(lead, referenceDate = new Date()) {
  if (CLOSED_STATUSES.has(lead.statut)) return false
  if (!lead.dateRelance) return lead.statut === 'À relancer'
  const followUpDate = startOfDate(lead.dateRelance)
  if (!followUpDate) return false
  return followUpDate <= startOfToday(referenceDate)
}

export function matchesLeadQuickView(lead, quickView, referenceDate = new Date()) {
  switch (quickView) {
    case 'new':
      return lead.statut === 'nouveau'
    case 'new_stale':
      return lead.statut === 'nouveau' && new Date(lead.timestamp).getTime() < startOfToday(referenceDate).getTime() - (3 * 86400000)
    case 'follow_up':
      return hasOverdueFollowUp(lead, referenceDate)
    case 'overdue_follow_up':
      return hasOverdueFollowUp(lead, referenceDate)
    case 'high_priority':
      return lead.priorite === 'Haute' && !CLOSED_STATUSES.has(lead.statut)
    case 'converted':
      return lead.statut === 'Converti'
    case 'no_next_step':
      return !CLOSED_STATUSES.has(lead.statut) && !String(lead.nextStep || '').trim()
    case 'missing_probability':
      return !CLOSED_STATUSES.has(lead.statut) && !String(lead.probabilite || '').trim()
    case 'quote_no_follow_up':
      return !CLOSED_STATUSES.has(lead.statut) && !!lead.dateDevis && !lead.dateRelance
    case 'missing_amount':
      return !CLOSED_STATUSES.has(lead.statut) && !String(lead.montantDevis || '').trim()
    case 'missing_etab':
      return !CLOSED_STATUSES.has(lead.statut) && !String(lead.typeEtablissement || '').trim()
    case 'missing_source':
      return !String(lead.source || '').trim()
    case 'all':
    default:
      return true
  }
}

export function countLeadsForQuickView(leads, quickView, referenceDate = new Date()) {
  return leads.filter(lead => matchesLeadQuickView(lead, quickView, referenceDate)).length
}
