-- Connexion OAuth déléguée pour la boîte Outlook personnelle de Tada Wind.
-- Les jetons ne sont jamais accessibles au navigateur.
create table public.automation_connections (
  id text primary key check (id='outlook'),
  sender text not null check(lower(sender)='tada-wind@outlook.com'),
  token_cipher text not null,
  updated_at timestamptz not null default now()
);
create table public.automation_oauth_states (
  state_hash text primary key,
  verifier_cipher text not null,
  expires_at timestamptz not null,
  created_by uuid not null references auth.users(id)
);
create index automation_oauth_states_expiry on public.automation_oauth_states(expires_at);
alter table public.automation_connections enable row level security;
alter table public.automation_oauth_states enable row level security;
revoke all on public.automation_connections,public.automation_oauth_states from public,anon,authenticated;
grant all on public.automation_connections,public.automation_oauth_states to service_role;
