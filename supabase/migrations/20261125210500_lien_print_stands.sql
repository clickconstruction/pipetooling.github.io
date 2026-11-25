SET lock_timeout = '3s';

-- Lien desk: *It stands as printed*, on record (v2.8595, punch list #362, step 7).
--
-- Since v2.8589 every lien print keeps what its paper said, and since v2.8593 the run's checklist names a printed
-- notice or affidavit that would say another thing today (*changed since printed*). A person has three answers for a
-- changed paper: print it again, take it out of the run, or say **it stands as printed**: the paper that left the
-- printer is still good, though a statement on it has moved.
--
-- The owner's answer of 2026-11-25 to where that is kept: *on record, in a table of its own*, with who, when and what
-- had changed, so every office seat sees it, and *a second change asks again*. This is that table.
--
-- One row each time a person says a changed paper stands. `change_key` is the client's short key for the difference
-- that was on the screen (`lienPrintChangeKey`, `src/lib/jobs/lienPrintSworn.ts`): the fields that moved, with the
-- value printed and the value now. The row answers for that difference alone. If a statement moves again the key is
-- another, no live row matches it, and the desk asks again. `changes` keeps the same difference in words, for the
-- record. A row is taken back with a stamp and never deleted.
--
-- A paper is a job's notice or a job's affidavit, named by (job_id, paper), as `lien_run_left_out` names it: an
-- affidavit has no desk item. `sent_document_id` is the filed print the answer was given for, when there is one. It is
-- kept as a plain id with no foreign key: a sent copy is never deleted, and the reference is for a reader, not a rule.
--
-- Saying a paper stands changes nothing on the paper: no notice, affidavit, filing, desk item or sent copy is touched,
-- and no rule about when a paper may go reads this table. Additive and idempotent.

CREATE TABLE IF NOT EXISTS public.lien_print_stands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  -- Which of the job's papers: its § 53.056 notice or its § 53.052 affidavit.
  paper text NOT NULL CHECK (paper IN ('notice', 'affidavit')),
  -- The difference the answer is for, as the client keys it. Another difference is another key.
  change_key text NOT NULL CHECK (length(btrim(change_key)) BETWEEN 1 AND 200),
  -- That difference in words: an array of { key, label, printed, now }.
  changes jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(changes) = 'array'),
  -- The filed print the answer was given for (`sent_documents.id`); null when the print kept no row to name.
  sent_document_id uuid,
  stood_by uuid NOT NULL REFERENCES public.users(id),
  stood_at timestamptz NOT NULL DEFAULT now(),
  -- Taken back: who and when. Both or neither.
  taken_back_by uuid REFERENCES public.users(id),
  taken_back_at timestamptz,
  CONSTRAINT lien_print_stands_taken_back_pair CHECK ((taken_back_at IS NULL) = (taken_back_by IS NULL))
);

COMMENT ON TABLE public.lien_print_stands IS
  'Lien desk (v2.8595, punch list #362 step 7): a person said a printed lien paper (a job''s notice or affidavit) stands as printed though a statement on it has moved. change_key names the difference the answer is for, changes keeps it in words, with who and when. A row taken back keeps its stamp. Written only by set_lien_print_stands; the lien office reads it.';

-- One standing answer a paper and difference: the same press twice writes one row.
CREATE UNIQUE INDEX IF NOT EXISTS lien_print_stands_live_key
  ON public.lien_print_stands (job_id, paper, change_key)
  WHERE taken_back_at IS NULL;

ALTER TABLE public.lien_print_stands ENABLE ROW LEVEL SECURITY;

-- The lien office reads (dev, assistant-like, a master), as it reads lien_run_left_out. No policy writes: the function
-- below is the only way in, so who and when are the server's and never typed.
DROP POLICY IF EXISTS lien_print_stands_select_office ON public.lien_print_stands;
CREATE POLICY lien_print_stands_select_office
  ON public.lien_print_stands FOR SELECT TO authenticated
  USING (
    (SELECT public.is_dev())
    OR (SELECT public.is_assistant())
    OR (SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'master_technician'))
  );

