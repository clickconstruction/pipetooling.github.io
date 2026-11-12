SET lock_timeout = '3s';

-- A person matter's text documents are a dev's alone, like the rest of the matter.
--
-- 20261105220000 gave every table that hangs on a matter a restrictive <table>_person_dev_only policy, so a matter
-- standing on a person (legal_matters.kind = 'person') is read and written by devs only. Three days later
-- 20261108210000 made `documents` the one documents table and let it hold a matter's text documents (matter_id),
-- with the office's permissive policies beside the devs' (matter_id IS NOT NULL AND legal_office_can_read()), and
-- `document_revisions` the same. Neither table got the fence. So the words of a .md or .txt filed on a PERSON matter
-- could be read at the table, and on `documents` changed, by a master, an assistant or a controller, while the matter
-- and its Evidence row were closed to them. No screen opens that door; the table did.
--
-- This migration adds the two missing fences in the same form as the other five. Restrictive: they only ever narrow
-- what the permissive policies allow. A person's own documents (person_id set, matter_id null) and an account
-- matter's documents read and write exactly as before. The firm's portal reads as the service role and is not bound.
-- Idempotent: each policy is made only when it is missing.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['documents', 'document_revisions'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = t || '_person_matter_dev_only') THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (matter_id IS NULL OR NOT public.legal_matter_is_person(matter_id) OR public.is_dev()) WITH CHECK (matter_id IS NULL OR NOT public.legal_matter_is_person(matter_id) OR public.is_dev())',
        t || '_person_matter_dev_only', t
      );
    END IF;
  END LOOP;
END $$;

COMMENT ON POLICY documents_person_matter_dev_only ON public.documents IS
  'A text document on a matter that stands on a person is a dev''s alone, on every verb: the fence the five older legal tables carry (20261105220000), which this table missed when it took in matter documents (20261108210000).';
COMMENT ON POLICY document_revisions_person_matter_dev_only ON public.document_revisions IS
  'A prior version of a text document on a matter that stands on a person is a dev''s alone: the fence of documents_person_matter_dev_only, on its history.';
