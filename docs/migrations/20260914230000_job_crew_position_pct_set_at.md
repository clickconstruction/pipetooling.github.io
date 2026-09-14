# 20260914230000_job_crew_position_pct_set_at.sql (2026-09-14, v2.3432)

The Pipeline crew feed learns when — and by what — the job's percent was set. One read-only RPC changed, no table changes.

- `list_job_crew_position(p_job_ids uuid[], p_today date)` — **dropped and recreated** (the OUT list changes; `CREATE OR REPLACE` cannot change a `RETURNS TABLE`). Every column of [20260914200000](20260914200000_job_crew_position.md) stays as it was, plus two at the end: `pct_set_at` (the `changed_at` of the newest `job_pct_events` row of **any** source — the event that set the number the job carries now, since the `jobs_ledger_log_pct_change` trigger logs every change of `pct_complete`) and `pct_source` (that row's `seed` / `manual` / `service`). `pct_manual_at` (newest `manual` row) is unchanged.
- Grants (`REVOKE … FROM PUBLIC, anon`; `GRANT EXECUTE … TO authenticated`), `STABLE SECURITY DEFINER`, `search_path = public` and the office-only guard (dev / master_technician / assistant / controller / primary; anyone else gets no rows) are identical to the v2.3418 version.
- `p_today` is still passed by the client (`todayYmdInAppTz`) so no zone literal lives in SQL.

Apply order: merge → `supabase db push` → `npm run gen-types:linked` chore (the two fields were hand-added to the Functions entry in `src/types/database.ts` in this PR; the regen replaces the entry, as v2.3422 did after v2.3418). The client is safe ahead of the push: with the fields absent, `newestPercent` keeps the v2.3418 reading.
