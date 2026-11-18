# 20261117080000_job_lien_path_answer.sql (2026-11-16, v2.7504)

A job can leave the lien path for a reason of its own, and one function writes that answer. The owner's ask of 2026-11-16, on a job whose one bill was three trips to pick up checks that were not there: the money is not for labor or materials on the property, so most likely no lien secures it, and the desk had no way to say so. This is the database half. No screen reads it yet.

Until now a job left the Lien desk three ways: paid, Uncollectible (which writes the money off), or its whole property answered public ([`20261116221500`](./20261116221500_property_lien_public_answer.md), which is about the land). None of them says *collect this one another way*.

## The columns, on `jobs_ledger`

| Column | Type | What it holds |
|---|---|---|
| `lien_path_answer` | `text`, NULL or `'off_path'` (`jobs_ledger_lien_path_answer_check`) | NULL: the job is on the lien path, as every job is until a person says otherwise. `'off_path'`: a person took it off, and the desk leaves it out of its bins and its run. |
| `lien_path_answered_at` | `timestamptz` | When the job was last taken off the path, or last put back. |
| `lien_path_answered_by` | `uuid` → `users(id)`, `ON DELETE SET NULL` | Who did that. |
| `lien_path_reason` | `text` | Why, in the person's words. |

The answer is the job's own. The public property answer stays on the property and is still derived for every job at the address; a job is off the path when either says so.

## The function

`set_job_lien_path_answer(p_job_id uuid, p_answer text, p_reason text DEFAULT NULL, p_attorney_list boolean DEFAULT false) RETURNS jsonb`

- **Who.** The lien office: `dev`, `master_technician`, `assistant`, `controller` (`isLienOffice`). Anyone else gets `{ "error": "Not authorized to take a job off the lien path" }`.
- **`p_answer`**: `'off_path'`, or `'on_path'`, which puts the job back. A reason is required to take a job off and to put one back.
- **A change** writes the four columns and `updated_at` on the job, and one `lien_path_change` line on the job's activity (`job_activity_events`, financial): *Taken off the lien path — …* or *Put back on the lien path — …*, with the answer and the reason in `detail`.
- **The same press twice changes nothing**: the same answer with the same reason writes no second stamp and no second line. A new reason on a job already off the path is a change. Putting back a job that was never taken off answers ok and writes nothing.
- **`p_attorney_list`**, on the way off only: `true` also puts the job on the attorney's list by calling `set_job_collections_flag(job, true, reason)`. A job already on the list is left as it is, with its own note. What the flag itself refuses (a job must be billed) comes back as `held`, and the job is off the lien path all the same.
- **Returns** `{ ok, answer, changed, on_attorney_list, already_on_list, held }`, or `{ error }` with nothing written.
- **Putting the job back** does not take it off the attorney's list.
- Nothing is filed, voided or deleted. The desk items stay as they are, so a job put back finds its papers where they stood.

`SECURITY DEFINER`, owned by `postgres`, `search_path = public, pg_temp`. `EXECUTE` is revoked from `PUBLIC` and `anon` and granted to `authenticated`. Training mode is refused by the statement triggers on `jobs_ledger`, which fire inside a definer function.

## Safety

No table is made, so no fence calls. Additive and idempotent: `ADD COLUMN IF NOT EXISTS`, the check added only when it is missing, `CREATE OR REPLACE`. Starts with `SET lock_timeout = '3s'`. Adding the columns takes a brief lock on `jobs_ledger` and, for the reference, on `users`; the columns are nullable with no default, so no row is rewritten.

## The bed

`job-lien-path-answer` (`scripts/pgtest-job-lien-path-answer.sh`, `supabase/tests/job_lien_path_answer/`): stand-in tables, the real `set_job_collections_flag` lifted out of `20261007170000_job_uncollectible.sql`, the migration twice, and a scenario for who may press, each refusal, each answer's writes, the activity line, the attorney's list and what its flag refused, the same press twice and putting the job back.

## Apply order

Nothing reads the columns or calls the function until the client PRs that follow, so the push can come any time after this merges and before those. Pushed on 2026-11-16 at about 22:45 UTC with `scripts/db-push.sh`, from a checkout equal to `origin/main` (465bdfdfc), where it was the only pending migration. Read back: `check:migration-drift` holds 1338 files against 1338 versions, and the four columns read NULL on real jobs.

**Applied** to prod by 2026-11-18: `npm run check:migration-drift` read 1,366 local files against 1,366 remote versions, fully applied, this version among them (run in the docs pass after #8630).
