-- Job splits and optional person attribution for Mercury banking rows (Sorting).
-- Staff: dev, master_technician, assistant.

CREATE TABLE public.mercury_transaction_job_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mercury_transaction_id uuid NOT NULL REFERENCES public.mercury_transactions (id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs_ledger (id) ON DELETE CASCADE,
  amount numeric(18, 4) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id),
  CONSTRAINT mercury_transaction_job_allocations_tx_job_unique UNIQUE (mercury_transaction_id, job_id)
);

CREATE INDEX mercury_transaction_job_allocations_mercury_transaction_id_idx
  ON public.mercury_transaction_job_allocations (mercury_transaction_id);

CREATE INDEX mercury_transaction_job_allocations_job_id_idx
  ON public.mercury_transaction_job_allocations (job_id);

COMMENT ON TABLE public.mercury_transaction_job_allocations IS
  'Splits a Mercury transaction amount across jobs; line amounts are signed and should sum to mercury_transactions.amount when any lines exist.';

CREATE TABLE public.mercury_transaction_attributions (
  mercury_transaction_id uuid PRIMARY KEY REFERENCES public.mercury_transactions (id) ON DELETE CASCADE,
  person_id uuid REFERENCES public.people (id)
);

COMMENT ON TABLE public.mercury_transaction_attributions IS
  'Optional person attribution for a Mercury transaction (at most one person per transaction).';

ALTER TABLE public.mercury_transaction_job_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mercury_transaction_attributions ENABLE ROW LEVEL SECURITY;

-- Banking staff: dev, master, assistant (inline to avoid new helper dependency)
CREATE POLICY "mercury_transaction_job_allocations staff select"
  ON public.mercury_transaction_job_allocations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  );

CREATE POLICY "mercury_transaction_job_allocations staff insert"
  ON public.mercury_transaction_job_allocations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  );

CREATE POLICY "mercury_transaction_job_allocations staff update"
  ON public.mercury_transaction_job_allocations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  );

CREATE POLICY "mercury_transaction_job_allocations staff delete"
  ON public.mercury_transaction_job_allocations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  );

CREATE POLICY "mercury_transaction_attributions staff select"
  ON public.mercury_transaction_attributions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  );

CREATE POLICY "mercury_transaction_attributions staff insert"
  ON public.mercury_transaction_attributions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  );

CREATE POLICY "mercury_transaction_attributions staff update"
  ON public.mercury_transaction_attributions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  );

CREATE POLICY "mercury_transaction_attributions staff delete"
  ON public.mercury_transaction_attributions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mercury_transaction_job_allocations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mercury_transaction_attributions TO authenticated;

-- Masters can read Mercury ledger (assistants + devs already have policies)
CREATE POLICY "mercury_transactions master select"
  ON public.mercury_transactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'master_technician'
    )
  );

COMMENT ON POLICY "mercury_transactions master select" ON public.mercury_transactions IS
  'master_technician can read Mercury transactions for Banking (Sorting) and allocations.';

-- Atomic replace: validates sum when at least one split row; allows zero rows (unallocated)
CREATE OR REPLACE FUNCTION public.replace_mercury_transaction_splits(
  p_mercury_transaction_id uuid,
  p_rows jsonb,
  p_person_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx_amount numeric(18, 4);
  v_sum numeric(18, 4);
  v_len int;
  elem jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('dev', 'master_technician', 'assistant')
  ) THEN
    RAISE EXCEPTION 'replace_mercury_transaction_splits: not authorized';
  END IF;

  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'replace_mercury_transaction_splits: p_rows must be a JSON array';
  END IF;

  SELECT t.amount INTO v_tx_amount
  FROM public.mercury_transactions t
  WHERE t.id = p_mercury_transaction_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'replace_mercury_transaction_splits: transaction not found';
  END IF;

  v_len := jsonb_array_length(p_rows);

  SELECT COALESCE(SUM((e->>'amount')::numeric(18, 4)), 0) INTO v_sum
  FROM jsonb_array_elements(p_rows) AS e;

  IF v_len > 0 AND v_sum IS DISTINCT FROM v_tx_amount THEN
    RAISE EXCEPTION 'replace_mercury_transaction_splits: allocation sum must equal transaction amount';
  END IF;

  DELETE FROM public.mercury_transaction_job_allocations
  WHERE mercury_transaction_id = p_mercury_transaction_id;

  FOR elem IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    INSERT INTO public.mercury_transaction_job_allocations (
      mercury_transaction_id,
      job_id,
      amount,
      created_by
    )
    VALUES (
      p_mercury_transaction_id,
      (elem->>'job_id')::uuid,
      (elem->>'amount')::numeric(18, 4),
      auth.uid()
    );
  END LOOP;

  IF p_person_id IS NULL THEN
    DELETE FROM public.mercury_transaction_attributions
    WHERE mercury_transaction_id = p_mercury_transaction_id;
  ELSE
    INSERT INTO public.mercury_transaction_attributions (mercury_transaction_id, person_id)
    VALUES (p_mercury_transaction_id, p_person_id)
    ON CONFLICT (mercury_transaction_id) DO UPDATE SET person_id = EXCLUDED.person_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.replace_mercury_transaction_splits(uuid, jsonb, uuid) IS
  'Replaces job splits for a Mercury transaction; optional person attribution. Sum of split amounts must equal transaction amount when there is at least one split.';

REVOKE ALL ON FUNCTION public.replace_mercury_transaction_splits(uuid, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_mercury_transaction_splits(uuid, jsonb, uuid) TO authenticated;
