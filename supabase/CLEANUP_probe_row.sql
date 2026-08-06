-- One-off cleanup. Run once in the Supabase SQL editor, then delete this file.
--
-- WHY THIS EXISTS: while verifying that 0003's append-only trigger actually
-- fires, I inserted a probe row into the PRODUCTION forward_returns table —
-- spec_hash 'probe', which corresponds to no strategy. The verification
-- succeeded, which is precisely the problem: the row cannot be removed through
-- PostgREST, because the table is append-only by design.
--
-- That test belonged on a scratch database. The same behaviour had already
-- been verified locally against SQLite, and on a product whose pitch is
-- immutable auditable records, a junk row in the audit table is exactly the
-- wrong thing to leave lying around.
--
-- (First version of this file named the trigger `forward_returns_no_change`,
-- which is the REFERRAL table's trigger — copied across by mistake, so it
-- errored with "trigger does not exist". This version disables by scope
-- rather than by name, so a wrong name can't break it again.)
--
-- Disabling a trigger to delete from an append-only table is, correctly, an
-- awkward thing to have to do. It is meant to be. Nothing else should need it.

begin;

-- DISABLE TRIGGER USER turns off every user-defined trigger on this table
-- (here: exactly one, forward_returns_no_update) while leaving system triggers
-- such as foreign-key checks in place.
alter table public.forward_returns disable trigger user;

delete from public.forward_returns where spec_hash = 'probe';

alter table public.forward_returns enable trigger user;

commit;

-- ── Verify, in this order ────────────────────────────────────────────────────

-- 1. The probe row is gone. Expect 0 rows.
select * from public.forward_returns where spec_hash = 'probe';

-- 2. The trigger is back on and armed. Expect tgenabled = 'O' (origin).
select tgname, tgenabled
from pg_trigger
where tgrelid = 'public.forward_returns'::regclass
  and not tgisinternal;

-- 3. OPTIONAL, and it must FAIL with "forward_returns is append-only".
--    If it succeeds, the guarantee is off and something is wrong.
--      delete from public.forward_returns;
