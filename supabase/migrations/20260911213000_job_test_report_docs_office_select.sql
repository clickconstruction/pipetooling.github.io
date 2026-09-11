SET lock_timeout = '3s';

-- Test reports PR 13 (v2.3331): the office reads the stored test-report PDFs.
-- Documents → Jobs lists every sent report as a child row that opens the exact
-- file the GC received, through a client-minted signed URL. Until now the
-- job-test-reports bucket had no client policies at all (the send function
-- writes with the service role; the portal door mints links server-side).
-- Read only, office set (dev · assistant-like · master · primary), and only
-- for jobs the same predicate as the table's RLS reaches. Paths are
-- <job_id>/<report_id>-v<n>.pdf, so the first folder is the job. Idempotent.

INSERT INTO storage.buckets (id, name, public)
VALUES ('job-test-reports', 'job-test-reports', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS job_test_report_docs_office_select ON storage.objects;
CREATE POLICY job_test_report_docs_office_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'job-test-reports'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND (
      public.is_dev()
      OR public.is_assistant()
      OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.role IN ('master_technician', 'primary'))
    )
    AND public.can_reach_job_for_test_report(((storage.foldername(name))[1])::uuid)
  );
