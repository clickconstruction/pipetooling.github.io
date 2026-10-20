SET lock_timeout = '3s';

-- Prospect fields: who we are talking to (punch list #117, v2.5600). Every prospect is a person we
-- call, sometimes at a company: the person's title and cell, whether we may text them, a sub's
-- Google Maps profile and license, and a second way to reach them. The bench keeps the Maps link too,
-- and Add a company reads it. Additive, idempotent; nothing existing changes.

ALTER TABLE public.prospects
  ADD COLUMN IF NOT EXISTS is_person boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contact_title text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS ok_to_text text NOT NULL DEFAULT 'not_asked',
  ADD COLUMN IF NOT EXISTS maps_url text,
  ADD COLUMN IF NOT EXISTS license text,
  ADD COLUMN IF NOT EXISTS also_reach text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prospects_ok_to_text_check') THEN
    ALTER TABLE public.prospects
      ADD CONSTRAINT prospects_ok_to_text_check CHECK (ok_to_text IN ('not_asked', 'yes', 'no')) NOT VALID;
    ALTER TABLE public.prospects VALIDATE CONSTRAINT prospects_ok_to_text_check;
  END IF;
END $$;

COMMENT ON COLUMN public.prospects.is_person IS 'v2.5600: the person is the record (no company); company_name holds their name and Add customer opens Residential.';
COMMENT ON COLUMN public.prospects.contact_title IS 'v2.5600: the title their company knows the person by.';
COMMENT ON COLUMN public.prospects.contact_phone IS 'v2.5600: the person''s cell; phone_number stays the company line. Texts go to the cell.';
COMMENT ON COLUMN public.prospects.ok_to_text IS 'v2.5600: not_asked, yes or no, asked on the call; quo-send refuses a text to a prospect without a yes.';
COMMENT ON COLUMN public.prospects.maps_url IS 'v2.5600: the Google Maps business profile link; a double key.';
COMMENT ON COLUMN public.prospects.license IS 'v2.5600: a sub''s license, carried to the bench.';
COMMENT ON COLUMN public.prospects.also_reach IS 'v2.5600: a second name and number, free text.';

ALTER TABLE public.gc_companies ADD COLUMN IF NOT EXISTS maps_url text;
COMMENT ON COLUMN public.gc_companies.maps_url IS 'v2.5600: the Google Maps business profile link, from the prospect or typed on Add a company.';

-- Add a company reads the Maps link (`mapsUrl`); everything else as v2.4848 wrote it.
CREATE OR REPLACE FUNCTION public.gc_add_company(company jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
  v_name text;
  v_trades text[];
  v_lang text;
  v_miles integer;
  x jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  v_name := btrim(coalesce(company->>'name', ''));
  IF v_name = '' THEN
    RAISE EXCEPTION 'Give the company a name.' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(company->'trades') = 'array' THEN
    v_trades := ARRAY(SELECT DISTINCT btrim(value #>> '{}') FROM jsonb_array_elements(company->'trades') WHERE btrim(value #>> '{}') <> '');
  ELSE
    v_trades := '{}';
  END IF;
  IF cardinality(v_trades) = 0 THEN
    RAISE EXCEPTION 'Pick the trade they do.' USING ERRCODE = 'P0001';
  END IF;
  v_lang := coalesce(nullif(btrim(coalesce(company->>'lang', '')), ''), 'en');
  IF v_lang NOT IN ('en', 'es') THEN
    RAISE EXCEPTION 'The language is English or Spanish.' USING ERRCODE = 'P0001';
  END IF;
  v_miles := nullif(btrim(coalesce(company->>'maxMiles', '')), '')::integer;
  IF v_miles IS NOT NULL AND v_miles <= 0 THEN
    RAISE EXCEPTION 'How far they drive is a number of miles over 0.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.gc_companies (name, trades, contact_name, phone, email, address, max_miles, license, lang, maps_url, vetting_status, created_by)
  VALUES (
    v_name, v_trades,
    btrim(coalesce(company->>'contactName', '')), btrim(coalesce(company->>'phone', '')), btrim(coalesce(company->>'email', '')),
    btrim(coalesce(company->>'address', '')), v_miles, btrim(coalesce(company->>'license', '')), v_lang,
    nullif(btrim(coalesce(company->>'mapsUrl', '')), ''),
    CASE WHEN coalesce((company->>'known')::boolean, false) THEN NULL ELSE 'new' END,
    v_uid
  ) RETURNING id INTO v_id;

  FOR x IN SELECT value FROM jsonb_array_elements(coalesce(company->'people', '[]'::jsonb)) LOOP
    IF btrim(coalesce(x->>'name', '')) <> '' THEN
      INSERT INTO public.gc_company_people (company_id, name, email, role, gets, added_by)
      VALUES (
        v_id, btrim(x->>'name'), btrim(coalesce(x->>'email', '')), btrim(coalesce(x->>'role', '')),
        CASE WHEN jsonb_typeof(x->'gets') = 'array' THEN ARRAY(SELECT DISTINCT value #>> '{}' FROM jsonb_array_elements(x->'gets')) ELSE '{}'::text[] END,
        'office'
      );
    END IF;
  END LOOP;
  RETURN v_id;
END;
$$;
