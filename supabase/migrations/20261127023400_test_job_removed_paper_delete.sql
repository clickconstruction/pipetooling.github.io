SET lock_timeout = '3s';

-- Presses nothing takes back (punch list #443, row 10): the developer deletes a taken-off paper of a test job.
--
-- Take off on a paper's row (job_paper_remove, 20261117220000) sets removed_at and keeps the row, by design:
-- signatures hang on it. The table lets a signed-in person only read (one read policy for the office, and INSERT,
-- UPDATE and DELETE revoked), so every write is a function, and no function deletes. The pane and every read of a
-- job's papers leave a taken-off row out, so on a ZZ test job the rows walks take off pile up where no screen lists
-- them. The owner's answer of 2026-11-25: build the take-backs that need a migration, each on its own yes.
--
-- Two functions, as the take-backs of this card are built: SECURITY DEFINER, a developer alone, a test job alone
-- (job_is_zz_test, 20261120163000), and a refusal in words when anything points at the row. No table, column,
-- policy, grant or trigger is made or changed, so no fence is owed and no table is locked. job_required_papers
-- keeps its one read policy and its revoked writes: a direct DELETE still reaches no row for anyone.
--
--   list_test_job_removed_papers(p_job_id)        the taken-off papers of one test job, newest taken off first, each
--                                                 with what points at it: the copies on people's files
--                                                 (person_contract_documents.job_required_paper_id), the GC
--                                                 proposals made on it (job_paper_proposals.required_paper_id)
--                                                 and taken as it (taken_as), and the papers that are a revision of
--                                                 it (revision_of). The screen draws Delete dead, with the reason,
--                                                 on a row any of those counts is above zero for.
--   delete_test_job_required_paper(p_paper_id)    refuses nobody signed in, anyone but a dev, a paper that is not
--                                                 there, a paper still on its job, a paper of a job that is not a
--                                                 ZZ test job, and a paper anything points at, in words. Then it
--                                                 deletes the one row.
--
-- Why each tie refuses, where the key itself would let the row go: a person's copy would lose its paper without a
-- word (ON DELETE SET NULL) and stand as a copy of nothing, signed or not. A GC's proposal made on the paper would
-- be deleted with it (ON DELETE CASCADE), and a proposal taken as it would lose what it was taken as. A later
-- revision would lose its place in the chain.
--
-- Both set row_security = off, as job_is_zz_test does. Every statement is safe to run twice.

CREATE OR REPLACE FUNCTION public.list_test_job_removed_papers(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_papers jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'Only a developer can read a job’s taken-off papers.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.jobs_ledger j WHERE j.id = p_job_id) THEN
    RAISE EXCEPTION 'The job is not there any more.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.job_is_zz_test(p_job_id) THEN
    RAISE EXCEPTION 'Only a test job’s taken-off papers are listed. This job is a real one.' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', r.id,
           'paper_name', r.paper_name,
           'required_at', r.required_at,
           'removed_at', r.removed_at,
           'copies', (SELECT count(*) FROM public.person_contract_documents d WHERE d.job_required_paper_id = r.id),
           'proposals', (SELECT count(*) FROM public.job_paper_proposals g WHERE g.required_paper_id = r.id),
           'taken_as', (SELECT count(*) FROM public.job_paper_proposals g WHERE g.taken_as = r.id),
           'revisions', (SELECT count(*) FROM public.job_required_papers n WHERE n.revision_of = r.id)
         ) ORDER BY r.removed_at DESC, r.id), '[]'::jsonb)
    INTO v_papers
  FROM public.job_required_papers r
  WHERE r.job_id = p_job_id AND r.removed_at IS NOT NULL;

  RETURN jsonb_build_object('ok', true, 'job_id', p_job_id, 'papers', v_papers);
END;
$$;

REVOKE ALL ON FUNCTION public.list_test_job_removed_papers(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_test_job_removed_papers(uuid) TO authenticated;

COMMENT ON FUNCTION public.list_test_job_removed_papers(uuid) IS
  'Punch list #443, row 10: a developer reads the taken-off papers (removed_at set) of a job whose name or customer starts with ZZ, newest taken off first, each with the counts of what points at it: copies on people''s files, GC proposals made on it and taken as it, and later revisions. Refuses everything else in words. Answers { ok, job_id, papers }.';

CREATE OR REPLACE FUNCTION public.delete_test_job_required_paper(p_paper_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_paper public.job_required_papers%ROWTYPE;
  v_n bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'Only a developer can delete a taken-off paper.' USING ERRCODE = 'P0001';
  END IF;
  -- The row is held until this transaction ends: a copy or a proposal made on it at the same moment waits on its own
  -- key, then finds the paper gone and is refused, where the key would otherwise clear it or take it without a word.
  SELECT * INTO v_paper FROM public.job_required_papers r WHERE r.id = p_paper_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The paper is not there any more. Read the list again.' USING ERRCODE = 'P0001';
  END IF;
  IF v_paper.removed_at IS NULL THEN
    RAISE EXCEPTION 'This paper is still on its job. Take it off first.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.job_is_zz_test(v_paper.job_id) THEN
    RAISE EXCEPTION 'Only a paper of a test job can be deleted. This job is a real one.' USING ERRCODE = 'P0001';
  END IF;

  -- What points at the paper, in the order the list counts it.
  SELECT count(*) INTO v_n FROM public.person_contract_documents d WHERE d.job_required_paper_id = p_paper_id;
  IF v_n > 0 THEN
    RAISE EXCEPTION '% this paper. It stays.', CASE WHEN v_n = 1 THEN 'A copy on a person’s file names' ELSE v_n::text || ' copies on people’s files name' END USING ERRCODE = 'P0001';
  END IF;
  SELECT count(*) INTO v_n FROM public.job_paper_proposals g WHERE g.required_paper_id = p_paper_id;
  IF v_n > 0 THEN
    RAISE EXCEPTION '% made on this paper. It stays.', CASE WHEN v_n = 1 THEN 'A GC proposal was' ELSE v_n::text || ' GC proposals were' END USING ERRCODE = 'P0001';
  END IF;
  SELECT count(*) INTO v_n FROM public.job_paper_proposals g WHERE g.taken_as = p_paper_id;
  IF v_n > 0 THEN
    RAISE EXCEPTION '% taken as this paper. It stays.', CASE WHEN v_n = 1 THEN 'A GC proposal was' ELSE v_n::text || ' GC proposals were' END USING ERRCODE = 'P0001';
  END IF;
  SELECT count(*) INTO v_n FROM public.job_required_papers n WHERE n.revision_of = p_paper_id;
  IF v_n > 0 THEN
    RAISE EXCEPTION '% a revision of this one. Delete the later one first.', CASE WHEN v_n = 1 THEN 'Another paper is' ELSE v_n::text || ' other papers are' END USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.job_required_papers r WHERE r.id = p_paper_id AND r.removed_at IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The paper is not there any more. Read the list again.' USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object('ok', true, 'job_id', v_paper.job_id, 'paper_name', v_paper.paper_name);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_test_job_required_paper(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_test_job_required_paper(uuid) TO authenticated;

COMMENT ON FUNCTION public.delete_test_job_required_paper(uuid) IS
  'Punch list #443, row 10: a developer deletes one taken-off paper (removed_at set) of a job whose name or customer starts with ZZ. Refuses everything else in words, and a paper a person''s copy names, a GC proposal was made on or taken as, or a later revision names. Answers { ok, job_id, paper_name }.';
