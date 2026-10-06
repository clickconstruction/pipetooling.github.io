# 20261006234000_gc_plan_sets_questions.sql (2026-10-06, v2.4691)

GC mode, the real build, step 3: the plan sets and the questions about them, from the prototype's model (`to-dos/gc-mode/NEW_PROJECT_REAL_BUILD.md` → *The tables*, on branch `spike/gc-mode`). Four tables and one foreign key; nothing reads or writes them yet.

- **`gc_plan_sets`**: one row per set (`rev` 0 is the first), `label`, `kind` (bid · pricing · permit for the first; addendum · bulletin · revised · permit · construction after), `issued_on`, `note`, `checked_by_user_id`, and the Drive link on the set: `drive_url`, `drive_access` (anyone · restricted, null until checked), `drive_checked_on`. Unique per project and rev.
- **`gc_plan_set_items`**: what a set did to each sheet and section, one row each: `kind` (sheet · section), `number`, `title`, `change` (issued · revised · added · removed · renamed), `was_title`, `discipline`, `page`. The first set's rows are all issued; the sheets at any set are a fold over these rows (`sheetsAtRev`, `specsAtRev` in `src/lib/gc/plans.ts`).
- **`gc_plan_questions`**: a question about the plans, from a company (`company_id`, the Board's record once it exists, so no foreign key yet) or from us; sent to the architect, answered, who the answer went to, the set that carried it.
- **`gc_plan_set_sends`**: which companies a set reached and whether it `touched` their trade, with the email's `email_send_log` row. Unique per set and company.
- **`gc_scope_items.added_in_set_id`** gains its foreign key to `gc_plan_sets` (step 2 left the column bare), guarded by a `pg_constraint` check so a rerun is a no-op.

RLS: one `FOR ALL` policy per table for `is_dev()`, like step 2. Ends with the three block calls.

Apply order: after `20261006233000_gc_projects_trades_scope.sql` (the push's timestamp order). No client reads these tables until steps 4 to 9. Additive and idempotent.
