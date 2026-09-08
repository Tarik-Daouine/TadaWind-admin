// Prépare uniquement des brouillons sourcés. Aucun envoi, aucune approbation.
// Deno : --allow-env --allow-read --allow-write --allow-net --config supabase/functions/prospector-worker/deno.json
import {writeFileSync} from 'node:fs'
import {management} from './prospector-db.mjs'
import {validateMessage} from '../supabase/functions/_shared/prospector/schemas.js'
const pilots = [
  ['02e2a1e3-77fa-431b-8c12-859545d99d02','Une vidéo courte pour présenter vos chambres','Les 3 Suites et 6 chambres sont décorées et personnalisées de manière unique','Je vous propose un film court construit comme une visite : quelques détails de décoration, une chambre puis une ouverture sur les extérieurs. L’idée serait de vous livrer un format pour le site et une version verticale pour les réseaux sociaux.','contact@lepetitmanoir-hotel.com'],
  ['f1959197-b8ca-4526-9c35-efc4585dada3','Une idée de vidéo autour de votre ferme','au sein d’un domaine de 80 hectares dont les deux tiers sont boisés','Je vous propose une courte vidéo autour de l’expérience à la ferme : le cadre, les gestes en cuisine et l’accueil. Des vues aériennes pourraient compléter ce récit si le lieu s’y prête.','contact@lesgenestes.com'],
  ['1e2023b0-cd1c-4be2-905d-f784d4f3d5e8','Une vidéo pour présenter votre cadre','à 1km, un agréable parc arboré de 2ha avec son étang de pêche','Je vous propose une vidéo courte qui relierait la visite de l’hôtel à celle du parc, en indiquant clairement la distance entre les deux. Elle pourrait servir sur votre site et être déclinée en format vertical.','contact@hotel-archambeau.com'],
  ['07a5182c-64a5-436f-87db-78e36e61263e','Une idée de vidéo au fil de l’eau','Niché dans un ancien moulin en pierre au bord de la rivière','Je vous propose une vidéo courte autour du moulin et de la rivière, avec un rythme calme et le son de l’eau. L’idée serait de présenter une ambiance de séjour, dans un format pour votre site et vos réseaux sociaux.','info@moulindelabeune.com'],
  ['a5c2b28b-5de6-4d00-9f28-fa2bf84d3d0f','Une vidéo courte pour votre communication','Au coeur du Périgord noir, entre Lascaux et les Eyzies, avec un accès direct à la Vézère','Je vous propose une vidéo courte qui ferait découvrir le lieu puis l’accès à la rivière. Nous pourrions en tirer un format pour votre site et une version verticale pour vos réseaux sociaux.','thonachotel@wanadoo.fr'],
]
const sql = value => "'" + String(value).replaceAll("'", "''") + "'"
const query = async q => management('database/query',{query:q,read_only:true})
const results=[]
for(const [id,subject,quote,proposal,email] of pilots){
  const [prospect]=await query(`select id,name,website,city,email,contact_email,status from public.prospects where id=${sql(id)}`)
  const [previous]=await query(`select * from public.prospect_messages where prospect_id=${sql(id)} and channel='email' and kind='first_touch'`)
  if(!previous || previous.status!=='draft' || previous.revision!==1 || previous.send_lock_at)throw new Error('PILOT_MESSAGE_PROTECTED')
  const sources=(await query(`select id,prospect_id,type,url,fetched_at,content_excerpt,extracted,confidence from public.prospect_sources where prospect_id=${sql(id)}`)).map(s=>({...s,confidence:Number(s.confidence),fetched_at:new Date(s.fetched_at).toISOString()}))
  const proof=previous.sources_used.find(s=>sources.some(full=>full.id===s.source_id&&full.content_excerpt.includes(quote)))
  if(!proof)throw new Error('PILOT_PROOF_MISSING')
  const website=prospect.website.replace(/^http:/,'https:')
  const fetched=await fetch(website,{signal:AbortSignal.timeout(20000)})
  const html=await fetched.text()
  if(!fetched.ok||!html.toLowerCase().includes(email.toLowerCase()))throw new Error('PILOT_EMAIL_NOT_VERIFIED')
  const intro='Bonjour,\n\nSur votre site, vous indiquez : « '
  const close=' ».\n\n'
  const cta='\n\nSouhaitez-vous que je vous envoie une proposition de déroulé en quelques lignes ? Si vous n’êtes pas la bonne personne, à qui puis-je m’adresser ?\n\nSi vous ne souhaitez pas être recontacté, dites-le-moi simplement en réponse.\n\nTada Wind'
  const body=intro+quote+close+proposal+cta
  const segment=(path,text,kind='generic',source_ids=[])=>({path,text,kind,source_ids})
  const output=validateMessage({variants:{email:{subject,body}},grounding:[segment('email.subject',subject),segment('email.body',intro),segment('email.body',quote,'fact',[proof.source_id]),segment('email.body',close),segment('email.body',proposal,'proposal'),segment('email.body',cta)],sources_used:[{...proof,claim:quote,evidence_quote:quote}],confidence:Number(previous.variables.confidence??0.7),tone_check:{generic:false,fake_compliment:false,corporate:false}},{channel:'email',sources,prospectId:id})
  if(process.argv.includes('--apply')){
    await management('database/query',{query:`begin;
      select set_config('request.jwt.claims','{"role":"service_role"}',true);set local role service_role;
      select public.prospector_store_messages(${sql(id)},${sql(JSON.stringify(output))}::jsonb);
      update public.prospects set email=${sql(email)} where id=${sql(id)} and contact_email is null;
      insert into public.prospect_sources(prospect_id,type,url,content_excerpt,extracted,confidence) values(${sql(id)},'website_page',${sql(fetched.url)},${sql('Adresse de contact publiée sur le site : '+email)},${sql(JSON.stringify({review:'pilot_contact_verification',email,fetched_at:new Date().toISOString()}))}::jsonb,0.95);
      commit;`})
  }
  results.push({id,name:prospect.name,city:prospect.city,email,subject,body,source:proof.url,quote,proposal,followup:'Bonjour, je reviens vers vous au sujet de mon idée de vidéo. Souhaitez-vous que je vous envoie un court déroulé ? Si ce n’est pas un sujet pour vous, dites-le-moi et je ne vous relancerai pas.\n\nTada Wind'})
}
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')
const cards=results.map((p,i)=>`<article><h2>${i+1}. ${escape(p.name)}</h2><p>${escape(p.city)} · <a href="mailto:${escape(p.email)}">${escape(p.email)}</a></p><h3>${escape(p.subject)}</h3><pre>${escape(p.body)}</pre><p><a href="${escape(p.source)}">Vérifier la source</a></p><details><summary>Relance à envisager 7 jours après l’envoi, en l’absence de réponse</summary><pre>${escape(p.followup)}</pre></details></article>`).join('')
writeFileSync(new URL('../docs/prospector/PILOTE-PRET-2026-09-07.html',import.meta.url),`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Les cinq messages pilotes — Tada Wind</title><style>body{font:17px/1.6 system-ui;background:#f5f2eb;color:#20382f;max-width:850px;margin:40px auto;padding:0 20px}article{background:white;padding:28px;margin:24px 0;border-radius:14px;border:1px solid #d9dfd7}h1{font-size:34px}h2{font-size:23px}h3{font-size:18px}pre{white-space:pre-wrap;font:inherit}a{color:#286248}summary{cursor:pointer}header{border-bottom:2px solid #ad8f57;padding-bottom:20px}@media print{article{break-inside:avoid}details{display:none}}</style><header><p>TADA WIND · PILOTE DU 7 SEPTEMBRE 2026</p><h1>Cinq messages à relire</h1><p>Destinataires vérifiés sur les sites officiels. Les constats restent cités ; les idées de vidéo sont des propositions. Aucun message envoyé ni approuvé à ce stade. La signature Tada Wind sera ajoutée par la copie depuis l’admin.</p><p><a href="https://tarik-daouine.github.io/TadaWind-admin/">Ouvrir l’admin → À valider</a></p></header>${cards}<footer><h2>Suivi du pilote</h2><p>Après un envoi réel uniquement : « Je l’ai envoyé » dans l’admin, avec la référence Outlook. Noter réponse, intérêt, rendez-vous et opportunité. La relance ci-dessus est un texte préparé, pas un envoi programmé. Arrêter les relances en cas de refus. Temps de relecture personnel et résultats commerciaux : à mesurer.</p></footer></html>`)
console.log(JSON.stringify({prepared:results.length,mode:process.argv.includes('--apply')?'stored_drafts':'preview',sent:0,approved:0}))
