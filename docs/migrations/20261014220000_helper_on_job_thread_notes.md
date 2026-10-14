# 20261014220000_helper_on_job_thread_notes.sql (2026-10-14, v2.5526)

A finding from the prod field walk after the residential build (Customer communication helper 10, directed by cc). The Sample helper, on the ZZ job's crew and clocked in, pressed Job Mode's **Something else** and got *You don't have permission to leave the note for the office*. The same helper could not see the Sample primary's note in Job updates.

## Why

`jobs_ledger_thread_notes` has two permissive branches in its insert and select policies (newest definition `20260907050000`). The field branch, for helpers and subcontractors (`auth_uid_is_helpers_or_subcontractor()`), lets a user through when they are on the job's crew or have a schedule block on it. The crew check is an `EXISTS` on `jobs_ledger_team_members`, which runs under the caller's RLS. That table's SELECT policy leaves helpers out, so a helper never sees their own crew row. Only a dispatch block let them through. It is the same trap `superintendent_can_touch_job_thread` (`20260902165836`) closed for superintendents.

## What it does

1. **`helper_on_job(job)`**: SECURITY DEFINER with `row_security = off`, so the answer does not depend on what the caller can see.
   - True when the signed-in user is on the job's crew (`jobs_ledger_team_members`).
   - True when they have a schedule block on it this week or last: Monday of last week through Sunday of this week, in Chicago, the span of `messages_tech_on_job` (`20261014180000`).
   - Revoked from anon. Granted to authenticated and the service role.
2. **`jobs_ledger_thread_notes_insert`** and **`jobs_ledger_thread_notes_select`** are recreated from `20260907050000`.
   - The field branch's crew `EXISTS` becomes `helper_on_job(job_id)`.
   - The branch's own schedule-block `EXISTS` stays as it was, so a helper or sub dispatched to the job on any day keeps what they had.
   - The office branch is untouched. The restrictive fences (training mode, the twin fence, primary scope) still apply on top.

No new table, so no house calls.

## Push order

Push after the PR lands. No client or edge function depends on it: Job Mode's Something else and the card's Post note already write this table, and they start to work for a helper on the crew once it is pushed.

## Checked before the push

The SQL bed `helper-on-job` (`npm run test:pg:helper-on-job`) runs every migration on Supabase Postgres 17, then this one a second time, which must change nothing, then the scenario. Docker does not run on the office Mac, so it runs in the SQL beds workflow once the PR is ready.

- Hector, a helper on the crew alone, sees no crew row of his own, and `helper_on_job` says he is on the job.
- Hector leaves a note and reads it with the office's. He cannot write a note as someone else.
- Hana, a helper on no job, can neither leave a note nor read one.
- Sam, a sub dispatched three weeks ago, is outside `helper_on_job`'s span and still reads the job's notes through the branch's own dispatch check.
- Rosa, the office, reads both notes. Nobody signed out may call `helper_on_job`.

## Verify after the push

```sql
-- The function: a definer, signed in only.
SELECT p.proname, p.prosecdef,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'helper_on_job';
-- expect: helper_on_job true true false

-- Both policies ask it.
SELECT polname, pg_get_expr(polqual, polrelid) ILIKE '%helper_on_job%' AS select_asks,
  pg_get_expr(polwithcheck, polrelid) ILIKE '%helper_on_job%' AS insert_asks
FROM pg_policy WHERE polrelid = 'public.jobs_ledger_thread_notes'::regclass
  AND polname IN ('jobs_ledger_thread_notes_insert', 'jobs_ledger_thread_notes_select');
-- expect: _insert null true; _select true null
```

On the app: the Sample helper, clocked in on the ZZ job, presses **Message the customer**, then **Something else**, and sends a note. *The office has your note.* shows, and the note reads in the card's Job updates.
