---
name: "GC mode, Owner Billing: a billing-only job, kept off every crew screen"
parent: to-dos/gc-mode/OWNER_BILLING_REAL_BUILD.md (decision 10's check)
status: the owner said yes 2026-10-09 (call 1, with service_types.billing_only folded in; Stages' Working default kept) · BO-1 (the migration, below) cut 2026-10-09 · BO-2 (the client) after the types
---

# A billing-only job, kept off every crew screen

## Why

Decision 1 gives each GC job we win one Pipeline job, its billing job, so its bills use the app's
statement, Stripe, payments, promises, the chase list and the waiver train as they are. Decision
10's check (2026-10-07) found that nothing on main can keep such a job away from the crews. It
stays off every list built from a team, a schedule or a clock session, but it shows in:

- the clock-in typed search;
- My Schedule's **+ Add job**, which lists 20 jobs before anyone types;
- the dispatch board's job pickers;
- the office's Tally and `/map`.

Nothing on the server stops a clock-in on it.

This PR adds one column and closes every way in. It is a Pipeline PR on its own, cut from
`origin/main` before O4a, which is the first thing to set the column.

## The column

```sql
ALTER TABLE public.jobs_ledger
  ADD COLUMN IF NOT EXISTS billing_only boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.jobs_ledger.billing_only IS
  'A job that only carries bills (GC mode''s billing job for a project we build, O4a). Nobody clocks in, schedules or joins its crew: the three guards refuse it, and the crew searches and lists leave it out.';
```

A constant default makes this a catalog change, with no rewrite of the table. Every job on prod
reads `false`. There is no index: a billing-only job is rare, and each filter below sits on a
read that already scans what it scans today.

**Who sets it:** only O4a's `gc_send_owner_pay_app`, when it opens a project's billing job. A guard
on `jobs_ledger` refuses turning it on for a job that already has a clock session, a schedule
block or a crew member, and refuses turning it off once set. The second refusal keeps a GC job's
bills from becoming a crew job by a stray update. Fixing a mistake is a migration.

## The three guards (and the flip)

One function, `SECURITY DEFINER` so it sees the job whoever inserts. A crew member's own row
security may hide the billing job, and then a plain check would let the row through.

```sql
CREATE OR REPLACE FUNCTION public.refuse_billing_only_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job uuid := nullif(to_jsonb(NEW) ->> TG_ARGV[0], '')::uuid;
BEGIN
  IF v_job IS NOT NULL AND EXISTS (SELECT 1 FROM public.jobs_ledger WHERE id = v_job AND billing_only) THEN
    RAISE EXCEPTION 'That job only carries a GC job''s bills. Pick the job the work is on.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clock_sessions_refuse_billing_only ON public.clock_sessions;
CREATE TRIGGER clock_sessions_refuse_billing_only
  BEFORE INSERT OR UPDATE OF job_ledger_id ON public.clock_sessions
  FOR EACH ROW EXECUTE FUNCTION public.refuse_billing_only_job('job_ledger_id');

DROP TRIGGER IF EXISTS job_schedule_blocks_refuse_billing_only ON public.job_schedule_blocks;
CREATE TRIGGER job_schedule_blocks_refuse_billing_only
  BEFORE INSERT OR UPDATE OF job_id ON public.job_schedule_blocks
  FOR EACH ROW EXECUTE FUNCTION public.refuse_billing_only_job('job_id');

DROP TRIGGER IF EXISTS jobs_ledger_team_members_refuse_billing_only ON public.jobs_ledger_team_members;
CREATE TRIGGER jobs_ledger_team_members_refuse_billing_only
  BEFORE INSERT OR UPDATE OF job_id ON public.jobs_ledger_team_members
  FOR EACH ROW EXECUTE FUNCTION public.refuse_billing_only_job('job_id');
```

The flip, on `jobs_ledger` itself (`BEFORE UPDATE OF billing_only`, its own small function): on is
refused while any of the three tables names the job, and off is always refused.

`UPDATE OF <column>` keeps the guards off every other update: clocking out, approving hours,
moving a block's time. A row that already names a job never trips them.

## The two searches

**`search_jobs_ledger`** gains an opt-in. A second argument with a default would leave two
overloads, and a one-argument call would then match both ("function is not unique"). So the
migration drops the one-argument function and creates the two-argument one in the same
transaction. Every call that passes only `search_text` keeps working, by name through PostgREST.

```sql
DROP FUNCTION IF EXISTS public.search_jobs_ledger(text);
CREATE OR REPLACE FUNCTION public.search_jobs_ledger(search_text text DEFAULT '', include_billing_only boolean DEFAULT false)
RETURNS TABLE(id uuid, service_type_id uuid, service_type_name text, hcp_number text, job_name text, job_address text, click_number text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- the body of 20260905220000_search_rpcs_escape_and_numeric_order.sql, word for word, with one
  -- line added to the inner WHERE:
  --   AND (include_billing_only OR NOT jl.billing_only)
$$;
REVOKE EXECUTE ON FUNCTION public.search_jobs_ledger(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_jobs_ledger(text, boolean) TO authenticated, service_role;
```

These callers opt in with `include_billing_only: true`, because they move or find money, or are
the office looking for any job:

- `src/components/HeaderGlobalSearch.tsx` (both calls);
- `src/components/MercuryTransactionAllocationsModal.tsx`;
- `src/components/banking/TransactionDetailModal.tsx`;
- `src/components/jobs/JobPaymentMoveModal.tsx`;
- `src/components/jobs/PaidInFullEmailSettingsModal.tsx`.

dev-mcp's `findJob` (`supabase/functions/dev-mcp/index.ts`) opts in too, so the dev seat finds
it. That is a function redeploy (the lead) and a catalog rebuild.

The rest leave it out, with no change to their code: the clock-in button, hours, dispatch, the
estimator and focus pickers, POs, supply-house invoices, overhead, combine and separate, migrate,
and the field lookup.

**`search_jobs_for_self_schedule`**: `CREATE OR REPLACE` with the same signature and body, and one
line added, `AND NOT j.billing_only`.

## The client lists, by file

Each is a plain `jobs_ledger` read today with no status or team filter. Each gains
`.eq('billing_only', false)`:

- `src/lib/scheduleDispatchHub.ts` → `fetchJobsLedgerForScheduleDispatchHub`: the dispatch board,
  QuickAssign, and the person day, week and month pickers.
- `src/pages/JobTally.tsx`: the office branch of the job list (about line 663). Helpers and subs
  read the team-joined `list_jobs_for_tally`, which the team guard already covers.
- `src/hooks/useMapPageData.ts`: the `map jobs_ledger` read (about line 103).
- `src/lib/jobs/jobFollowupQueue.ts`: it skips a billing-only row. The Stages fetch
  (`src/lib/fetchJobsLedgerWithDetailsForStages.ts`) adds `billing_only` to its select, so the
  row carries it.

**One the owner may want too:** Stages' **Working** column. The billing job sits there as
`working` forever, and its bills show under **Billed** and **Ready to Bill** as they should.
Default: Working leaves billing-only jobs out, and the bills stay. It is one filter in
`jobsStagesBoard.ts`'s bucketing, and it lands in this PR only on his word.

Not touched, since the guards already keep them clear: `list_assigned_jobs_for_dashboard`,
`list_superintendent_jobs_for_dashboard` (with `project_id` null, decision 10), and
`list_jobs_for_tally`. The crew-day payload, the calendar, the team board and the Hours grid are
built from sessions and blocks, which the guards refuse.

## Tests

- **Render tests that pin a caller's arguments** change with it: the opt-in callers' tests that
  assert `{ search_text }` now see `{ search_text, include_billing_only: true }`.
- **A SQL test bed** (`supabase/tests/`, the repo's pattern where one exists) for the guard and the
  searches. Otherwise the doc's verify steps below are the test.
- **Kernel test:** `jobFollowupQueue.test.ts` gains a billing-only row that never queues.

## Verify after the push (five steps)

Each step from 2 on runs as a dev, in one transaction that rolls back. The first line of that
transaction makes a stand-in billing-only job (the owner's user as master, any service type):

```sql
BEGIN;
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, billing_only)
  VALUES ('00000000-0000-0000-0000-0000000b1110',
          (SELECT id FROM public.users WHERE role = 'dev' LIMIT 1),
          (SELECT id FROM public.service_types LIMIT 1),
          'Billing check, rolled back', true);
-- step's statements
ROLLBACK;
```

1. **The column is there and every job reads false.**
   `SELECT count(*) FILTER (WHERE billing_only) AS billing_only, count(*) AS jobs FROM public.jobs_ledger;`
   gives `0` and today's count.
2. **The guards are there and refuse.** The three triggers are in `pg_trigger`, enabled:
   `SELECT tgname, tgenabled FROM pg_trigger WHERE tgname LIKE '%_refuse_billing_only';` gives 3
   rows of `O`. Inside the transaction, three updates are each refused with *That job only
   carries a GC job's bills.*:
   - `UPDATE public.clock_sessions SET job_ledger_id = '…b1110' WHERE id = (SELECT id FROM public.clock_sessions LIMIT 1);`
   - the same on `job_schedule_blocks.job_id`;
   - the same on `jobs_ledger_team_members.job_id`.
3. **Ordinary work still goes through.** In the same transaction,
   `UPDATE public.clock_sessions SET job_ledger_id = job_ledger_id WHERE id = (SELECT id FROM public.clock_sessions LIMIT 1);`
   gives `UPDATE 1`. Turning `billing_only` on for a job with sessions is refused.
4. **The searches.**
   - `SELECT count(*) FROM public.search_jobs_ledger('Billing check');` gives 0.
   - `SELECT count(*) FROM public.search_jobs_ledger('Billing check', true);` gives 1.
   - `SELECT count(*) FROM public.search_jobs_for_self_schedule('Billing check');` gives 0.
   - `SELECT count(*) FROM public.search_jobs_ledger('');` gives 50, as before.
5. **Nobody signed out reaches the search.**
   `BEGIN; SET LOCAL ROLE anon; SELECT * FROM public.search_jobs_ledger('a'); ROLLBACK;` gives
   `permission denied for function search_jobs_ledger`.

Then `npm run check:migration-drift`, the types PR (`database.ts` gains the column and the
second argument; the dev-mcp catalog is rebuilt), and dev-mcp's redeploy.

## The lock note

This touches four busy tables while crews work:
- `ALTER TABLE jobs_ledger` takes an ACCESS EXCLUSIVE lock for an instant. It is a catalog change
  with a constant default.
- `CREATE TRIGGER` takes a SHARE ROW EXCLUSIVE lock on `clock_sessions`, `job_schedule_blocks` and
  `jobs_ledger_team_members`. `clock_sessions` is written all day by clock-ins.
- The search's `DROP` / `CREATE` takes a short lock on the function only.

`SET lock_timeout = '3s';` is first. **It goes in the lead's evening batch.** If it stops at the
3-second timeout, nothing is applied (the migration is one transaction); run `supabase db push`
again a few minutes later. Never in the morning clock-in hour.

## Docs this PR touches

- `docs/migrations/<stamp>_billing_only_jobs.md` (the five steps).
- `docs/BILLING_FLOWS.md`: a billing-only job, a line, linked from O4a's section.
- `docs/GLOSSARY.md`: billing-only job.
- `docs/EDGE_FUNCTIONS.md`: dev-mcp's `find_job` now finds them.
- `docs/JOBS_STAGES_TAB_ARCHITECTURE.md`: only if the Working filter is taken.
- The release note and fragment, for the office: "a GC job's billing job never shows where crews
  pick a job".

## The owner's calls this PR carries

1. **Keep decision 1 and add this flag**, the lead's recommendation, or drop decision 1.
2. **Stages' Working column** leaves the billing job out (default yes).
3. The three from decision 10:
   - the money-waiting email (it reads only `billed` jobs, so it misses these bills unless told);
   - the overhead rate (pass-through bills lower it);
   - Job Summary and the Stages header counts.

## Is this the best we can do?

It closes every way onto a crew screen with three guards and two search filters. It changes
nothing for any job that exists. It could be better three ways:

1. **A kind, not a flag.** A `jobs_ledger.kind` column (`field`, `billing`, `office`) would also
   absorb the "Office" job, which is found today by `hcp_number = '000'` or a name with "Office" in
   it (`baseline.sql` 6019–6036). Every non-field job would then be one rule. It is a wider change
   to the Office job's readers, so it is not taken here.
2. **One door for crew reads.** A view, `jobs_ledger_field`, that every crew-facing list reads,
   so a screen added later cannot forget the filter. The four client reads above would move to it.
   It is better done once the Pipeline's own job lists are next touched.
3. **Hide it at the source.** A restrictive read policy on `jobs_ledger` would hide billing-only
   jobs from helpers and subs, who never need them, so no future screen can list one to them. The
   searches are `SECURITY DEFINER` and still need their filters. A new policy on the app's
   busiest table wants a timing check first.

## The migration as built (BO-1, byte for byte)

The owner's yes folded in `service_types.billing_only` (O4a's finding: a "General contracting" type would show in about a dozen pickers). The flip, described in words above, is written out here. The client's part (the opt-ins, the crew lists, Stages' Working column, the pickers and dev-mcp's `find_job`) is BO-2, after the types are regenerated. It has to wait for them, because `.eq('billing_only', …)` and the search's second argument do not typecheck before.

```sql
SET lock_timeout = '3s';

-- A billing-only job, kept off every crew screen (to-dos/gc-mode/mockups/billing-only-job.md on branch
-- spike/gc-mode; the owner's call 1, 2026-10-09: yes, with a service_types flag folded in). GC mode's billing
-- job for a project we build (Owner Billing's O4a, which comes next and is the first to set the column)
-- carries only our bills to the customer. Nobody clocks in on it, schedules it or joins its crew: three
-- guards refuse it, the crew searches leave it out, and its service type stays out of the pickers.
-- Constant defaults make both columns catalog changes, with no rewrite of either table.

ALTER TABLE public.jobs_ledger
  ADD COLUMN IF NOT EXISTS billing_only boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.jobs_ledger.billing_only IS
  'A job that only carries bills (GC mode''s billing job for a project we build, O4a). Nobody clocks in, schedules or joins its crew: the three guards refuse it, and the crew searches and lists leave it out.';

ALTER TABLE public.service_types
  ADD COLUMN IF NOT EXISTS billing_only boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.service_types.billing_only IS
  'A service type only billing-only jobs carry (GC mode''s General contracting, O4a). The pickers that choose a type for crew work, bids, materials and supply houses leave it out; a job''s own type still reads by id.';

-- The three guards: one function, SECURITY DEFINER so it sees the job whoever inserts. A crew member's own row
-- security may hide the billing job, and then a plain check would let the row through.
CREATE OR REPLACE FUNCTION public.refuse_billing_only_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job uuid := nullif(to_jsonb(NEW) ->> TG_ARGV[0], '')::uuid;
BEGIN
  IF v_job IS NOT NULL AND EXISTS (SELECT 1 FROM public.jobs_ledger WHERE id = v_job AND billing_only) THEN
    RAISE EXCEPTION 'That job only carries a GC job''s bills. Pick the job the work is on.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clock_sessions_refuse_billing_only ON public.clock_sessions;
CREATE TRIGGER clock_sessions_refuse_billing_only
  BEFORE INSERT OR UPDATE OF job_ledger_id ON public.clock_sessions
  FOR EACH ROW EXECUTE FUNCTION public.refuse_billing_only_job('job_ledger_id');

DROP TRIGGER IF EXISTS job_schedule_blocks_refuse_billing_only ON public.job_schedule_blocks;
CREATE TRIGGER job_schedule_blocks_refuse_billing_only
  BEFORE INSERT OR UPDATE OF job_id ON public.job_schedule_blocks
  FOR EACH ROW EXECUTE FUNCTION public.refuse_billing_only_job('job_id');

DROP TRIGGER IF EXISTS jobs_ledger_team_members_refuse_billing_only ON public.jobs_ledger_team_members;
CREATE TRIGGER jobs_ledger_team_members_refuse_billing_only
  BEFORE INSERT OR UPDATE OF job_id ON public.jobs_ledger_team_members
  FOR EACH ROW EXECUTE FUNCTION public.refuse_billing_only_job('job_id');

-- The flip: on is refused while any of the three tables names the job, and off is always refused, so a GC
-- job's bills never become a crew job by a stray update. Fixing a mistake is a migration.
CREATE OR REPLACE FUNCTION public.jobs_ledger_billing_only_flip()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.billing_only AND NOT NEW.billing_only THEN
    RAISE EXCEPTION 'A job that carries a GC job''s bills stays that way.' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.billing_only AND NOT OLD.billing_only AND (
    EXISTS (SELECT 1 FROM public.clock_sessions WHERE job_ledger_id = NEW.id)
    OR EXISTS (SELECT 1 FROM public.job_schedule_blocks WHERE job_id = NEW.id)
    OR EXISTS (SELECT 1 FROM public.jobs_ledger_team_members WHERE job_id = NEW.id)
  ) THEN
    RAISE EXCEPTION 'That job has hours, a schedule or a crew, so it cannot only carry bills.' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jobs_ledger_billing_only_flip ON public.jobs_ledger;
CREATE TRIGGER jobs_ledger_billing_only_flip
  BEFORE UPDATE OF billing_only ON public.jobs_ledger
  FOR EACH ROW EXECUTE FUNCTION public.jobs_ledger_billing_only_flip();

-- The job search gains an opt-in. A second argument with a default would leave two overloads, and a
-- one-argument call would then match both, so the one-argument function goes in the same transaction. Every
-- call that passes only search_text keeps working by name through PostgREST. The body is
-- 20260905220000's, with one line added to the inner WHERE.
DROP FUNCTION IF EXISTS public.search_jobs_ledger(text);
CREATE OR REPLACE FUNCTION public.search_jobs_ledger(search_text text DEFAULT ''::text, include_billing_only boolean DEFAULT false)
RETURNS TABLE(id uuid, service_type_id uuid, service_type_name text, hcp_number text, job_name text, job_address text, click_number text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH q AS (
    SELECT
      coalesce(search_text, '') AS raw,
      public.escape_like_pattern(coalesce(search_text, '')) AS esc,
      -- Legacy "J1004" -> "1004": the remainder after the J, escaped.
      CASE
        WHEN length(coalesce(search_text, '')) >= 2 AND lower(left(search_text, 1)) = 'j'
        THEN public.escape_like_pattern(substring(search_text from 2))
      END AS j_rest
  )
  SELECT
    r.id,
    r.service_type_id,
    r.service_type_name,
    r.hcp_number,
    r.job_name,
    r.job_address,
    r.click_number
  FROM (
    SELECT
      jl.id,
      jl.service_type_id,
      coalesce(stj.name, '')::text AS service_type_name,
      coalesce(jl.hcp_number, '')::text AS hcp_number,
      coalesce(jl.job_name, '')::text AS job_name,
      coalesce(jl.job_address, '')::text AS job_address,
      coalesce(jl.click_number, '')::text AS click_number,
      coalesce(nullif(jl.hcp_number, ''), jl.click_number, '') AS effective_number
    FROM public.jobs_ledger jl
    LEFT JOIN public.service_types stj ON stj.id = jl.service_type_id
    CROSS JOIN q
    WHERE (include_billing_only OR NOT jl.billing_only)
    AND (
      q.raw = ''
      OR jl.hcp_number ILIKE '%' || q.esc || '%'
      OR jl.click_number ILIKE '%' || q.esc || '%'
      OR (
        q.j_rest IS NOT NULL
        AND (
          jl.hcp_number ILIKE '%' || q.j_rest || '%'
          OR jl.click_number ILIKE '%' || q.j_rest || '%'
        )
      )
      OR jl.job_name ILIKE '%' || q.esc || '%'
      OR jl.job_address ILIKE '%' || q.esc || '%'
      OR EXISTS (
        SELECT 1
        FROM public.service_types st
        WHERE st.ledger_job_prefix IS NOT NULL
          AND btrim(st.ledger_job_prefix) <> ''
          AND q.raw <> ''
          AND length(q.raw) > length(btrim(st.ledger_job_prefix))
          AND lower(left(q.raw, length(btrim(st.ledger_job_prefix)))) = lower(btrim(st.ledger_job_prefix))
          AND (
            jl.hcp_number ILIKE '%' || public.escape_like_pattern(substring(q.raw from length(btrim(st.ledger_job_prefix)) + 1)) || '%'
            OR jl.click_number ILIKE '%' || public.escape_like_pattern(substring(q.raw from length(btrim(st.ledger_job_prefix)) + 1)) || '%'
          )
      )
    )
  ) r
  ORDER BY
    (CASE WHEN r.effective_number = '' THEN 1 ELSE 0 END),
    (substring(r.effective_number from '[0-9]+'))::numeric DESC NULLS LAST,
    r.effective_number DESC
  LIMIT 50;
$$;

COMMENT ON FUNCTION public.search_jobs_ledger(text, boolean) IS
  'Search jobs_ledger by HCP / Click number, job name, or address. J prefix and ledger_job_prefix normalized; %/_/\ in the typed text are escaped (escape_like_pattern); ordered by job number NUMERICALLY (first digit run, desc) under LIMIT 50. Leaves billing-only jobs out unless include_billing_only (the money and office searches). Returns service_type_id, service_type_name, click_number. SECURITY DEFINER.';

REVOKE EXECUTE ON FUNCTION public.search_jobs_ledger(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_jobs_ledger(text, boolean) TO authenticated, service_role;

-- My Schedule's + Add job leaves billing-only jobs out: 20260811140701's body, one line added.
CREATE OR REPLACE FUNCTION public.search_jobs_for_self_schedule(p_query text)
RETURNS TABLE (
  id uuid,
  hcp_number text,
  click_number text,
  job_name text,
  job_address text,
  status text,
  customer_name text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT j.id, j.hcp_number, j.click_number, j.job_name, j.job_address, j.status, j.customer_name
  FROM public.jobs_ledger j
  WHERE (SELECT auth.uid()) IS NOT NULL
    AND j.status IN ('waiting', 'working', 'ready_to_bill', 'billed')
    AND NOT j.billing_only
    AND (
      COALESCE(trim(p_query), '') = ''
      OR j.hcp_number ILIKE '%' || trim(p_query) || '%'
      OR j.click_number ILIKE '%' || trim(p_query) || '%'
      OR j.job_name ILIKE '%' || trim(p_query) || '%'
      OR j.job_address ILIKE '%' || trim(p_query) || '%'
      OR COALESCE(j.customer_name, '') ILIKE '%' || trim(p_query) || '%'
    )
  ORDER BY array_position(ARRAY['waiting','working','ready_to_bill','billed'], j.status),
           NULLIF(j.hcp_number, '') NULLS LAST,
           j.job_name
  LIMIT 20;
$$;
```
