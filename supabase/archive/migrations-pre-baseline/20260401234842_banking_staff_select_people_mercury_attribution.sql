-- Banking "Link to jobs & person": staff need to pick any roster person for Mercury attribution.
-- Existing people SELECT policies are master-scoped (shares, superintendent adoption); the client
-- loads all non-archived people for the dropdown, so RLS must allow dev / master / assistant to read
-- the full non-archived roster (same staff who can edit mercury_transaction_attributions).

CREATE POLICY "Banking staff read non-archived people for mercury attribution"
  ON public.people
  FOR SELECT
  TO authenticated
  USING (
    archived_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  );

COMMENT ON POLICY "Banking staff read non-archived people for mercury attribution" ON public.people IS
  'Lets dev, master, and assistant load the full roster for Mercury transaction person attribution (Banking modal).';
