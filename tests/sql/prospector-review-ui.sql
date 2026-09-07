-- Décisions humaines sur un brouillon : édition (l'humain devient l'auteur),
-- approbation, refus. À exécuter après toutes les migrations, en transaction rollback.
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'ASSERTION_FAILED: %', label; end if; end$$;
create function pg_temp.expect_error(statement text, expected text) returns void language plpgsql as $$declare caught text;begin begin execute statement;exception when others then caught:=sqlerrm;end;if caught is null or position(expected in caught)=0 then raise exception 'EXPECTED_ERROR: %, got %',expected,coalesce(caught,'success');end if;end$$;

select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
insert into public.prospects(id,name,category,city,website,contact_email,distance_km,data_origin,status,analysis,strategy)
  values('cccccccc-0000-4000-8000-00000000d001','Revue Test','hotels','Sarlat','https://revue.invalid/','dir@revue.invalid',12.0,'openstreetmap','qualified',
    '{"summary":"x","qualitative_scores":{},"buying_signals":[]}','{"angles":[{"title":"x"}],"recommended_channel":"email"}');
insert into public.prospect_sources(id,prospect_id,type,url,content_excerpt,confidence)
  values('cccccccc-0000-4000-8000-00000000d5f1','cccccccc-0000-4000-8000-00000000d001','website_page','https://revue.invalid/','Notre hôtel est situé à Sarlat.','0.8');
update public.prospects set instagram='https://instagram.com/test',linkedin='https://linkedin.com/test',phone='0102030405' where id='cccccccc-0000-4000-8000-00000000d001';
reset role;
update public.prospector_settings set channels='{"email":true,"instagram":true,"linkedin":true,"phone":true}' where id='main';
set local role service_role;
do $$ declare original jsonb := $m${
 "variants":{"email":{"subject":"Idee","body":"Votre hôtel est situé à Sarlat. Une vidéo ?"},
  "instagram_dm":{"body":"Votre hôtel est situé à Sarlat."},"linkedin":{"body":"Votre hôtel est situé à Sarlat."},
  "phone_script":{"opening":"Votre hôtel est situé à Sarlat.","reason":"r","proposal":"p","objections":[],"cta":"c"}},
 "sources_used":[{"source_id":"cccccccc-0000-4000-8000-00000000d5f1","type":"website_page","url":"https://revue.invalid/","path":"email.body","claim":"Votre hôtel est situé à Sarlat.","evidence_quote":"Notre hôtel est situé à Sarlat."},
  {"source_id":"cccccccc-0000-4000-8000-00000000d5f1","type":"website_page","url":"https://revue.invalid/","path":"instagram_dm.body","claim":"Votre hôtel est situé à Sarlat.","evidence_quote":"Notre hôtel est situé à Sarlat."},
  {"source_id":"cccccccc-0000-4000-8000-00000000d5f1","type":"website_page","url":"https://revue.invalid/","path":"linkedin.body","claim":"Votre hôtel est situé à Sarlat.","evidence_quote":"Notre hôtel est situé à Sarlat."},
  {"source_id":"cccccccc-0000-4000-8000-00000000d5f1","type":"website_page","url":"https://revue.invalid/","path":"phone_script.opening","claim":"Votre hôtel est situé à Sarlat.","evidence_quote":"Notre hôtel est situé à Sarlat."}],
 "grounding":[{"path":"email.subject","text":"Idee","kind":"generic","source_ids":[]},
  {"path":"email.body","text":"Votre hôtel est situé à Sarlat.","kind":"fact","source_ids":["cccccccc-0000-4000-8000-00000000d5f1"]},
  {"path":"email.body","text":" Une vidéo ?","kind":"proposal","source_ids":[]},
  {"path":"instagram_dm.body","text":"Votre hôtel est situé à Sarlat.","kind":"fact","source_ids":["cccccccc-0000-4000-8000-00000000d5f1"]},
  {"path":"linkedin.body","text":"Votre hôtel est situé à Sarlat.","kind":"fact","source_ids":["cccccccc-0000-4000-8000-00000000d5f1"]},
  {"path":"phone_script.opening","text":"Votre hôtel est situé à Sarlat.","kind":"fact","source_ids":["cccccccc-0000-4000-8000-00000000d5f1"]},
  {"path":"phone_script.reason","text":"r","kind":"proposal","source_ids":[]},{"path":"phone_script.proposal","text":"p","kind":"proposal","source_ids":[]},{"path":"phone_script.cta","text":"c","kind":"proposal","source_ids":[]}],
 "tone_check":{"generic":false,"fake_compliment":false,"corporate":false},"confidence":0.7}$m$::jsonb; ch text; one_message jsonb; begin
  foreach ch in array array['email','instagram_dm','linkedin','phone_script'] loop
    one_message := original || jsonb_build_object('variants',jsonb_build_object(ch,original->'variants'->ch),
      'sources_used',(select jsonb_agg(e) from jsonb_array_elements(original->'sources_used') e where e->>'path' like ch||'.%'),
      'grounding',(select jsonb_agg(e) from jsonb_array_elements(original->'grounding') e where e->>'path' like ch||'.%'));
    perform public.prospector_store_messages('cccccccc-0000-4000-8000-00000000d001',one_message);
  end loop;
