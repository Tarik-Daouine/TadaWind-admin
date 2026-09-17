import type {SupabaseClient} from 'npm:@supabase/supabase-js@2.100.0'
import {Buffer} from 'node:buffer'
import {request as httpsRequest} from 'node:https'
import {buildOverpassQuery,parseOverpassResponse} from './discovery.js'
import {completeLocations} from './location.js'

const USER_AGENT=Deno.env.get('NOMINATIM_USER_AGENT')||'TadaWindProspector/1.0 (contact@tadawind.com)'
// Overpass refuse un rayon > ~200 km ; on borne la requête sans changer le rayon de campagne stocké.
const OVERPASS_MAX_RADIUS_KM=200
// Les instances publiques peuvent être temporairement saturées. La seconde URL
// vise directement l'autre serveur de l'instance principale ; la troisième est
// une instance mondiale indépendante répertoriée par OpenStreetMap.
const OVERPASS_ENDPOINTS=[
  // Le répartiteur principal dirige actuellement certaines requêtes françaises
  // vers l'instance lz4 saturée. Le serveur z répond à la même API et passe en
  // premier pour éviter de consommer tout le délai avant le repli.
  'https://z.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]

async function jsonRequest(url:string,init:RequestInit={}){
  const response=await fetch(url,{...init,headers:{accept:'application/json','user-agent':USER_AGENT,...init.headers},signal:AbortSignal.timeout(30000)})
  if(response.status===429)throw new Error('RATE_LIMITED')
  // Le code HTTP reste uniquement dans les journaux internes de la fonction :
  // le job conserve ensuite le code public DISCOVERY_SOURCE_ERROR.
  if(!response.ok)throw new Error(`DISCOVERY_SOURCE_HTTP_${response.status}`)
  const text=await response.text()
  if(new TextEncoder().encode(text).byteLength>1_000_000)throw new Error('RESPONSE_TOO_LARGE')
  try{return JSON.parse(text)}catch{throw new Error('INVALID_DISCOVERY_RESPONSE')}
}

async function geocode(address:string){
  const url=new URL('https://nominatim.openstreetmap.org/search')
  url.search=new URLSearchParams({q:address,format:'jsonv2',limit:'1',countrycodes:'fr'}).toString()
  const payload=await jsonRequest(url.href)
  const lat=Number(payload?.[0]?.lat),lng=Number(payload?.[0]?.lon)
  if(!Number.isFinite(lat)||!Number.isFinite(lng))throw new Error('REFERENCE_ADDRESS_NOT_FOUND')
  return {lat,lng}
}

// Le fetch Web de l'Edge Runtime remplace User-Agent par sa propre valeur.
// Overpass refuse cette valeur (HTTP 406). Le client Node écrit réellement
// l'identification exigée par le service public.
async function overpassJsonRequest(endpoint:string,query:string){
  const body=new URLSearchParams({data:query}).toString()
  return await new Promise<unknown>((resolve,reject)=>{
    const request=httpsRequest(endpoint,{
      method:'POST',
      headers:{
        accept:'application/json',
        'content-type':'application/x-www-form-urlencoded;charset=UTF-8',
        'content-length':Buffer.byteLength(body),
        'user-agent':USER_AGENT,
      },
    },response=>{
      const chunks:Buffer[]=[]
      let size=0
      response.on('data',(chunk:Buffer)=>{
        size+=chunk.length
        if(size>1_000_000){request.destroy(new Error('RESPONSE_TOO_LARGE'));return}
        chunks.push(chunk)
      })
      response.on('end',()=>{
        const status=response.statusCode??0
        if(status===429){reject(new Error('RATE_LIMITED'));return}
        if(status<200||status>=300){reject(new Error(`DISCOVERY_SOURCE_HTTP_${status}`));return}
        try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))}catch{reject(new Error('INVALID_DISCOVERY_RESPONSE'))}
      })
    })
    request.setTimeout(30000,()=>request.destroy(new Error('FETCH_TIMEOUT')))
    request.on('error',reject)
    request.end(body)
  })
}

async function requestOverpass(query:string){
  for(const [index,endpoint] of OVERPASS_ENDPOINTS.entries()){
    try{
      const payload=await overpassJsonRequest(endpoint,query)
      return {payload,endpoint}
    }catch(error){
      console.warn('OVERPASS_ENDPOINT_FAILED',JSON.stringify({endpoint,index,error:error instanceof Error?error.message:'UNKNOWN'}))
    }
  }
  throw new Error('DISCOVERY_SOURCE_ERROR')
}

export async function runDiscovery(client:SupabaseClient,campaignId:string){
  const [campaignResult,settingsResult]=await Promise.all([
    client.from('prospect_campaigns').select('*').eq('id',campaignId).single(),
    client.from('prospector_settings').select('*').eq('id','main').single(),
  ])
  if(campaignResult.error)throw new Error('CAMPAIGN_NOT_FOUND')
  if(settingsResult.error)throw new Error('SETTINGS_NOT_FOUND')
  const campaign=campaignResult.data,settings=settingsResult.data,filters=campaign.filters??{}
  const center=Number.isFinite(settings.reference_lat)&&Number.isFinite(settings.reference_lng)
    ?{lat:settings.reference_lat,lng:settings.reference_lng}:await geocode(settings.reference_address)
  const radiusKm=Number(filters.radius_km??settings.radius_preferred_km)
  const overpassRadiusKm=Math.min(OVERPASS_MAX_RADIUS_KM,Math.max(1,radiusKm))
  const query=buildOverpassQuery({lat:center.lat,lng:center.lng,radiusKm:overpassRadiusKm,categories:filters.categories})
  const {payload,endpoint}=await requestOverpass(query)
  const candidates=parseOverpassResponse(payload,{maxResults:50})
  const location=await completeLocations(candidates)
  if(location.missing)console.warn('DISCOVERY_LOCATION_INCOMPLETE',JSON.stringify({campaignId,...location}))
  const stored=await client.rpc('prospector_store_discovery',{p_campaign_id:campaignId,p_candidates:candidates,p_report:{found:candidates.length,center,radius_km:radiusKm,overpass_radius_km:overpassRadiusKm,source_endpoint:endpoint,location}})
  if(stored.error)throw new Error(stored.error.message)
  return stored.data
}
