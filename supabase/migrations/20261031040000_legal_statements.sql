SET lock_timeout = '3s';

-- Affidavits from the Legal desk (punch list #220, v2.6209, PR 2 of six).
--
-- The office made one affidavit by hand in nine steps across four tools, and a date in it was wrong.
-- A STATEMENT is one more kind of legal_matter_entries row, 'statement': occurred_on is the day it is
-- about (where it sits on the Timeline's Said lane; it may be before the matter existed and is never
-- ahead of today), body is the statement's paragraphs, and meta carries
--   { title, affiant: { kind team | witness, user_id, name, role }, form notary | declaration,
--     incident_to, venue_county, state draft | printed | signed, prints: [{ at, by, face, text }],
--     signed_on, hand_changed, document_id, source office | mcp }.
-- It inherits the stream's office read policy, the portal's read, hold-back from counsel
-- (held_overrides key statement:<id>) and undo with a reason.
--
--   1. The kind CHECK gains 'statement' (v4 → v5).
--   2. legal_statement_add — the office's draft, gated like legal_plan_add.
--   3. legal_statement_update — the day, the span, the title, the affiant, the form, the county, the
--      text; NULL leaves a field as it is; refused once the scan is filed (the sworn text is sworn).
--   4. legal_statement_print — appends one print to meta.prints (append-only: when, by whom, which
--      face, the text as printed) and moves a draft to printed.
--   5. legal_statement_sign — files the signed copy: the Evidence document (a live row of the same
--      matter), the day it was signed (read off the jurat, not ahead of today), whether the paper
--      reads as last printed, and the incident day confirmed or corrected.
--   6. legal_void_entry lets the office undo a statement it wrote (Not signed…).
--   7. app_settings.office_county, seeded Guadalupe (the owner, 2026-10-30), writable by the office
--      roles under a key-scoped policy.
--
-- Additive and idempotent; no table is created, so no read-only fence is owed.

-- 1. The kind CHECK (v4 from 20261025160000; drop whatever holds kind, add v5).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.legal_matter_entries'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%kind%'
      AND conname <> 'legal_matter_entries_kind_check_v5'
  LOOP
    EXECUTE format('ALTER TABLE public.legal_matter_entries DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;
DO $$
BEGIN
  ALTER TABLE public.legal_matter_entries ADD CONSTRAINT legal_matter_entries_kind_check_v5 CHECK (kind IN (
    'fee', 'cost', 'step', 'question', 'answer', 'payment_received', 'recovery_applied', 'note', 'plan', 'event', 'offer', 'statement'
  )) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE public.legal_matter_entries VALIDATE CONSTRAINT legal_matter_entries_kind_check_v5;

COMMENT ON TABLE public.legal_matter_entries IS 'Append-only stream on a legal matter (v2.3313): the firm''s fees and costs, steps (demand · suit · judgment · settled), questions and the office''s answers, payments the firm reports and the office applies, notes — since v2.5800 planned steps (kind ''plan''), since v2.5836 events the office records (kind ''event''), since v2.5847 offers (kind ''offer''), and since v2.6209 sworn statements and unsworn declarations the office drafts, prints and files (kind ''statement'': occurred_on = the day it is about, body = the paragraphs, meta = { title, affiant, form, incident_to, venue_county, state, prints, signed_on, hand_changed, document_id, source }; held under statement:<id>). via_portal marks the firm''s own entries (PR 4); acknowledged_at clears them from the office''s Needs You.';

-- The affiant as the window sends it: { kind, user_id, name, role }. Returns NULL when sound, else the refusal.
CREATE OR REPLACE FUNCTION public.legal_statement_affiant_problem(p_affiant jsonb)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_affiant IS NULL OR jsonb_typeof(p_affiant) <> 'object' THEN 'Say who swears it'
    WHEN COALESCE(p_affiant->>'kind', '') NOT IN ('team', 'witness') THEN 'The affiant is one of our team or a witness'
    WHEN COALESCE(TRIM(p_affiant->>'name'), '') = '' THEN CASE WHEN p_affiant->>'kind' = 'team' THEN 'Pick who swears it' ELSE 'Type the witness''s name' END
    WHEN length(TRIM(p_affiant->>'name')) > 200 THEN 'Keep the affiant''s name under 200 characters'
    WHEN length(COALESCE(p_affiant->>'role', '')) > 300 THEN 'Keep the role line under 300 characters'
    ELSE NULL
  END
$$;

-- The affiant stored: the four keys and nothing else, trimmed.
CREATE OR REPLACE FUNCTION public.legal_statement_affiant_clean(p_affiant jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object(
    'kind', p_affiant->>'kind',
    'user_id', CASE WHEN p_affiant->>'kind' = 'team' AND COALESCE(p_affiant->>'user_id', '') ~ '^[0-9a-f-]{36}$' THEN p_affiant->>'user_id' ELSE NULL END,
    'name', TRIM(p_affiant->>'name'),
    'role', TRIM(COALESCE(p_affiant->>'role', ''))
  )
$$;

-- 2. Office: draft a statement.
CREATE OR REPLACE FUNCTION public.legal_statement_add(
  p_matter_id uuid, p_on date, p_body text, p_title text, p_affiant jsonb, p_form text DEFAULT 'notary',
  p_incident_to date DEFAULT NULL, p_venue_county text DEFAULT NULL, p_source text DEFAULT 'office'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_body text := COALESCE(TRIM(p_body), '');
  v_title text := COALESCE(TRIM(p_title), '');
  v_problem text := public.legal_statement_affiant_problem(p_affiant);
  v_source text := CASE WHEN p_source IN ('office', 'mcp') THEN p_source ELSE 'office' END;
  v_county text := NULLIF(TRIM(COALESCE(p_venue_county, '')), '');
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.legal_matters WHERE id = p_matter_id) THEN RETURN jsonb_build_object('error', 'Matter not found'); END IF;
  IF v_problem IS NOT NULL THEN RETURN jsonb_build_object('error', v_problem); END IF;
  IF v_title = '' THEN RETURN jsonb_build_object('error', 'Give the statement a title'); END IF;
  IF length(v_title) > 200 THEN RETURN jsonb_build_object('error', 'Keep the title under 200 characters'); END IF;
  IF p_on IS NULL THEN RETURN jsonb_build_object('error', 'Pick the day it is about'); END IF;
  IF p_on > public.app_today() THEN RETURN jsonb_build_object('error', 'The day it is about cannot be ahead of today'); END IF;
  IF p_incident_to IS NOT NULL AND p_incident_to < p_on THEN RETURN jsonb_build_object('error', 'The last day of the span comes before the first'); END IF;
  IF p_incident_to IS NOT NULL AND p_incident_to > public.app_today() THEN RETURN jsonb_build_object('error', 'The span cannot run past today'); END IF;
  IF COALESCE(p_form, '') NOT IN ('notary', 'declaration') THEN RETURN jsonb_build_object('error', 'Pick how it is signed: before a notary, or under penalty of perjury'); END IF;
  IF v_body = '' THEN RETURN jsonb_build_object('error', 'Type the statement'); END IF;
  IF length(v_body) > 20000 THEN RETURN jsonb_build_object('error', 'Keep the statement under 20,000 characters'); END IF;
  IF v_county IS NOT NULL AND length(v_county) > 60 THEN RETURN jsonb_build_object('error', 'Keep the county under 60 characters'); END IF;
  INSERT INTO public.legal_matter_entries (matter_id, kind, body, occurred_on, meta, created_by)
  VALUES (p_matter_id, 'statement', v_body, p_on,
    jsonb_build_object(
      'title', v_title,
      'affiant', public.legal_statement_affiant_clean(p_affiant),
      'form', p_form,
      'incident_to', CASE WHEN p_incident_to IS NULL OR p_incident_to = p_on THEN NULL ELSE to_char(p_incident_to, 'YYYY-MM-DD') END,
      'venue_county', v_county,
      'state', 'draft',
      'prints', '[]'::jsonb,
      'signed_on', NULL,
      'hand_changed', false,
      'document_id', NULL,
      'source', v_source
    ), auth.uid())
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok', true, 'entry_id', v_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_statement_add(uuid, date, text, text, jsonb, text, date, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_statement_add(uuid, date, text, text, jsonb, text, date, text, text) TO authenticated;
COMMENT ON FUNCTION public.legal_statement_add(uuid, date, text, text, jsonb, text, date, text, text) IS 'Draft a sworn statement or an unsworn declaration on a legal matter (v2.6209, punch list #220): a legal_matter_entries row of kind statement, dated the day it is about (not ahead of today), with the title, the affiant ({ kind team | witness, user_id, name, role }), the form (notary | declaration), the span''s last day, the venue county and the paragraphs. Office roles (legal_office_can_read). p_source: office, or mcp.';

-- 3. Office: change a draft. NULL leaves a field as it is; p_clear_incident_to drops the span's last day; p_clear_venue_county leaves the county blank for the notary.
CREATE OR REPLACE FUNCTION public.legal_statement_update(
  p_entry_id uuid, p_on date DEFAULT NULL, p_body text DEFAULT NULL, p_title text DEFAULT NULL, p_affiant jsonb DEFAULT NULL, p_form text DEFAULT NULL,
  p_incident_to date DEFAULT NULL, p_clear_incident_to boolean DEFAULT false, p_venue_county text DEFAULT NULL, p_clear_venue_county boolean DEFAULT false, p_source text DEFAULT 'office'
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_entry public.legal_matter_entries%ROWTYPE;
  v_on date;
  v_to date;
  v_body text;
  v_title text;
  v_affiant jsonb;
  v_form text;
  v_county text;
  v_problem text;
  v_source text := CASE WHEN p_source IN ('office', 'mcp') THEN p_source ELSE 'office' END;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;
  SELECT * INTO v_entry FROM public.legal_matter_entries WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Statement not found'); END IF;
  IF v_entry.kind <> 'statement' THEN RETURN jsonb_build_object('error', 'Only a statement can be changed here'); END IF;
  IF v_entry.voided_at IS NOT NULL THEN RETURN jsonb_build_object('error', 'That statement was dropped'); END IF;
  IF COALESCE(v_entry.meta->>'state', 'draft') = 'signed' THEN RETURN jsonb_build_object('error', 'The signed copy is filed; the sworn text cannot change. Swear a new statement instead.'); END IF;
  v_on := COALESCE(p_on, v_entry.occurred_on);
  v_to := CASE WHEN p_clear_incident_to THEN NULL WHEN p_incident_to IS NOT NULL THEN p_incident_to ELSE NULLIF(v_entry.meta->>'incident_to', '')::date END;
  v_body := COALESCE(NULLIF(TRIM(p_body), ''), v_entry.body);
  v_title := COALESCE(NULLIF(TRIM(p_title), ''), v_entry.meta->>'title', '');
  v_affiant := COALESCE(p_affiant, v_entry.meta->'affiant');
  v_form := COALESCE(p_form, v_entry.meta->>'form', 'notary');
  v_county := CASE WHEN p_clear_venue_county THEN NULL WHEN p_venue_county IS NOT NULL THEN NULLIF(TRIM(p_venue_county), '') ELSE NULLIF(v_entry.meta->>'venue_county', '') END;
  v_problem := public.legal_statement_affiant_problem(v_affiant);
  IF v_problem IS NOT NULL THEN RETURN jsonb_build_object('error', v_problem); END IF;
  IF length(v_title) > 200 THEN RETURN jsonb_build_object('error', 'Keep the title under 200 characters'); END IF;
  IF v_on > public.app_today() THEN RETURN jsonb_build_object('error', 'The day it is about cannot be ahead of today'); END IF;
  IF v_to IS NOT NULL AND v_to < v_on THEN RETURN jsonb_build_object('error', 'The last day of the span comes before the first'); END IF;
  IF v_to IS NOT NULL AND v_to > public.app_today() THEN RETURN jsonb_build_object('error', 'The span cannot run past today'); END IF;
  IF v_form NOT IN ('notary', 'declaration') THEN RETURN jsonb_build_object('error', 'Pick how it is signed: before a notary, or under penalty of perjury'); END IF;
  IF length(v_body) > 20000 THEN RETURN jsonb_build_object('error', 'Keep the statement under 20,000 characters'); END IF;
  IF v_county IS NOT NULL AND length(v_county) > 60 THEN RETURN jsonb_build_object('error', 'Keep the county under 60 characters'); END IF;
  UPDATE public.legal_matter_entries
    SET occurred_on = v_on,
        body = v_body,
        meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object(
          'title', v_title,
          'affiant', public.legal_statement_affiant_clean(v_affiant),
          'form', v_form,
          'incident_to', CASE WHEN v_to IS NULL OR v_to = v_on THEN NULL ELSE to_char(v_to, 'YYYY-MM-DD') END,
          'venue_county', v_county,
          'edited_at', now(), 'edited_by', auth.uid(), 'edited_source', v_source)
  WHERE id = p_entry_id;
  RETURN jsonb_build_object('ok', true, 'entry_id', p_entry_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_statement_update(uuid, date, text, text, jsonb, text, date, boolean, text, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_statement_update(uuid, date, text, text, jsonb, text, date, boolean, text, boolean, text) TO authenticated;
COMMENT ON FUNCTION public.legal_statement_update(uuid, date, text, text, jsonb, text, date, boolean, text, boolean, text) IS 'Change a statement''s draft (v2.6209): the day, the span, the title, the affiant, the form, the county, the text; NULL leaves a field as it is. Office roles. Refused once the signed copy is filed, or on a dropped statement.';

-- 4. Office: a print. Appended, never edited: the record shows what was handed over and when.
CREATE OR REPLACE FUNCTION public.legal_statement_print(p_entry_id uuid, p_face text, p_text text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_entry public.legal_matter_entries%ROWTYPE;
  v_prints jsonb;
  v_text text := COALESCE(p_text, '');
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;
  IF COALESCE(p_face, '') NOT IN ('whole', 'statement', 'signing') THEN RETURN jsonb_build_object('error', 'Pick which face printed: the whole paper, the statement alone, or the signing page alone'); END IF;
  IF length(v_text) > 24000 THEN RETURN jsonb_build_object('error', 'The printed text is too long to keep'); END IF;
  SELECT * INTO v_entry FROM public.legal_matter_entries WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Statement not found'); END IF;
  IF v_entry.kind <> 'statement' THEN RETURN jsonb_build_object('error', 'Only a statement keeps a print log'); END IF;
  IF v_entry.voided_at IS NOT NULL THEN RETURN jsonb_build_object('error', 'That statement was dropped'); END IF;
  v_prints := COALESCE(v_entry.meta->'prints', '[]'::jsonb);
  IF jsonb_typeof(v_prints) <> 'array' THEN v_prints := '[]'::jsonb; END IF;
  IF jsonb_array_length(v_prints) >= 200 THEN RETURN jsonb_build_object('error', 'Two hundred prints are on this statement already'); END IF;
  v_prints := v_prints || jsonb_build_array(jsonb_build_object('at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'by', auth.uid(), 'face', p_face, 'text', v_text));
  UPDATE public.legal_matter_entries
    SET meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object('prints', v_prints, 'state', CASE WHEN COALESCE(meta->>'state', 'draft') = 'signed' THEN 'signed' ELSE 'printed' END)
  WHERE id = p_entry_id;
  RETURN jsonb_build_object('ok', true, 'entry_id', p_entry_id, 'prints', jsonb_array_length(v_prints));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_statement_print(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_statement_print(uuid, text, text) TO authenticated;
COMMENT ON FUNCTION public.legal_statement_print(uuid, text, text) IS 'Note a print of a statement (v2.6209): appends { at, by, face whole | statement | signing, text } to meta.prints and moves a draft to printed. Office roles. Append-only; at most 200 prints.';

-- 5. Office: file the signed copy.
CREATE OR REPLACE FUNCTION public.legal_statement_sign(
  p_entry_id uuid, p_document_id uuid, p_signed_on date, p_as_printed boolean DEFAULT true, p_on date DEFAULT NULL, p_incident_to date DEFAULT NULL, p_clear_incident_to boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_entry public.legal_matter_entries%ROWTYPE;
  v_on date;
  v_to date;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;
  SELECT * INTO v_entry FROM public.legal_matter_entries WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Statement not found'); END IF;
  IF v_entry.kind <> 'statement' THEN RETURN jsonb_build_object('error', 'Only a statement takes a signed copy'); END IF;
  IF v_entry.voided_at IS NOT NULL THEN RETURN jsonb_build_object('error', 'That statement was dropped'); END IF;
  IF COALESCE(v_entry.meta->>'state', 'draft') = 'signed' THEN RETURN jsonb_build_object('error', 'The signed copy is already filed'); END IF;
  IF p_signed_on IS NULL THEN RETURN jsonb_build_object('error', 'Type the day it was signed, off the jurat'); END IF;
  IF p_signed_on > public.app_today() THEN RETURN jsonb_build_object('error', 'The day it was signed cannot be ahead of today'); END IF;
  IF p_document_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.legal_matter_documents d WHERE d.id = p_document_id AND d.matter_id = v_entry.matter_id AND d.voided_at IS NULL) THEN
    RETURN jsonb_build_object('error', 'The signed copy is not on this matter''s Evidence');
  END IF;
  v_on := COALESCE(p_on, v_entry.occurred_on);
  v_to := CASE WHEN p_clear_incident_to THEN NULL WHEN p_incident_to IS NOT NULL THEN p_incident_to ELSE NULLIF(v_entry.meta->>'incident_to', '')::date END;
  IF v_on > public.app_today() THEN RETURN jsonb_build_object('error', 'The day it is about cannot be ahead of today'); END IF;
  IF v_to IS NOT NULL AND v_to < v_on THEN RETURN jsonb_build_object('error', 'The last day of the span comes before the first'); END IF;
  UPDATE public.legal_matter_entries
    SET occurred_on = v_on,
        meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object(
          'state', 'signed',
          'signed_on', to_char(p_signed_on, 'YYYY-MM-DD'),
          'hand_changed', NOT COALESCE(p_as_printed, true),
          'document_id', p_document_id,
          'incident_to', CASE WHEN v_to IS NULL OR v_to = v_on THEN NULL ELSE to_char(v_to, 'YYYY-MM-DD') END,
          'signed_filed_at', now(), 'signed_filed_by', auth.uid())
  WHERE id = p_entry_id;
  RETURN jsonb_build_object('ok', true, 'entry_id', p_entry_id, 'signed_on', to_char(p_signed_on, 'YYYY-MM-DD'));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_statement_sign(uuid, uuid, date, boolean, date, date, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_statement_sign(uuid, uuid, date, boolean, date, date, boolean) TO authenticated;
COMMENT ON FUNCTION public.legal_statement_sign(uuid, uuid, date, boolean, date, date, boolean) IS 'File a statement''s signed copy (v2.6209): the Evidence document (a live row of the same matter), the day it was signed (read off the jurat, not ahead of today), whether the paper reads as last printed (false marks hand changes; the scan governs), and the incident day confirmed or corrected. Office roles. Once.';

-- 6. Undo: the office drops a statement it wrote (20261025160000's body, 'statement' added).
CREATE OR REPLACE FUNCTION public.legal_void_entry(p_entry_id uuid, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_entry public.legal_matter_entries%ROWTYPE;
  v_reason text := COALESCE(NULLIF(TRIM(p_reason), ''), '');
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;
  IF v_reason = '' THEN RETURN jsonb_build_object('error', 'Say why: the firm reads the reason'); END IF;
  SELECT * INTO v_entry FROM public.legal_matter_entries WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Entry not found'); END IF;
  IF v_entry.via_portal THEN RETURN jsonb_build_object('error', 'The firm undoes its own entries; ask them in the conversation'); END IF;
  IF v_entry.kind NOT IN ('fee', 'cost', 'note', 'plan', 'event', 'offer', 'statement') THEN RETURN jsonb_build_object('error', 'Only a fee, a cost, a note, a planned step, an event, an offer or a statement can be undone here. Reverse an applied payment on the job.'); END IF;
  IF v_entry.voided_at IS NOT NULL THEN RETURN jsonb_build_object('error', 'Already undone'); END IF;
  UPDATE public.legal_matter_entries
    SET voided_at = now(), voided_by = auth.uid(), voided_via_portal = false, void_reason = v_reason
  WHERE id = p_entry_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_void_entry(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_void_entry(uuid, text) TO authenticated;

-- 7. The office's county for the venue line, typed once; the office roles may change it.
INSERT INTO public.app_settings (key, value_text)
VALUES ('office_county', 'Guadalupe')
ON CONFLICT (key) DO NOTHING;
DROP POLICY IF EXISTS legal_office_update_office_county ON public.app_settings;
CREATE POLICY legal_office_update_office_county
  ON public.app_settings
  FOR UPDATE TO authenticated
  USING (key = 'office_county' AND public.legal_office_can_read())
  WITH CHECK (key = 'office_county' AND public.legal_office_can_read());
