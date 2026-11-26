SET lock_timeout = '3s';

-- Punch list #439, piece 3, the ground: a paper names a site (to-dos/site-nda-for-vendors/README.md).
--
-- A paper's row is person_contract_documents. It names a job (job_id, 20261117220000) and the party it is with
-- (party_contact_id, 20261120010000), and nothing that names a site. The card's settled calls: a site is a development,
-- which carries all its jobs and has a name and a city and no address, or it is an address, matched by its cleaned key
-- as address_place_answers keeps it (20261124200000: normalizeAddressKey, at most 300 characters). The paper may print
-- the site's address only when a box is ticked, and the box starts unticked.
--
-- Four columns on the paper's row, all empty on every row there is:
--
--   site_development_id   the site when it is a development. The development deleted, the paper stays and names no site.
--   site_address_key      the site when it is an address: the cleaned key, never blank, at most 300 characters.
--   site_address          the address as written when the paper was sent, for the row's label and for the print.
--                         Only beside a key, never blank, at most 500 characters.
--   site_prints_address   true when the signer reads the address before signing. False on every row; true only on a
--                         row that keeps an address as written.
--
-- A row names at most one of the two: a development or an address key. Two partial indexes, since every list of a
-- site's papers reads by site.
--
-- What this does not change. No policy and no grant: the table's policies answer by role and name no column, so
-- whoever writes a paper writes its site. No trigger of the table watches these columns. The signer's page
-- (get-contract-for-signer), the signing itself (accept-contract) and the signed copy read the row by a list of
-- columns they name, so nothing of a site reaches a signer until one of them is changed to say so. The view
-- agreements_on_file names its own columns and answers as before. No row is written.
--
-- No table, so no fence call. Every statement is safe to run twice.

-- 1) The columns. Each is a change of the catalog alone: a null column, and a boolean with a constant default.
ALTER TABLE public.person_contract_documents ADD COLUMN IF NOT EXISTS site_development_id uuid REFERENCES public.developments(id) ON DELETE SET NULL;
ALTER TABLE public.person_contract_documents ADD COLUMN IF NOT EXISTS site_address_key text;
ALTER TABLE public.person_contract_documents ADD COLUMN IF NOT EXISTS site_address text;
ALTER TABLE public.person_contract_documents ADD COLUMN IF NOT EXISTS site_prints_address boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.person_contract_documents.site_development_id IS
  'Punch list #439: the site this paper names when the site is a development, which carries all its jobs. Null when the paper names an address or no site. Set null when the development is deleted.';
COMMENT ON COLUMN public.person_contract_documents.site_address_key IS
  'Punch list #439: the site this paper names when the site is an address: the cleaned key (normalizeAddressKey), the same form address_place_answers keeps, so the same place is one site. Null when the paper names a development or no site.';
COMMENT ON COLUMN public.person_contract_documents.site_address IS
  'Punch list #439: the site''s address as written when the paper was sent, for the row''s label and for the print. Only beside site_address_key.';
COMMENT ON COLUMN public.person_contract_documents.site_prints_address IS
  'Punch list #439: true when the paper prints the site''s address, so the signer reads it before signing. False unless a box was ticked, and only on a row that keeps site_address.';

-- 2) The shape. Added NOT VALID and validated after, so the table is read under a lock that lets writes through.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'person_contract_documents_site_one_kind' AND conrelid = 'public.person_contract_documents'::regclass) THEN
    ALTER TABLE public.person_contract_documents ADD CONSTRAINT person_contract_documents_site_one_kind
      CHECK (site_development_id IS NULL OR site_address_key IS NULL) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'person_contract_documents_site_key_words' AND conrelid = 'public.person_contract_documents'::regclass) THEN
    ALTER TABLE public.person_contract_documents ADD CONSTRAINT person_contract_documents_site_key_words
      CHECK (site_address_key IS NULL OR (btrim(site_address_key) <> '' AND char_length(site_address_key) <= 300)) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'person_contract_documents_site_address_words' AND conrelid = 'public.person_contract_documents'::regclass) THEN
    ALTER TABLE public.person_contract_documents ADD CONSTRAINT person_contract_documents_site_address_words
      CHECK (
        (site_address IS NULL OR (site_address_key IS NOT NULL AND btrim(site_address) <> '' AND char_length(site_address) <= 500))
        AND (NOT site_prints_address OR site_address IS NOT NULL)
      ) NOT VALID;
  END IF;
END $$;
ALTER TABLE public.person_contract_documents VALIDATE CONSTRAINT person_contract_documents_site_one_kind;
ALTER TABLE public.person_contract_documents VALIDATE CONSTRAINT person_contract_documents_site_key_words;
ALTER TABLE public.person_contract_documents VALIDATE CONSTRAINT person_contract_documents_site_address_words;

-- 3) Every list of a site's papers reads by site. Partial, since most papers name none.
CREATE INDEX IF NOT EXISTS idx_person_contract_documents_site_development
  ON public.person_contract_documents (site_development_id) WHERE site_development_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_person_contract_documents_site_address_key
  ON public.person_contract_documents (site_address_key) WHERE site_address_key IS NOT NULL;
