-- Company documents (v2.941): a dev-maintained list of always-current company
-- docs (Bank Deposit Details, I-9, Certificate of Insurance, ...) — name + link
-- — that office staff (assistants, estimators, masters) open on demand from
-- Settings → Your account. "Most recent copy" = the dev updates the link;
-- updated_at shows staff how fresh it is.

CREATE TABLE IF NOT EXISTS public.company_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  link_url text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.company_documents IS 'Dev-maintained company document links (Settings → Your account → Company documents). Office roles read; devs manage.';

DROP TRIGGER IF EXISTS update_company_documents_updated_at ON public.company_documents;
CREATE TRIGGER update_company_documents_updated_at BEFORE UPDATE ON public.company_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Office staff read company documents" ON public.company_documents;
CREATE POLICY "Office staff read company documents" ON public.company_documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
        AND u.role IN ('dev', 'master_technician', 'assistant', 'controller', 'estimator')
    )
  );

DROP POLICY IF EXISTS "Devs insert company documents" ON public.company_documents;
CREATE POLICY "Devs insert company documents" ON public.company_documents
  FOR INSERT WITH CHECK (public.is_dev());
DROP POLICY IF EXISTS "Devs update company documents" ON public.company_documents;
CREATE POLICY "Devs update company documents" ON public.company_documents
  FOR UPDATE USING (public.is_dev()) WITH CHECK (public.is_dev());
DROP POLICY IF EXISTS "Devs delete company documents" ON public.company_documents;
CREATE POLICY "Devs delete company documents" ON public.company_documents
  FOR DELETE USING (public.is_dev());

-- Training-mode write blocks (required for every CREATE TABLE — see CLAUDE.md).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
