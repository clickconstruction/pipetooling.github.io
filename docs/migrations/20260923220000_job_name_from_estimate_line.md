# 20260923220000_job_name_from_estimate_line.sql (2026-09-23, v2.3766)

**Purpose**: a job named for the customer *and the work* — the SQL twins of `src/lib/estimates/jobNameFromWork.ts` for jobs the signature makes on its own, and a plan-then-apply backfill for jobs already named with only the customer's name.

**Changes**
- `public.auto_create_job_from_signed_estimate(uuid)` re-created — the `20260923120000` body; when the title is still the app default and the customer has a name, `v_name` is `<customer> — <line>` when `line_items_snapshot` has exactly one element whose `line_item` (else `description`), whitespace-folded, is 1–60 characters and not one of the generic service words; else the customer's name. Guard 2 folds `v_name` as before. Everything else unchanged.
- `public.plan_job_names_from_work(p_apply boolean DEFAULT false) RETURNS TABLE (job_id uuid, hcp_number text, old_name text, new_name text, work text)` — SECURITY DEFINER; caller must be dev or controller (else raises). Selects jobs whose `job_name` folds equal to their customer's name or matches `^(estimate|change order) for\s`, with exactly one `jobs_ledger_fixtures` row whose `name` is specific by the rule above, and a `new_name` that differs. `p_apply = false` returns the plan and writes nothing. `p_apply = true` updates `jobs_ledger.job_name` for those rows, inserts one `job_activity_events` row per job (`event_type = 'job_renamed_from_work'`, `summary` "Renamed from … to …", `detail` with `old_name`, `new_name`, `work`, `source = 'plan_job_names_from_work'`, `financial = false`, `actor_user_id = auth.uid()`), and returns the rows it changed. Granted to `authenticated` and `service_role`; `anon` revoked.

**Idempotent**: `CREATE OR REPLACE` both; the apply is re-runnable (a renamed job no longer matches). No table. **Order**: after `20260923120000` (it rebuilds that function's body). Client and migration are independent.

**Run** (after push, from the main checkout, as the dev seat):
```sql
SELECT * FROM public.plan_job_names_from_work(false);   -- the plan, nothing written
SELECT * FROM public.plan_job_names_from_work(true);    -- rename, one activity row per job
```
