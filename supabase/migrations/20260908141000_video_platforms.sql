-- Preserve existing Streamable references; future projects can use another host.
alter table public.projects add column video_url text;
alter table public.projects add constraint video_url_length check(video_url is null or length(video_url)<=500);
