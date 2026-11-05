---
name: The pay tables key on the person, not the name
number: 267
group: ready
status: card written 2026-11-04 after the users-without-login train (#260) shipped; Phase E of the person-identity plan, shelved 2026-10-26, reopened on the dev's word · PR 1's audit run 2026-11-05 (`scripts/audit-pay-keys.sql`, read-only on prod, #7068): 85 rows carry no person_id across ten names, none disagrees with its name; the NOT NULL waits on the owner settling the ten names
summary: >
  The ten pay tables (people_hours, people_pay_config, people_crew_jobs, …) still key on person_name text, with
  person_id filled by a trigger that resolves the name through users.name and people.account_user_id. That is why
  a rename cascades through the pay tables, why two people cannot share a name, and why the backfill had to skip
  two roster records. Every person now has a users row, so the re-key is cheaper than when it was shelved.
next: The owner settles the ten names the audit found on the desk (seven match a users row with no People record, three match nobody); then PR 1's second half, person_id NOT NULL on the ten tables with the trigger refusing a name that resolves to nobody.
size: L
blocker: The measurement on prod; a pay row that resolves to nobody has to be settled by hand first.
ver: v2.6517 · 6511
opinion: build, carefully — it is the last place a person is a string, and it holds the money.
mockup: not required — no screen changes; the keys under them do
---

# The pay tables key on the person, not the name

## The ask

The dev, 2026-11-04: "is there anything else we should do to make it clean and robust and more useful for the future?" — "Yes, make cards" — "do them all here". The owner retired Phase E from the punch list on 2026-10-26; this card reopens it on the dev's word, with the owner told before the key changes.

## What was true on 2026-11-04

- The ten pay tables key by `person_name` (PRIMARY KEY or UNIQUE): `people_pay_config (person_name)`, `people_hours (person_name, work_date)`, `people_crew_jobs (work_date, person_name)`, `people_crew_bids`, `pay_stubs`, `pay_stub_days`, `person_offsets`, `hours_reviewed (person_name, start_date)`, `people_team_members (team_id, person_name)`, `people_hours_display_order (person_name)`. Each carries `person_id → people` filled by `pay_tables_set_person_id` (`20260730164728`) through `resolve_pay_person_id` (`20260722268000`: `users.name → people.account_user_id` first, then a unique unarchived `people.name`), with partial unique indexes on `person_id`.
- `approve_clock_sessions_v2` writes `people_hours` under `trim(users.name)`; `cascadePersonNameInPayTables` renames across the ten on a rename; `combinePeople.ts` renames and re-points them on a combine; `findNameCollision` refuses a hire whose exact name exists.
- The backfill (v2.6517) skipped two roster records because a users row carries their name: a second users row on one name would re-point someone's pay.
- `docs/PERSON_IDENTITY_PLAN.md` holds Phase E: `person_id NOT NULL`, the keys moved off `person_name`, the cascade retired.

## The decision

Re-key in three moves, each a PR that leaves the app working between them: the measurement and the settling; the keys; the readers. `person_name` stays as a display column until the last reader is off it.

## Where it plugs in

- `docs/PERSON_IDENTITY_PLAN.md` (Phase E), `scripts/audit-pay-person-id-phase0.sql`, `20260722268000_person_identity_phase_b_backfill.sql`, `20260730164728_widen_pay_person_id_triggers.sql`, `20260909182000_crew_sync_person_id_upsert.sql`, `20260930160727_typed_hours_second_look.sql` (`approve_clock_sessions_v2`).
- Client: `src/lib/cascadePersonName.ts`, `src/lib/combinePeople.ts`, `src/lib/people/hireWrites.ts` (`findNameCollision`, `upsertPayConfigRow`), `src/lib/people/rosterPeople.ts` (`PayRosterIndex` by name), the Hours grid, Payroll, Review and the Due summaries' readers of `person_name`.
- Beds: `supabase/tests/typed_hours/`, `supabase/tests/employment_stints/`, a new `pay_keys` bed.

## The plan

1. **PR 1 — measure and settle** (S): a read-only audit (`scripts/audit-pay-keys.sql`, over the pooler) of every pay row whose `person_id` is NULL or whose name disagrees with its person; the rows settled by hand on the owner's word; `person_id NOT NULL` on the ten tables once the count is zero, with the trigger refusing a name that resolves to nobody.
2. **PR 2 — the keys** (M): each table's key moved to `person_id` (plus its date or team), `person_name` kept as a column the trigger fills from the person; `approve_clock_sessions_v2` and the crew syncs write by `person_id`; the cascade on rename becomes a no-op kept for one release; the bed.
3. **PR 3 — the readers** (M): the client reads and joins by `person_id` (`PayRosterIndex`, the Hours grid, Payroll, Review, Due, the combine), `findNameCollision` goes, two people may share a name; `cascadePersonNameInPayTables` deleted; the plan doc's Phase E marked done.

## How to verify

- PR 1: the audit prints zero rows before the NOT NULL migration pushes.
- PR 2: the typed-hours and employment-stints beds green; after the push, approving a session for a person renamed on the desk lands on the same pay rows.
- PR 3: on the dev server, rename a `ZZ Test` person and read their Hours, Payroll and Review unchanged; hire a second person with the same name and see both paid apart.
