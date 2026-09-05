-- L4-L5: restricted user RPCs for prospect records and notes/tags.
alter table public.prospects add column notes text;

create function public.prospector_update_prospect(p_id uuid,p_expected_updated_at timestamptz,p_patch jsonb) returns public.prospects
language plpgsql security definer set search_path = '' as $$
declare current public.prospects; merged public.prospects; result public.prospects; actor uuid:=public.prospector_require_user();
begin
  if jsonb_typeof(p_patch) is distinct from 'object' or p_patch='{}'::jsonb or exists(
    select 1 from jsonb_object_keys(p_patch) k where k not in ('name','category','subcategory','description','address','city','postal_code','department','region','country','phone','email','email_commercial','contact_first_name','contact_last_name','contact_role','contact_email','contact_phone','website','instagram','facebook','linkedin','tiktok','youtube','other_links','tags','notes','next_action','next_action_at','next_followup_at'))
  then raise exception 'INVALID_PROSPECT_PATCH'; end if;
  select * into strict current from public.prospects where id=p_id and deleted_at is null for update;
  if current.updated_at is distinct from p_expected_updated_at then raise exception 'PROSPECT_CONFLICT'; end if;
  merged:=jsonb_populate_record(current,p_patch);
  if jsonb_typeof(merged.other_links) is distinct from 'array' or cardinality(merged.tags)>50 or array_position(merged.tags,null) is not null
    or exists(select 1 from unnest(merged.tags) tag where length(trim(tag)) not between 1 and 60) then raise exception 'INVALID_PROSPECT_VALUES'; end if;
  update public.prospects set name=merged.name,category=nullif(trim(merged.category),''),subcategory=nullif(trim(merged.subcategory),''),
    description=merged.description,address=merged.address,city=merged.city,postal_code=merged.postal_code,department=merged.department,
    region=merged.region,country=merged.country,phone=merged.phone,email=merged.email,email_commercial=merged.email_commercial,
    contact_first_name=merged.contact_first_name,contact_last_name=merged.contact_last_name,contact_role=merged.contact_role,
    contact_email=merged.contact_email,contact_phone=merged.contact_phone,website=merged.website,instagram=merged.instagram,
    facebook=merged.facebook,linkedin=merged.linkedin,tiktok=merged.tiktok,youtube=merged.youtube,other_links=merged.other_links,
    tags=array(select distinct trim(tag) from unnest(merged.tags) tag order by trim(tag)),notes=merged.notes,next_action=merged.next_action,
    next_action_at=merged.next_action_at,next_followup_at=merged.next_followup_at where id=p_id returning * into result;
  insert into public.prospect_events(prospect_id,type,label,meta,actor,actor_id) values(p_id,
    case when p_patch ? 'notes' then 'note_added' else 'prospect_updated' end,'Fiche prospect mise à jour',
    jsonb_build_object('fields',(select jsonb_agg(k) from jsonb_object_keys(p_patch) k)),'user',actor);
  return result;
end $$;

revoke all on function public.prospector_update_prospect(uuid,timestamptz,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.prospector_update_prospect(uuid,timestamptz,jsonb) to authenticated;
