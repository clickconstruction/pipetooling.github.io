# 20261103030000_imported_clock_sessions.sql (2026-11-03, v2.6425)

Imported clock sessions: the days the app never recorded, put on the clock by a dev as ordinary rows.

- **`clock_sessions.origin` admits `imported`** beside `user_punch` and `salary_schedule` (the check is re-added `NOT VALID` and then validated, so the table is never rewritten under a long lock). The insert policies still admit only `user_punch`; an imported row is written by the function below or the service role and by nothing else.
- **One imported row a person, a day and a job**: the partial unique index `clock_sessions_imported_one_a_day_a_job`. A second run of the same rows inserts nothing.
- **`import_clock_sessions(p_rows jsonb)`** — `SECURITY DEFINER`, EXECUTE to `authenticated`, refused inside unless `is_dev()`. Each row carries `user_id`, `job_ledger_id`, `work_date`, `clocked_in_at`, `clocked_out_at` and a `notes` that names the source; a row is refused, by name and reason, when the person is unknown or a sample, the job is unknown or billing-only, out is not after in or more than sixteen hours after it, the day is not the clock-in's calendar day in the company's zone, or the note is empty. The rest still go in. Answers `{ inserted, skipped, refused: [{ row, reason }] }`.
- **No table, no policy, no fence calls**: `clock_sessions` already has them. The rows land unapproved; `approve_clock_sessions_v2` treats them as any pending session (the typed-hours triggers record only `user_punch`, so nobody is held), and the crew-day and first/last-work-date triggers run as for a punch.

**Apply order**: nothing in the client calls the function, so the client may deploy first or last. Push, then run the import from a dev seat; the rows the Gray Fox work needs are built outside the repo (the bank's payouts, the trip ledger and the person's own word are not in git).

Bed: `supabase/tests/typed_hours/50_imported_scenarios.sql` (the widened check, the controller refused, two rows in and the rerun skipping both, six refusals with their reasons, no typed entry and the importing dev's approval landing the day in the pay).

**Applied** to prod by 2026-11-04: `npm run check:migration-drift` read 1105 local files and 1105 remote versions, fully applied (read in the docs pass after #6888); `check:edge-drift` read every one of the 178 functions deployed and current the same day; types regenerated from prod in #6929.
