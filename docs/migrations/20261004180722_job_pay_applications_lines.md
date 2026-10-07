# 20261004180722_job_pay_applications_lines.sql (2026-10-04, v2.4498)

Two columns on `job_pay_applications`:

- `lines jsonb NOT NULL DEFAULT '[]'` (a check keeps it an array) — the G703's lines: `[{ id, label, scheduledValue, labor, stage, fromPrevious, thisPeriod, stored }]`. A line's `id` stays the same from one application to the next, so the next one carries its work forward and a later one is checked against it. An application saved before this keeps an empty list and reads as its one line from `fields` (`linesOfApplication`).
- `split_labor_material boolean NOT NULL DEFAULT false` — print each line as a labor row and a material row.

Additive; the table's policies and fences are unchanged.

Apply order: **migration first, or with the merge**. The old client never names the columns. The new client reads without them on a database that lacks them and saves a one-line application the old way (its line also goes into `fields`); an application with more than one line, or with split rows, is refused with a message until the columns exist (`PayApplicationLinesNotReady`), since saving it without them would lose its lines. Regenerate `src/types/database.ts` after the push.

Test: `supabase/tests/pay_applications/20_scenario.sql` — a new row starts with no lines and no split; lines that are not a list are refused; the office saves lines and the split.
