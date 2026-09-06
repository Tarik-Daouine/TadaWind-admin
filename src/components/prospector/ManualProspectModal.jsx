import React, { useEffect, useState } from 'react'
import Modal from '../ui/Modal.jsx'
import Input from '../ui/Input.jsx'
import Button from '../ui/Button.jsx'

const empty={name:'',category:'',city:'',address:'',website:'',phone:'',email:'',instagram:'',description:''}
export default function ManualProspectModal({open,onClose,onCreate}) {
  const [form,setForm]=useState(empty),[saving,setSaving]=useState(false),[error,setError]=useState('')
  useEffect(()=>{if(open){setForm(empty);setError('')}},[open])
  const set=(key,value)=>setForm(previous=>({...previous,[key]:value}))
  const submit=async()=>{
    if(!form.name.trim()){setError('Le nom de l’entreprise est obligatoire.');return}
    setSaving(true);setError('')
    const input=Object.fromEntries(Object.entries(form).map(([key,value])=>[key,value.trim()]).filter(([,value])=>value))
    const result=await onCreate(input);setSaving(false)
    if(result.error)setError(result.error);else onClose(result.data)
  }
  return <Modal open={open} onClose={()=>!saving&&onClose()} title="Ajouter un prospect" size="lg" footer={<><Button onClick={()=>onClose()} disabled={saving}>Annuler</Button><Button variant="primary" onClick={submit} loading={saving}>Ajouter</Button></>}>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:'0 14px'}}><Input autoFocus label="Entreprise *" value={form.name} onChange={e=>set('name',e.target.value)}/><Input label="Catégorie" value={form.category} onChange={e=>set('category',e.target.value)} placeholder="hôtel, camping, immobilier…"/><Input label="Ville" value={form.city} onChange={e=>set('city',e.target.value)}/><Input label="Adresse" value={form.address} onChange={e=>set('address',e.target.value)}/><Input label="Site web" type="url" value={form.website} onChange={e=>set('website',e.target.value)} placeholder="https://…"/><Input label="Téléphone" type="tel" value={form.phone} onChange={e=>set('phone',e.target.value)}/><Input label="Email professionnel" type="email" value={form.email} onChange={e=>set('email',e.target.value)}/><Input label="Instagram" value={form.instagram} onChange={e=>set('instagram',e.target.value)}/></div>
    <Input label="Contexte manuel" multiline value={form.description} onChange={e=>set('description',e.target.value)} hint="Renseigne uniquement des faits vérifiables. Une source manuelle sera ajoutée lors de l’analyse."/>
    {error&&<div role="alert" style={{color:'#f38b8b',fontSize:12,lineHeight:1.5}}>{error}</div>}
  </Modal>
}
