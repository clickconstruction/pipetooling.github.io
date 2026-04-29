-- PO Generator: allow entries without a supply house.

ALTER TABLE public.material_po_generator_entries
  ALTER COLUMN supply_house_id DROP NOT NULL;

COMMENT ON COLUMN public.material_po_generator_entries.supply_house_id IS
  'Optional supply house for Materials PO Generator entries.';

CREATE OR REPLACE FUNCTION public.insert_material_po_generator_entry (
  p_job_ledger_id uuid,
  p_for_user_id uuid,
  p_supply_house_id uuid DEFAULT NULL,
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

  IF p_supply_house_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.supply_houses WHERE id = p_supply_house_id) THEN
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
  'Materials PO Generator: inserts one ledger row with a unique random 5-digit po_code; optional supply_house_id; enforces job access for dev/master/assistant.';
