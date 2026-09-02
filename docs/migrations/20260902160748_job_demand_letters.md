# 20260902160748_job_demand_letters.sql (2026-09-02, v2.2640)

Final demand letters sent from the Lien instruments modal (phase 2 of the
Lien Instruments plan): one row per letter — the rendered snapshot, recipient,
physical send proof, and the deadline the letter names.

- Columns: `job_id` FK → jobs_ledger (CASCADE), `invoice_ids uuid[]` (covered
  bill lines — drives the deadline watch's "still unpaid" check), `amount`,
  `deadline_date` (partial index where live + set), `fields jsonb` (rendered
  DemandLetterFields snapshot), `recipient_name/email/address`, `sent_method`
  ('' | certified_mail | traceable_courier | email | hand — § 53.003's
  traceable-delivery menu), `tracking_number`, `sent_at` (date — effective on
  mailing), `created_by`, `voided_at` (withdrawn letters void, never delete).
- RLS: same office set as `job_lien_releases` (is_dev / is_assistant / the
  job's master); insert requires `created_by = auth.uid()`; delete dev-only.
  Ends with both `apply_read_only_write_blocks()` and
  `apply_read_only_stmt_blocks()`.
- Additive/idempotent; the client fails soft everywhere it reads the table
  (modal history hides, amber ring stays off, watch stays quiet), so apply
  order vs the client deploy is not critical. Applied during the v2.2640
  merge window; types verified against `gen-types:linked`.
