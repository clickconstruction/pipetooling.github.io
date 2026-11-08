# 20261108054743_vehicle_rate_override_comment.sql (2026-11-08, v2.6672)

One `COMMENT ON COLUMN` and nothing else (punch list #52 follow-up). `people_pay_config.vehicle_rate_override`'s comment still read as `20260903233954_pay_config_vehicle_arrangement.sql` wrote it — *Manual $/field hour that replaces the computed vehicle rate when set* — while since v2.4653 (punch list #52 PR 5) the override replaces only the vehicle line's **fixed** part: insurance + registration + service + wear ÷ field hours. Fuel is never in it; fuel stays on the jobs it was put on, and Review adds the person's fuel on no job beside the fixed rate (`lib/people/wheels.ts`, `reviewVehicleFuel.ts`). The new comment says so, names the trailing 90 days and keeps the version trail (v2.2733 → v2.4653 → v2.6672).

**Tables**: none created or altered, so no fence is owed and no type changes (`src/types/database.ts` carries no comments). **Data**: none moves. **Lock**: a `COMMENT` takes a brief `SHARE UPDATE EXCLUSIVE` lock on the table; with `lock_timeout = '3s'` a busy moment fails fast and the push is retried.

**Apply**: `supabase db push` from a clean checkout of `main` after this merges, in any order against the Pages deploy — nothing in the client reads a column comment.

**Check**: `select col_description('public.people_pay_config'::regclass, attnum) from pg_attribute where attrelid = 'public.people_pay_config'::regclass and attname = 'vehicle_rate_override'` reads the new sentence.

**Applied** to prod on 2026-11-08, read the same day: `npm run check:migration-drift` from the coordinating session's worktree read 1164 local files and 1164 remote versions, fully applied, this file among them; pushed right after #7284 merged, the first migration of the night. Types regenerated from prod through #7301 (`chore(types)` after the night's six migrations).
