-- Apply only after deploying the internal-only website contact form.
-- The service role continues to accept requests atomically through its RPC.
drop policy if exists public_insert_lead on public.leads;
revoke insert on public.leads from anon;
