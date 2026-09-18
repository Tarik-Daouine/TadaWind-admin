import { describe, expect, it } from 'vitest'
import { prospectorJobError, prospectorJobLabel, prospectorJobState, prospectorJobSubject, summarizeProspectorJobs } from '../../../src/hooks/useProspectorJobs.js'

describe('suivi des jobs de prospection', () => {
  it('isole les traitements actifs et la dernière erreur', () => {
    const jobs=[
      {id:'1',type:'manual_analyze',status:'running'},
      {id:'2',type:'enrich',status:'queued'},
      {id:'3',type:'copywrite',status:'error',error:'FETCH_TIMEOUT'},
      {id:'4',type:'score',status:'done'},
    ]
    expect(summarizeProspectorJobs(jobs)).toEqual({active:jobs.slice(0,2),latestError:jobs[2]})
  })

  it('traduit les statuts sans exposer les codes techniques', () => {
    expect(prospectorJobLabel({type:'manual_analyze'})).toBe('Analyse du prospect')
    expect(prospectorJobError('UNSAFE_IP')).toContain('adresse réseau non publique')
    expect(prospectorJobError('UNKNOWN')).not.toContain('UNKNOWN')
  })

  it('identifie clairement le prospect et une nouvelle tentative', () => {
    const job={type:'enrich',status:'queued',attempts:1,prospect:{name:'Hôtel du Parc',city:'Thonac'}}
    expect(prospectorJobSubject(job)).toBe('Hôtel du Parc')
    expect(prospectorJobState(job)).toBe('Nouvelle tentative')
  })
})
