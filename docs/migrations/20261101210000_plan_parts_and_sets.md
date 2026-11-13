# 20261101210000_plan_parts_and_sets.sql (2026-11-01, v2.6297)

Plan sets by part, the ground (punch list #239, PR 1). The owner's two cases, 2026-11-01: *on a project they often get an updated set halfway through, or make their own as-builts and want to save them with the build.* The read-out on the Gray Fox development found the shape of the problem: a bid carries set rows (`bid_plan_sets`, v2.6168) but a job holds one link, nothing carries a set from a bid to the job it becomes, two sets were current at once for two buildings, and ten jobs read *on an older set* with no door to move them.

The design, option D of the read-out: **a set belongs to a part of a site, and each part has one set it builds from.** A job names its part and follows it, so it never needs moving. A job outside any development owns its own part. A bid keeps its own rows and pins what it was priced on. An as-built is a set of kind `as_built`, on the job that made it, marking up the set it built from.

## What it does

**`plan_parts`**: a building or area of a development (`development_id`), or the one part a job outside any development owns (`job_id`); exactly one owner (`plan_parts_one_owner`), one part per job (`plan_parts_job_one`), one name per development (`plan_parts_development_name`). `current_set_id`, `current_set_by`, `current_set_at` say which set the part builds from today and who chose it. `position` orders a development's parts.

**`plan_sets`**: one row per set on a part — `name`, `kind` (`issued` · `addendum` · `bulletin` · `revised` · `permit` · `construction` · `assembled` · `as_built`), `source` (`gc` · `architect` · `ours`), `dated` (the date printed on the sheets), `came_at` (the day it reached us), `memo`, `link` (a Drive folder or file, or `''` while the files are on their way), `replaces_set_id`, `marks_up_set_id` (an as-built's), `job_id` (the job that made an as-built), and the probe columns `bid_plan_sets` keeps (`file_name`, `file_size`, `file_count`, `checked_at`, `check_note`). The part going away takes its sets.

**`jobs_ledger.plan_part_id`**: the part the job builds from. Null until the office names one, so every job reads as it did.

**The mirror**: `job_plans_link` keeps meaning what it meant — the portal, the dashboards and the job window's *Open plans* read it — and now follows the part. `plan_part_mirror_job_links(part)` writes the current set's link onto every job naming the part; the triggers call it when a part's `current_set_id` changes, when the current set's `link` changes, and (`BEFORE`, on the row itself) when a job names a part. `SECURITY DEFINER`, since an estimator may switch a set without the right to update job rows. A set with an empty link changes nothing.

**Who can see and write**: `plan_part_can_see(part)` — the caller sees the part's owner under their own RLS (the development row, or the job in the ledger or on its team, as `on_site_can_touch_job` reads it); not `SECURITY DEFINER`. `plan_part_can_write(part)` — can see, and is dev, master, assistant, controller or estimator. Parts: select by see, insert by the five roles on an owner they can see, update and delete by write. Sets: select by see; insert by write, **or by a crew member on the job for an as-built of ours on the job's own part**; update and delete by write, or by the as-built's own author. `authenticated` reads and writes, `anon` nothing, `service_role` all. Three house calls at the end, two new tables.

## What stays

`bids.plans_link` and `bid_plan_sets` are untouched: a bid pins what it was priced on, the robot's link stays the robot's. The Development page's Plans look still reads the bare links until PR 3 reads the parts.

## Checked before the push

The file is idempotent (`IF NOT EXISTS`, `DROP … IF EXISTS` before each policy and trigger, the current-set FK added inside a `DO` block that looks for it first). No SQL bed yet: the functions are two lookups and one mirror `UPDATE`; the first live write is PR 2's, on a ZZ Test job, and the fragment will say what it found.

## After the push

Run `npm run gen:types` in a `chore(types)` PR when convenient; the two tables and the job column are hand-carried in `src/types/database.ts` so PR 2 typechecks before then. The client starts reading and writing parts in PR 2 (the Plans section of the job window's Documents tab); until then the tables stay empty.

**Applied** by 2026-11-01 (`npm run check:migration-drift` then: 1059 local files, 1059 remote versions, fully applied); the two tables and the job column stay hand-carried in `src/types/database.ts` until the next `chore(types)`; PR 2 (v2.6298, #6744) reads and writes them from the job window's Documents tab.
