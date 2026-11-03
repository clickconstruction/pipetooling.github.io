SET lock_timeout = '3s';

-- Search every file deeply (punch list #240): a digital twin reads no file's words. A twin holds the estimator role, so
-- is_office_or_estimator() let the three twins read every job's file text through this table and search_file_index,
-- which runs as the caller. drive-link has refused a twin every action since it was written, and the card says never a
-- twin. A rolled-back read as each role on prod found it. Wrapped in SELECT so a read over many rows asks each question
-- once. Only the policy changes: the office and the estimators read as before, and the service role writes as before.
-- See docs/migrations/20261102215000_file_index_no_twins.md.

DROP POLICY IF EXISTS file_index_select ON public.file_index;
CREATE POLICY file_index_select ON public.file_index
  FOR SELECT TO authenticated USING ((SELECT public.is_office_or_estimator()) AND NOT (SELECT public.is_digital_twin()));
