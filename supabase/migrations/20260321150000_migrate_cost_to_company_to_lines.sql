-- Migrate existing cost_to_company to person_license_cost_lines, then drop column

INSERT INTO public.person_license_cost_lines (person_license_id, amount, note, date)
SELECT id, cost_to_company, NULL, date_of_expiry
FROM public.person_licenses
WHERE cost_to_company IS NOT NULL;

ALTER TABLE public.person_licenses DROP COLUMN IF EXISTS cost_to_company;
