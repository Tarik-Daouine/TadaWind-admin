-- Vérifie la chaîne IA côté base : store_analysis -> apply_score -> strategize,
-- puis store_messages avec validation des preuves. À exécuter après les migrations
-- foundation + crm + worker + discovery + ai_pipeline (transaction rollback).
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'ASSERTION_FAILED: %', label; end if; end$$;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;

insert into public.prospects(id,name,category,city,website,contact_email,lat,lng,distance_km,data_origin,status)
  values('aaaaaaaa-0000-4000-8000-0000000f0001','Hôtel Pipeline','hotels','Sarlat','https://pipeline.invalid/','dir@pipeline.invalid',44.88,1.21,12.0,'openstreetmap','to_analyze');
insert into public.prospect_sources(id,prospect_id,type,url,content_excerpt,extracted,confidence)
  values('aaaaaaaa-0000-4000-8000-0000000f5001','aaaaaaaa-0000-4000-8000-0000000f0001','website_page','https://pipeline.invalid/',
    'Notre hôtel est situé à Sarlat. Ouverture de notre terrasse en septembre 2026.','{"website":{"has_contact_form":true}}','0.8');

select public.prospector_store_analysis('aaaaaaaa-0000-4000-8000-0000000f0001', $j${
  "summary":"Un hôtel à Sarlat.","business_type":"hôtel","positioning":"inconnu","target_customers":[],"visual_dependency":"forte",
  "marketing_state":{"website_quality":"inconnu","website_recent":"inconnu","photos_professional":"inconnu","has_video":"inconnu","has_drone":"inconnu","video_outdated":"inconnu","instagram_active":"inconnu","reels_used":"inconnu","publishing_regular":"inconnu"},
  "buying_signals":[{"type":"Ouverture terrasse","evidence_source_id":"aaaaaaaa-0000-4000-8000-0000000f5001","weight":"fort"}],
  "opportunities":["Terrasse"],"weaknesses":["Aucune vidéo"],"recommended_content":["Vidéo"],
  "qualitative_scores":{"fit_tada_wind":85,"video_need":70,"drone_need":40,"commercial_potential":60,"digital_gap":55},
  "confidence":0.6,"sources_considered":["aaaaaaaa-0000-4000-8000-0000000f5001"]}$j$::jsonb);

select pg_temp.assert_true((select score=69 and priority='good' and status='qualified' and weights_version='2026-09-05'
  from public.prospects where id='aaaaaaaa-0000-4000-8000-0000000f0001'), 'score déterministe = 69, priorité good');
select pg_temp.assert_true((select cardinality(score_reasons)=8 from public.prospects where id='aaaaaaaa-0000-4000-8000-0000000f0001'), 'huit motifs de score');
select pg_temp.assert_true((select count(*)=1 from public.prospect_jobs where prospect_id='aaaaaaaa-0000-4000-8000-0000000f0001' and type='strategize' and status='queued'), 'stratégie mise en file');
select pg_temp.assert_true((select count(*)=2 from public.prospect_events where prospect_id='aaaaaaaa-0000-4000-8000-0000000f0001' and type in ('analyzed','scored')), 'événements analyzed + scored');

