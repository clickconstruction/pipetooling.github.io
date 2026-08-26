# 20260826171756_checklist_items_due_date.sql — optional due date on checklist items (v2.2349)

`checklist_items.due_date date NULL` + check constraint
`checklist_items_due_after_start` (`due_date IS NULL OR due_date >= start_date`,
added idempotently via pg_constraint probe). Start (`start_date`) = when the
task appears; due = when it's late; NULL = legacy behavior, no backfill.
One-offs only in v1 (UI-enforced, not DB-constrained). Occurrences still
materialize on `start_date` — due is item metadata. Additive; existing RLS
covers it. Client + reminder-cron re-keying land separately (Tier 2b).
