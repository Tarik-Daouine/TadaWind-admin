import type {SupabaseClient} from 'npm:@supabase/supabase-js@2.100.0'
import {parseWebsiteHtml} from './enrich.js'
import {fetchPublicHtml,sha256} from './http.ts'

export async function runEnrichment(client:SupabaseClient,prospectId:string,{fetchHtml=fetchPublicHtml,allowNoWebsite=false}={}){
  const prospectResult=await client.from('prospects').select('*').eq('id',prospectId).single()
  if(prospectResult.error)throw new Error('PROSPECT_NOT_FOUND')
  const prospect=prospectResult.data
  if(!prospect.website){
    // Prospect ajouté manuellement sans site : on analyse depuis les sources déjà présentes (note manuelle).
    if(!allowNoWebsite)throw new Error('NO_WEBSITE')
    const skipped=await client.rpc('prospector_enqueue_analysis',{p_id:prospectId})
    if(skipped.error)throw new Error(skipped.error.message)
    return {prospect:skipped.data,cached:false,url:null,signals:0,website:false}
  }
  const requested=new URL(prospect.website).href,now=new Date()
  const cached=await client.from('prospect_web_cache').select('final_url,content_hash,result,expires_at').eq('url',requested).gt('expires_at',now.toISOString()).maybeSingle()
  let result,finalUrl,contentHash
  if(cached.data){({result,final_url:finalUrl,content_hash:contentHash}=cached.data)}else{
    const fetched=await fetchHtml(requested);finalUrl=fetched.finalUrl;contentHash=await sha256(fetched.html)
    result=parseWebsiteHtml(fetched.html,{url:finalUrl,fetchedAt:now.toISOString()})
  }
  const stored=await client.rpc('prospector_store_enrichment',{p_id:prospectId,p_requested_url:requested,p_final_url:finalUrl,p_content_hash:contentHash,p_result:result,p_expires_at:new Date(now.getTime()+14*86400000).toISOString()})
  if(stored.error)throw new Error(stored.error.message)
  return {prospect:stored.data,cached:!!cached.data,url:finalUrl,signals:result.signals?.length??0,website:true}
}
