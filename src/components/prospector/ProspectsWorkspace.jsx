import React,{useState} from 'react'
import { useProspects } from '../../hooks/useProspects.js'
import { useIsMobile } from '../../hooks/useIsMobile.js'
import ProspectsTable from './ProspectsTable.jsx'
import ProspectDetail from './ProspectDetail.jsx'
import ManualProspectModal from './ManualProspectModal.jsx'

export default function ProspectsWorkspace({onToast}) {
  const data=useProspects(),mobile=useIsMobile(),[selectedId,setSelectedId]=useState(null),[adding,setAdding]=useState(false)
  const selected=data.prospects.find(item=>item.id===selectedId)
  return <div style={{height:'100%',display:'flex',overflow:'hidden'}}>
    {(!mobile||!selected)&&<div style={{width:!mobile&&selected?'min(540px,47vw)':'100%',flexShrink:0,borderRight:!mobile&&selected?'1px solid var(--border)':'none',overflow:'hidden'}}><ProspectsTable {...data} selectedId={selectedId} onSelect={setSelectedId} onAdd={()=>setAdding(true)}/></div>}
    {selected&&<div style={{flex:1,minWidth:0,overflow:'hidden'}}><ProspectDetail prospect={selected} onUpdate={data.update} onRequestAnalysis={data.requestAnalysis} onClose={()=>setSelectedId(null)} onToast={onToast}/></div>}
    <ManualProspectModal open={adding} onCreate={data.create} onClose={created=>{setAdding(false);if(created){setSelectedId(created.id);onToast?.('Prospect ajouté','success')}}}/>
  </div>
}
