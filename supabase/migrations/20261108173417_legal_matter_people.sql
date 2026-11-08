SET lock_timeout = '3s';

-- The people on a legal matter, and the proceedings beside the claim (punch list #174, v2.6705; rank 9 of the ten
-- to-dos drawn from the Burd matter, job 891). A matter involves more people than the customer record holds: the
-- GC's president and billing contact, the owner of record, a tenant, an inspector, counsel. On job 891 their
-- addresses lived in the narrative and were re-found by hand for every letter, and the one address the record knew
-- bounced with nothing recording the bounce. The owner's calls of 2026-11-08: the people live on the matter, not the
-- customer (once a customer goes to legal the company does not work with them again); seeded from the customer
-- record and the property record's owner; each with a use (letters, copies, never) and a reason; letters pick their
-- recipients from the list; the proceedings sit beside the claim with their agency, reference, contact, status and
-- documents, and the firm's portal sees the proceedings list.
--
--   1. legal_matter_people — one row a person: name, role, organization, email, phone, mailing address, use and its
--      reason, where it was seeded from. Writes through the RPCs only; a removed row keeps removed_at.
--   2. legal_matter_proceedings — one row a proceeding: kind, agency, reference, a contact from the people, status
--      and its day, documents (Evidence rows of the same matter), keep_out (its documents stay out of anything
--      addressed to the other side). Writes through the RPCs only; a removed row keeps removed_at.
--   3. legal_matter_person_save / legal_matter_person_remove / legal_matter_people_seed — the office adds, edits,
--      removes, or seeds the rows the desk computed from the record (the seed skips a name and address already there).
--   4. legal_proceeding_save / legal_proceeding_remove.
--
-- The matter is made when the account has none (legal_answer_gap's ensure, v2.5920), refused once closed.
-- Idempotent. Two CREATE TABLEs, so the four fences close them.

-- 1. The people.
CREATE TABLE IF NOT EXISTS public.legal_matter_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id uuid NOT NULL REFERENCES public.legal_matters(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 160),
  role text NOT NULL CHECK (role IN ('customer', 'president', 'billing', 'field', 'owner', 'tenant', 'inspector', 'agency', 'supplier', 'counsel', 'witness', 'other')),
  organization text NOT NULL DEFAULT '' CHECK (length(organization) <= 160),
  email text NOT NULL DEFAULT '' CHECK (length(email) <= 200),
  phone text NOT NULL DEFAULT '' CHECK (length(phone) <= 60),
  mailing_address text NOT NULL DEFAULT '' CHECK (length(mailing_address) <= 400),
  use text NOT NULL DEFAULT 'copies' CHECK (use IN ('letters', 'copies', 'never')),
  reason text NOT NULL DEFAULT '' CHECK (length(reason) <= 300),
  seeded_from text CHECK (seeded_from IS NULL OR seeded_from IN ('customer', 'contact_person', 'property')),
  added_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  removed_by uuid REFERENCES public.users(id) ON DELETE SET NULL
);
COMMENT ON TABLE public.legal_matter_people IS 'The people on a legal matter (v2.6705, punch list #174): name, role, organization, how to reach them, and a use — letters (a To), copies (a CC) or never, with the reason (a witness, a bounced inbox). Seeded from the customer record and the property record''s owner, then the office''s own. A removed row keeps removed_at. Writes via legal_matter_person_save / legal_matter_person_remove / legal_matter_people_seed only.';
COMMENT ON COLUMN public.legal_matter_people.use IS 'letters: a letter''s To. copies: a copy. never: cannot be picked, and the reason says why.';
COMMENT ON COLUMN public.legal_matter_people.seeded_from IS 'customer · contact_person · property when the desk seeded the row from the record; null when the office typed it.';
CREATE INDEX IF NOT EXISTS legal_matter_people_matter_idx ON public.legal_matter_people (matter_id, added_at) WHERE removed_at IS NULL;
ALTER TABLE public.legal_matter_people ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS legal_matter_people_office_select ON public.legal_matter_people;
CREATE POLICY legal_matter_people_office_select ON public.legal_matter_people FOR SELECT TO authenticated USING (public.legal_office_can_read());
REVOKE ALL ON TABLE public.legal_matter_people FROM anon;
GRANT SELECT ON TABLE public.legal_matter_people TO authenticated;

