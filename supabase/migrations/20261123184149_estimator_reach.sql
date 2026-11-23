SET lock_timeout = '3s';

-- Where an outside signer lives, the owner's second decision of 2026-11-22 (punch list #403,
-- to-dos/outside-signer-record/README.md): how far an estimator's reach goes. The database's half, two things.
--
--   1. Naming a party who holds a paper needs one of the office's four roles. A party on no list is closed to an
--      estimator until Add to a list says what they are (call 4). But Messages' Who is this? (name_contact) is the
--      whole office team's, the estimator among them, and a paper follows its contact. So an estimator could name such
--      a party a customer and then read that party's papers, a W-9 among them. The contacts table is the office
--      team's to write too, so the same could be done with one UPDATE and no function. Now a contact that holds a
--      paper is named by a dev, a leader, an assistant or the controller alone, on every path:
--        * named in place, by name_contact or by a statement of the caller's own: a guard on contacts;
--        * folded into the record's own contact, by name_contact or by a call of the fold itself: contacts_fold_papers.
--   2. An estimator reads the form's layout and the signature's image of an outside company's paper. They opened its
--      signed record since v2.8162, and the window said in words that those two did not read. A training account is
--      left out of both (the default this was built on: a training account reads the line and no more).
--
-- What does not change: a contact that holds no paper is named by the office team as before. A fold that is not a
-- naming (two customers merged, a record deleted by a screen) carries its papers as before, whoever runs it. No write
-- policy changes. A digital twin reads neither the layout nor the image. The estimator's read of the paper's own row
-- (person_contract_documents_estimator_outside) is as it was, a training estimator's among them.
--
-- No table is made, so there is no fence to call. Every statement is safe to run twice.
-- Doc: docs/migrations/20261123184149_estimator_reach.md.

-- ---------- 1. Naming a party who holds a paper ----------

-- Whether a contact holds a paper, past the caller's own policies: an estimator reads no paper of a party on no list,
-- so the guards cannot ask as them. Nobody signed in may call it, so it tells nobody which contacts hold a paper.
CREATE OR REPLACE FUNCTION public.contact_holds_paper(p_contact_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.person_contract_documents d WHERE d.party_contact_id = p_contact_id);
$$;

COMMENT ON FUNCTION public.contact_holds_paper(uuid) IS
  'Punch list #403: whether a contact is the party of any paper (person_contract_documents.party_contact_id), read past row security for the guards that keep naming such a party to the office''s four roles. Not granted to anyone signed in.';

