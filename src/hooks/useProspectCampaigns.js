import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

export function useProspectCampaigns(page) {
  const [state,setState]=useState({campaigns:[],count:0,loading:true,error:null})
  const [revision,setRevision]=useState(0)
  useEffect(()=>{
    let live=true, timer
    setState(previous=>({...previous,loading:true,error:null}))
    async function fetchPage() {
      let nextDelay=30000
      try {
        const result=await supabase.from('prospect_campaigns')
          .select('id,name,status,filters,stats,created_at,prospect_jobs(id,type,status,error,updated_at)',{count:'exact'})
          .order('created_at',{ascending:false}).order('id').range((page-1)*15,page*15-1)
        if(result.error) throw result.error
        if(!live)return
        const campaigns=result.data??[]
        nextDelay=campaigns.some(c=>c.prospect_jobs?.some(j=>['queued','running'].includes(j.status)))?5000:30000
        setState({campaigns,count:result.count??campaigns.length,loading:false,error:null})
      } catch {
        if(live)setState(previous=>({...previous,loading:false,error:'Impossible de charger les campagnes. Réessaie dans quelques instants.'}))
      } finally { if(live)timer=setTimeout(fetchPage,nextDelay) }
    }
    fetchPage()
    return ()=>{live=false;clearTimeout(timer)}
  },[page,revision])
  return {...state,reload:()=>setRevision(value=>value+1)}
}
