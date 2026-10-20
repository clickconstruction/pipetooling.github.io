# 20261014004000_sub_sheet_on_site_done.sql (2026-10-12, v2.5429)

Residential Messages R8 · 12, PR 2 of 3 (`to-dos/gc-mode/messages/RESIDENTIAL_BUILD_PLAN.md` on `spike/gc-mode`; customer communication helper 1, directed by the lead). The sub sheet (`people_labor_jobs`) gains the two days the sub's flow reads: the first day the sub was on site and the day their work was done. Until now the sheet kept only the newest report (`progress_at`) and the newest stage move (`stage_changed_at`), so the first of each was lost. The owner's calls, 2026-10-12: only a real percent counts as on site, and done never fills on site. Nothing reads the two columns yet. PR 3's loader (`subStampsFor`) reads them and turns `sub_on_site` and `sub_done` from half kept to kept in `src/lib/flows/facts.ts`.

## What it does

1. **`on_site_at`** (timestamptz): the first report of a percent above 0 while the sheet is Working. Set once, never cleared.
   - A 0% report does not count.
   - A note with no new percent does not count. The portal's note keeps the percent the sheet had, so the trigger asks for a percent that differs from the one before.
   - The sub's **my work here is done** press does not count. It writes 100% and moves the sheet past Working in the same write.
2. **`done_at`** (timestamptz): the first move out of Working, to the walk-through or to the customer, at the move's own time.
   - A move back to Working clears it, and the next move out sets it again.
   - A move between the walk-through and the customer leaves it.
   - A move whose writer did not stamp `stage_changed_at` is done at the write.
   - A sheet born past Working takes its `stage_changed_at`, or no day when it has none.
3. **`people_labor_jobs_flow_stamps_biu`**: one BEFORE INSERT OR UPDATE OF `progress_at`, `progress_pct`, `stage` trigger fills both. The sheet's writers are unchanged: the sub's portal (`submit-sub-portal`, a progress report and **my work here is done**) and the office's `set_sub_sheet_stage`.
4. **The backfill**, from the job's activity feed, touching only the rows it fills:
   - `done_at`, for sheets past Working: the newest `sub_stage_change` line moving the sheet out of Working (`detail.source_id`, `detail.from = 'working'`), else `stage_changed_at`.
   - `on_site_at`: the earliest `sub_progress` line with `detail.pct` above 0 (`detail.laborJobId`).
   - Both lookups ride `job_activity_events_source_idx` (`event_type`, `detail ->> 'source_id'`), so the ALTER's lock is held only as long as a few indexed reads.
   - Each row it fills also wakes `people_labor_jobs_link_job_ledger_biu`. It finds nothing to link, since every sheet has had its job link since v2.3435.

No new table, grant or policy, so no fence calls.

## Checked before the push

The SQL bed `sub-sheet-stamps` (`npm run test:pg:sub-sheet-stamps`) runs every migration on Supabase Postgres 17, then this one a second time, which must change nothing, then the scenario. Docker does not run on the office Mac, so it runs in the SQL beds workflow once the PR is ready. It checks:

- The two columns are timestamps, and one trigger wakes on the report and the stage only.
- On site, report by report. A 0% report and a note leave it empty. The first 25% sets it. Later reports and notes keep it, and so does every move.
- Done, move by move. The office's own `set_sub_sheet_stage` stamps the move's time. On to the customer, and a write of the same stage, keep it. Back to Working clears it, and the next move out stamps it again.
- **My work here is done** on a sheet with no report is done and never on site.
- A move with no time of its own is done at the write. Sheets born past Working, with and without a stage time, and a sheet born Working with a percent.
- The backfill. With the trigger off, five sheets gather their reports and moves the old way. The migration once more, streamed in mid-scenario as a second push would, fills:
  - on site from the first real percent;
  - done from the newest move out of Working, past a later move to the customer;
  - done from the stage time where no feed line exists.
- A sheet now Working gets no done day. Days already set are kept though the feed says otherwise. The rows' places show the backfill touched only the three it filled, and the trigger is on again.

## Verify after the push

```sql
-- 1. The columns and the trigger.
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'people_labor_jobs' AND column_name IN ('on_site_at', 'done_at') ORDER BY 1;
-- expect: done_at and on_site_at, both timestamp with time zone
SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid = 'public.people_labor_jobs'::regclass AND tgname = 'people_labor_jobs_flow_stamps_biu';
-- expect: one row, O

-- 2. What the backfill filled.
SELECT stage = 'working' AS working, count(*) AS sheets, count(on_site_at) AS on_site, count(done_at) AS done
FROM public.people_labor_jobs GROUP BY 1 ORDER BY 1;
-- expect: no done day on a Working sheet; most sheets past Working with a done day
```

## Rollback

```sql
DROP TRIGGER IF EXISTS people_labor_jobs_flow_stamps_biu ON public.people_labor_jobs;
DROP FUNCTION IF EXISTS public.people_labor_jobs_flow_stamps();
ALTER TABLE public.people_labor_jobs DROP COLUMN IF EXISTS on_site_at;
ALTER TABLE public.people_labor_jobs DROP COLUMN IF EXISTS done_at;
```

## Status

Written 2026-10-12 with the migration. Not pushed. The lead pushes it after the PR is on `main`.
