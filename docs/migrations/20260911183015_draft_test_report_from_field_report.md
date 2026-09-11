# 20260911183015_draft_test_report_from_field_report.sql (2026-09-11, v2.3303)

Test reports PR 4 — dial A (fragment `docs/recent-features/v2.3303.md`). Requires `20260911175738_job_test_reports.sql` (v2.3298).

- **`draft_test_report_from_field_report()`** + trigger **`reports_draft_test_report`** (AFTER INSERT on `reports`, SECURITY DEFINER): for a **Status Report** or **Job Complete** report on a job, reads the job name and every string the tech typed; the type comes from the name (`post test` / `post-level` / `…hydrostatic test post` → post_test; `pre…` → pre_test; `pinpoint`; `gas test`; a bare `hydro` in the name or the wording → pre_test), the verdict from the wording for hydrostatic tests (`fail` / `leaks detected` / `lost water` → FAIL unless "no leaks"; `pass` / `held` / `no hydrostatic loss` → PASS). Inserts one draft `job_test_reports` row (system sewer, 60 minutes, `test_date` = the report's civil date, `source_report_id`, `created_by` = the tech). **One open draft per job and type**: a later report on the same job fills a missing verdict, never adds a row. Any error is a `WARNING` — the report insert always succeeds.
- No backfill: the reports already filed this week were handled by hand.
- Ends with both read-only blocks.

Validated 2026-09-11 in a rolled-back transaction on prod (PR 2's DDL applied first): Johnson Pretest + "Hydrostatic test passed." → one pre_test PASS draft with source and author; a second status report adds no row; a Note on an ordinary job drafts nothing; a Job Complete "Failed - lost 2 inches" on Montolongo Post Test → post_test FAIL.

Apply order: merge, then `supabase db push` (after PR 2's migration). No edge function.
