SET lock_timeout = '3s';
-- A matter on a person (v2.6543, punch list #269 PR 3a). The Legal desk's matters stand on a Collections payer
-- (payer_key, customer_id, the jobs through legal_matter_jobs). The analysis for counsel about a former teammate has the
-- same shape — a narrative for the firm, documents with a hash and a state, a timeline of planned steps and events —
-- and no payer. This file gives legal_matters a kind: 'account' (every row so far) or 'person', the latter standing on
-- a people row (person_id, one matter a person, payer_key 'p:<person_id>' so the UNIQUE holds and the desk's
-- account lookups never match it). A person matter is a dev's record like the HR file it hangs on: restrictive
-- policies on the five legal tables keep its rows from the office roles that read account matters, and
-- legal_person_matter_open (devs only) makes it. Additive and idempotent; no table is created, so no fence calls.

ALTER TABLE public.legal_matters ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'account';
ALTER TABLE public.legal_matters ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES public.people(id) ON DELETE RESTRICT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'legal_matters_kind_check') THEN
    ALTER TABLE public.legal_matters ADD CONSTRAINT legal_matters_kind_check CHECK (kind IN ('account', 'person')) NOT VALID;
    ALTER TABLE public.legal_matters VALIDATE CONSTRAINT legal_matters_kind_check;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'legal_matters_person_kind_check') THEN
    ALTER TABLE public.legal_matters ADD CONSTRAINT legal_matters_person_kind_check CHECK ((kind = 'person') = (person_id IS NOT NULL)) NOT VALID;
    ALTER TABLE public.legal_matters VALIDATE CONSTRAINT legal_matters_person_kind_check;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS legal_matters_person_id_key ON public.legal_matters (person_id) WHERE person_id IS NOT NULL;

COMMENT ON COLUMN public.legal_matters.kind IS 'v2.6543: account (a Collections payer and its jobs, the desk''s matter) or person (a matter on a people row, the HR file''s; devs only).';
COMMENT ON COLUMN public.legal_matters.person_id IS 'v2.6543: the people row a person matter stands on; NULL on an account matter. One matter a person.';

-- Whether a matter is a person's: the restrictive policies on the child tables read it as the definer, since the caller
-- may not see the matter row itself.
CREATE OR REPLACE FUNCTION public.legal_matter_is_person(p_matter_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.legal_matters m WHERE m.id = p_matter_id AND m.kind = 'person');
$$;
REVOKE EXECUTE ON FUNCTION public.legal_matter_is_person(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_matter_is_person(uuid) TO authenticated;

-- A person matter's rows are a dev's alone, on every verb, on every table that hangs on a matter. Restrictive: it only
-- ever narrows what the permissive office policies allow.
DO $$
DECLARE
  t text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'legal_matters' AND policyname = 'legal_matters_person_dev_only') THEN
    CREATE POLICY legal_matters_person_dev_only ON public.legal_matters AS RESTRICTIVE FOR ALL TO authenticated
      USING (kind <> 'person' OR public.is_dev()) WITH CHECK (kind <> 'person' OR public.is_dev());
  END IF;
  FOREACH t IN ARRAY ARRAY['legal_matter_jobs', 'legal_matter_entries', 'legal_matter_documents', 'legal_matter_gap_answers'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname = t || '_person_dev_only') THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (NOT public.legal_matter_is_person(matter_id) OR public.is_dev()) WITH CHECK (NOT public.legal_matter_is_person(matter_id) OR public.is_dev())',
        t || '_person_dev_only', t
      );
    END IF;
  END LOOP;
END $$;

-- Open a matter on a person, or find the one that stands: devs only. The row is made the way the desk's review save
-- makes an account's, less the payer: stage review, nothing released, the person's name as payer_name so every reader
-- that prints a matter's name prints the person's.
CREATE OR REPLACE FUNCTION public.legal_person_matter_open(p_person_id uuid, p_handling_name text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name text;
  v_id uuid;
  v_stage text;
  v_closed timestamptz;
  v_made boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.is_dev() THEN RETURN jsonb_build_object('error', 'A matter on a person is a dev''s to open'); END IF;
  IF p_person_id IS NULL THEN RETURN jsonb_build_object('error', 'Missing person'); END IF;
  SELECT name INTO v_name FROM public.people WHERE id = p_person_id;
  IF v_name IS NULL THEN RETURN jsonb_build_object('error', 'No such person'); END IF;
  IF length(COALESCE(p_handling_name, '')) > 200 THEN RETURN jsonb_build_object('error', 'Keep the handling name under 200 characters'); END IF;

  SELECT id, stage, closed_at INTO v_id, v_stage, v_closed FROM public.legal_matters WHERE person_id = p_person_id;
  IF v_id IS NULL THEN
    INSERT INTO public.legal_matters (payer_key, customer_id, payer_name, kind, person_id, handling_name, created_by)
    VALUES ('p:' || p_person_id::text, NULL, v_name, 'person', p_person_id, COALESCE(btrim(p_handling_name), ''), auth.uid())
    RETURNING id, stage, closed_at INTO v_id, v_stage, v_closed;
    v_made := true;
  END IF;
  RETURN jsonb_build_object('ok', true, 'matter_id', v_id, 'stage', v_stage, 'closed', v_closed IS NOT NULL, 'made', v_made, 'person_name', v_name);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.legal_person_matter_open(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.legal_person_matter_open(uuid, text) TO authenticated;
COMMENT ON FUNCTION public.legal_person_matter_open(uuid, text) IS 'Open a matter on a person, or find the one that stands (v2.6543, punch list #269 PR 3a): devs only; one matter a person (payer_key p:<person_id>, kind person); stage review, nothing released. Replies { ok, matter_id, stage, closed, made, person_name }.';
