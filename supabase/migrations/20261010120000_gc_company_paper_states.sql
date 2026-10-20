SET lock_timeout = '3s';

-- GC mode, the Board's papers read for the office (v2.5179; carved out of Building's door D1, call 6, at the lead's
-- word: to-dos/gc-mode/mockups/building-door.md on branch spike/gc-mode).
--
-- A trade partner company's papers are rows of person_contract_documents (B6-b-i, 20261010009000). That table's SELECT
-- policy reads for the pay roles (a dev, a leader, an assistant, and the controller through has_payroll_access()), so an
-- estimator's board read every company's master agreement, W-9 and insurance as missing, and held its bars as not ready. A row policy for the office
-- would hand it every column of a company's paper, a W-9's form_hints (its tax number's last four), the answers' PDF
-- path and the signer's IP and agent among them (the Board's call).
--
-- So the office reads the states only, through one function:
--   * a company's own papers only (company_id set), never a person's;
--   * only the three kinds the board reads (companyPapers: agreement, w9, coi);
--   * only the eight columns companyPapers reads (CompanyPaperRow), nothing else of the row;
--   * for the office team (gc_office_team()); anyone else gets an empty set, not an error.
-- Building's door D1 widens the gate to the schedule's team with one CREATE OR REPLACE. No table is created or changed.

CREATE OR REPLACE FUNCTION public.gc_company_paper_states(p_company_ids uuid[] DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  company_id uuid,
  doc_type text,
  status text,
  sent_at timestamptz,
  signed_at date,
  expires_at date,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id, d.company_id, d.doc_type, d.status, d.sent_at, d.signed_at, d.expires_at, d.created_at
  FROM public.person_contract_documents d
  WHERE (SELECT public.gc_office_team())
    AND d.company_id IS NOT NULL
    AND d.doc_type IN ('agreement', 'w9', 'coi')
    AND (p_company_ids IS NULL OR d.company_id = ANY (p_company_ids))
  ORDER BY d.company_id, d.created_at, d.id;
$$;

REVOKE ALL ON FUNCTION public.gc_company_paper_states(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_company_paper_states(uuid[]) TO authenticated, service_role;

COMMENT ON FUNCTION public.gc_company_paper_states(uuid[]) IS
  'GC mode (v2.5179, the Board''s papers for the office; Building''s door D1, call 6): a trade partner company''s papers as companyPapers reads them (CompanyPaperRow): its agreement, W-9 and certificate rows of person_contract_documents, eight columns and nothing else of the row (never form_hints, the answers'' PDF or the signer''s details), never a person''s paper. For the office team (gc_office_team()); an empty set for anyone else. Building''s door widens it to the schedule''s team.';