-- 2. The proceedings.
CREATE TABLE IF NOT EXISTS public.legal_matter_proceedings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id uuid NOT NULL REFERENCES public.legal_matters(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('agency_complaint', 'records_request', 'bond_claim', 'permit', 'other')),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 160),
  agency text NOT NULL DEFAULT '' CHECK (length(agency) <= 160),
  reference text NOT NULL DEFAULT '' CHECK (length(reference) <= 120),
  person_id uuid REFERENCES public.legal_matter_people(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered', 'closed')),
  status_on date,
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 600),
  document_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  keep_out boolean NOT NULL DEFAULT true,
  added_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  removed_by uuid REFERENCES public.users(id) ON DELETE SET NULL
);
COMMENT ON TABLE public.legal_matter_proceedings IS 'A proceeding that runs beside a legal matter''s claim (v2.6705, punch list #174): an agency complaint, a records request, a bond claim, a permit question — its agency, reference, a contact from the matter''s people, status and day, the Evidence documents behind it, and keep_out, which holds those documents out of anything addressed to the other side. The firm''s portal reads the list. A removed row keeps removed_at. Writes via legal_proceeding_save / legal_proceeding_remove only.';
CREATE INDEX IF NOT EXISTS legal_matter_proceedings_matter_idx ON public.legal_matter_proceedings (matter_id, added_at) WHERE removed_at IS NULL;
ALTER TABLE public.legal_matter_proceedings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS legal_matter_proceedings_office_select ON public.legal_matter_proceedings;
CREATE POLICY legal_matter_proceedings_office_select ON public.legal_matter_proceedings FOR SELECT TO authenticated USING (public.legal_office_can_read());
REVOKE ALL ON TABLE public.legal_matter_proceedings FROM anon;
GRANT SELECT ON TABLE public.legal_matter_proceedings TO authenticated;

