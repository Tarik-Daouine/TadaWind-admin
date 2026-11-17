import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'

const ACTIVE = new Set(['queued','running'])

export function useCampaignProgress(initialCampaign) {
  const [state,setState]=useState({campaign:initialCampaign,prospects:[],jobs:[],loading:true,refreshing:false,error:null})
  const live=useRef(true),timer=useRef(null),generation=useRef(0),lastKick=useRef(0)
  const campaignId=initialCampaign?.id

  const reload=useCallback(async({quiet=false}={})=>{
    if(!campaignId)return
    const current=++generation.current
    setState(previous=>({...previous,[quiet?'refreshing':'loading']:true,error:null}))
    try{
      const [campaignResult,prospectsResult]=await Promise.all([
        supabase.from('prospect_campaigns').select('id,name,status,filters,stats,created_at,updated_at').eq('id',campaignId).single(),
        supabase.from('prospects').select('id,name,city,category,distance_km,website,status,score,priority,created_at,updated_at').eq('campaign_id',campaignId).is('deleted_at',null).order('created_at',{ascending:true}),
      ])
      if(campaignResult.error)throw campaignResult.error
      if(prospectsResult.error)throw prospectsResult.error
      const prospects=prospectsResult.data??[], ids=prospects.map(item=>item.id)
      let jobsQuery=supabase.from('prospect_jobs').select('id,type,status,error,attempts,max_attempts,prospect_id,campaign_id,created_at,updated_at,run_after').order('updated_at',{ascending:false}).limit(300)
      jobsQuery=ids.length?jobsQuery.or(`campaign_id.eq.${campaignId},prospect_id.in.(${ids.join(',')})`):jobsQuery.eq('campaign_id',campaignId)
      const jobsResult=await jobsQuery
      if(jobsResult.error)throw jobsResult.error
      if(!live.current||current!==generation.current)return
      setState({campaign:campaignResult.data,prospects,jobs:jobsResult.data??[],loading:false,refreshing:false,error:null})
    }catch{
      if(live.current&&current===generation.current)setState(previous=>({...previous,loading:false,refreshing:false,error:'Impossible d’actualiser cette recherche pour le moment.'}))
    }
  },[campaignId])

  useEffect(()=>{
    live.current=true
    reload()
    return()=>{live.current=false;generation.current++;clearTimeout(timer.current)}
  },[reload])

  const active=useMemo(()=>state.jobs.filter(job=>ACTIVE.has(job.status)),[state.jobs])
  useEffect(()=>{
    clearTimeout(timer.current)
    timer.current=setTimeout(()=>reload({quiet:true}),active.length?3000:15000)
    return()=>clearTimeout(timer.current)
  },[active.length,state.campaign?.updated_at,reload])

  useEffect(()=>{
    const runnable=active.some(job=>job.status==='queued'&&(!job.run_after||new Date(job.run_after)<=new Date()))
    const running=active.some(job=>job.status==='running')
    if(!runnable||running||Date.now()-lastKick.current<15000)return
    lastKick.current=Date.now()
    void supabase.functions.invoke('prospector-dispatch',{body:{campaign_id:campaignId}})
  },[active,campaignId])

  return {...state,active,reload}
}
