-- One-off cleanup. Run once in the Supabase SQL editor, then delete this file.
--
-- WHY THIS EXISTS: while verifying that 0004's append-only trigger actually
-- fires, I inserted a probe row into the PRODUCTION forward_returns table —
-- spec_hash 'probe', which corresponds to no strategy. The verification
-- succeeded, which is precisely the problem: the row cannot be removed through
-- PostgREST, because the table is append-only by design.
--
-- That test belonged on a scratch database. The same trigger behaviour had
-- already been verified locally against SQLite; re-verifying it by writing to
-- the live audit table was the wrong call, and on a product whose pitch is
-- immutable auditable records, a junk row in the audit table is exactly the
-- wrong thing to leave lying around.
--
-- Disabling a trigger to delete from an append-only table is, correctly, an
-- awkward thing to have to do. It is meant to be. Nothing else should ever
-- need this file.

begin;

alter table public.forward_returns disable trigger forward_returns_no_change;

delete from public.forward_returns where spec_hash = 'probe';

alter table public.forward_returns enable trigger forward_returns_no_change;

commit;

-- Verify: this must return 0 rows.
select * from public.forward_returns where spec_hash = 'probe';

-- And confirm the guarantee is back on. This must FAIL with
-- "forward_returns is append-only":
--   delete from public.forward_returns;