-- The matter for an account, made when there is none (legal_answer_gap's ensure). Null with the refusal's words when closed.
CREATE OR REPLACE FUNCTION public.legal_matter_ensure_open(p_payer_key text, p_customer_id uuid, p_payer_name text, p_job_ids uuid[], OUT o_matter uuid, OUT o_error text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_closed timestamptz;
BEGIN
  o_matter := NULL; o_error := NULL;
  IF p_payer_key IS NULL OR p_payer_key = '' THEN o_error := 'Missing payer'; RETURN; END IF;
  INSERT INTO public.legal_matters (payer_key, customer_id, payer_name, created_by)
  VALUES (p_payer_key, p_customer_id, COALESCE(p_payer_name, ''), auth.uid())
  ON CONFLICT (payer_key) DO UPDATE
    SET customer_id = COALESCE(EXCLUDED.customer_id, public.legal_matters.customer_id),
        payer_name = CASE WHEN EXCLUDED.payer_name <> '' THEN EXCLUDED.payer_name ELSE public.legal_matters.payer_name END,
        updated_at = now()
  RETURNING id, closed_at INTO o_matter, v_closed;
  IF v_closed IS NOT NULL THEN o_error := 'This matter is closed'; o_matter := NULL; RETURN; END IF;
  IF p_job_ids IS NOT NULL THEN
    INSERT INTO public.legal_matter_jobs (matter_id, job_id) SELECT o_matter, j FROM unnest(p_job_ids) AS j ON CONFLICT DO NOTHING;
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_matter_ensure_open(text, uuid, text, uuid[]) FROM PUBLIC, anon, authenticated;

-- 3. Add or edit a person. p_person_id NULL adds.
CREATE OR REPLACE FUNCTION public.legal_matter_person_save(
  p_payer_key text, p_customer_id uuid, p_payer_name text, p_job_ids uuid[],
  p_person_id uuid, p_name text, p_role text, p_organization text DEFAULT '', p_email text DEFAULT '', p_phone text DEFAULT '',
  p_mailing_address text DEFAULT '', p_use text DEFAULT 'copies', p_reason text DEFAULT ''
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_matter uuid; v_err text; v_person uuid;
  v_name text := COALESCE(TRIM(p_name), '');
  v_reason text := COALESCE(TRIM(p_reason), '');
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;
  IF v_name = '' THEN RETURN jsonb_build_object('error', 'Name the person'); END IF;
  IF length(v_name) > 160 THEN RETURN jsonb_build_object('error', 'Keep the name under 160 characters'); END IF;
  IF p_role IS NULL OR p_role NOT IN ('customer', 'president', 'billing', 'field', 'owner', 'tenant', 'inspector', 'agency', 'supplier', 'counsel', 'witness', 'other') THEN RETURN jsonb_build_object('error', 'Pick what they are to the matter'); END IF;
  IF p_use IS NULL OR p_use NOT IN ('letters', 'copies', 'never') THEN RETURN jsonb_build_object('error', 'Pick how letters use them: letters, copies or never'); END IF;
  IF p_use = 'never' AND v_reason = '' THEN RETURN jsonb_build_object('error', 'Say why letters never go to them'); END IF;
  IF length(v_reason) > 300 THEN RETURN jsonb_build_object('error', 'Keep the reason under 300 characters'); END IF;
  SELECT o_matter, o_error INTO v_matter, v_err FROM public.legal_matter_ensure_open(p_payer_key, p_customer_id, p_payer_name, p_job_ids);
  IF v_err IS NOT NULL THEN RETURN jsonb_build_object('error', v_err); END IF;
  IF p_person_id IS NULL THEN
    INSERT INTO public.legal_matter_people (matter_id, name, role, organization, email, phone, mailing_address, use, reason, added_by, updated_by)
    VALUES (v_matter, v_name, p_role, LEFT(COALESCE(TRIM(p_organization), ''), 160), LEFT(COALESCE(TRIM(p_email), ''), 200), LEFT(COALESCE(TRIM(p_phone), ''), 60), LEFT(COALESCE(TRIM(p_mailing_address), ''), 400), p_use, v_reason, auth.uid(), auth.uid())
    RETURNING id INTO v_person;
  ELSE
    UPDATE public.legal_matter_people
      SET name = v_name, role = p_role, organization = LEFT(COALESCE(TRIM(p_organization), ''), 160), email = LEFT(COALESCE(TRIM(p_email), ''), 200), phone = LEFT(COALESCE(TRIM(p_phone), ''), 60),
          mailing_address = LEFT(COALESCE(TRIM(p_mailing_address), ''), 400), use = p_use, reason = v_reason, updated_by = auth.uid(), updated_at = now()
    WHERE id = p_person_id AND matter_id = v_matter AND removed_at IS NULL
    RETURNING id INTO v_person;
    IF v_person IS NULL THEN RETURN jsonb_build_object('error', 'That person is not on this matter, or was removed'); END IF;
  END IF;
  RETURN jsonb_build_object('ok', true, 'matter_id', v_matter, 'person_id', v_person);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_matter_person_save(text, uuid, text, uuid[], uuid, text, text, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_matter_person_save(text, uuid, text, uuid[], uuid, text, text, text, text, text, text, text, text) TO authenticated;
COMMENT ON FUNCTION public.legal_matter_person_save(text, uuid, text, uuid[], uuid, text, text, text, text, text, text, text, text) IS 'Add or edit a person on a legal matter (v2.6705, punch list #174) by an office role; the matter is made when the account has none; refused once closed. A use of never needs its reason. p_person_id NULL adds.';

CREATE OR REPLACE FUNCTION public.legal_matter_person_remove(p_person_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;
  UPDATE public.legal_matter_people SET removed_at = now(), removed_by = auth.uid() WHERE id = p_person_id AND removed_at IS NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'That person is already off the matter'); END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_matter_person_remove(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_matter_person_remove(uuid) TO authenticated;
COMMENT ON FUNCTION public.legal_matter_person_remove(uuid) IS 'Take one person off a legal matter (v2.6705): removed_at is set, the row kept. Office roles.';

-- The seed: the rows the desk computed from the customer record and the property record's owner, as a jsonb array of
-- {name, role, organization, email, phone, mailing_address, use, reason, seeded_from}. A row whose name and email
-- (case-blind) are already on the matter, removed or not, is skipped, so a second press adds nothing twice.
CREATE OR REPLACE FUNCTION public.legal_matter_people_seed(p_payer_key text, p_customer_id uuid, p_payer_name text, p_job_ids uuid[], p_people jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_matter uuid; v_err text; v_row jsonb; v_added int := 0; v_skipped int := 0;
  v_name text; v_email text; v_role text; v_use text; v_from text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;
  IF p_people IS NULL OR jsonb_typeof(p_people) <> 'array' THEN RETURN jsonb_build_object('error', 'Nothing to seed'); END IF;
  SELECT o_matter, o_error INTO v_matter, v_err FROM public.legal_matter_ensure_open(p_payer_key, p_customer_id, p_payer_name, p_job_ids);
  IF v_err IS NOT NULL THEN RETURN jsonb_build_object('error', v_err); END IF;
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_people) LOOP
    v_name := LEFT(COALESCE(TRIM(v_row->>'name'), ''), 160);
    v_email := LEFT(COALESCE(TRIM(v_row->>'email'), ''), 200);
    v_role := COALESCE(v_row->>'role', 'other');
    v_use := COALESCE(v_row->>'use', 'copies');
    v_from := v_row->>'seeded_from';
    IF v_name = '' THEN v_skipped := v_skipped + 1; CONTINUE; END IF;
    IF v_role NOT IN ('customer', 'president', 'billing', 'field', 'owner', 'tenant', 'inspector', 'agency', 'supplier', 'counsel', 'witness', 'other') THEN v_role := 'other'; END IF;
    IF v_use NOT IN ('letters', 'copies', 'never') THEN v_use := 'copies'; END IF;
    IF v_from IS NOT NULL AND v_from NOT IN ('customer', 'contact_person', 'property') THEN v_from := NULL; END IF;
    IF EXISTS (SELECT 1 FROM public.legal_matter_people p WHERE p.matter_id = v_matter AND lower(p.name) = lower(v_name) AND lower(p.email) = lower(v_email)) THEN
      v_skipped := v_skipped + 1; CONTINUE;
    END IF;
    INSERT INTO public.legal_matter_people (matter_id, name, role, organization, email, phone, mailing_address, use, reason, seeded_from, added_by, updated_by)
    VALUES (v_matter, v_name, v_role, LEFT(COALESCE(TRIM(v_row->>'organization'), ''), 160), v_email, LEFT(COALESCE(TRIM(v_row->>'phone'), ''), 60),
            LEFT(COALESCE(TRIM(v_row->>'mailing_address'), ''), 400), v_use, LEFT(COALESCE(TRIM(v_row->>'reason'), ''), 300), v_from, auth.uid(), auth.uid());
    v_added := v_added + 1;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'matter_id', v_matter, 'added', v_added, 'skipped', v_skipped);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_matter_people_seed(text, uuid, text, uuid[], jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_matter_people_seed(text, uuid, text, uuid[], jsonb) TO authenticated;
COMMENT ON FUNCTION public.legal_matter_people_seed(text, uuid, text, uuid[], jsonb) IS 'Seed a legal matter''s people from the rows the desk computed off the customer record and the property record''s owner (v2.6705, punch list #174). A name and email already on the matter is skipped. Office roles; the matter is made when the account has none; refused once closed.';

-- 4. Add or edit a proceeding. p_proceeding_id NULL adds. The contact must be one of the matter's people and each
-- document one of the matter's live Evidence rows.
CREATE OR REPLACE FUNCTION public.legal_proceeding_save(
  p_payer_key text, p_customer_id uuid, p_payer_name text, p_job_ids uuid[],
  p_proceeding_id uuid, p_kind text, p_title text, p_agency text DEFAULT '', p_reference text DEFAULT '', p_person_id uuid DEFAULT NULL,
  p_status text DEFAULT 'open', p_status_on date DEFAULT NULL, p_note text DEFAULT '', p_document_ids uuid[] DEFAULT '{}'::uuid[], p_keep_out boolean DEFAULT true
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_matter uuid; v_err text; v_id uuid; v_bad int;
  v_title text := COALESCE(TRIM(p_title), '');
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('agency_complaint', 'records_request', 'bond_claim', 'permit', 'other') THEN RETURN jsonb_build_object('error', 'Pick what kind of proceeding this is'); END IF;
  IF v_title = '' THEN RETURN jsonb_build_object('error', 'Name the proceeding'); END IF;
  IF length(v_title) > 160 THEN RETURN jsonb_build_object('error', 'Keep the name under 160 characters'); END IF;
  IF p_status IS NULL OR p_status NOT IN ('open', 'answered', 'closed') THEN RETURN jsonb_build_object('error', 'Pick where it stands: open, answered or closed'); END IF;
  IF length(COALESCE(p_note, '')) > 600 THEN RETURN jsonb_build_object('error', 'Keep the note under 600 characters'); END IF;
  SELECT o_matter, o_error INTO v_matter, v_err FROM public.legal_matter_ensure_open(p_payer_key, p_customer_id, p_payer_name, p_job_ids);
  IF v_err IS NOT NULL THEN RETURN jsonb_build_object('error', v_err); END IF;
  IF p_person_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.legal_matter_people WHERE id = p_person_id AND matter_id = v_matter AND removed_at IS NULL) THEN
    RETURN jsonb_build_object('error', 'That contact is not on this matter');
  END IF;
  SELECT count(*) INTO v_bad FROM unnest(COALESCE(p_document_ids, '{}'::uuid[])) AS d
    WHERE NOT EXISTS (SELECT 1 FROM public.legal_matter_documents m WHERE m.id = d AND m.matter_id = v_matter AND m.voided_at IS NULL);
  IF v_bad > 0 THEN RETURN jsonb_build_object('error', 'A document is not on this matter'); END IF;
  IF p_proceeding_id IS NULL THEN
    INSERT INTO public.legal_matter_proceedings (matter_id, kind, title, agency, reference, person_id, status, status_on, note, document_ids, keep_out, added_by, updated_by)
    VALUES (v_matter, p_kind, v_title, LEFT(COALESCE(TRIM(p_agency), ''), 160), LEFT(COALESCE(TRIM(p_reference), ''), 120), p_person_id, p_status, p_status_on, COALESCE(TRIM(p_note), ''), COALESCE(p_document_ids, '{}'::uuid[]), COALESCE(p_keep_out, true), auth.uid(), auth.uid())
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.legal_matter_proceedings
      SET kind = p_kind, title = v_title, agency = LEFT(COALESCE(TRIM(p_agency), ''), 160), reference = LEFT(COALESCE(TRIM(p_reference), ''), 120), person_id = p_person_id,
          status = p_status, status_on = p_status_on, note = COALESCE(TRIM(p_note), ''), document_ids = COALESCE(p_document_ids, '{}'::uuid[]), keep_out = COALESCE(p_keep_out, true),
          updated_by = auth.uid(), updated_at = now()
    WHERE id = p_proceeding_id AND matter_id = v_matter AND removed_at IS NULL
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN RETURN jsonb_build_object('error', 'That proceeding is not on this matter, or was removed'); END IF;
  END IF;
  RETURN jsonb_build_object('ok', true, 'matter_id', v_matter, 'proceeding_id', v_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_proceeding_save(text, uuid, text, uuid[], uuid, text, text, text, text, uuid, text, date, text, uuid[], boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_proceeding_save(text, uuid, text, uuid[], uuid, text, text, text, text, uuid, text, date, text, uuid[], boolean) TO authenticated;
COMMENT ON FUNCTION public.legal_proceeding_save(text, uuid, text, uuid[], uuid, text, text, text, text, uuid, text, date, text, uuid[], boolean) IS 'Add or edit a proceeding beside a legal matter''s claim (v2.6705, punch list #174) by an office role: kind, name, agency, reference, a contact from the matter''s people, status and day, Evidence documents of the same matter, keep_out. The matter is made when the account has none; refused once closed. p_proceeding_id NULL adds.';

CREATE OR REPLACE FUNCTION public.legal_proceeding_remove(p_proceeding_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;
  UPDATE public.legal_matter_proceedings SET removed_at = now(), removed_by = auth.uid() WHERE id = p_proceeding_id AND removed_at IS NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'That proceeding is already gone'); END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_proceeding_remove(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_proceeding_remove(uuid) TO authenticated;
COMMENT ON FUNCTION public.legal_proceeding_remove(uuid) IS 'Remove one proceeding (v2.6705): removed_at is set, the row kept. Office roles.';

-- New tables: the read-only fences (training mode), the digital-twin fence and the archived-caller fence.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
