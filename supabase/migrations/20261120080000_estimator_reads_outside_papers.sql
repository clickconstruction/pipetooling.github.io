SET lock_timeout = '3s';

-- Where an outside signer lives, step 4, the first PR (punch list #403, to-dos/outside-signer-record/README.md): the
-- estimator's read is widened, and the rule it follows gets a name the signed form's gate can ask.
--
-- The owner's calls of 2026-11-20, each against what the ground built (20261120010000_paper_party.sql):
--   * call 9: the estimator reads every kind of an outside company's paper, a W-9 and an insurance certificate among
--     them, where the ground let them read an agreement alone;
--   * calls 10 and 11: an estimator opens an outside company's signed form, a signed W-9 among them. That file is
--     minted by the edge function open-contract-form-pdf, which asks estimator_reads_paper below.
--
--   1. paper_is_outside_company says whether a paper is with an outside company, from the four columns that say who a
--      paper is with. It is the ground's own rule, word for word, moved out of the policy so one place holds it.
--   2. The estimator's read policy is restated over that function, without its doc_type line.
--   3. estimator_reads_paper answers one paper by its id, for the caller. The signed form's gate asks it, so the gate
--      and the policy cannot come apart.
--
-- What stays closed to an estimator, as before: every paper filed under a person (a staff paper, a sub's own, a
-- partner's, a person's copy of a job's paper, a signed hours statement), a party who is on no list until Add to a
-- list says what they are, and every paper for a digital twin, which reads as an estimator. No other role reads
-- anything it did not read before, and no write policy changes.
--
-- No table is made, so there is no fence to call. Every statement is safe to run twice.

-- ---------- 1. Is this paper with an outside company? ----------

-- The four columns say who a paper is with. A person's paper names a roster person or a partnership. A trade company's
-- own paper names the company. A party's paper names a contact, and that contact points at exactly one of a customer,
-- a person at one, a supply house or vendor, a rep, a trade company or a person at one. A contact with no record
-- behind it is a party on no list, and is not an outside company yet. An invoker: the contact is read under the
-- caller's own contacts policy, as the ground's policy read it.
CREATE OR REPLACE FUNCTION public.paper_is_outside_company(
  p_person_id uuid,
  p_partnership_id uuid,
  p_company_id uuid,
  p_party_contact_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT p_person_id IS NULL
    AND p_partnership_id IS NULL
    AND (
      p_company_id IS NOT NULL
      OR EXISTS (
        SELECT 1 FROM public.contacts c
        WHERE c.id = p_party_contact_id
          AND num_nonnulls(c.customer_id, c.customer_contact_person_id, c.supply_house_id, c.supply_house_contact_id,
                           c.gc_company_id, c.gc_company_person_id) = 1
      )
    );
$$;

COMMENT ON FUNCTION public.paper_is_outside_company(uuid, uuid, uuid, uuid) IS
  'Punch list #403: whether a paper (person_contract_documents) is with an outside company, from its person_id, partnership_id, company_id and party_contact_id. True for a trade company''s own paper and for a party''s paper whose contact points at a customer, a person at one, a supply house, a rep, a trade company or a person at one. False for every paper filed under a person and for a party on no list. The estimator''s read policy and estimator_reads_paper both ask it.';

REVOKE EXECUTE ON FUNCTION public.paper_is_outside_company(uuid, uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.paper_is_outside_company(uuid, uuid, uuid, uuid) TO authenticated, service_role;

-- ---------- 2. The estimator reads every kind of an outside company's paper ----------

-- The ground's policy with its doc_type line gone (call 9), and the paper's side of it asked of the function above.
-- Beside the table's own read policy (a dev, the leaders, the assistants and the controller), an estimator who is not a
-- digital twin reads a paper that is with an outside company, whatever its kind. Reading only: no write policy
-- changes, and an archived account is closed by the fence already on the table.
DROP POLICY IF EXISTS person_contract_documents_estimator_outside ON public.person_contract_documents;
CREATE POLICY person_contract_documents_estimator_outside ON public.person_contract_documents
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_estimator())
    AND NOT (SELECT public.is_digital_twin())
    AND public.paper_is_outside_company(person_id, partnership_id, company_id, party_contact_id)
  );

COMMENT ON POLICY person_contract_documents_estimator_outside ON public.person_contract_documents IS
  'Punch list #403, calls 4, 7 and 9: an estimator who is not a digital twin reads every kind of a paper that is with an outside company (paper_is_outside_company). Nothing filed under a person, and no party on no list.';

-- ---------- 3. One paper, for the caller: what the signed form's gate asks ----------

-- open-contract-form-pdf asks this as the caller before it mints an estimator a link to a signed form (calls 10 and
-- 11). An invoker: the paper is read through the caller's own policies, the archived fence among them, and the rule is
-- said again in words here, so a later read policy for an estimator opens no file by itself. False for anyone who is
-- not an estimator, for a digital twin, and for a paper that is not there.
CREATE OR REPLACE FUNCTION public.estimator_reads_paper(p_paper_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (SELECT public.is_estimator())
    AND NOT (SELECT public.is_digital_twin())
    AND EXISTS (
      SELECT 1 FROM public.person_contract_documents d
      WHERE d.id = p_paper_id
        AND public.paper_is_outside_company(d.person_id, d.partnership_id, d.company_id, d.party_contact_id)
    );
$$;

COMMENT ON FUNCTION public.estimator_reads_paper(uuid) IS
  'Punch list #403, calls 10 and 11: whether the caller is an estimator, not a digital twin, who reads this paper because it is with an outside company (paper_is_outside_company). The edge function open-contract-form-pdf asks it as the caller before it opens an estimator a signed form, so the gate follows the read policy.';

REVOKE EXECUTE ON FUNCTION public.estimator_reads_paper(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.estimator_reads_paper(uuid) TO authenticated, service_role;
