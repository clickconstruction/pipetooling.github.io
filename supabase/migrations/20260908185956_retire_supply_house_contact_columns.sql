SET lock_timeout = '3s';

-- Supply house directory, PR 4 (to-dos/supply-house-directory): reps
-- (supply_house_contacts) are the only home for a house's contact.
-- supply_houses.contact_name / email were the pre-v2.2648 single-contact
-- fields; 20260902170045 already copied every house email into a rep and the
-- 2026-09-08 read-only probe confirmed no house email is missing from the
-- reps. The house keeps `phone` as its main (counter) number.
--
-- Push AFTER the v2.3170 client deploys: the old form still writes both
-- columns on save, and a stale tab would get "column does not exist" until
-- it reloads. Idempotent.

-- A contact name with no email could never become a rep (email is NOT NULL
-- on reps). Keep the name in the house's notes rather than lose it.
UPDATE public.supply_houses
SET notes = concat_ws(E'\n', NULLIF(btrim(notes), ''), 'Contact: ' || btrim(contact_name))
WHERE contact_name IS NOT NULL
  AND btrim(contact_name) <> ''
  AND (email IS NULL OR btrim(email) = '')
  AND NOT EXISTS (
    SELECT 1 FROM public.supply_house_contacts c
    WHERE c.supply_house_id = supply_houses.id AND c.archived_at IS NULL
  )
  AND (notes IS NULL OR notes NOT LIKE '%Contact: ' || btrim(contact_name) || '%');

-- Belt and braces: any house email still absent from its reps becomes one.
INSERT INTO public.supply_house_contacts (supply_house_id, name, email, label, is_default)
SELECT sh.id,
       COALESCE(NULLIF(btrim(sh.contact_name), ''), split_part(btrim(sh.email), '@', 1)),
       btrim(sh.email),
       'primary',
       NOT EXISTS (SELECT 1 FROM public.supply_house_contacts d WHERE d.supply_house_id = sh.id AND d.archived_at IS NULL)
FROM public.supply_houses sh
WHERE sh.email IS NOT NULL AND btrim(sh.email) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.supply_house_contacts c
    WHERE c.supply_house_id = sh.id AND lower(btrim(c.email)) = lower(btrim(sh.email))
  );

ALTER TABLE public.supply_houses
  DROP COLUMN IF EXISTS contact_name,
  DROP COLUMN IF EXISTS email;