update public.prospects set strategy='{"angles":[{"title":"Terrasse"}]}' where id='aaaaaaaa-0000-4000-8000-0000000f0001';
update public.prospects set instagram='https://instagram.com/test',linkedin='https://linkedin.com/test',phone='0102030405' where id='aaaaaaaa-0000-4000-8000-0000000f0001';
reset role;
update public.prospector_settings set channels='{"email":true,"instagram":true,"linkedin":true,"phone":true}' where id='main';
set local role service_role;
do $$ declare original jsonb := $m${
 "variants":{"email":{"subject":"Une idée","body":"Votre hôtel est situé à Sarlat. Je vous propose une vidéo."},
   "instagram_dm":{"body":"Votre hôtel est situé à Sarlat. Une vidéo ?"},
   "linkedin":{"body":"Votre hôtel est situé à Sarlat. Une vidéo ?"},
   "phone_script":{"opening":"Votre hôtel est situé à Sarlat.","reason":"Une idée.","proposal":"Une vidéo.","objections":[{"objection":"Budget ?","response":"On adapte."}],"cta":"Un échange ?"}},
 "sources_used":[
   {"source_id":"aaaaaaaa-0000-4000-8000-0000000f5001","type":"website_page","url":"https://pipeline.invalid/","path":"email.body","claim":"Votre hôtel est situé à Sarlat.","evidence_quote":"Notre hôtel est situé à Sarlat."},
   {"source_id":"aaaaaaaa-0000-4000-8000-0000000f5001","type":"website_page","url":"https://pipeline.invalid/","path":"instagram_dm.body","claim":"Votre hôtel est situé à Sarlat.","evidence_quote":"Notre hôtel est situé à Sarlat."},
   {"source_id":"aaaaaaaa-0000-4000-8000-0000000f5001","type":"website_page","url":"https://pipeline.invalid/","path":"linkedin.body","claim":"Votre hôtel est situé à Sarlat.","evidence_quote":"Notre hôtel est situé à Sarlat."},
   {"source_id":"aaaaaaaa-0000-4000-8000-0000000f5001","type":"website_page","url":"https://pipeline.invalid/","path":"phone_script.opening","claim":"Votre hôtel est situé à Sarlat.","evidence_quote":"Notre hôtel est situé à Sarlat."}],
 "grounding":[
   {"path":"email.subject","text":"Une idée","kind":"generic","source_ids":[]},
   {"path":"email.body","text":"Votre hôtel est situé à Sarlat.","kind":"fact","source_ids":["aaaaaaaa-0000-4000-8000-0000000f5001"]},
   {"path":"email.body","text":" Je vous propose une vidéo.","kind":"proposal","source_ids":[]},
   {"path":"instagram_dm.body","text":"Votre hôtel est situé à Sarlat.","kind":"fact","source_ids":["aaaaaaaa-0000-4000-8000-0000000f5001"]},
   {"path":"instagram_dm.body","text":" Une vidéo ?","kind":"proposal","source_ids":[]},
   {"path":"linkedin.body","text":"Votre hôtel est situé à Sarlat.","kind":"fact","source_ids":["aaaaaaaa-0000-4000-8000-0000000f5001"]},
   {"path":"linkedin.body","text":" Une vidéo ?","kind":"proposal","source_ids":[]},
   {"path":"phone_script.opening","text":"Votre hôtel est situé à Sarlat.","kind":"fact","source_ids":["aaaaaaaa-0000-4000-8000-0000000f5001"]},
   {"path":"phone_script.reason","text":"Une idée.","kind":"proposal","source_ids":[]},
   {"path":"phone_script.proposal","text":"Une vidéo.","kind":"proposal","source_ids":[]},
   {"path":"phone_script.objections.0.objection","text":"Budget ?","kind":"proposal","source_ids":[]},
   {"path":"phone_script.objections.0.response","text":"On adapte.","kind":"proposal","source_ids":[]},
   {"path":"phone_script.cta","text":"Un échange ?","kind":"proposal","source_ids":[]}],
 "tone_check":{"generic":false,"fake_compliment":false,"corporate":false},"confidence":0.7,"model":"claude-sonnet-5"}$m$::jsonb; ch text; one_message jsonb; begin
  foreach ch in array array['email','instagram_dm','linkedin','phone_script'] loop
    one_message := original || jsonb_build_object('variants',jsonb_build_object(ch,original->'variants'->ch),
      'sources_used',(select jsonb_agg(e) from jsonb_array_elements(original->'sources_used') e where e->>'path' like ch||'.%'),
      'grounding',(select jsonb_agg(e) from jsonb_array_elements(original->'grounding') e where e->>'path' like ch||'.%'));
    perform public.prospector_store_messages('aaaaaaaa-0000-4000-8000-0000000f0001',one_message);
  end loop;
end $$;

select pg_temp.assert_true((select count(*)=4 from public.prospect_messages where prospect_id='aaaaaaaa-0000-4000-8000-0000000f0001' and status='draft'), '4 brouillons créés');
select pg_temp.assert_true((select bool_and(validated_revision=1) from public.prospect_messages where prospect_id='aaaaaaaa-0000-4000-8000-0000000f0001'), 'preuves validées en base');
select pg_temp.assert_true((select status='to_validate' from public.prospects where id='aaaaaaaa-0000-4000-8000-0000000f0001'), 'prospect en file de validation');
reset role;