REVOKE ALL ON FUNCTION public.contact_holds_paper(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.contact_holds_paper(uuid) TO service_role;

-- Named in place. Two changes to a contact are a naming, and each needs one of the four roles when the contact holds
-- a paper:
--   * a contact on no list (kind unknown or lead) is given a kind or a record, which is what name_contact writes;
--   * a contact that was not an outside company's becomes one, whatever it was before. That is the change that opens
--     its papers to an estimator (paper_is_outside_company counts the same six columns).
-- Everything else passes: a record deleted by a screen moves its contact off the row or back to no list, a merge
-- moves a customer's contact to another customer, and a write with no signed-in caller (the service role) is not
-- asked. A definer, so it may ask contact_holds_paper.
CREATE OR REPLACE FUNCTION public.contacts_paper_holder_named()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_named boolean;
  v_opened boolean;
BEGIN
  v_named := OLD.kind IN ('unknown', 'lead') AND (
    (NEW.kind IS DISTINCT FROM OLD.kind AND NEW.kind <> 'unknown')
    OR num_nonnulls(NEW.customer_id, NEW.customer_contact_person_id, NEW.gc_company_id, NEW.gc_company_person_id, NEW.person_id,
                    NEW.prospect_id, NEW.supply_house_id, NEW.supply_house_contact_id, NEW.team_prospect_id)
       > num_nonnulls(OLD.customer_id, OLD.customer_contact_person_id, OLD.gc_company_id, OLD.gc_company_person_id, OLD.person_id,
                      OLD.prospect_id, OLD.supply_house_id, OLD.supply_house_contact_id, OLD.team_prospect_id));
  v_opened := num_nonnulls(NEW.customer_id, NEW.customer_contact_person_id, NEW.supply_house_id, NEW.supply_house_contact_id,
                           NEW.gc_company_id, NEW.gc_company_person_id) = 1
    AND num_nonnulls(OLD.customer_id, OLD.customer_contact_person_id, OLD.supply_house_id, OLD.supply_house_contact_id,
                     OLD.gc_company_id, OLD.gc_company_person_id) <> 1;
  IF NOT (v_named OR v_opened) THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL OR public.is_office_staff() THEN
    RETURN NEW;
  END IF;
  IF public.contact_holds_paper(OLD.id) THEN
    RAISE EXCEPTION 'officeNamesPaperHolder' USING ERRCODE = '42501',
      DETAIL = 'They hold a paper, so only the office says who they are.';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.contacts_paper_holder_named() IS
  'Punch list #403, the owner''s second decision: a contact that holds a paper is named by the office''s four roles alone. Refuses anyone else signed in, an estimator among them, who gives a contact on no list a kind or a record, or who makes a contact an outside company''s when it was not. In words (officeNamesPaperHolder).';

REVOKE ALL ON FUNCTION public.contacts_paper_holder_named() FROM PUBLIC, anon, authenticated;

-- UPDATE OF: only a statement that sets one of the ten columns runs it, so a thread's state, a name or a goes-by
-- costs nothing more.
DROP TRIGGER IF EXISTS paper_holder_named_by_office ON public.contacts;
CREATE TRIGGER paper_holder_named_by_office
  BEFORE UPDATE OF kind, customer_id, customer_contact_person_id, gc_company_id, gc_company_person_id, person_id,
                   prospect_id, supply_house_id, supply_house_contact_id, team_prospect_id
  ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.contacts_paper_holder_named();

-- Folded: when the record has a contact already, name_contact folds the named contact into it, and this helper carries
-- the papers. Restated from 20261120010000_paper_party.sql with one refusal added. Outside a trigger, a signed-in
-- caller who is not one of the four roles carries no paper off a contact that is not an outside company's: someone on
-- no list, a lead, or a person on the roster or the hiring board. It raises, so the naming is undone whole and says
-- why. A fold between two outside companies' contacts (a merge) carries its papers as before, and so does a fold a
-- trigger runs (a record deleted by a screen). Everything else is as it was.
CREATE OR REPLACE FUNCTION public.contacts_fold_papers(p_from uuid, p_into uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_from IS NULL OR p_into IS NULL OR p_from = p_into THEN
    RETURN;
  END IF;
  IF auth.uid() IS NOT NULL AND pg_trigger_depth() = 0
     AND (NOT public.gc_office_team() OR public.is_read_only() OR public.is_digital_twin() OR public.caller_is_archived()) THEN
    RETURN;
  END IF;
  IF auth.uid() IS NOT NULL AND pg_trigger_depth() = 0 AND NOT public.is_office_staff()
     AND NOT EXISTS (
       SELECT 1 FROM public.contacts c
       WHERE c.id = p_from
         AND num_nonnulls(c.customer_id, c.customer_contact_person_id, c.supply_house_id, c.supply_house_contact_id,
                          c.gc_company_id, c.gc_company_person_id) = 1)
     AND public.contact_holds_paper(p_from) THEN
    RAISE EXCEPTION 'officeNamesPaperHolder' USING ERRCODE = '42501',
      DETAIL = 'They hold a paper, so only the office says who they are.';
  END IF;
  UPDATE public.person_contract_documents
  SET party_contact_id = p_into, person_name = 'party:' || p_into::text
  WHERE party_contact_id = p_from;
END;
$$;

COMMENT ON FUNCTION public.contacts_fold_papers(uuid, uuid) IS
  'Punch list #403: the spine''s contacts_fold runs it, so a folded contact''s papers are with the contact it folds into, under that contact''s stored name. A definer, since the papers are the four roles'' to write. Outside a trigger, a call from someone signed in off the office team, a training account, a digital twin or an archived account moves nothing, and a caller who is not one of the four roles is refused in words when the contact folded holds a paper and is not an outside company''s (the owner''s second decision of 2026-11-22).';

REVOKE EXECUTE ON FUNCTION public.contacts_fold_papers(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contacts_fold_papers(uuid, uuid) TO authenticated, service_role;

-- ---------- 2. An estimator reads the layout and the signature of an outside company's paper ----------

-- The form's layout: a template is read by an estimator when an outside company's paper is filled on it. The papers
-- are read under the estimator's own policy, and the rule is said again in words, as estimator_reads_paper says it.
-- Not a digital twin and not a training account. Beside the table's own read policy (the four roles).
DROP POLICY IF EXISTS contract_form_templates_estimator_outside ON public.contract_form_templates;
CREATE POLICY contract_form_templates_estimator_outside ON public.contract_form_templates
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_estimator())
    AND NOT (SELECT public.is_digital_twin())
    AND NOT (SELECT public.is_read_only())
    AND EXISTS (
      SELECT 1 FROM public.person_contract_documents d
      WHERE d.form_template_id = contract_form_templates.id
        AND public.paper_is_outside_company(d.person_id, d.partnership_id, d.company_id, d.party_contact_id)
    )
  );

COMMENT ON POLICY contract_form_templates_estimator_outside ON public.contract_form_templates IS
  'Punch list #403, the owner''s second decision: an estimator who is not a digital twin and not in training reads the layout of a form that an outside company''s paper is filled on, so the signed record lists its answers. Reading only.';

-- The signature's image: the private bucket keeps a paper's drawn signature under the paper's own id
-- (<paper id>/<file>.png). An estimator who is not in training reads the image of a paper estimator_reads_paper says
-- yes to, and of no other. The CASE keeps the cast from a path that is not a paper's (gc-sows/…, commitments/…). The
-- bucket's own policy (contract_signer_signatures_select, the four roles) was made out of band and is not touched.
DROP POLICY IF EXISTS contract_signer_signatures_estimator_outside ON storage.objects;
CREATE POLICY contract_signer_signatures_estimator_outside ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'contract-signer-signatures'
    AND NOT (SELECT public.is_read_only())
    AND CASE
      WHEN split_part(name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN public.estimator_reads_paper(split_part(name, '/', 1)::uuid)
      ELSE false
    END
  );
