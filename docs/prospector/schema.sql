-- ============================================================================
-- ARCHIVE DU BROUILLON INITIAL — NE PAS EXÉCUTER
--
-- Le schéma L0 final, versionné et appliqué est désormais :
-- ../../supabase/migrations/20260905153918_prospector_foundation.sql
--
-- Ce fichier est conservé pour rendre visible l'évolution de la spécification.
-- Il sera remplacé par une vue consolidée du schéma après les migrations L6–L12.
-- ============================================================================
/*
-- ============================================================================
-- Tada Wind Prospector — schéma BDD (brouillon initial, archivé)
-- Cible : Supabase / Postgres. Convention : snake_case anglais.
-- N'ALTÈRE PAS les tables existantes (projects, leads).
-- À relire avant application. RLS : accès complet role `authenticated`, rien pour `anon`.
-- ============================================================================

-- Extensions utiles (déjà présentes sur Supabase en général)
create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "unaccent";      -- normalisation
-- create extension if not exists "pg_cron";    -- décommenter si worker via pg_cron (D4)

-- ---------------------------------------------------------------------------
-- Helper de normalisation de nom (formes juridiques + accents + ponctuation)
-- ---------------------------------------------------------------------------
create or replace function prospector_normalize_name(txt text)
returns text language sql immutable as $$
  select trim(regexp_replace(
    regexp_replace(
      lower(unaccent(coalesce(txt, ''))),
      '\y(sarl|sas|sasu|eurl|earl|scea|sci|sa|snc|selarl)\y', '', 'g'
    ),
    '[^a-z0-9]+', ' ', 'g'
  ))
$$;

-- ---------------------------------------------------------------------------
-- prospector_settings — singleton (profil commercial + paramètres)
-- ---------------------------------------------------------------------------
create table if not exists prospector_settings (
  id                  text primary key default 'main',
  business_profile    jsonb not null default '{
    "business": "Tada Wind",
    "services": ["vidéo promotionnelle","drone","immobilier","tourisme","événementiel","contenus réseaux sociaux","photo au sol"],
    "positioning": "prestations visuelles professionnelles, personnalisées et locales",
    "targetCustomers": [],
    "preferredAreas": [],
    "portfolio": [],
    "contactInfo": {},
    "pitchNotes": ""
  }'::jsonb,
  reference_address   text,
  reference_lat       double precision,
  reference_lng       double precision,
  radius_preferred_km integer not null default 40,
  radius_max_km       integer not null default 100,
  min_score           integer not null default 40,
  priority_thresholds jsonb not null default '{"hot":80,"good":60,"consider":40,"low":20}'::jsonb,
  distance_bands      jsonb not null default '[{"max":30,"label":"priorité forte"},{"max":60,"label":"normale"},{"max":100,"label":"faible"}]'::jsonb,
  enabled_categories  text[] not null default '{}',
  disabled_categories text[] not null default '{}',
  followup_delays_days integer[] not null default '{3,7,14}',
  ai_model_simple     text not null default 'claude-haiku-4-5-20251001',
  ai_model_complex    text not null default 'claude-sonnet-5',
  tone               text not null default 'naturel, humain, direct, sympathique, sobre',
  channels           jsonb not null default '{"email":true,"instagram":true,"linkedin":true,"phone":true}'::jsonb,
  scoring_weights    jsonb not null default '{
    "version": "2026-09-05",
    "fit_tada_wind": 25, "video_interest": 20, "drone_interest": 15,
    "commercial_potential": 15, "digital_gap": 10,
    "geo_access": 5, "buying_signal": 5, "contactability": 5
  }'::jsonb,
  updated_at         timestamptz not null default now()
);
insert into prospector_settings (id) values ('main') on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- prospect_campaigns
-- ---------------------------------------------------------------------------
create table if not exists prospect_campaigns (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  filters     jsonb not null default '{}'::jsonb,
  status      text not null default 'draft',   -- draft|running|paused|done
  stats       jsonb not null default '{}'::jsonb,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- prospects
-- ---------------------------------------------------------------------------
create table if not exists prospects (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  -- Identité
  name               text not null,
  normalized_name    text generated always as (prospector_normalize_name(name)) stored,
  category           text,
  subcategory        text,
  description        text,
  address            text,
  city               text,
  postal_code        text,
  department         text,
  region             text,
  country            text default 'France',
  lat                double precision,
  lng                double precision,

  -- Contact
  phone              text,
  email              text,
  email_commercial   text,
  contact_first_name text,
  contact_last_name  text,
  contact_role       text,
  contact_email      text,
  contact_phone      text,

  -- Présence numérique
  website            text,
  website_domain     text,
  instagram          text,
  facebook           text,
  linkedin           text,
  tiktok             text,
  youtube            text,
  other_links        jsonb not null default '[]'::jsonb,

  -- Analyse / stratégie (dernier run)
  summary            text,
  analysis           jsonb,
  strategy           jsonb,

  -- Scoring
  score              integer,
  score_breakdown    jsonb,
  score_reasons      text[] not null default '{}',
  priority           text,                 -- hot|good|consider|low|excluded
  weaknesses         text[] not null default '{}',
  opportunities      text[] not null default '{}',

  -- CRM
  status             text not null default 'new',
  owner              text,
  discovered_at      timestamptz not null default now(),
  last_analyzed_at   timestamptz,
  last_contacted_at  timestamptz,
  next_action        text,
  next_action_at     timestamptz,
  next_followup_at   timestamptz,

  -- Méta / traçabilité / RGPD
  campaign_id        uuid references prospect_campaigns(id) on delete set null,
  data_origin        text,
  collected_at       timestamptz not null default now(),
  last_verified_at   timestamptz,
  tags               text[] not null default '{}',
  dedupe_hash        text,
  is_client          boolean not null default false,
  exclusion_reason   text,
  deleted_at         timestamptz
);

-- Déduplication
create unique index if not exists prospects_domain_uniq
  on prospects (website_domain) where website_domain is not null and deleted_at is null;
create index if not exists prospects_phone_idx        on prospects (phone);
create index if not exists prospects_name_city_idx    on prospects (normalized_name, city);
create index if not exists prospects_dedupe_hash_idx  on prospects (dedupe_hash);
create index if not exists prospects_status_idx       on prospects (status);
create index if not exists prospects_priority_idx     on prospects (priority);
create index if not exists prospects_campaign_idx     on prospects (campaign_id);

-- ---------------------------------------------------------------------------
-- prospect_sources — traçabilité de chaque donnée récupérée
-- ---------------------------------------------------------------------------
create table if not exists prospect_sources (
  id              uuid primary key default gen_random_uuid(),
  prospect_id     uuid not null references prospects(id) on delete cascade,
  type            text not null,      -- website_home|website_page|instagram|facebook|linkedin|maps|osm|manual
  url             text,
  fetched_at      timestamptz not null default now(),
  content_excerpt text,
  extracted       jsonb,
  confidence      numeric(3,2) default 0.5
);
create index if not exists prospect_sources_prospect_idx on prospect_sources (prospect_id);

-- ---------------------------------------------------------------------------
-- prospect_events — timeline
-- ---------------------------------------------------------------------------
create table if not exists prospect_events (
  id           uuid primary key default gen_random_uuid(),
  prospect_id  uuid not null references prospects(id) on delete cascade,
  created_at   timestamptz not null default now(),
  type         text not null,
  label        text,
  meta         jsonb,
  actor        text not null default 'system'   -- system|user
);
create index if not exists prospect_events_prospect_idx on prospect_events (prospect_id, created_at desc);

-- ---------------------------------------------------------------------------
-- prospect_messages — variantes générées + validation humaine (P1)
-- ---------------------------------------------------------------------------
create table if not exists prospect_messages (
  id               uuid primary key default gen_random_uuid(),
  prospect_id      uuid not null references prospects(id) on delete cascade,
  channel          text not null,     -- email|instagram_dm|linkedin|phone_script
  kind             text not null default 'first_touch',  -- first_touch|followup|reply_draft
  subject          text,
  body             text,
  variables        jsonb,
  sources_used     jsonb not null default '[]'::jsonb,   -- [{source_id,url,claim}]
  status           text not null default 'draft',        -- draft|approved|edited|sent|rejected|regenerate_requested
  generated_by     text,
  model            text,
  created_at       timestamptz not null default now(),
  approved_at      timestamptz,
  sent_at          timestamptz,
  sent_channel_ref text,
  rejection_reason text
);
create index if not exists prospect_messages_prospect_idx on prospect_messages (prospect_id);

-- ---------------------------------------------------------------------------
-- prospect_jobs — queue asynchrone
-- ---------------------------------------------------------------------------
create table if not exists prospect_jobs (
  id           uuid primary key default gen_random_uuid(),
  type         text not null,      -- discovery|enrich|analyze|score|strategize|copywrite|crm_next|manual_analyze
  status       text not null default 'queued',   -- queued|running|done|error
  payload      jsonb not null default '{}'::jsonb,
  result       jsonb,
  attempts     integer not null default 0,
  max_attempts integer not null default 3,
  run_after    timestamptz not null default now(),
  error        text,
  prospect_id  uuid references prospects(id) on delete cascade,
  campaign_id  uuid references prospect_campaigns(id) on delete cascade,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists prospect_jobs_pick_idx on prospect_jobs (status, run_after) where status = 'queued';

-- ---------------------------------------------------------------------------
-- prospect_blacklist — opt-out / exclusions définitives
-- ---------------------------------------------------------------------------
create table if not exists prospect_blacklist (
  id              uuid primary key default gen_random_uuid(),
  reason          text,
  domain          text,
  normalized_name text,
  phone           text,
  email           text,
  source          text not null default 'manual',   -- manual|opt_out|reply_negative
  created_by      text,
  created_at      timestamptz not null default now()
);
create index if not exists prospect_blacklist_domain_idx on prospect_blacklist (domain);
create index if not exists prospect_blacklist_name_idx   on prospect_blacklist (normalized_name);

-- ---------------------------------------------------------------------------
-- prospect_feedback — apprentissage (Phase 2/3)
-- ---------------------------------------------------------------------------
create table if not exists prospect_feedback (
  id                uuid primary key default gen_random_uuid(),
  prospect_id       uuid references prospects(id) on delete set null,
  decision          text not null,   -- approved|rejected|later|blacklist
  reason            text,            -- pas_interessant|trop_loin|mauvaise_categorie|trop_petit|deja_equipe|pas_assez_premium|mauvais_contact|autre
  note              text,
  score_at_decision integer,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ai_usage — suivi coûts LLM
-- ---------------------------------------------------------------------------
create table if not exists ai_usage (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  function           text not null,
  model              text not null,
  prospect_id        uuid references prospects(id) on delete set null,
  campaign_id        uuid references prospect_campaigns(id) on delete set null,
  input_tokens       integer not null default 0,
  output_tokens      integer not null default 0,
  cost_estimate_usd  numeric(10,4) not null default 0
);
create index if not exists ai_usage_created_idx on ai_usage (created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at auto
-- ---------------------------------------------------------------------------
create or replace function prospector_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['prospector_settings','prospect_campaigns','prospects','prospect_jobs']
  loop
    execute format('drop trigger if exists %I_touch on %I', t, t);
    execute format('create trigger %I_touch before update on %I
                    for each row execute function prospector_touch_updated_at()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- RLS — accès complet `authenticated`, rien pour `anon`
-- (le worker écrit via service_role qui bypass RLS)
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'prospector_settings','prospect_campaigns','prospects','prospect_sources',
    'prospect_events','prospect_messages','prospect_jobs','prospect_blacklist',
    'prospect_feedback','ai_usage'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I_auth_all on %I', t, t);
    execute format('create policy %I_auth_all on %I for all to authenticated using (true) with check (true)', t, t);
  end loop;
end $$;

-- ============================================================================
-- FIN
-- ============================================================================
*/
