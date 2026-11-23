SET lock_timeout = '3s';

-- Where an outside signer lives, step 5, the ground (punch list #403): a sub's company. The owner's calls 3 and 7 of
-- 2026-11-19: a sub's business is a company record of its own with its workers under it, and that record is the trade
-- company the app already keeps (gc_companies). No screen yet. In order:
--   1. person_trade_companies: one row for a roster person who works for a trade company, with what they are there
--      ("Owner"). A person has one company at most, and a company holds any number of people who are on the roster.
--      It is the office's four roles' to read and to write (a dev, the leaders, the assistants and the controller).
--      The roster's own policies are wide, so the link is a table of its own and no column on people: nobody reads
--      anything of the roster they did not read before.
--   2. Two doors for the office, each run as the caller under the row policies: person_trade_company_set links a
--      person to a company the app has, moves them, or takes them off; person_trade_company_enter finds the company by
--      its name or makes it (gc_add_company, as a company we know) and links the person in the same press.
--   3. gc_company_paper, restated from 20261010009000_gc_papers.sql with one line changed: the office's four roles
--      make a company's copy of a Contract Book entry, where only a dev did. The paper's own insert policy already took
--      those four roles. An estimator is still refused.
--   4. A person's paper says who they sign for. signing_for (v2.7977) is filled from the link: when the paper is made,
--      and again each time it is sent. A paper that is not sent yet follows the link and the company's name. A paper
--      that is out keeps what it said when it went, until it is sent again. A signed paper never changes. A party's
--      paper, a trade company's own and a partner's are left alone, and so is a send that names the business itself.
-- Who reads what: no read policy on any older table changes. An estimator reads a trade company's own paper, as since
-- v2.7977, and no person's paper, linked to a company or not.
-- Every statement is safe to run twice. Doc: docs/migrations/20261123020000_sub_company_ground.md.

-- ---------- 1. A roster person's company ----------

CREATE TABLE IF NOT EXISTS public.person_trade_companies (
  person_id uuid PRIMARY KEY REFERENCES public.people(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.gc_companies(id) ON DELETE CASCADE,
  -- What they are at the company, in its own words ("Owner"). Null: not said.
  title text
    CONSTRAINT person_trade_companies_title_said CHECK (title IS NULL OR length(btrim(title)) BETWEEN 1 AND 200),
  linked_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  linked_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.person_trade_companies IS
  'Punch list #403, step 5: the trade company (gc_companies) a roster person works for, one row a person, with what they are there. A sub and each of their workers point at the same company. The office''s four roles read and write it. A person''s paper takes signing_for from it (contract_docs_signing_for_company).';

CREATE INDEX IF NOT EXISTS person_trade_companies_company_idx ON public.person_trade_companies (company_id);

ALTER TABLE public.person_trade_companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS person_trade_companies_office ON public.person_trade_companies;
CREATE POLICY person_trade_companies_office ON public.person_trade_companies FOR ALL TO authenticated
  USING ((SELECT public.is_office_staff())) WITH CHECK ((SELECT public.is_office_staff()));

COMMENT ON POLICY person_trade_companies_office ON public.person_trade_companies IS
  'Punch list #403, step 5: a dev, the leaders, the assistants and the controller read and write who works for which trade company (is_office_staff). Nobody else reads a row, an estimator among them.';

REVOKE ALL ON TABLE public.person_trade_companies FROM anon;
REVOKE TRUNCATE ON TABLE public.person_trade_companies FROM authenticated;

-- ---------- 2. The office's two doors ----------

-- Link a roster person to a trade company the app has, move them to another, or take them off (no company). The title
-- is what they are there; sent as nothing, it clears. SECURITY INVOKER: the row policy says who may.
CREATE OR REPLACE FUNCTION public.person_trade_company_set(p_person_id uuid, p_company_id uuid, p_title text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_title text := nullif(left(btrim(regexp_replace(coalesce(p_title, ''), '\s+', ' ', 'g')), 200), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.is_office_staff() THEN
    RAISE EXCEPTION 'Only the office says which company a person works for.' USING ERRCODE = '42501';
  END IF;
  IF p_person_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.people WHERE id = p_person_id) THEN
    RAISE EXCEPTION 'No person on the roster with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF p_company_id IS NULL THEN
    DELETE FROM public.person_trade_companies WHERE person_id = p_person_id;
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.gc_companies WHERE id = p_company_id) THEN
    RAISE EXCEPTION 'No company with that id.' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.person_trade_companies (person_id, company_id, title)
  VALUES (p_person_id, p_company_id, v_title)
  ON CONFLICT (person_id) DO UPDATE
    SET company_id = EXCLUDED.company_id, title = EXCLUDED.title,
        linked_by = auth.uid(), linked_at = now();
END;
$$;

COMMENT ON FUNCTION public.person_trade_company_set(uuid, uuid, text) IS
  'Punch list #403, step 5: link a roster person to a trade company, move them, or take them off (a null company), with what they are there. The office''s four roles only. SECURITY INVOKER.';

-- Enter a person's company in one press: the company is found by its name, or made as gc_add_company makes one (a
-- company we know, so not held for vetting), and the person is linked to it. A second press with the same name links
-- to the company the first one made, so a press repeated after a failure makes no second company.
-- p_company: {name, trades[], contactName?, phone?, email?, address?, license?, lang?}. Returns the company's id.
CREATE OR REPLACE FUNCTION public.person_trade_company_enter(p_person_id uuid, p_company jsonb, p_title text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_name text := btrim(regexp_replace(coalesce(p_company->>'name', ''), '\s+', ' ', 'g'));
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.is_office_staff() THEN
    RAISE EXCEPTION 'Only the office says which company a person works for.' USING ERRCODE = '42501';
  END IF;
  IF p_person_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.people WHERE id = p_person_id) THEN
    RAISE EXCEPTION 'No person on the roster with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v_name = '' THEN
    RAISE EXCEPTION 'Give the company a name.' USING ERRCODE = 'P0001';
  END IF;
  SELECT c.id INTO v_id FROM public.gc_companies c
  WHERE lower(btrim(regexp_replace(c.name, '\s+', ' ', 'g'))) = lower(v_name)
  ORDER BY c.created_at, c.id
  LIMIT 1;
  IF v_id IS NULL THEN
    v_id := public.gc_add_company(coalesce(p_company, '{}'::jsonb) || jsonb_build_object('name', v_name, 'known', true));
  END IF;
  PERFORM public.person_trade_company_set(p_person_id, v_id, p_title);
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.person_trade_company_enter(uuid, jsonb, text) IS
  'Punch list #403, step 5: a roster person''s company in one press. Finds the trade company by its name, else makes it through gc_add_company as a company we know ({name, trades[], contactName?, phone?, email?, address?, license?, lang?}), and links the person to it. Returns the company''s id. The office''s four roles only. SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.person_trade_company_set(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.person_trade_company_enter(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.person_trade_company_set(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.person_trade_company_enter(uuid, jsonb, text) TO authenticated;

-- ---------- 3. The office makes a company's paper ----------

-- Restated from 20261010009000_gc_papers.sql. Its first check asked for a dev. It asks for the office's four roles now,
-- the same four the paper's own insert policy takes. Nothing else in the body changes.
CREATE OR REPLACE FUNCTION public.gc_company_paper(p_company_id uuid, p_book_entry_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_entry public.contract_template_documents%ROWTYPE;
  v_id uuid;
BEGIN
  IF NOT public.is_office_staff() THEN
    RAISE EXCEPTION 'Only the office sends a company its papers.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.gc_companies WHERE id = p_company_id) THEN
    RAISE EXCEPTION 'No company with that id.' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_entry FROM public.contract_template_documents WHERE id = p_book_entry_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That paper is not in the Contract Book.' USING ERRCODE = 'P0001';
  END IF;

  SELECT d.id INTO v_id FROM public.person_contract_documents d
  WHERE d.company_id = p_company_id AND d.document_name = v_entry.document_name
  ORDER BY d.lineage_version DESC
  LIMIT 1;
  IF v_id IS NOT NULL THEN
    UPDATE public.person_contract_documents
    SET canonical_document_url = nullif(btrim(coalesce(v_entry.canonical_document_url, '')), ''),
        applied_contract_template_document_id = v_entry.id,
        signing_body_html = CASE WHEN btrim(coalesce(signing_body_html, '')) = '' THEN v_entry.book_body_html ELSE signing_body_html END,
        signing_body_format = CASE WHEN btrim(coalesce(signing_body_html, '')) = '' THEN v_entry.book_body_format ELSE signing_body_format END
    WHERE id = v_id;
    RETURN v_id;
  END IF;

  INSERT INTO public.person_contract_documents (
    person_name, company_id, document_name, contract_lineage_id, lineage_version, supersedes_person_contract_document_id,
    status, canonical_document_url, signing_body_html, signing_body_format, applied_contract_template_document_id
  ) VALUES (
    'gc-company:' || p_company_id::text, p_company_id, v_entry.document_name, gen_random_uuid(), 1, NULL,
    'unsent', nullif(btrim(coalesce(v_entry.canonical_document_url, '')), ''), v_entry.book_body_html, v_entry.book_body_format, v_entry.id
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.gc_company_paper(uuid, uuid) IS
  'GC mode (B6-b-i): a trade partner company''s copy of one Contract Book entry (the master agreement, the W-9 form), named ''gc-company:'' || its id, the form trigger stamping a W-9''s doc_type. Returns the paper''s id. The office''s four roles since punch list #403''s step 5 (a dev only before). SECURITY INVOKER.';

-- ---------- 4. A person's paper says who they sign for ----------

-- The company a roster person works for, by name, as a paper keeps it. Null: none. A definer, for the triggers below:
-- a paper is written by the office, by the service role and by a sub starting their own copy of a job's paper, and
-- none of the last two reads the link. Nobody signed in may call it.
CREATE OR REPLACE FUNCTION public.person_signs_for(p_person_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT nullif(left(btrim(c.name), 200), '')
  FROM public.person_trade_companies l JOIN public.gc_companies c ON c.id = l.company_id
  WHERE l.person_id = p_person_id;
$$;

COMMENT ON FUNCTION public.person_signs_for(uuid) IS
  'Punch list #403, step 5: the name of the trade company a roster person works for, as a paper''s signing_for keeps it, or null. Read by the triggers that fill signing_for. Not granted to anyone signed in.';

REVOKE ALL ON FUNCTION public.person_signs_for(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.person_signs_for(uuid) TO service_role;

-- A person's own paper takes signing_for from the link when it is made, and again each time it is sent (the write
-- that sets status 'sent' with a new sent_at, as send-contract-for-signature makes it). Left alone: a party's paper, a
-- trade company's own, a partner's, a paper entered already signed, and a write that names the business itself.
CREATE OR REPLACE FUNCTION public.contract_docs_signing_for_company()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.person_id IS NULL OR NEW.company_id IS NOT NULL OR NEW.party_contact_id IS NOT NULL OR NEW.partnership_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'signed' OR NEW.signing_for IS NOT NULL THEN
      RETURN NEW;
    END IF;
  ELSE
    IF NEW.status IS DISTINCT FROM 'sent' THEN
      RETURN NEW;
    END IF;
    IF OLD.status = 'sent' AND NEW.sent_at IS NOT DISTINCT FROM OLD.sent_at THEN
      RETURN NEW;
    END IF;
    IF NEW.signing_for IS DISTINCT FROM OLD.signing_for THEN
      RETURN NEW;
    END IF;
  END IF;
  NEW.signing_for := public.person_signs_for(NEW.person_id);
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.contract_docs_signing_for_company() IS
  'Punch list #403, step 5: a person''s own paper takes signing_for from the trade company they work for (person_trade_companies), when it is made and each time it is sent. A signed paper, a party''s, a trade company''s own and a partner''s are left alone.';

-- Named to fire after set_person_id_on_write, which finds the roster person from the name.
DROP TRIGGER IF EXISTS signing_for_company_on_write ON public.person_contract_documents;
CREATE TRIGGER signing_for_company_on_write
  BEFORE INSERT OR UPDATE OF status, sent_at ON public.person_contract_documents
  FOR EACH ROW EXECUTE FUNCTION public.contract_docs_signing_for_company();

-- A paper that is not sent yet follows the link: a person linked, moved or taken off, and their unsent papers say so.
-- A paper that is out or signed is not touched here.
CREATE OR REPLACE FUNCTION public.person_trade_company_papers()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_person uuid := CASE WHEN TG_OP = 'DELETE' THEN OLD.person_id ELSE NEW.person_id END;
  v_for text := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE public.person_signs_for(NEW.person_id) END;
BEGIN
  UPDATE public.person_contract_documents d
  SET signing_for = v_for
  WHERE d.person_id = v_person AND d.status = 'unsent'
    AND d.company_id IS NULL AND d.party_contact_id IS NULL AND d.partnership_id IS NULL
    AND d.signing_for IS DISTINCT FROM v_for;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.person_trade_company_papers() IS
  'Punch list #403, step 5: when a roster person is linked to a trade company, moved or taken off, their own papers that are not sent yet take the new signing_for. A paper that is out or signed keeps what it says.';

DROP TRIGGER IF EXISTS person_trade_company_papers_on_write ON public.person_trade_companies;
CREATE TRIGGER person_trade_company_papers_on_write
  AFTER INSERT OR UPDATE OF company_id OR DELETE ON public.person_trade_companies
  FOR EACH ROW EXECUTE FUNCTION public.person_trade_company_papers();

-- A company renamed: its people's unsent papers take the new name.
CREATE OR REPLACE FUNCTION public.gc_company_renamed_papers()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_for text := nullif(left(btrim(NEW.name), 200), '');
BEGIN
  UPDATE public.person_contract_documents d
  SET signing_for = v_for
  FROM public.person_trade_companies l
  WHERE l.company_id = NEW.id AND d.person_id = l.person_id AND d.status = 'unsent'
    AND d.company_id IS NULL AND d.party_contact_id IS NULL AND d.partnership_id IS NULL
    AND d.signing_for IS DISTINCT FROM v_for;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.gc_company_renamed_papers() IS
  'Punch list #403, step 5: a trade company renamed, and the unsent papers of the roster people who work for it take the new name as signing_for.';

DROP TRIGGER IF EXISTS gc_company_renamed_papers_on_write ON public.gc_companies;
CREATE TRIGGER gc_company_renamed_papers_on_write
  AFTER UPDATE OF name ON public.gc_companies
  FOR EACH ROW WHEN (OLD.name IS DISTINCT FROM NEW.name)
  EXECUTE FUNCTION public.gc_company_renamed_papers();

REVOKE ALL ON FUNCTION public.contract_docs_signing_for_company() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.person_trade_company_papers() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gc_company_renamed_papers() FROM PUBLIC, anon, authenticated;

-- House rules: training mode, the twin fence and the archived seal cover the new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
