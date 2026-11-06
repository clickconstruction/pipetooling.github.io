---
name: "The crew's job window has no Plans section, so Add our as-built never reaches a helper or a subcontractor"
number: 276
group: ready
status: found 2026-11-06 on the walk of v2.6604 (punch list #272); not started
summary: >
  Punch list #239 built the Plans section with Add our as-built into the job window's Documents tab
  (v2.6298, v2.6345) and wrote that everyone on the job has the press. The job window a helper or a
  subcontractor gets is the read-only one (resolveJobWindowMode gives the full window to dev, master,
  assistant, controller and primary alone; estimators and superintendents get the read-only one too),
  and it carries one Plans row, Open plans on the job's mirrored link, and no Documents tab. So the
  crew's as-built press has never been on a crew member's screen; only the five roles who open the full
  window have pressed it. v2.6604 opened the database to the crew's read of a
  development's part, so the rows are theirs to read and write now; the screen is not.
next: Mount the crew's view of the Plans section (Building from with Open, Our as-builts, Add our as-built with Photos or a PDF) in the read-only window where the Open plans row sits, for the roles that window serves, and walk it as the sample helper on a ZZ Test development's job.
size: S (one component mounted in a second window, its render smoke, the guide's words)
blocker: None in the code. Which roles the read-only window serves is a product fact to keep; nothing opens that the database does not already allow.
ver: —
opinion: mount JobPlansSection with canWrite false in DetailJobModal's files row for every role that window serves; the section already draws the crew's presses and the office's apart, and the database (plan_set_crew_on_job, plan_part_crew_can_see) holds the crew to their own as-builts on their own jobs
---

# Add our as-built on the crew's own screen (#276)

## The finding

On the walk of v2.6604 (2026-11-06), signed in as the sample helper on a ZZ Test job inside the ZZ Test development: the Dashboard's *Job detail* opened the read-only window (`DetailJobModal`), whose plans are one row, **Open plans** on `jobs_ledger.job_plans_link` (the mirror writes the current set's link there). No Documents tab, no *Building from*, no *Our as-builts*, no **Add our as-built**. `resolveJobWindowMode` (`src/lib/jobDetailModalRole.ts`) gives the full window (`JobWindowModal`, whose Documents tab mounts `JobPlansSection`) to the office roles alone, so the press written for the crew (v2.6298, v2.6345, the guide *keep the plans on a job*) has only ever been pressed by the office.

The database side is done: `plan_set_crew_on_job` (v2.6583) lets a crew member keep an as-built on a job they are on, and `plan_part_crew_can_see` (v2.6604) lets them read the part their job builds from, on a development too.

## The plan

1. **`DetailJobModal.tsx`**: where `DetailJobModalFilesPlansRow` draws **Open plans**, mount `JobPlansSection` for the job (the component reads its own rows through `planSetsIo` and draws *Building from*, *Older sets* folded, *Our as-builts* and **Add our as-built**; its `canWrite` is false for these roles, so no **+ New set**). Keep **Open plans** as it is for a job with no part.
2. **Smoke**: `DetailJobModal`'s render test gains the section for a helper; `JobPlansSection.render.test.tsx` already covers the crew's presses.
3. **Guide** *keep the plans on a job*: the *Save the crew's as-built* step says where a helper finds it (the job's card on the Dashboard or Job Mode's *Job detail*); `roles` gains `subcontractor, helpers`.
4. **Walk** as the sample helper and the sample subcontractor (Settings → View as) on a ZZ Test development's job: *Building from* reads, **Add our as-built** lands with a photo, the row shows under *Our as-builts*; delete the rows after.

## How to verify

The walk above at 1280 and 375, and the render smokes. `docs/twins/APP_DIRECTORY.md`'s job-window line says who has the press.
