create table public.site_daily_counts (
  day date not null default current_date,
  event text not null check(event in ('page_view','form_open','contact_accepted','email_click')),
  total integer not null default 1 check(total between 1 and 10000),
  primary key(day,event)
);
alter table public.site_daily_counts enable row level security;
revoke all on public.site_daily_counts from anon,authenticated;
grant select on public.site_daily_counts to authenticated;
create policy site_counts_admin on public.site_daily_counts for select to authenticated using (coalesce((auth.jwt()->>'is_anonymous')::boolean,false)=false);
create function public.site_count_event(p_event text) returns void language plpgsql security definer set search_path=public as $$
begin
  if p_event not in ('page_view','form_open','contact_accepted','email_click') or p_event is null then raise exception 'INVALID_EVENT'; end if;
  insert into public.site_daily_counts(day,event,total) values(current_date,p_event,1)
  on conflict(day,event) do update set total=least(site_daily_counts.total+1,10000);
  delete from public.site_daily_counts where day < current_date-interval '13 months';
end;
$$;
revoke all on function public.site_count_event(text) from public,anon,authenticated;
grant execute on function public.site_count_event(text) to service_role;
