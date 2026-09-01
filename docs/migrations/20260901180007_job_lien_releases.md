# 20260901180007_job_lien_releases.sql (2026-09-01, v2.2582)

Creates `public.job_lien_releases` — one row per waiver-and-release document
generated from the Jobs board (`LienReleaseModal`, v2.2579), so releases can be
listed in the Bill Customer modal, badge the Stages row, and drive the
"payment cleared → issue the unconditional release" Needs You nudge.

- Columns: `job_id` FK → jobs_ledger (CASCADE), `invoice_ids uuid[]` snapshot
  of the covered bill lines, `form_type` (conditional_progress /
  unconditional_progress / unconditional_final), `amount`, `through_date`,
  `signed_date`, `fields jsonb` (the rendered LienWaiverFields snapshot),
  `created_by`, `voided_at` (mistaken records are voided, not deleted).
- RLS: select/insert/update for the office set (`is_dev()` / `is_assistant()`
  / the job's master via `jobs_ledger.master_user_id`); insert additionally
  requires `created_by = auth.uid()`; delete is dev-only. Ends with both
  `apply_read_only_write_blocks()` and `apply_read_only_stmt_blocks()`.
- Coordination: additive and idempotent; the client fails soft everywhere it
  reads the table (strip hides, badge stays plain, nudge stays quiet), so
  apply order vs the client deploy is not critical. Applied during the v2.2582
  PR merge window; types regenerated with `gen-types:linked` in the same PR.
