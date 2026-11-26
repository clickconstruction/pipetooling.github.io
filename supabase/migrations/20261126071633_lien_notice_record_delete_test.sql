SET lock_timeout = '3s';

-- Presses nothing takes back (punch list #443, row 1): deleting a test notice record takes its Activity line too.
--
-- A § 53.056 notice recorded by hand is one job_lien_filings row with by_hand set, and its insert trigger
-- (job_lien_filings_to_activity_ins, 20261019030000) writes one job_activity_events line of type lien_notice_sent
-- whose detail names the record (source_id). Since v2.8567 a developer deletes a voided by-hand record of a ZZ test
-- job from the job's Lien window, a direct delete under the table's own dev policy. The line stayed, because
-- job_activity_events has a read policy and no other (20260608010000): only SECURITY DEFINER code writes it. Three
-- records deleted that way on a ZZ Test job left three lines that name nothing. The owner's answer of 2026-11-25:
-- build the take-backs that need a migration, each on its own yes.
--
-- Two functions, as the take-backs of this card are built: SECURITY DEFINER, a developer alone, a test job alone,
-- and a refusal in words when anything points at the row.
--
--   delete_test_lien_notice_record(p_filing_id)     refuses nobody signed in, anyone but a dev, a record that is not
--                                                   there, a record that is not a § 53.056 notice recorded by hand,
--                                                   a live record, a record on a job that is not a ZZ test job
--                                                   (job_is_zz_test, 20261120163000), and a record a desk paper, a
--                                                   bill's pay offer, another record or a sent copy points at, in
--                                                   the Lien window's own sentences. Then it deletes the record's
--                                                   Activity line and the record, in the one transaction.
--   delete_test_lien_notice_stray_lines(p_job_id)   refuses the same callers, a job that is not there and a job
--                                                   that is not a ZZ test job. Then it deletes the job's
--                                                   lien_notice_sent lines whose source_id names no record at all:
--                                                   the lines the earlier deletes left. None is an answer.
--
-- Both set row_security = off. Each is owned by the owner of both tables, which row security does not bind, so the
-- setting changes nothing today. It is there so that a function that ever ran as a role row security does bind would
-- raise, where without it the delete of the line would reach no row without a word and the record would go alone.
--
-- No table, policy, grant or trigger is made or changed, so no fence is owed. job_activity_events keeps its one read
-- policy: a direct DELETE still reaches no row for anyone. job_lien_filings keeps its dev delete policy. Every
-- statement is safe to run twice.

CREATE OR REPLACE FUNCTION public.delete_test_lien_notice_record(p_filing_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_rec public.job_lien_filings%ROWTYPE;
  v_n integer;
  v_lines integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'Only a developer can delete a notice record.' USING ERRCODE = 'P0001';
  END IF;
  -- The row is held until this transaction ends: a tie made at the same moment waits, then finds the record gone
  -- and is refused by its own foreign key, where an ON DELETE SET NULL would otherwise clear it without a word.
  SELECT * INTO v_rec FROM public.job_lien_filings WHERE id = p_filing_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The record is not there any more. Read the window again.' USING ERRCODE = 'P0001';
  END IF;
  IF v_rec.kind <> 'notice_53_056' OR NOT v_rec.by_hand THEN
    RAISE EXCEPTION 'Only a notice recorded by hand can be deleted.' USING ERRCODE = 'P0001';
  END IF;
  IF v_rec.voided_at IS NULL THEN
    RAISE EXCEPTION 'Void this record first.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.job_is_zz_test(v_rec.job_id) THEN
    RAISE EXCEPTION 'Only a record on a test job can be deleted. This job is a real one.' USING ERRCODE = 'P0001';
  END IF;

  -- What points at the record, in the order and the words of lienByHandTiesProblem (src/lib/jobs/lienByHandRecordDelete.ts).
  SELECT count(*) INTO v_n FROM public.job_lien_desk_items i WHERE i.sent_filing_id = p_filing_id;
  IF v_n > 0 THEN
    RAISE EXCEPTION '% tied to this record. It stays.', CASE WHEN v_n = 1 THEN 'A paper on the Lien desk is' ELSE v_n::text || ' papers on the Lien desk are' END USING ERRCODE = 'P0001';
  END IF;
  SELECT count(*) INTO v_n FROM public.jobs_ledger_invoices b WHERE b.lien_offer_filing_id = p_filing_id;
  IF v_n > 0 THEN
    RAISE EXCEPTION '% this record. It stays.', CASE WHEN v_n = 1 THEN 'A bill’s pay offer names' ELSE 'The pay offers of ' || v_n::text || ' bills name' END USING ERRCODE = 'P0001';
  END IF;
  SELECT count(*) INTO v_n FROM public.job_lien_filings f WHERE f.applied_from = p_filing_id;
  IF v_n > 0 THEN
    RAISE EXCEPTION '% applied from this one. It stays.', CASE WHEN v_n = 1 THEN 'Another record was' ELSE v_n::text || ' other records were' END USING ERRCODE = 'P0001';
  END IF;
  -- sent_documents.source_id is a uuid with no foreign key: the copy names any table by source_table.
  SELECT count(*) INTO v_n FROM public.sent_documents s WHERE s.source_table = 'job_lien_filings' AND s.source_id = p_filing_id;
  IF v_n > 0 THEN
    RAISE EXCEPTION '% this record. It stays.', CASE WHEN v_n = 1 THEN 'A sent copy names' ELSE v_n::text || ' sent copies name' END USING ERRCODE = 'P0001';
  END IF;

  -- The line the insert trigger wrote: this job's, of this type, naming this record. The trigger wrote the id as text.
  DELETE FROM public.job_activity_events e
  WHERE e.job_id = v_rec.job_id
    AND e.event_type = 'lien_notice_sent'
    AND e.detail ->> 'source_id' = p_filing_id::text;
  GET DIAGNOSTICS v_lines = ROW_COUNT;

  DELETE FROM public.job_lien_filings f
  WHERE f.id = p_filing_id
    AND f.kind = 'notice_53_056'
    AND f.by_hand
    AND f.voided_at IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The record is not there any more. Read the window again.' USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object('ok', true, 'job_id', v_rec.job_id, 'activity_lines', v_lines);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_test_lien_notice_record(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_test_lien_notice_record(uuid) TO authenticated;

COMMENT ON FUNCTION public.delete_test_lien_notice_record(uuid) IS
  'Punch list #443, row 1: a developer deletes one voided § 53.056 notice record made by hand, on a job whose name or customer starts with ZZ, with its line on the job''s Activity (job_activity_events, lien_notice_sent, source_id), in one transaction. Refuses everything else in words, and a record a desk paper, a bill''s pay offer, another record or a sent copy points at. Answers { ok, job_id, activity_lines }.';

CREATE OR REPLACE FUNCTION public.delete_test_lien_notice_stray_lines(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_lines integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'Only a developer can clear Activity lines.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.jobs_ledger j WHERE j.id = p_job_id) THEN
    RAISE EXCEPTION 'The job is not there any more.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.job_is_zz_test(p_job_id) THEN
    RAISE EXCEPTION 'Only a test job’s Activity lines can be cleared. This job is a real one.' USING ERRCODE = 'P0001';
  END IF;

  -- A stray line names a record that is in the table no more, on any job. The id is compared as the text the trigger
  -- wrote, so a source_id that is no uuid cannot raise. A line that names nothing is left alone.
  DELETE FROM public.job_activity_events e
  WHERE e.job_id = p_job_id
    AND e.event_type = 'lien_notice_sent'
    AND btrim(coalesce(e.detail ->> 'source_id', '')) <> ''
    AND NOT EXISTS (SELECT 1 FROM public.job_lien_filings f WHERE f.id::text = e.detail ->> 'source_id');
  GET DIAGNOSTICS v_lines = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'job_id', p_job_id, 'activity_lines', v_lines);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_test_lien_notice_stray_lines(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_test_lien_notice_stray_lines(uuid) TO authenticated;

COMMENT ON FUNCTION public.delete_test_lien_notice_stray_lines(uuid) IS
  'Punch list #443, row 1: a developer clears, on a job whose name or customer starts with ZZ, the lien_notice_sent lines of the job''s Activity whose source_id names no job_lien_filings row: the lines left by notice records deleted before delete_test_lien_notice_record took the line too. A line that names a standing record or names nothing stays. Answers { ok, job_id, activity_lines }, and zero is an answer.';
