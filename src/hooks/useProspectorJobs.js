import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'

export const ACTIVE_JOB_STATUSES = new Set(['queued', 'running'])

export function summarizeProspectorJobs(jobs = []) {
  const active = jobs.filter(job => ACTIVE_JOB_STATUSES.has(job.status))
  const latestError = jobs.find(job => job.status === 'error') ?? null
  return { active, latestError }
}

export function prospectorJobLabel(job) {
  const actions = {
    manual_analyze: 'Analyse du prospect', enrich: 'Collecte du site', analyze: 'Analyse des sources',
    score: 'Calcul du score', strategize: 'Préparation de la stratégie', copywrite: 'Rédaction des brouillons',
    discovery: 'Recherche de prospects', crm_next: 'Mise à jour CRM',
  }
  return actions[job?.type] ?? 'Traitement de prospection'
}

export function prospectorJobError(error) {
  const labels = {
    LLM_NOT_CONFIGURED: 'La clé ou le modèle IA reste à configurer.',
    BUDGET_FX_NOT_CONFIGURED: 'Le taux de conversion du budget reste à configurer.',
    MONTHLY_BUDGET_EXCEEDED: 'Le plafond mensuel IA est atteint.',
    MODEL_PRICING_NOT_CONFIGURED: 'Le tarif de ce modèle doit être vérifié avant utilisation.',
    NO_WEBSITE: 'Aucun site web n’est renseigné.', PROSPECT_NOT_FOUND: 'Le prospect n’existe plus.',
    UNSAFE_URL: 'L’adresse du site est bloquée pour des raisons de sécurité.',
    UNSAFE_HOST: 'Le domaine du site est bloqué pour des raisons de sécurité.',
    UNSAFE_IP: 'Le site pointe vers une adresse réseau non publique.',
    UNSUPPORTED_CONTENT_TYPE: 'Le site ne renvoie pas une page HTML exploitable.',
    RESPONSE_TOO_LARGE: 'La page du site dépasse la taille autorisée.',
    FETCH_TIMEOUT: 'Le site a mis trop de temps à répondre.', RATE_LIMITED: 'Le site limite temporairement les requêtes.',
    JOB_TYPE_NOT_IMPLEMENTED: 'Ce type de traitement n’est pas encore disponible.',
  }
  return labels[error] ?? 'Le dernier traitement a échoué. Tu peux vérifier la fiche puis relancer.'
}

export function useProspectorJobs() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const timer = useRef(null)
  const live = useRef(true)

  const reload = useCallback(async () => {
    const result = await supabase.from('prospect_jobs')
      .select('id,type,status,error,attempts,max_attempts,prospect_id,created_at,updated_at,run_after')
      .order('updated_at', { ascending: false }).limit(25)
    if (!live.current) return
    if (result.error) setError('Impossible de suivre les traitements en cours.')
    else { setJobs(result.data ?? []); setError(null) }
    setLoading(false)
  }, [])

  useEffect(() => {
    live.current = true
    reload()
    const onCreated = () => reload()
    window.addEventListener('prospector:job-created', onCreated)
    return () => { live.current = false; clearTimeout(timer.current); window.removeEventListener('prospector:job-created', onCreated) }
  }, [reload])

  const { active, latestError } = summarizeProspectorJobs(jobs)
  useEffect(() => {
    clearTimeout(timer.current)
    timer.current = setTimeout(reload, active.length ? 5000 : 30000)
    return () => clearTimeout(timer.current)
  }, [active.length, jobs, reload])

  return { jobs, active, latestError, loading, error, reload }
}
