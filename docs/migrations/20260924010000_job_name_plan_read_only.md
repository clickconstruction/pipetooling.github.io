# 20260924010000_job_name_plan_read_only.sql (2026-09-24, v2.3778)

**Purpose**: `plan_job_names_from_work(false)` runs in a read-only transaction (it built a temp table in `20260923220000`, so `BEGIN READ ONLY` and the dev-mcp `call_read` door both refused it); the import placeholder "Job total (migrated)" is not work.

**Changes**
- `public.specific_work_name(text)` re-created: also `NULL` for `job total`, `job total (migrated)` and any folded name ending `(migrated)`.
- `public.job_names_from_work_plan() RETURNS TABLE (job_id, hcp_number, old_name, new_name, work)` — new, `LANGUAGE sql STABLE SECURITY DEFINER`: the plan query from `20260923220000`, unchanged. `REVOKE` from PUBLIC, anon, authenticated; `GRANT` to service_role only (its callers are SECURITY DEFINER).
- `public.plan_job_names_from_work(boolean)` re-created, same signature and rows: role check as before; `p_apply = false` → `RETURN QUERY SELECT … FROM job_names_from_work_plan()`; `p_apply = true` → one `WITH p AS (plan), upd AS (UPDATE …), ins AS (INSERT … job_activity_events …) SELECT … FROM p`. No temp table.

**Idempotent**: `CREATE OR REPLACE` throughout. Additive. **Order**: after `20260923220000`. No client dependency.
