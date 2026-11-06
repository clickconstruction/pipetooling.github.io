---
name: "A crew member on a development's job reads no plan set, and a helper none at all"
number: 272
group: ready
status: found 2026-11-06 by the SQL bed of v2.6583 (#7131, punch list #239's last code item); not started
summary: >
  The job window's Plans section is drawn for everyone on the job, and Add our as-built is the crew's press
  (v2.6298, v2.6345). The database shows them nothing to add it to. A part owned by a development is read through
  the developments row under the caller's own RLS, which admits the office, estimators, primaries, superintendents
  and a master's shares and never a crew; and a helper on any job's part reads nothing without a clock session
  linking them to the job, since the on-site gate asks jobs_ledger and the team table under their RLS, where a
  helper sees neither. So the crew's as-built has only ever worked for a subcontractor on a job outside any
  development. Every walk of #239 was the dev's, which is why nobody saw it.
next: One migration and a bed, then a walk as a helper and as a subcontractor on a ZZ Test development's job.
size: S (one migration, one bed, a walk)
blocker: None. The write rule is ready for it (plan_set_crew_on_job, v2.6583, a definer); only the read gate is closed.
ver: —
opinion: open plan_part_can_see with a definer read of the caller's own crew jobs for the part, as helper_on_job (v2.5526) did for thread notes; do not widen developments_select, which the Development page and its money read through
---

# A crew member reads the plans of the job they are on (#272)

## The finding

Found 2026-11-06 by the bed `plan_sets_author` (v2.6583, migration `20261106180000`), whose first run put two jobs on a development and signed in as a subcontractor on one job's crew: he read no part. Two gates close the read.

- **A development's part**: `plan_part_can_see(part)` (migration `20261101210000`) reads a development's part through `EXISTS (SELECT 1 FROM developments WHERE id = p.development_id)` under the caller's own RLS. `developments_select` (`20260907050000`) admits the office, estimators, primaries, superintendents and a master's shares. A subcontractor or a helper on the crew of a job on the site reads no row, so no part, so no set, so no as-built press that lands.
- **A helper on any job**: for a job-owned part the gate asks `on_site_can_touch_job(job)` (`20261029010000`), which reads `jobs_ledger` and `jobs_ledger_team_members` under the caller's RLS. The ledger admits no helper, and the team table's SELECT policy leaves helpers out (the trap `20261014220000` named for thread notes), so a helper reads the part only when a clock session links them to the job.

The write rule is ready: `plan_set_crew_on_job(job_id, part_id)` (v2.6583) is a definer with `row_security = off`, and the bed proves it answers true for a helper on the crew whose own crew row the team table hides.

## The plan

1. **One migration**: `plan_part_can_see(part)` gains a third branch, a definer read of the caller's own crew jobs naming the part — `EXISTS (SELECT 1 FROM jobs_ledger j WHERE j.plan_part_id = p.id AND public.helper_on_job(j.id))` run as a definer with row security off, so a helper and a subcontractor on the crew read the part their job builds from, on a development or not. `plan_parts_select` reads the row's own columns (a policy that calls the function on its own table recurses), so it gains the same branch inline through a definer helper. Nothing on `developments_select`: the Development page and its money read through it. `plan_part_can_write` is unchanged, since it starts from `plan_part_can_see` and adds the five office roles.
2. **A bed**: a subcontractor and a helper on the crew of a development's job read the part, its sets and their own as-built, keep an as-built, and read nothing of another part's job they are not on; the office unchanged. Extend `plan_sets_author` or cut `plan_part_crew_read`.
3. **A walk**: on the dev server as a helper (Settings → View as) on a ZZ Test development's job, Documents → Plans reads *Building from* and *Add our as-built* lands; delete the rows after.

## How to verify

The bed, then the walk above. `docs/ACCESS_CONTROL.md` → *Plan sets by part* gets the read rule's new sentence.
