-- Fix : text[] || 'literal' choisissait l'opérateur anyarray||anyarray (« malformed array literal »).
-- Remplacé par array_append. Idempotent avec la version corrigée de 20260905172828.
create or replace function public.prospector_available_channels(p public.prospects) returns text[]
language plpgsql stable security definer set search_path = '' as $$
declare ch jsonb; out text[] := '{}'; rx text := '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$';
begin
  select channels into ch from public.prospector_settings where id='main';
  if coalesce((ch->>'email')::boolean,false) and (coalesce(p.email,'') ~ rx or coalesce(p.contact_email,'') ~ rx or coalesce(p.email_commercial,'') ~ rx) then out := array_append(out,'email'); end if;
  if coalesce((ch->>'instagram')::boolean,false) and coalesce(length(trim(p.instagram)),0) > 0 then out := array_append(out,'instagram_dm'); end if;
  if coalesce((ch->>'linkedin')::boolean,false) and coalesce(length(trim(p.linkedin)),0) > 0 then out := array_append(out,'linkedin'); end if;
  if coalesce((ch->>'phone')::boolean,false) and (p.phone is not null or p.contact_phone is not null) then out := array_append(out,'phone'); end if;
  return out;
end $$;
revoke all on function public.prospector_available_channels(public.prospects) from public, anon, authenticated, service_role;
grant execute on function public.prospector_available_channels(public.prospects) to service_role;
