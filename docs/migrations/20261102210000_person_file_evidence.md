# 20261102210000_person_file_evidence.sql (2026-11-02, v2.6392)

Evidence on a person's HR file as records (the People → Paperwork spike): the day it is about, a title, a memo and its files, filed in Drive by `hr-evidence-drive` (v2.6393).

- **`public.person_file_evidence`** — one row per piece of evidence: `person_id` → `people` (cascade), `entry_id` → `person_file_entries` (the entry it proves, set null on delete), `dated_on` (the day it is ABOUT), `title` (1 to 160 characters), `memo` (up to 4,000), `created_by`, `author_label`, `created_at`, and the Drive stamps `drive_folder_id`, `drive_folder_url`, `filed_at`, `fail_why`. Index on `(person_id, dated_on DESC)`.
- **RLS** — dev only, like every HR table: SELECT and INSERT for `authenticated` under `is_dev()`; **no UPDATE or DELETE policy** on purpose (a record is append-only like an entry; the Drive stamps are written by the service role from the function). `GRANT SELECT, INSERT` to `authenticated`.
- **`public.person_file_attachments`** gains `evidence_id` → `person_file_evidence` (cascade), `drive_file_id`, `drive_url`, `filed_at`, `fail_why`; index on `evidence_id`. A file written before this migration keeps `entry_id` or stands alone; the panel lists those under *Files from before records*.
- The three fence appliers run (read-only training mode, the statement trigger, the digital-twin fence).
- The People folder itself is an `app_settings` row (`drive_people_folder_id`, v2.6393), no DDL.

**Apply order**: the client reads the table fail-soft (42P01 is no records) and a save names the missing table, so the client may deploy first with nothing lost; push right after the merge all the same (`check:calls-ahead` labels the PR), then `npm run gen-types:linked` and the dev seat's catalog (`node scripts/build-dev-mcp-catalog.mjs`, one `dev-mcp` redeploy) so `find_table` lists it. Push this before `20261102213000_hr_evidence_drive_cron.sql` (v2.6393): the cron's clause reads this table.
