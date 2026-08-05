SET lock_timeout = '3s';

-- Manual override for the "Applied version" date on a person's contract
-- document (People → Contracts). When NULL the client derives the date from
-- the pinned/assigned Contract Book row's updated_at (previous behavior);
-- when set, this date is shown instead and Contract Book edits do not move it.
ALTER TABLE public.person_contract_documents
  ADD COLUMN IF NOT EXISTS applied_version_date date;

COMMENT ON COLUMN public.person_contract_documents.applied_version_date IS
  'Manually set "Applied version" date; NULL = derive from the Contract Book row''s updated_at.';
