import React,{useEffect,useMemo,useState} from 'react'
import Button from '../ui/Button.jsx'
import Badge from '../ui/Badge.jsx'

const PAGE_SIZE=15
const statusLabel={new:'Nouveau',to_analyze:'À analyser',qualified:'Qualifié',to_validate:'À valider',ready_to_contact:'Prêt à contacter',contacted:'Contacté',followup_1:'Relance 1',followup_2:'Relance 2',replied:'Réponse',interested:'Intéressé',meeting:'Rendez-vous',quote:'Devis',won:'Gagné',lost:'Perdu',archived:'Archivé',excluded:'Exclu',low_priority:'Priorité faible'}
const priority={hot:['Très chaud','var(--red)','var(--red-dim)'],good:['Bon','var(--green)','var(--green-dim)'],consider:['À considérer','var(--amber)','var(--amber-dim)'],low:['Faible','var(--gray)','var(--gray-dim)'],excluded:['Exclu','var(--red)','var(--red-dim)']}
const control={background:'var(--s3)',border:'1px solid var(--border-md)',borderRadius:'var(--radius)',color:'var(--text)',fontFamily:'var(--sans)',fontSize:12,padding:'7px 10px',outline:'none'}

export default function ProspectsTable({prospects,selectedId,onSelect,onAdd,loading,error}) {
  const [search,setSearch]=useState(''),[status,setStatus]=useState(''),[level,setLevel]=useState(''),[sort,setSort]=useState('score'),[page,setPage]=useState(1)
  const filtered=useMemo(()=>prospects.filter(p=>{
    const haystack=[p.name,p.category,p.city,p.website_domain,p.email].filter(Boolean).join(' ').toLowerCase()
    return (!search||haystack.includes(search.toLowerCase()))&&(!status||p.status===status)&&(!level||p.priority===level)
  }).sort((a,b)=>sort==='name'?(a.name??'').localeCompare(b.name??'','fr'):sort==='recent'?new Date(b.created_at)-new Date(a.created_at):(b.score??-1)-(a.score??-1)),[prospects,search,status,level,sort])
  const pages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE)); useEffect(()=>setPage(1),[search,status,level,sort]); useEffect(()=>{if(page>pages)setPage(pages)},[page,pages])
  const rows=filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE)
  return <div style={{height:'100%',display:'flex',flexDirection:'column',minWidth:0}}>
    <div style={{padding:'16px 18px',borderBottom:'1px solid var(--border)',display:'flex',gap:9,flexWrap:'wrap',alignItems:'center'}}>
      <input aria-label="Rechercher un prospect" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nom, ville, domaine…" style={{...control,minWidth:190,flex:1}}/>
      <select aria-label="Filtrer par statut" value={status} onChange={e=>setStatus(e.target.value)} style={control}><option value="">Tous les statuts</option>{Object.entries(statusLabel).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
      <select aria-label="Filtrer par priorité" value={level} onChange={e=>setLevel(e.target.value)} style={control}><option value="">Toutes priorités</option>{Object.entries(priority).map(([value,item])=><option key={value} value={value}>{item[0]}</option>)}</select>
      <select aria-label="Trier les prospects" value={sort} onChange={e=>setSort(e.target.value)} style={control}><option value="score">Score décroissant</option><option value="recent">Plus récents</option><option value="name">Nom</option></select>
      {onAdd&&<Button variant="primary" size="sm" onClick={onAdd}>Ajouter</Button>}
    </div>
    {error&&<div role="alert" style={{padding:'10px 18px',fontSize:12,color:'#f38b8b',background:'var(--red-dim)'}}>{error}</div>}
    <div style={{flex:1,overflow:'auto'}}>{loading?<Empty label="Chargement des prospects…"/>:!rows.length?<Empty label={prospects.length?'Aucun résultat pour ces filtres.':'Aucun prospect enregistré.'}/>:<table style={{width:'100%',borderCollapse:'collapse',fontSize:12,minWidth:760}}><thead><tr>{['Score','Entreprise','Activité','Ville','Distance','Statut','Prochaine action'].map(label=><th key={label} style={{position:'sticky',top:0,zIndex:1,textAlign:'left',padding:'9px 12px',background:'var(--s2)',borderBottom:'1px solid var(--border)',color:'var(--muted2)',fontSize:10,textTransform:'uppercase',letterSpacing:'.07em'}}>{label}</th>)}</tr></thead><tbody>{rows.map(p=>{
      const tone=priority[p.priority];return <tr key={p.id} onClick={()=>onSelect(p.id)} style={{cursor:'pointer',background:p.id===selectedId?'var(--red-dim)':'transparent',borderBottom:'1px solid var(--border)'}}>
        <td style={cell}>{p.score==null?<span style={{color:'var(--muted2)'}}>—</span>:<strong>{p.score}/100</strong>}</td><td style={cell}><div style={{fontWeight:600,color:'var(--text)'}}>{p.name}</div><div style={{fontSize:10,color:'var(--muted2)',marginTop:2}}>{p.website_domain||p.email||''}</div>{tone&&<div style={{marginTop:5}}><Badge variant="custom" small label={tone[0]} color={tone[1]} bg={tone[2]}/></div>}</td>
        <td style={cell}>{p.category||'—'}</td><td style={cell}>{p.city||'—'}</td><td style={cell}>{p.distance_km==null?'—':`${p.distance_km} km`}</td><td style={cell}>{statusLabel[p.status]||p.status}</td><td style={{...cell,maxWidth:180}}>{p.next_action||'—'}</td></tr>})}</tbody></table>}</div>
    <div style={{padding:'10px 16px',borderTop:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:11,color:'var(--muted)'}}><span>{filtered.length} prospect{filtered.length>1?'s':''}</span><div style={{display:'flex',alignItems:'center',gap:8}}><Button size="sm" onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}>Précédent</Button><span>{page}/{pages}</span><Button size="sm" onClick={()=>setPage(p=>Math.min(pages,p+1))} disabled={page===pages}>Suivant</Button></div></div>
  </div>
}
const cell={padding:'10px 12px',color:'var(--muted)',verticalAlign:'middle'}
function Empty({label}){return <div style={{height:'100%',minHeight:180,display:'grid',placeItems:'center',color:'var(--muted)',fontSize:13}}>{label}</div>}
