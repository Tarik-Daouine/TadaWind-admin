export const OPPORTUNITY_STATUSES=['interested','meeting','quote']
export const FOLLOWUP_STATUSES=['contacted','followup_1','followup_2']
export function applyProspectorView(query,view,now=new Date().toISOString()) {
  if(view==='contacted')return query.not('last_contacted_at','is',null)
  if(view==='opportunities')return query.in('status',OPPORTUNITY_STATUSES).eq('is_client',false)
  if(view==='followups')return query.in('status',FOLLOWUP_STATUSES).eq('is_client',false).lte('next_followup_at',now)
  return query
}
