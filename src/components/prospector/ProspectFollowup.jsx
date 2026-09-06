import React,{useRef,useState} from 'react'
import {supabase} from '../../lib/supabase.js'
import {prospectorReviewError} from '../../hooks/useProspectorValidation.js'
import {SectionCard,SectionTitle} from '../ui/SectionCard.jsx'
import Button from '../ui/Button.jsx'
import Input from '../ui/Input.jsx'

export default function ProspectFollowup({prospect,onUpdate,onReload,onToast}) {
  const [status,setStatus]=useState('replied'),[note,setNote]=useState(''),[action,setAction]=useState(prospect.next_action??''),[date,setDate]=useState(''),[error,setError]=useState(null),[busy,setBusy]=useState(false)
  const lock=useRef(false)
  const active=!prospect.is_client&&!['lost','archived','excluded','won'].includes(prospect.status)
  async function run(callback) {
    if(lock.current)return
    lock.current=true;setBusy(true);setError(null)
    try {
      const result=await callback()
      if(result.error)throw result.error
      onToast?.('Suivi commercial enregistré','success')
      await onReload()
    } catch(e){setError(typeof e==='string'?e: e.message?.includes('CONTACT_REQUIRED')?'Confirme d’abord le premier contact dans la file de validation.':prospectorReviewError(e))}
    finally{lock.current=false;setBusy(false)}
  }
  return <SectionCard><SectionTitle>Suivi commercial</SectionTitle>
    <p style={{fontSize:12,color:'var(--muted)',marginBottom:14}}>{prospect.next_followup_at?'Relance prévue : '+new Date(prospect.next_followup_at).toLocaleString('fr-FR'):'Aucune relance planifiée.'}</p>
    {error&&<p role="alert" style={{color:'var(--red)'}}>{error}</p>}
    {active&&<>
      <Input label="Prochaine action commerciale" value={action} onChange={e=>setAction(e.target.value)}/>
      <Input label="Échéance du suivi" type="datetime-local" value={date} onChange={e=>setDate(e.target.value)}/>
      <Button loading={busy} disabled={!date||!action.trim()} onClick={()=>run(()=>onUpdate(prospect,{next_action:action.trim(),next_action_at:new Date(date).toISOString(),next_followup_at:new Date(date).toISOString()}))}>Planifier le suivi</Button>
      {prospect.last_contacted_at&&<form onSubmit={e=>{e.preventDefault();run(()=>supabase.rpc('prospector_record_outcome',{p_id:prospect.id,p_expected_updated_at:prospect.updated_at,p_status:status,p_note:note}))}} style={{marginTop:18}}>
        <label style={{fontSize:12,display:'block',marginBottom:12}}>Résultat de l’échange
          <select aria-label="Résultat de l’échange" value={status} onChange={e=>setStatus(e.target.value)} style={{display:'block',padding:8,marginTop:6,background:'var(--s3)',color:'var(--text)',border:'1px solid var(--border)'}}>
            {Object.entries({replied:'Réponse reçue',interested:'Intéressé',meeting:'Rendez-vous',quote:'Devis',won:'Gagné',lost:'Perdu'}).map(([value,label])=><option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <Input label="Compte rendu de l’échange" multiline required maxLength={4000} value={note} onChange={e=>setNote(e.target.value)}/>
        <Button type="submit" loading={busy} disabled={!note.trim()}>Enregistrer l’échange</Button>
      </form>}
    </>}
  </SectionCard>
}
