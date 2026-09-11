# 20260911213000_job_test_report_docs_office_select.sql (2026-09-11, v2.3331)

Test reports PR 13 (fragment `docs/recent-features/v2.3331.md`): Documents → Jobs lists test reports.

- Ensures the private `job-test-reports` bucket exists (`ON CONFLICT DO NOTHING` — the send function created it out of band with PR 3).
- **`job_test_report_docs_office_select`** on `storage.objects`: SELECT for `authenticated` on that bucket, office set only (dev · assistant-like · master · primary) and only when `can_reach_job_for_test_report(<first path folder>)` — the same predicate as the table's RLS. The folder must look like a uuid before the cast. No INSERT/UPDATE/DELETE for clients: the send function and the auto-sender write with the service role, and a stored PDF is never edited.
- Until this, the bucket had no client policies (the portal's `open-test-report-pdf` mints links server-side). The Documents page mints a five-minute signed URL client-side, the `job-contract-documents` pattern.

Storage policies are DDL on `storage.objects`; this one is tracked here rather than out of band so the ledger shows it. Apply with `supabase db push` after merge; the client fails soft (a toast) until it lands. No types change.
