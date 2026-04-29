-- PO Generator ledger (Materials tab): unique 5-digit codes with job-scoped RLS for dev/master/assistant.

CREATE TABLE public.material_po_generator_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_code integer NOT NULL CHECK (po_code >= 10000 AND po_code <= 99999),
  job_ledger_id uuid NOT NULL REFERENCES public.jobs_ledger (id) ON DELETE CASCADE,
  for_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  supply_house_id uuid NOT NULL REFERENCES public.supply_houses (id) ON DELETE RESTRICT,
  notes text,
  created_by uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT material_po_generator_entries_po_code_unique UNIQUE (po_code)
);

CREATE INDEX idx_material_po_generator_entries_job_ledger_id
  ON public.material_po_generator_entries (job_ledger_id);

CREATE INDEX idx_material_po_generator_entries_created_at
  ON public.material_po_generator_entries (created_at DESC);

COMMENT ON TABLE public.material_po_generator_entries IS
  'Materials PO Generator tab: ledger rows with a random 5-digit PO code; visibility follows jobs_ledger access for dev/master/assistant.';

ALTER TABLE public.material_po_generator_entries ENABLE ROW LEVEL SECURITY;

-- dev / master_technician / assistant: same job visibility as jobs_ledger (excluding primary-only shortcuts).
CREATE POLICY material_po_generator_entries_select_authenticated
ON public.material_po_generator_entries
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant')
  )
  AND EXISTS (
    SELECT 1
    FROM public.jobs_ledger jl
    WHERE jl.id = material_po_generator_entries.job_ledger_id
      AND (
        jl.master_user_id = auth.uid()
        OR public.is_dev ()
        OR EXISTS (
          SELECT 1
          FROM public.master_assistants ma
          WHERE ma.master_id = auth.uid ()
            AND ma.assistant_id = jl.master_user_id
        )
        OR EXISTS (
          SELECT 1
          FROM public.master_assistants ma
          WHERE ma.master_id = jl.master_user_id
            AND ma.assistant_id = auth.uid ()
        )
        OR public.assistants_share_master (auth.uid (), jl.master_user_id)
      )
  )
);

-- No INSERT/UPDATE/DELETE policies: clients use insert_material_po_generator_entry (SECURITY DEFINER).

CREATE OR REPLACE FUNCTION public.insert_material_po_generator_entry (
  p_job_ledger_id uuid,
  p_for_user_id uuid,
  p_supply_house_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS TABLE (out_id uuid, out_po_code integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt int;
  v_code int;
  v_new_id uuid;
  v_inserted_code int;
BEGIN
  IF auth.uid () IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid ()
      AND u.role IN ('dev', 'master_technician', 'assistant')
  ) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.jobs_ledger jl
    WHERE jl.id = p_job_ledger_id
      AND (
        jl.master_user_id = auth.uid ()
        OR public.is_dev ()
        OR EXISTS (
          SELECT 1
          FROM public.master_assistants ma
          WHERE ma.master_id = auth.uid ()
            AND ma.assistant_id = jl.master_user_id
        )
        OR EXISTS (
          SELECT 1
          FROM public.master_assistants ma
          WHERE ma.master_id = jl.master_user_id
            AND ma.assistant_id = auth.uid ()
        )
        OR public.assistants_share_master (auth.uid (), jl.master_user_id)
      )
  ) THEN
    RAISE EXCEPTION 'job not accessible';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_for_user_id) THEN
    RAISE EXCEPTION 'user not found';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.supply_houses WHERE id = p_supply_house_id) THEN
    RAISE EXCEPTION 'supply house not found';
  END IF;

  FOR v_attempt IN 1..50 LOOP
    v_code := 10000 + floor(random() * 90000)::integer;
    BEGIN
      INSERT INTO public.material_po_generator_entries (
        po_code,
        job_ledger_id,
        for_user_id,
        supply_house_id,
        notes,
        created_by
      )
      VALUES (
        v_code,
        p_job_ledger_id,
        p_for_user_id,
        p_supply_house_id,
        NULLIF (trim(p_notes), ''),
        auth.uid ()
      )
      RETURNING
        material_po_generator_entries.id,
        material_po_generator_entries.po_code
        INTO v_new_id,
        v_inserted_code;

      RETURN QUERY
      SELECT
        v_new_id,
        v_inserted_code;

      RETURN;
    EXCEPTION
      WHEN unique_violation THEN
        NULL;
    END;
  END LOOP;

  RAISE EXCEPTION 'could not allocate unique PO code';
END;
$$;

COMMENT ON FUNCTION public.insert_material_po_generator_entry (uuid, uuid, uuid, text) IS
  'Materials PO Generator: inserts one ledger row with a unique random 5-digit po_code; enforces job access for dev/master/assistant.';

REVOKE ALL ON FUNCTION public.insert_material_po_generator_entry (uuid, uuid, uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.insert_material_po_generator_entry (uuid, uuid, uuid, text) TO authenticated;

GRANT SELECT ON public.material_po_generator_entries TO authenticated;
