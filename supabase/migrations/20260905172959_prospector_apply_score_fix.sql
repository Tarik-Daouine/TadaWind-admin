-- Fix : mêmes corrections array_append que 20260905172828 (concaténation text[] || literal).
-- Conservé pour l'alignement de l'historique local/distant ; idempotent.
-- ── Scoring déterministe (parité avec src/lib/prospector/scoring.js) ──
create or replace function public.prospector_apply_score(p_id uuid) returns public.prospects
language plpgsql security definer set search_path = '' as $$
declare
  p public.prospects; s public.prospector_settings; w jsonb; a jsonb; q jsonb;
  b jsonb := '{}'; reasons text[] := '{}'; excl text[] := '{}';
  total numeric := 0; val numeric; pts numeric; sig numeric := 0; contact numeric := 0;
  band jsonb; has_form boolean; prio text; k text; inp text; rx text := '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$';
  qual_map jsonb := '{"fit_tada_wind":"fit_tada_wind","video_interest":"video_need","drone_interest":"drone_need","commercial_potential":"commercial_potential","digital_gap":"digital_gap"}';
  crit jsonb := '{"fit_tada_wind":"Adéquation Tada Wind","video_interest":"Intérêt vidéo","drone_interest":"Intérêt drone","commercial_potential":"Potentiel commercial","digital_gap":"Présence numérique perfectible","geo_access":"Accessibilité géographique","buying_signal":"Signal d''achat","contactability":"Facilité de contact"}';
begin
  perform public.prospector_require_worker();
  select * into strict p from public.prospects where id=p_id for update;
  select * into strict s from public.prospector_settings where id='main';
  w := s.scoring_weights;
  a := coalesce(p.analysis,'{}'::jsonb);
  q := coalesce(a->'qualitative_scores','{}'::jsonb);

  foreach k in array array['fit_tada_wind','video_interest','drone_interest','commercial_potential','digital_gap','geo_access','buying_signal','contactability'] loop
    b := b || jsonb_build_object(k, 0);
  end loop;

  if public.prospector_is_blacklisted(p) then excl := array_append(excl,'Entreprise sur liste d''exclusion'); end if;
  if p.is_client then excl := array_append(excl,'Entreprise déjà cliente'); end if;
  if p.distance_km is not null and p.distance_km > s.radius_max_km then
    excl := array_append(excl, 'Hors zone : '||p.distance_km||' km (maximum '||s.radius_max_km||' km)'); end if;
  if p.category is not null and (p.category = any(s.disabled_categories)
     or (cardinality(s.enabled_categories) > 0 and not (p.category = any(s.enabled_categories)))) then
    excl := array_append(excl,'Catégorie désactivée'); end if;

  if cardinality(excl) > 0 then
    update public.prospects set score=0, score_breakdown=b, score_reasons=excl, weights_version=(w->>'version'),
      priority='excluded', exclusion_reason=array_to_string(excl,' ; '),
      status = case when status in ('won','archived','lost','excluded') then status else 'excluded' end
    where id=p_id returning * into p;
    insert into public.prospect_events(prospect_id,type,label,meta,actor)
      values(p_id,'scored','Score : exclu',jsonb_build_object('priority','excluded','reasons',to_jsonb(excl)),'system');
    return p;
  end if;

  for k in select jsonb_object_keys(qual_map) loop
    inp := qual_map->>k;
    val := case when jsonb_typeof(q->inp)='number' then greatest(0, least(100, (q->>inp)::numeric)) else 0 end;
    pts := round(val * (w->>k)::numeric / 100, 2);
    b := jsonb_set(b, array[k], to_jsonb(pts));
    reasons := array_append(reasons, (crit->>k)||' : '||pts||'/'||(w->>k)||' ('||
      case when jsonb_typeof(q->inp)='number' then 'note '||val||'/100' else 'donnée inconnue' end||')');
  end loop;

  pts := 0;
  if p.distance_km is not null then
    for band in select value from jsonb_array_elements(s.distance_bands) loop
      if p.distance_km <= (band->>'max')::numeric then pts := (band->>'points')::numeric; exit; end if;
    end loop;
  end if;
  b := jsonb_set(b, '{geo_access}', to_jsonb(round(pts/5 * (w->>'geo_access')::numeric, 2)));
  reasons := array_append(reasons, 'Distance : '||coalesce(p.distance_km::text||' km','inconnue')||' → '||(b->>'geo_access')||'/'||(w->>'geo_access'));

  for band in select value from jsonb_array_elements(coalesce(a->'buying_signals','[]'::jsonb)) loop
    sig := greatest(sig, case band->>'weight' when 'fort' then 5 when 'moyen' then 3 when 'faible' then 1 else 0 end);
  end loop;
  b := jsonb_set(b, '{buying_signal}', to_jsonb(round(sig/5 * (w->>'buying_signal')::numeric, 2)));
  reasons := array_append(reasons, 'Signal d''achat : '||(case sig when 5 then 'fort' when 3 then 'moyen' when 1 then 'faible' else 'aucun renseigné' end)||' → '||(b->>'buying_signal')||'/'||(w->>'buying_signal'));

  select bool_or(coalesce((src.extracted->'website'->>'has_contact_form')::boolean,false)) into has_form
    from public.prospect_sources src where src.prospect_id=p_id;
  contact := case
    when coalesce(p.contact_email,'') ~ rx then 5
    when coalesce(p.email,'') ~ rx or coalesce(p.email_commercial,'') ~ rx then 3
    when coalesce(has_form,false) then 1 else 0 end;
  b := jsonb_set(b, '{contactability}', to_jsonb(round(contact/5 * (w->>'contactability')::numeric, 2)));
  reasons := array_append(reasons, 'Contact : '||(case contact when 5 then 'email direct' when 3 then 'email général' when 1 then 'formulaire seul' else 'aucun moyen renseigné' end)||' → '||(b->>'contactability')||'/'||(w->>'contactability'));

  select sum(value::numeric) into total from jsonb_each_text(b);
  total := least(100, greatest(0, round(total)));
  prio := case
    when total >= (s.priority_thresholds->>'hot')::numeric then 'hot'
    when total >= (s.priority_thresholds->>'good')::numeric then 'good'
    when total >= (s.priority_thresholds->>'consider')::numeric then 'consider'
    when total >= (s.priority_thresholds->>'low')::numeric then 'low'
    else 'excluded' end;

  update public.prospects set score=total::integer, score_breakdown=b, score_reasons=reasons,
    weights_version=(w->>'version'), priority=prio,
    weaknesses = coalesce((select array_agg(x) from jsonb_array_elements_text(a->'weaknesses') x),'{}'),
    opportunities = coalesce((select array_agg(x) from jsonb_array_elements_text(a->'opportunities') x),'{}'),
    summary = coalesce(nullif(a->>'summary',''), summary),
    status = case when status in ('new','to_analyze') then 'qualified' else status end
  where id=p_id returning * into p;
  insert into public.prospect_events(prospect_id,type,label,meta,actor)
    values(p_id,'scored','Score : '||total||'/100',jsonb_build_object('total',total,'priority',prio,'breakdown',b),'system');
  return p;
end $$;
revoke all on function public.prospector_apply_score(uuid) from public, anon, authenticated, service_role;
grant execute on function public.prospector_apply_score(uuid) to service_role;
