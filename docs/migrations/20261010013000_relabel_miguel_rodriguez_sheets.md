# 20261010013000_relabel_miguel_rodriguez_sheets.sql (2026-10-09, v2.5053)

One of the owner's office-data calls of 2026-10-09, sent by Punchlist: the five sub sheets still labelled "Miguel Rodriguez" carry the keeper's name, `Miguel "Mike" Rodriguez`. It is done as a data migration, on the user's word in Helper 4's session.

## Why a migration

- No roster person is named "Miguel Rodriguez" any more.
- Each of the five sheets is already linked to the keeper (`people` `d1c06d87-3033-4a2e-88dc-23d8174d5c76`) in `people_labor_job_assignees`, so only the label is stale.
- So the app's two tools don't reach them. Combine people's step 3 starts from a roster person. People → Subs' **Assign** lists only sheets linked to nobody.
- The full sheet editor would delete and re-create each sheet's items, and rewrite its address, job, rate and date from the form, to change one name.

The stale label is not harmless. `sync_assignees_on_write` rebuilds a sheet's links from its label on every label write, and "Miguel Rodriguez" resolves to nobody. So the next edit of any of these sheets would have dropped its link to the keeper.

## What it does

One guarded `UPDATE` of `people_labor_jobs.assigned_to_name`, from "Miguel Rodriguez" to `Miguel "Mike" Rodriguez`:

| Sheet | Job # |
|---|---|
| `b5c7b32a-b78c-4a87-9420-54ccad410ae6` | 892 |
| `2c06f9d4-53b5-4515-a155-b916657c9b82` | 891 |
| `c6dc06c0-8b75-4235-94e5-eb59be49c23e` | 878 |
| `7084016e-dc02-473a-b10e-cefcab46d9ff` | 892 |
| `58e432ac-7e0d-4695-84ab-81ffa2dd7264` | 892 |

- `SET lock_timeout = '3s'` comes first.
- The `WHERE` names the five ids and the old label, so a second run changes nothing.

**The triggers on the change:**
- `sync_assignees_on_write` rebuilds each sheet's link from the new label. `resolve_pay_person_id('Miguel "Mike" Rodriguez')` is the keeper, so the five links come back the same.
- `people_labor_jobs_link_job_ledger_biu` changes nothing, because every sheet already has its job and its number is unchanged.
- `people_labor_jobs_stage_to_activity_upd` fires only on a stage change, so the Activity feed gets no line.
- The link table has no archive trigger, so Recently deleted gets nothing either.

## Checked before the PR

Read-only on prod, 2026-10-09. The local Postgres bed could not start: the Mac's shared memory was used up by other servers.
- The `WHERE` matches exactly five rows.
- The trigger's own rebuild query, run on the new label, returns the keeper once. On the old label it returns no one.
- Neither branch of the job-link trigger applies to the five rows.

## Push

Punchlist pushes it after merge.

## Verify after the push

- The five rows read `Miguel "Mike" Rodriguez`.
- `people_labor_job_assignees` still holds one row per sheet for `d1c06d87…`.
- People → Subs still shows `Miguel "Mike" Rodriguez` with 5 sheets.
