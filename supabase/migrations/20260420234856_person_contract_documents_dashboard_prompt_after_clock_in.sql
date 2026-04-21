-- Dashboard post–clock-in reminder: staff flag per person contract document + RPC for signers.

ALTER TABLE public.person_contract_documents
  ADD COLUMN IF NOT EXISTS dashboard_prompt_after_clock_in BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.person_contract_documents.dashboard_prompt_after_clock_in IS
  'When true, show this unsigned document on the signer''s Dashboard after each clock-in (if signing content exists). Set in People → Contracts.';

-- Signer identity: roster people.email matches auth users.email and people.name = person_contract_documents.person_name, OR users.name matches person_name.
CREATE OR REPLACE FUNCTION public.list_my_contract_dashboard_prompts()
RETURNS TABLE (
  id uuid,
  document_name text,
  status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pcd.id, pcd.document_name, pcd.status
  FROM public.person_contract_documents pcd
  CROSS JOIN public.users u
  WHERE u.id = auth.uid()
    AND pcd.dashboard_prompt_after_clock_in = true
    AND pcd.status <> 'signed'
    AND (
      (pcd.signing_body_html IS NOT NULL AND btrim(pcd.signing_body_html) <> '')
      OR (pcd.canonical_document_url IS NOT NULL AND btrim(pcd.canonical_document_url) <> '')
      OR (pcd.url IS NOT NULL AND btrim(pcd.url) <> '')
    )
    AND (
      EXISTS (
        SELECT 1
        FROM public.people p
        WHERE p.archived_at IS NULL
          AND trim(p.name) = trim(pcd.person_name)
          AND p.email IS NOT NULL
          AND btrim(p.email) <> ''
          AND u.email IS NOT NULL
          AND btrim(u.email) <> ''
          AND lower(btrim(p.email)) = lower(btrim(u.email))
      )
      OR trim(u.name) = trim(pcd.person_name)
    );
$$;

REVOKE ALL ON FUNCTION public.list_my_contract_dashboard_prompts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_contract_dashboard_prompts() TO authenticated;

COMMENT ON FUNCTION public.list_my_contract_dashboard_prompts() IS
  'Unsigned person_contract_documents flagged for dashboard reminder, for the current auth user (roster email/name match). SECURITY DEFINER.';
