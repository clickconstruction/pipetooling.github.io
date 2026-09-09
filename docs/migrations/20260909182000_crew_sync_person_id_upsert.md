# 20260909182000_crew_sync_person_id_upsert.sql (2026-09-09, v2.3199)

Crew-day sync upserts by **person**, not by name. `CREATE OR REPLACE` of `sync_crew_jobs_from_clock(text, date)` only; body otherwise verbatim from `20260909022534_recorded_time_costing.sql`. No trigger, grant or policy changes. Additive and idempotent.

- **Bug**: the function's `INSERT … ON CONFLICT (work_date, person_name)` keys on the clock user's `users.name`, but a `people_crew_jobs` row can already exist for the same person-day under the roster name (`people.name`) with the same `person_id` — e.g. user "Zack" ↔ roster "Zach W" (31 such rows on 2026-09-09). The partial unique index `people_crew_jobs_person_id_work_date_uniq (person_id, work_date)` then rejects the insert with `duplicate key value violates unique constraint …`, and **every clock-session change for that person-day fails** (approve, edit, move to another job). Surfaced by the first cost batch (v2.3196), which repoints 77 sessions to another job — 12 of them this person's.
- **Root cause**: two resolvers disagree. The function used `resolve_pay_person_id_from_clock_user(NULL, name)`, which matches `people.name` only and returns NULL for a login name; the table's BEFORE INSERT trigger `pay_tables_set_person_id` uses `resolve_pay_person_id(name)`, which also matches `users.name → people.account_user_id` and finds the person. The function inserted "no person", the trigger stamped the real `person_id`, and the partial unique index refused the duplicate.
- **Fix**: resolve the person as `COALESCE(resolve_pay_person_id_from_clock_user(NULL, name), resolve_pay_person_id(name))` — the same answer the insert trigger will reach — then `UPDATE … WHERE person_id = … AND work_date = …` first and return if a row was found (its `person_name` stays as the roster wrote it); only otherwise run the by-name upsert. The "nothing recorded" branch deletes by `person_id` as well as by name.
- **Apply**: `supabase db push` after the v2.3199 merge; either order vs the client is safe (server-side only). No type change (same signature).
- **Verify after push** (rolled-back on the dev machine before the PR):

  ```sql
  begin;
  update clock_sessions set job_ledger_id = job_ledger_id where id = '<a session of the mismatched person>';  -- fires the sync trigger
  select person_name, person_id, job_assignments from people_crew_jobs where person_id = '<person>' and work_date = '<that day>';  -- one row, updated
  rollback;
  ```
- **Category**: People / crew days · function
