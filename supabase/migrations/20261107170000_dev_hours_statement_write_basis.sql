SET lock_timeout = '3s';
-- Punch list #212, the dev MCP's charged and sheet papers: dev_hours_statement_write's `make` learns the four columns the
-- Hours statement window has saved since v2.6446 and v2.6097 that the wrapper of 20261103003000 never took — `basis`
-- (paid | charged; with_pay forced off on charged, a sheet paper refused the charged basis as the window holds its
-- switch), `charge_rate` and `charge_words` (what a charged paper was priced by, kept on the row for the list and the
-- print), and `labor_company` (a sub's company on the attestation, at most 160 characters). Everything else is the
-- 20261103003000 body unchanged: mark_sent, file_on_matter, the record id minted per job, the dev as preparer.
-- Devs only; idempotent (CREATE OR REPLACE); no table is created, so no read-only fence is owed.

CREATE OR REPLACE FUNCTION public.dev_hours_statement_write(p jsonb, p_dry_run boolean DEFAULT true, p_file jsonb DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_action text := lower(btrim(COALESCE(p->>'action', 'make')));
  v_job public.jobs_ledger%ROWTYPE;
  v_user public.users%ROWTYPE;
  v_hs public.hours_statements%ROWTYPE;
  v_matter public.legal_matters%ROWTYPE;
  v_person_id uuid;
  v_from date;
  v_to date;
  v_with_pay boolean;
  v_basis text;
  v_charge_rate numeric;
  v_charge_words text;
  v_labor_company text;
  v_kind text;
  v_stated jsonb;
  v_gap_from date;
  v_gap_to date;
  v_snapshot jsonb;
  v_number text;
  v_next integer;
  v_record text;
  v_count integer;
  v_id uuid;
  v_doc jsonb;
  v_doc_reply jsonb;
  v_after jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_dev() THEN
    RAISE EXCEPTION 'dev_hours_statement_write: devs only' USING ERRCODE = '42501';
  END IF;
  IF v_action NOT IN ('make', 'mark_sent', 'file_on_matter') THEN
    RAISE EXCEPTION 'dev_hours_statement_write: action must be make, mark_sent or file_on_matter';
  END IF;

  IF v_action = 'make' THEN
    IF COALESCE(p->>'job_ledger_id', '') !~ '^[0-9a-fA-F-]{36}$' THEN RAISE EXCEPTION 'dev_hours_statement_write: job_ledger_id is required (a jobs_ledger.id)'; END IF;
    SELECT * INTO v_job FROM public.jobs_ledger WHERE id = (p->>'job_ledger_id')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'dev_hours_statement_write: job % not found', p->>'job_ledger_id'; END IF;
    IF COALESCE(p->>'user_id', '') !~ '^[0-9a-fA-F-]{36}$' THEN RAISE EXCEPTION 'dev_hours_statement_write: user_id is required (the worker''s users.id)'; END IF;
    SELECT * INTO v_user FROM public.users WHERE id = (p->>'user_id')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'dev_hours_statement_write: worker % not found', p->>'user_id'; END IF;
    v_person_id := NULLIF(btrim(COALESCE(p->>'person_id', '')), '')::uuid;
    IF v_person_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.people WHERE id = v_person_id) THEN
      RAISE EXCEPTION 'dev_hours_statement_write: person_id % is not a roster row', v_person_id;
    END IF;
    IF COALESCE(p->>'period_start', '') !~ '^\d{4}-\d{2}-\d{2}$' OR COALESCE(p->>'period_end', '') !~ '^\d{4}-\d{2}-\d{2}$' THEN
      RAISE EXCEPTION 'dev_hours_statement_write: period_start and period_end must be days, YYYY-MM-DD';
    END IF;
    v_from := (p->>'period_start')::date;
    v_to := (p->>'period_end')::date;
    IF v_to < v_from THEN RAISE EXCEPTION 'dev_hours_statement_write: period_end comes before period_start'; END IF;
    IF v_to > public.app_today() THEN RAISE EXCEPTION 'dev_hours_statement_write: the period cannot run past today'; END IF;
    v_with_pay := COALESCE((p->>'with_pay')::boolean, true);
    v_kind := COALESCE(p->>'kind', 'clock');
    IF v_kind NOT IN ('clock', 'sheet', 'schedule') THEN RAISE EXCEPTION 'dev_hours_statement_write: kind must be clock, sheet or schedule'; END IF;
    -- The basis (punch list #251's columns, v2.6446): a charged paper carries no pay and prices at the rate the customer is
    -- charged; a sub's sheet is agreed work, so a sheet paper is always as paid, as the window holds the switch.
    v_basis := COALESCE(NULLIF(btrim(p->>'basis'), ''), 'paid');
    IF v_basis NOT IN ('paid', 'charged') THEN RAISE EXCEPTION 'dev_hours_statement_write: basis must be paid or charged'; END IF;
    IF v_basis = 'charged' AND v_kind = 'sheet' THEN RAISE EXCEPTION 'dev_hours_statement_write: a sheet paper is always as paid; leave basis off'; END IF;
    IF v_basis = 'charged' THEN v_with_pay := false; END IF;
    v_charge_rate := CASE WHEN v_basis = 'charged' THEN NULLIF(btrim(COALESCE(p->>'charge_rate', '')), '')::numeric ELSE NULL END;
    IF v_charge_rate IS NOT NULL AND v_charge_rate < 0 THEN RAISE EXCEPTION 'dev_hours_statement_write: charge_rate cannot be negative'; END IF;
    v_charge_words := CASE WHEN v_basis = 'charged' THEN NULLIF(btrim(COALESCE(p->>'charge_words', '')), '') ELSE NULL END;
    -- A sub's company on the attestation (the table's labor_company, at most 160 characters), null when none is named.
    v_labor_company := NULLIF(btrim(COALESCE(p->>'labor_company', '')), '');
    IF length(COALESCE(v_labor_company, '')) > 160 THEN RAISE EXCEPTION 'dev_hours_statement_write: labor_company is at most 160 characters'; END IF;
    v_stated := COALESCE(p->'stated_days', '[]'::jsonb);
    IF jsonb_typeof(v_stated) <> 'array' THEN RAISE EXCEPTION 'dev_hours_statement_write: stated_days must be a list of { day, hours, note, statedBy }'; END IF;
    v_gap_from := NULLIF(btrim(COALESCE(p->>'gap_from', '')), '')::date;
    v_gap_to := NULLIF(btrim(COALESCE(p->>'gap_to', '')), '')::date;
    IF (v_gap_from IS NULL) <> (v_gap_to IS NULL) OR (v_gap_to IS NOT NULL AND v_gap_to < v_gap_from) THEN
      RAISE EXCEPTION 'dev_hours_statement_write: gap_from and gap_to come together, the gap running forward';
    END IF;
    v_snapshot := p->'snapshot';
    IF v_snapshot IS NULL OR jsonb_typeof(v_snapshot) <> 'object' OR NOT (v_snapshot ? 'input') OR NOT (v_snapshot ? 'job') OR NOT (v_snapshot ? 'worker') THEN
      RAISE EXCEPTION 'dev_hours_statement_write: snapshot must carry input, job and worker — the server reads them through get_hours_statement';
    END IF;
    -- The record id as the window mints it: the job's number with its spaces taken out, then one past the highest n
    -- among the job's ids, whatever job number those name (hoursStatementRecord.ts, nextHoursStatementRecordId).
    v_number := regexp_replace(COALESCE(NULLIF(btrim(v_job.hcp_number), ''), NULLIF(btrim(v_job.click_number), ''), left(v_job.id::text, 8)), '\s+', '', 'g');
    SELECT COALESCE(max((regexp_match(record_id, '-(\d{4,})$'))[1]::integer), 0) + 1 INTO v_next FROM public.hours_statements WHERE job_ledger_id = v_job.id;
    v_record := 'HS-' || v_number || '-' || CASE WHEN v_next < 10000 THEN lpad(v_next::text, 4, '0') ELSE v_next::text END;
    SELECT count(*) INTO v_count FROM public.hours_statements WHERE job_ledger_id = v_job.id;
    v_after := jsonb_build_object(
      'record_id', v_record,
      'job_ledger_id', v_job.id, 'user_id', v_user.id, 'person_id', v_person_id,
      'period_start', to_char(v_from, 'YYYY-MM-DD'), 'period_end', to_char(v_to, 'YYYY-MM-DD'),
      'with_pay', v_with_pay, 'basis', v_basis, 'charge_rate', v_charge_rate, 'charge_words', v_charge_words, 'labor_company', v_labor_company, 'kind', v_kind, 'stated_days', v_stated,
      'gap_from', CASE WHEN v_gap_from IS NULL THEN NULL ELSE to_char(v_gap_from, 'YYYY-MM-DD') END,
      'gap_to', CASE WHEN v_gap_to IS NULL THEN NULL ELSE to_char(v_gap_to, 'YYYY-MM-DD') END,
      'state', 'draft', 'prepared_by', auth.uid()
    );
    IF p_dry_run THEN
      RETURN jsonb_build_object(
        'dry_run', true, 'action', 'make',
        'job', jsonb_build_object('id', v_job.id, 'number', v_number, 'name', v_job.job_name, 'site', v_job.job_address),
        'worker', jsonb_build_object('user_id', v_user.id, 'name', v_user.name, 'role', v_user.role),
        'record_id', v_record,
        'statements_on_job', v_count,
        'after', v_after,
        'then', 'The row lands as a draft under the job''s Hours statements and on the worker''s desk, you named as the preparer. With send: { how: email | link } the server then draws the form, mints the signing link and the row reads sent; without it the office sends from the window.'
      );
    END IF;
    INSERT INTO public.hours_statements (job_ledger_id, person_id, user_id, labor_company, period_start, period_end, with_pay, basis, charge_rate, charge_words, kind, stated_days, gap_from, gap_to, snapshot, prepared_by, prepared_at, state, record_id)
    VALUES (v_job.id, v_person_id, v_user.id, v_labor_company, v_from, v_to, v_with_pay, v_basis, v_charge_rate, v_charge_words, v_kind, v_stated, v_gap_from, v_gap_to, v_snapshot, auth.uid(), now(), 'draft', v_record)
    RETURNING id INTO v_id;
    RETURN jsonb_build_object('ok', true, 'statement_id', v_id, 'record_id', v_record, 'state', 'draft', 'job_ledger_id', v_job.id, 'user_id', v_user.id);
  END IF;

  IF COALESCE(p->>'statement_id', '') !~ '^[0-9a-fA-F-]{36}$' THEN RAISE EXCEPTION 'dev_hours_statement_write: statement_id is required (an hours_statements.id)'; END IF;
  SELECT * INTO v_hs FROM public.hours_statements WHERE id = (p->>'statement_id')::uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'dev_hours_statement_write: statement % not found', p->>'statement_id'; END IF;

  IF v_action = 'mark_sent' THEN
    IF v_hs.state = 'signed' THEN RAISE EXCEPTION 'dev_hours_statement_write: % is signed already', v_hs.record_id; END IF;
    IF p_dry_run THEN
      RETURN jsonb_build_object('dry_run', true, 'action', 'mark_sent', 'statement_id', v_hs.id, 'record_id', v_hs.record_id, 'state_before', v_hs.state, 'after', jsonb_build_object('state', 'sent'));
    END IF;
    UPDATE public.hours_statements SET state = 'sent', updated_at = now() WHERE id = v_hs.id;
    RETURN jsonb_build_object('ok', true, 'statement_id', v_hs.id, 'record_id', v_hs.record_id, 'state', 'sent');
  END IF;

  -- file_on_matter
  IF v_hs.state <> 'signed' THEN RAISE EXCEPTION 'dev_hours_statement_write: only a signed statement goes on the matter (% is %)', v_hs.record_id, v_hs.state; END IF;
  IF v_hs.contract_document_id IS NULL THEN RAISE EXCEPTION 'dev_hours_statement_write: % has no signed copy to file', v_hs.record_id; END IF;
  IF v_hs.matter_document_id IS NOT NULL THEN RAISE EXCEPTION 'dev_hours_statement_write: % is on a matter already (document %)', v_hs.record_id, v_hs.matter_document_id; END IF;
  IF COALESCE(p->>'matter_id', '') !~ '^[0-9a-fA-F-]{36}$' THEN RAISE EXCEPTION 'dev_hours_statement_write: matter_id is required (a legal_matters.id)'; END IF;
  SELECT * INTO v_matter FROM public.legal_matters WHERE id = (p->>'matter_id')::uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'dev_hours_statement_write: matter % not found', p->>'matter_id'; END IF;
  v_doc := jsonb_build_object(
    'matter_id', v_matter.id,
    'title', COALESCE(NULLIF(btrim(p->>'title'), ''), 'Signed hours statement ' || v_hs.record_id),
    'shows', COALESCE(NULLIF(btrim(p->>'shows'), ''), 'A worker''s signed statement of the hours worked on this job, ' || v_hs.record_id || '.'),
    'original_name', COALESCE(NULLIF(btrim(p->>'original_name'), ''), v_hs.record_id || ' signed.pdf'),
    'mime', p->>'mime', 'size_bytes', p->'size_bytes', 'sha256', p->>'sha256',
    'dated_on', COALESCE(NULLIF(btrim(p->>'dated_on'), ''), to_char(v_hs.updated_at, 'YYYY-MM-DD')),
    'state', 'final'
  );
  -- The live document wrapper (v2.6004) checks the file facts, the matter and the row, and writes the row at apply.
  v_doc_reply := public.dev_legal_document_write(v_doc, p_dry_run, p_file);
  IF p_dry_run THEN
    RETURN jsonb_build_object(
      'dry_run', true, 'action', 'file_on_matter',
      'statement', jsonb_build_object('id', v_hs.id, 'record_id', v_hs.record_id, 'state', v_hs.state, 'job_ledger_id', v_hs.job_ledger_id, 'user_id', v_hs.user_id),
      'matter', jsonb_build_object('id', v_matter.id, 'payer_name', v_matter.payer_name, 'stage', v_matter.stage),
      'document', v_doc_reply,
      'then', 'The signed PDF is copied onto the matter''s Evidence tab under Documents from the office, dated the signing day, and the statement points at the copy; the firm reads it on its next open and the packet letters it under D.'
    );
  END IF;
  UPDATE public.hours_statements SET matter_document_id = (v_doc_reply->>'document_id')::uuid, updated_at = now() WHERE id = v_hs.id;
  RETURN jsonb_build_object('ok', true, 'statement_id', v_hs.id, 'record_id', v_hs.record_id, 'matter_id', v_matter.id, 'matter_document_id', v_doc_reply->>'document_id', 'storage_path', v_doc_reply->>'storage_path');
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.dev_hours_statement_write(jsonb, boolean, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_hours_statement_write(jsonb, boolean, jsonb) TO authenticated;
COMMENT ON FUNCTION public.dev_hours_statement_write(jsonb, boolean, jsonb) IS
  'The dev MCP''s wrapper for a signed hours statement (v2.6414, punch list #212 PR 5; the basis, the charge columns and labor_company since migration 20261107170000): action make writes the hours_statements row the window would (the record id minted per job, the caller as preparer, with_pay off on the charged basis) from the snapshot the server read; mark_sent moves it to sent after the server sent the link; file_on_matter copies a signed one''s PDF onto a legal matter through dev_legal_document_write (the file stored first, named in p_file) and ties the statement to it. p_dry_run true names what would be written. Devs only.';
