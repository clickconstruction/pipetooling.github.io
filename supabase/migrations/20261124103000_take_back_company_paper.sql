SET lock_timeout = '3s';

-- Punch list #403, the walks of 2026-11-24: no press took back a trade company's own paper. Take back on Documents →
-- Agreements (20261123, the owner's answer: delete the paper and end its link) deletes an outside party's paper under
-- the table's own policy, and left a trade company's own paper out on purpose: GC mode sends those too, and keeps a
-- record of each ask that only a dev reads. The office also sends a sub's company its papers from People → Contracts
-- (step 6), with no GC ask behind them, and one sent by mistake stayed with its signing link live for 14 days.
--
--   * take_back_company_paper(p_document_id) deletes one paper that is a trade company's own (company_id set), not
--     signed, required by no job and replaced by no newer copy. The signing link lives on the row, so it ends with it.
--     Nobody is emailed. Answers 'taken'; 'signed' when the paper was signed or received before the press, and is
--     kept; 'gone' when it is not there any more.
--   * What it refuses in words: a paper that is not a trade company's (a party's is taken back on its own line, under
--     the table's policy); a paper a job requires; a paper a newer copy replaced; and a paper GC mode is waiting on.
--     GC mode's ask is gc_trade_promises: gc_send_paper opens one for the company with the paper's kind (an agreement
--     keeps msa, a W-9 w9, a certificate insurance, the mapping gc_company_paper_kept keeps them by) and nothing but
--     the signed paper keeps it. Deleting the paper under an open ask would leave GC mode chasing a paper that is
--     gone, so that paper stays GC mode's, as it was. The rule is by kind, not by paper: an open ask for an agreement
--     holds every waiting agreement of that company. It deletes less, never more.
--   * What it leaves: the email that went out (gc_trade_messages, and the sent copy), and the company on the bench.
--     gc_remove_bench_company keeps a company we emailed, by its own rule, unchanged.
--   * SECURITY DEFINER, since gc_trade_promises reads under a dev's policy and the leader takes a paper back too. The
--     door is the app's own rule for deleting a paper anywhere, the leader and a dev (is_master_or_dev()), said in
--     words; a training account, a digital twin and an archived caller are refused first, since a definer passes
--     their fences.
--   * No table is made, so no fence call closes the file. CREATE OR REPLACE: a second run changes nothing.

CREATE OR REPLACE FUNCTION public.take_back_company_paper(p_document_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v record;
  v_kind text;
  v_due date;
  v_paper text;
  v_company text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to take a paper back.' USING ERRCODE = 'P0001';
  END IF;
  -- Who may: whoever deletes a paper anywhere in the app, the leader and a dev.
  IF NOT public.is_master_or_dev() THEN
    RAISE EXCEPTION 'Only the leader or a dev takes a paper back.' USING ERRCODE = '42501';
  END IF;
  -- A definer passes the read-only blocks, the twin fence and the archived seal, so each is said here before the write.
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot take a paper back.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot take a paper back.' USING ERRCODE = '42501';
  END IF;
  IF public.caller_is_archived() THEN
    RAISE EXCEPTION 'An archived account cannot take a paper back.' USING ERRCODE = '42501';
  END IF;
  IF p_document_id IS NULL THEN
    RAISE EXCEPTION 'Pick the paper to take back.' USING ERRCODE = 'P0001';
  END IF;

  SELECT d.id, d.status, d.company_id, d.job_id, d.job_required_paper_id, d.doc_type, d.document_name
  INTO v
  FROM public.person_contract_documents d
  WHERE d.id = p_document_id
  FOR UPDATE;
  -- Someone else took it back, or this press landed twice.
  IF NOT FOUND THEN
    RETURN 'gone';
  END IF;
  IF v.company_id IS NULL THEN
    RAISE EXCEPTION 'That paper is not a trade company''s own, so it is not taken back here.' USING ERRCODE = 'P0001';
  END IF;
  -- A signed paper is the agreement itself, and a received certificate is kept as one is.
  IF v.status IN ('signed', 'received') THEN
    RETURN 'signed';
  END IF;

  v_paper := coalesce(nullif(btrim(v.document_name), ''), 'This paper');
  SELECT coalesce(nullif(btrim(c.name), ''), 'the company') INTO v_company FROM public.gc_companies c WHERE c.id = v.company_id;
  v_company := coalesce(v_company, 'the company');

  IF v.status NOT IN ('unsent', 'sent') THEN
    RAISE EXCEPTION '% stays with %, since it is neither waiting nor unsent.', v_paper, v_company USING ERRCODE = 'P0001';
  END IF;
  IF v.job_id IS NOT NULL OR v.job_required_paper_id IS NOT NULL THEN
    RAISE EXCEPTION '% stays with %, since a job requires it. It comes off on the job.', v_paper, v_company USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.person_contract_documents newer WHERE newer.supersedes_person_contract_document_id = v.id) THEN
    RAISE EXCEPTION '% stays with %, since a newer copy replaced it. The newer copy is the live paper.', v_paper, v_company USING ERRCODE = 'P0001';
  END IF;

  -- GC mode's ask for this kind of paper, about the company itself (no job, no trade): open until the paper is signed.
  v_kind := CASE v.doc_type WHEN 'agreement' THEN 'msa' WHEN 'w9' THEN 'w9' WHEN 'coi' THEN 'insurance' END;
  IF v_kind IS NOT NULL THEN
    SELECT p.due_on INTO v_due
    FROM public.gc_trade_promises p
    WHERE p.company_id = v.company_id AND p.kind = v_kind AND p.kept_on IS NULL AND p.project_id IS NULL AND p.package_id IS NULL
    LIMIT 1;
    IF FOUND THEN
      RAISE EXCEPTION '% stays with %, since GC mode asked for it by %. It is GC mode''s paper to chase.', v_paper, v_company, to_char(v_due, 'FMMon FMDD')
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  DELETE FROM public.person_contract_documents WHERE id = v.id;
  RETURN 'taken';
END;
$$;

COMMENT ON FUNCTION public.take_back_company_paper(uuid) IS
  'Punch list #403: take back a trade company''s own paper (person_contract_documents with company_id) that is not signed. Deletes the row, so its signing link ends; nobody is emailed. Answers taken, signed (signed or received before the press, kept) or gone (not there any more). Refuses in words a paper that is not a trade company''s, one a job requires, one a newer copy replaced, and one GC mode is waiting on (an open gc_trade_promises row of the paper''s kind about the company itself). SECURITY DEFINER, since the ask reads under a dev''s policy: the leader and a dev (is_master_or_dev()); a training account, a digital twin and an archived caller are refused first.';

REVOKE ALL ON FUNCTION public.take_back_company_paper(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.take_back_company_paper(uuid) TO authenticated, service_role;
