SET lock_timeout = '3s';

-- v2.3718 — PO code: write down what they said they need AFTER the code lands
-- (to-dos/po-generator-stated-need, punch list #25, PR 2).
--
-- v2.3599 asked for the claim by name on both doors and read it back on the invoice
-- form; the ledger then showed what that bought: of the codes minted since, none carried a
-- claim, and in five months one real claim was ever typed. The box sits before Generate, and
-- the office mints the code first — the tech is asking for a number, not offering a list.
-- So the question moves to after the code: the just-minted card asks it while the tech is
-- still on the line, and any ledger row with nothing written down can take it later.
--
-- `material_po_generator_entries` had no update door at all (the insert RPC is the only
-- writer; no UPDATE policy). This adds one that changes `notes` and nothing else, gated
-- exactly as `insert_material_po_generator_entry` gates the mint: dev / master_technician /
-- assistant, with access to the row's job. Owner-bypass of RLS is what makes the UPDATE
-- possible; the read_only_block_stmt trigger on the table still fires inside it, so a
-- training-mode user is refused as everywhere else. Idempotent (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION public.set_material_po_generator_stated_need(p_id uuid, p_notes text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_job uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant')
  ) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  SELECT e.job_ledger_id INTO v_job
  FROM public.material_po_generator_entries e
  WHERE e.id = p_id;

  IF v_job IS NULL THEN
    RAISE EXCEPTION 'PO code not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.jobs_ledger jl
    WHERE jl.id = v_job
      AND (
        jl.master_user_id = auth.uid()
        OR public.is_dev()
        OR EXISTS (SELECT 1 FROM public.master_assistants ma WHERE ma.master_id = auth.uid() AND ma.assistant_id = jl.master_user_id)
        OR EXISTS (SELECT 1 FROM public.master_assistants ma WHERE ma.master_id = jl.master_user_id AND ma.assistant_id = auth.uid())
        OR public.assistants_share_master(auth.uid(), jl.master_user_id)
      )
  ) THEN
    RAISE EXCEPTION 'job not accessible';
  END IF;

  UPDATE public.material_po_generator_entries
  SET notes = NULLIF(btrim(p_notes), '')
  WHERE id = p_id;
END;
$$;

COMMENT ON FUNCTION public.set_material_po_generator_stated_need(uuid, text) IS
  'PO Generator: writes (or clears, on blank) what they said they need on one minted code — the only column that changes after the mint. Same gate as insert_material_po_generator_entry: dev / master_technician / assistant with access to the row''s job (v2.3718).';

REVOKE EXECUTE ON FUNCTION public.set_material_po_generator_stated_need(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_material_po_generator_stated_need(uuid, text) TO authenticated;