REVOKE ALL ON TABLE public.lien_print_stands FROM anon;
REVOKE ALL ON TABLE public.lien_print_stands FROM authenticated;
GRANT SELECT ON TABLE public.lien_print_stands TO authenticated;
GRANT ALL ON TABLE public.lien_print_stands TO service_role;

-- Say a changed paper stands as printed, or take that back. Answers { ok, stands, changed } or { error } with nothing
-- written.
CREATE OR REPLACE FUNCTION public.set_lien_print_stands(
  p_job_id uuid,
  p_paper text,
  p_stands boolean,
  p_change_key text DEFAULT NULL,
  p_changes jsonb DEFAULT NULL,
  p_sent_document_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_key text := btrim(COALESCE(p_change_key, ''));
  v_changes jsonb := COALESCE(p_changes, '[]'::jsonb);
  v_rows integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;
  IF NOT (
    public.is_dev()
    OR public.is_assistant()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_uid AND u.role = 'master_technician')
  ) THEN
    RETURN jsonb_build_object('error', 'Not authorized to say a lien paper stands as printed');
  END IF;
  IF p_paper IS NULL OR p_paper NOT IN ('notice', 'affidavit') THEN
    RETURN jsonb_build_object('error', 'The paper must be notice or affidavit');
  END IF;
  IF p_stands IS NULL THEN
    RETURN jsonb_build_object('error', 'Say whether the paper stands or the answer is taken back');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.jobs_ledger j WHERE j.id = p_job_id) THEN
    RETURN jsonb_build_object('error', 'Job not found');
  END IF;

  IF p_stands THEN
    IF v_key = '' OR length(v_key) > 200 THEN
      RETURN jsonb_build_object('error', 'Say which change the paper stands through');
    END IF;
    -- Two checks, in this order: the length of something that is not a list is an error, not an answer.
    IF jsonb_typeof(v_changes) <> 'array' THEN
      RETURN jsonb_build_object('error', 'Say what had changed on the paper');
    END IF;
    IF jsonb_array_length(v_changes) = 0 THEN
      RETURN jsonb_build_object('error', 'Say what had changed on the paper');
    END IF;
    INSERT INTO public.lien_print_stands (job_id, paper, change_key, changes, sent_document_id, stood_by, stood_at)
    VALUES (p_job_id, p_paper, v_key, v_changes, p_sent_document_id, v_uid, now())
    ON CONFLICT (job_id, paper, change_key) WHERE taken_back_at IS NULL DO NOTHING;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RETURN jsonb_build_object('ok', true, 'stands', true, 'changed', v_rows > 0);
  END IF;

  -- Taken back: every standing answer for this paper, whatever difference it was for, so no older one stands in.
  UPDATE public.lien_print_stands
     SET taken_back_by = v_uid, taken_back_at = now()
   WHERE job_id = p_job_id AND paper = p_paper AND taken_back_at IS NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'stands', false, 'changed', v_rows > 0);
END;
$$;

COMMENT ON FUNCTION public.set_lien_print_stands(uuid, text, boolean, text, jsonb, uuid) IS
  'Lien desk (v2.8595): say a job''s printed notice or affidavit stands as printed through the difference p_change_key names (p_changes keeps it in words), or take that back, which stamps every standing answer for that paper. The lien office only. Changes nothing about the paper itself.';

REVOKE ALL ON FUNCTION public.set_lien_print_stands(uuid, text, boolean, text, jsonb, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_lien_print_stands(uuid, text, boolean, text, jsonb, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_lien_print_stands(uuid, text, boolean, text, jsonb, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_lien_print_stands(uuid, text, boolean, text, jsonb, uuid) TO service_role;

-- House rules: training mode writes nothing, a twin writes nothing here, an archived caller reads nothing.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
