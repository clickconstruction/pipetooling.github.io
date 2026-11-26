# 20261120070000 — on_site_door_facts (v2.8103)

Materials on site (punch list #407): what the Job Mode card's Materials on site press says of a job's site, in one read. No table is created, so no fence is owed. Replaced by [`20261126014752_box_due_a_count`](./20261126014752_box_due_a_count.md) (v2.8612, punch list #398), whose `due` leaves out an added part's own count and counts only a box with a line to count.

**`on_site_door_facts(p_job_id uuid)` → jsonb**, `LANGUAGE sql`, `STABLE`, **`SECURITY INVOKER`**: `job_containers`, `job_material_movements`, `box_stickers` and `sticker_runs` each answer under the caller's own RLS, so the numbers are what that person can open. Granted to `authenticated`; revoked from `anon` and `PUBLIC`.

The site is `on_site_site_job_ids(p_job_id)`, every job of the job's development, with the job itself always among them, so a reader who cannot read the ledger row still counts the one job.

| Key | What it is |
|---|---|
| `boxes` | Live containers on the site that are not Unsorted. |
| `due` | Of those, the ones never counted or last counted 14 days ago or more. The rule is `countIsDue` with `STALE_COUNT_DAYS = 14` in `src/lib/materials/onSite.ts`, the `stale` of `jobMaterialsSummary`. A count is a `counted` row whose `from_container_id` is the box, and a press taken back is left out. |
| `stickers` | Stickers of the site's runs that are on no box and not lost: the screens' *reserved*. |

The client is `fetchSiteDoorFacts` in `src/lib/materials/siteBoxCountIo.ts`, read by `useSiteDoorFacts` for the card.

## Order

The client may deploy before the push. A database without the function answers `PGRST202`, and `fetchSiteDoorFacts` then falls back to the head count of v2.8050 with nothing due and no stickers, so the press keeps its number and only the line under it waits. `check:calls-ahead` still labels the PR *push right after the merge*, since the client names the function. Push with `bash scripts/db-push.sh` from a checkout of main.

**Checked before the merge**, read only, 2026-11-20: the function's body run as a plain query against prod for three jobs. The ZZ test job answered 3 boxes and 2 due, and the dev seat's `read_on_site` on the same job, which reads the app's own kernel, listed the same two boxes as due a count. The one real site answered every box due, which fits a first count seventeen days before. A job on no site with nothing on it answered zeros.

**Verify** after the push, read only: `call_read on_site_door_facts { p_job_id: <a job> }` through the dev seat, against `read_on_site`'s `due_a_count` on a job that is its whole site.

**Applied** to prod 2026-11-21 at 01:06 UTC with `bash scripts/db-push.sh`, after the freeze runbook's Step 0 read answered in 0.2 s. The drift check then read 1,411 versions applied against 1,411 local files. Read back, read only: the function answered 3 boxes, 2 due and 9 stickers for the ZZ test job, and `read_on_site` listed the same two boxes as due a count. The API answers an anonymous caller with a refusal and not a missing name, so the schema cache holds the function. The dev seat's `call_read` does not know the name until the seat is deployed with the regenerated catalog.