end $$;
reset role;

select set_config('request.jwt.claims','{"role":"authenticated","sub":"11111111-1111-4111-8111-111111111111"}',true);
set local role authenticated;

-- Le worker a déjà tamponné la traçabilité : approbation directe possible.
select public.prospector_review_message((select id from public.prospect_messages where prospect_id='cccccccc-0000-4000-8000-00000000d001' and channel='linkedin'),'approve',1);
select pg_temp.assert_true((select status='approved' and approved_by is not null from public.prospect_messages where prospect_id='cccccccc-0000-4000-8000-00000000d001' and channel='linkedin'),'approbation directe tracée');

-- Une révision périmée est refusée.
select pg_temp.expect_error($q$select public.prospector_review_message((select id from public.prospect_messages where prospect_id='cccccccc-0000-4000-8000-00000000d001' and channel='linkedin'),'approve',9)$q$,'MESSAGE_CONFLICT');

-- Édition conservant le constat sourcé : révision +1, retraçage, approbation possible.
select public.prospector_review_message((select id from public.prospect_messages where prospect_id='cccccccc-0000-4000-8000-00000000d001' and channel='email'),
  'edit',1,'{"body":"Votre hôtel est situé à Sarlat. Je vous propose un tournage drone."}');
select pg_temp.assert_true((select revision=2 and validated_revision=2 and status='draft' and jsonb_array_length(sources_used)=1
  from public.prospect_messages where prospect_id='cccccccc-0000-4000-8000-00000000d001' and channel='email'),'édition retracée à la révision 2');
select public.prospector_review_message((select id from public.prospect_messages where prospect_id='cccccccc-0000-4000-8000-00000000d001' and channel='email'),'approve',2);
select pg_temp.assert_true((select status='approved' from public.prospect_messages where prospect_id='cccccccc-0000-4000-8000-00000000d001' and channel='email'),'message édité approuvable');

-- Réécriture complète : la citation orpheline est retirée, le texte reste approuvable.
select public.prospector_review_message((select id from public.prospect_messages where prospect_id='cccccccc-0000-4000-8000-00000000d001' and channel='instagram_dm'),
  'edit',1,'{"body":"Bonjour, un mot de ma part sans reprendre le constat initial."}');
select pg_temp.assert_true((select jsonb_array_length(sources_used)=0 from public.prospect_messages where prospect_id='cccccccc-0000-4000-8000-00000000d001' and channel='instagram_dm'),'citation orpheline retirée');

-- Un corps vide est refusé.
select pg_temp.expect_error($q$select public.prospector_review_message((select id from public.prospect_messages where prospect_id='cccccccc-0000-4000-8000-00000000d001' and channel='phone_script'),'edit',1,'{"body":"   "}')$q$,'MESSAGE_BODY_REQUIRED');

-- Refus : motif obligatoire, puis sortie de la file.
select pg_temp.expect_error($q$select public.prospector_reject_prospect('cccccccc-0000-4000-8000-00000000d001','  ')$q$,'REJECTION_REASON_REQUIRED');
select public.prospector_reject_prospect('cccccccc-0000-4000-8000-00000000d001','trop_loin');
select pg_temp.assert_true((select status='archived' and exclusion_reason='trop_loin' from public.prospects where id='cccccccc-0000-4000-8000-00000000d001'),'prospect archivé');
select pg_temp.assert_true((select count(*)=0 from public.prospect_messages where prospect_id='cccccccc-0000-4000-8000-00000000d001' and status<>'rejected'),'brouillons refusés');
select pg_temp.assert_true((select count(*)>0 from public.prospect_feedback where prospect_id='cccccccc-0000-4000-8000-00000000d001' and decision='rejected'),'feedback enregistré');

-- Un prospect archivé ne peut plus être régénéré.
select pg_temp.expect_error($q$select public.prospector_request_regeneration('cccccccc-0000-4000-8000-00000000d001')$q$,'PROSPECT_NOT_ANALYZABLE');
reset role;
