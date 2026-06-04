-- Organization-wide Banking note per Mercury transaction (shared by dev / master_technician / assistant).
-- Writes via upsert_mercury_org_transaction_note; direct INSERT/UPDATE/DELETE revoked from authenticated.

CREATE TABLE public.mercury_transaction_org_notes (
  mercury_transaction_id uuid NOT NULL PRIMARY KEY REFERENCES public.mercury_transactions (id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT ''::text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users (id),
  CONSTRAINT mercury_transaction_org_notes_body_len CHECK (char_length(body) <= 2000)
);

CREATE INDEX mercury_transaction_org_notes_updated_at_idx
  ON public.mercury_transaction_org_notes (updated_at DESC);

COMMENT ON TABLE public.mercury_transaction_org_notes IS
  'Organization-wide Banking note per Mercury transaction; not synced to Mercury.';

ALTER TABLE public.mercury_transaction_org_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mercury_transaction_org_notes_select_banking"
  ON public.mercury_transaction_org_notes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  );

CREATE POLICY "mercury_transaction_org_notes_insert_banking"
  ON public.mercury_transaction_org_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  );

CREATE POLICY "mercury_transaction_org_notes_update_banking"
  ON public.mercury_transaction_org_notes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  );

CREATE POLICY "mercury_transaction_org_notes_delete_banking"
  ON public.mercury_transaction_org_notes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  );

GRANT SELECT ON public.mercury_transaction_org_notes TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.mercury_transaction_org_notes FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.mercury_transaction_org_notes FROM anon;

GRANT ALL ON public.mercury_transaction_org_notes TO service_role;

CREATE OR REPLACE FUNCTION public.upsert_mercury_org_transaction_note(
  p_mercury_transaction_id uuid,
  p_body text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  v_body text := trim(both FROM coalesce(p_body, ''));
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'upsert_mercury_org_transaction_note: not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = uid AND role IN ('dev', 'master_technician', 'assistant')
  ) THEN
    RAISE EXCEPTION 'upsert_mercury_org_transaction_note: not authorized';
  END IF;

  IF char_length(v_body) > 2000 THEN
    RAISE EXCEPTION 'upsert_mercury_org_transaction_note: note too long';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.mercury_transactions t WHERE t.id = p_mercury_transaction_id
  ) THEN
    RAISE EXCEPTION 'upsert_mercury_org_transaction_note: transaction not found';
  END IF;

  IF v_body = '' THEN
    DELETE FROM public.mercury_transaction_org_notes
    WHERE mercury_transaction_id = p_mercury_transaction_id;
    RETURN;
  END IF;

  INSERT INTO public.mercury_transaction_org_notes (
    mercury_transaction_id,
    body,
    updated_at,
    updated_by
  )
  VALUES (p_mercury_transaction_id, v_body, now(), uid)
  ON CONFLICT (mercury_transaction_id)
  DO UPDATE SET
    body = excluded.body,
    updated_at = now(),
    updated_by = uid;
END;
$$;

COMMENT ON FUNCTION public.upsert_mercury_org_transaction_note(uuid, text) IS
  'Insert/update/delete (empty body) organization Banking note for a Mercury transaction. Roles: dev, master_technician, assistant.';

REVOKE ALL ON FUNCTION public.upsert_mercury_org_transaction_note(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_mercury_org_transaction_note(uuid, text) TO authenticated;
