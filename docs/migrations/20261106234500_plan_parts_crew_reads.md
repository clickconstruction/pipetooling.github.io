# 20261106234500_plan_parts_crew_reads.sql (2026-11-06, v2.6604)

Plan sets by part, punch list #272. The read gate `plan_part_can_see` (`20261101210000`) opened a part two ways, both under the caller's own RLS: a development's part through its `developments` row, which `developments_select` shows the office, estimators, primaries, superintendents and a master's shares and never a crew; and a job's own part through `on_site_can_touch_job`, the job in the ledger or on its team. A job outside any development owns its part and the ledger shows the crew their jobs, so that way was open; a job on a development builds from a part the development owns, and no crew member reads the development, so a subcontractor or a helper on such a job read no part, no set, and the job window's *Add our as-built* (v2.6298, v2.6345) found nothing to add to. The SQL bed `plan_sets_author` found it on 2026-11-06 (v2.6583, `20261106180000`); the card's second claim, that a helper read no part on any job without a clock session, the bed's first run of this half disproved: the ledger shows a helper on the crew their job.

## What it does

- **`plan_part_crew_can_see(p_part_id)`** → boolean: the signed-in user is on the crew of a job that builds from the part (`jobs_ledger.plan_part_id`) or owns it (`plan_parts.job_id`), crew as `helper_on_job` (`20261014220000`) reads it: the team table, or a schedule block on the job this week or last. `SECURITY DEFINER`, `row_security = off`, `search_path = public`, as `helper_on_job` and `plan_set_crew_on_job` are. Execute: `authenticated`, `service_role`; revoked from `PUBLIC` and `anon`.
- **`plan_part_can_see(p_part_id)`**: the two branches of `20261101210000` and a third, `plan_part_crew_can_see(p.id)`.
- **`plan_parts_select`**: the row's own columns as before (a policy that calls `plan_part_can_see` on its own table recurses) and the third branch inline, `plan_part_crew_can_see(id)`; the definer reads `plan_parts` with row security off, so it does not come back into this policy.

## What stays

`developments_select` as it was: the Development page and its money read through it, and a crew member still reads no development row (the Plans section's *Building from* names the part, not the site). `plan_part_can_write` starts from `plan_part_can_see` and adds the five office roles, so the crew still writes nothing on a part and, on a set, only an as-built or a paper on a job they are on (`plan_set_crew_on_job`, `20261106180000`). `plan_sets_select` reads `plan_part_can_see(part_id)` and so opens with it. The restrictive fences (training mode, the twin fence, the archived seal, primary scope) still apply on top. No client file changes: `planSetsIo.ts` reads the same rows.

## Checked before the push

Idempotent: `CREATE OR REPLACE`, `DROP POLICY IF EXISTS` and `CREATE POLICY` by name. No `CREATE TABLE`, so no fence calls. The SQL bed `plan_sets_author` (`npm run test:pg:plan-sets-author`, in `scripts/sql-beds.txt`) applies every migration in order and this one a second time, then its second half signs in as a subcontractor and a helper on the crew of a development's job: both read no development row, yet the part, its set and their own as-built there, read nothing of the development's other part, and keep an as-built; the office reads every part.

## After the push

Regenerate `src/types/database.ts` and the dev-mcp catalog for the new function (`supabase gen types`, `npm run gen:dev-mcp-catalog`), then `supabase functions deploy dev-mcp`. The live check: on the dev server, Settings → View as a helper and a subcontractor on a ZZ Test development's job, the job window's Documents → Plans reads *Building from* and *Add our as-built* lands; delete the rows after; `npm run check:migration-drift`.
