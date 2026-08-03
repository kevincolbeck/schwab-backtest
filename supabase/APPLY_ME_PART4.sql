-- Part 4: credit-RPC lockdown. Idempotent — safe to re-run any time.
--
-- Why: Postgres grants EXECUTE on new functions to PUBLIC by default, and Part 3
-- only revoked from anon/authenticated — a no-op against the PUBLIC grant. Net
-- effect: anyone holding the anon key could POST /rest/v1/rpc/grant_credits to
-- mint credits or /rest/v1/rpc/spend_credits to drain any user. This revokes the
-- PUBLIC grant too. The service role and the signup trigger (SECURITY DEFINER,
-- runs as the function owner) keep working — no function bodies change here.

revoke execute on function public.credit_balance(uuid) from public, anon, authenticated;
revoke execute on function public.grant_credits(uuid, integer, text, text) from public, anon, authenticated;
revoke execute on function public.spend_credits(uuid, integer, text, text) from public, anon, authenticated;

-- Prevent recurrence: future functions in this schema no longer get the default
-- PUBLIC execute grant (grant to specific roles explicitly when needed).
alter default privileges in schema public revoke execute on functions from public;
