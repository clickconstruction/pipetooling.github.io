-- v2.6782 — Research: the permits a city issues, on a ledger (punch list #292, PR 1).
-- Two tables and one log: `permits` (one row per permit the pull or a file brought in, keyed by
-- city, source, number and type, since a commercial job's trade permits share the building
-- permit's number), `permit_verdicts` (the office's calls, append-only, the newest per permit
-- wins) and `permit_pulls` (each run of the pull with its counts). One predicate: the people who
-- research — the office and every estimator. One read: `research_permits`, the ledger's rows with
-- the plumber pairing and the newest verdict in one call. The nightly pull is `permit-pull`,
-- scheduled here at 11:30 UTC (5:30 AM Central) the way court-precinct-nightly is.
SET lock_timeout = '3s';

-- Who researches: the office (dev, master, assistant, controller) and every estimator.
CREATE OR REPLACE FUNCTION public.user_can_research_permits()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_office_staff()
      OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'estimator');
$$;
COMMENT ON FUNCTION public.user_can_research_permits() IS
  'Research (punch list #292): true for the office and every estimator — the people who read the permit ledger and call on it.';
GRANT EXECUTE ON FUNCTION public.user_can_research_permits() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_research_permits() TO service_role;

CREATE TABLE IF NOT EXISTS public.permits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  -- Where the row came from: a feed's name (sa-issued, sa-applied) or 'file' for a dropped export.
  source text NOT NULL,
  permit_number text NOT NULL,
  permit_type text NOT NULL,
  -- building | plumbing | other, read off the permit type by the pull's kernel.
  kind text NOT NULL CHECK (kind IN ('building', 'plumbing', 'other')),
  -- applied | issued: an application is the earliest signal, an issued permit the firm one.
  stage text NOT NULL CHECK (stage IN ('applied', 'issued')),
  residential boolean NOT NULL DEFAULT false,
  work_type text,
  project_name text,
  address text,
  -- The address with the city tail and spacing stripped, lower-cased: the pairing key.
  address_key text,
  zip text,
  lat double precision,
  lng double precision,
  submitted_on date,
  issued_on date,
  declared_value numeric,
  area_sf numeric,
  -- Who pulled it, as the feed names them: a company or a person.
  contact text,
  raw jsonb,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  pulled_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT permits_city_source_number_type_key UNIQUE (city, source, permit_number, permit_type)
);
CREATE INDEX IF NOT EXISTS permits_city_kind_filed_idx ON public.permits (city, kind, COALESCE(issued_on, submitted_on) DESC);
CREATE INDEX IF NOT EXISTS permits_address_key_idx ON public.permits (city, address_key);
CREATE INDEX IF NOT EXISTS permits_number_idx ON public.permits (city, permit_number);
COMMENT ON TABLE public.permits IS 'Research (punch list #292): one row per permit a city feed or a dropped file brought in; a commercial job''s trade permits share the building permit''s number, so the key carries the type.';

ALTER TABLE public.permits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS permits_select ON public.permits;
CREATE POLICY permits_select ON public.permits
  FOR SELECT TO authenticated
  USING (public.user_can_research_permits());
-- The office may drop a file's rows in; the feeds write as the service role.
DROP POLICY IF EXISTS permits_insert_file ON public.permits;
CREATE POLICY permits_insert_file ON public.permits
  FOR INSERT TO authenticated
  WITH CHECK (source = 'file' AND public.user_can_research_permits());
REVOKE ALL ON TABLE public.permits FROM anon;
GRANT SELECT, INSERT ON TABLE public.permits TO authenticated;
GRANT ALL ON TABLE public.permits TO service_role;

CREATE TABLE IF NOT EXISTS public.permit_verdicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permit_id uuid NOT NULL REFERENCES public.permits(id) ON DELETE CASCADE,
  verdict text NOT NULL CHECK (verdict IN ('look', 'approach', 'not_for_us', 'taken')),
  reason text NOT NULL CHECK (length(btrim(reason)) > 0),
  -- Look into it: the day the row comes back to the top.
  look_again_on date,
  -- Approach them: the GC lead the press made or found.
  prospect_id uuid REFERENCES public.prospects(id) ON DELETE SET NULL,
  decided_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  decided_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS permit_verdicts_permit_decided_idx ON public.permit_verdicts (permit_id, decided_at DESC);
COMMENT ON TABLE public.permit_verdicts IS 'Research (punch list #292): the office''s calls on a permit, append-only; the newest per permit is the row''s verdict. A verdict carries its reason, since the next estimator reads it.';

ALTER TABLE public.permit_verdicts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS permit_verdicts_select ON public.permit_verdicts;
CREATE POLICY permit_verdicts_select ON public.permit_verdicts
  FOR SELECT TO authenticated
  USING (public.user_can_research_permits());
DROP POLICY IF EXISTS permit_verdicts_insert ON public.permit_verdicts;
CREATE POLICY permit_verdicts_insert ON public.permit_verdicts
  FOR INSERT TO authenticated
  WITH CHECK (decided_by = auth.uid() AND public.user_can_research_permits());
REVOKE ALL ON TABLE public.permit_verdicts FROM anon;
GRANT SELECT, INSERT ON TABLE public.permit_verdicts TO authenticated;
GRANT ALL ON TABLE public.permit_verdicts TO service_role;

CREATE TABLE IF NOT EXISTS public.permit_pulls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  city text NOT NULL,
  ran_at timestamptz NOT NULL DEFAULT now(),
  since date,
  rows_seen integer NOT NULL DEFAULT 0,
  rows_kept integer NOT NULL DEFAULT 0,
  error text
);
CREATE INDEX IF NOT EXISTS permit_pulls_ran_idx ON public.permit_pulls (ran_at DESC);
COMMENT ON TABLE public.permit_pulls IS 'Research (punch list #292): each run of the permit pull, per feed, with what it saw and kept; the ledger''s Pulled line reads the newest.';

ALTER TABLE public.permit_pulls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS permit_pulls_select ON public.permit_pulls;
CREATE POLICY permit_pulls_select ON public.permit_pulls
  FOR SELECT TO authenticated
  USING (public.user_can_research_permits());
REVOKE ALL ON TABLE public.permit_pulls FROM anon;
GRANT SELECT ON TABLE public.permit_pulls TO authenticated;
GRANT ALL ON TABLE public.permit_pulls TO service_role;

-- The ledger's read: building permits of a city filed since a day, with the plumber pairing (a
-- plumbing permit on the same number or the same address) and the newest verdict. Security
-- invoker: the caller's own RLS applies to every table it reads.
CREATE OR REPLACE FUNCTION public.research_permits(p_city text, p_since date, p_residential boolean DEFAULT false)
RETURNS TABLE (
  id uuid,
  city text,
  source text,
  permit_number text,
  permit_type text,
  stage text,
  residential boolean,
  work_type text,
  project_name text,
  address text,
  zip text,
  lat double precision,
  lng double precision,
  submitted_on date,
  issued_on date,
  filed_on date,
  declared_value numeric,
  area_sf numeric,
  contact text,
  plumber text,
  plumber_permit_on date,
  verdict text,
  verdict_reason text,
  verdict_look_again_on date,
  verdict_prospect_id uuid,
  verdict_by uuid,
  verdict_by_name text,
  verdict_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH building AS (
    SELECT p.*, COALESCE(p.issued_on, p.submitted_on) AS filed_on
    FROM public.permits p
    WHERE p.city = p_city
      AND p.kind = 'building'
      AND (p_residential OR NOT p.residential)
      AND COALESCE(p.issued_on, p.submitted_on) >= p_since
  ),
  paired AS (
    SELECT b.id AS building_id,
           (array_agg(q.contact ORDER BY COALESCE(q.issued_on, q.submitted_on) DESC NULLS LAST))[1] AS plumber,
           max(COALESCE(q.issued_on, q.submitted_on)) AS plumber_permit_on
    FROM building b
    JOIN public.permits q
      ON q.city = b.city
     AND q.kind = 'plumbing'
     AND (q.permit_number = b.permit_number OR (b.address_key IS NOT NULL AND q.address_key = b.address_key))
     AND COALESCE(q.issued_on, q.submitted_on) >= COALESCE(b.submitted_on, b.issued_on) - 30
    GROUP BY b.id
  ),
  newest AS (
    SELECT DISTINCT ON (v.permit_id) v.permit_id, v.verdict, v.reason, v.look_again_on, v.prospect_id, v.decided_by, v.decided_at
    FROM public.permit_verdicts v
    JOIN building b ON b.id = v.permit_id
    ORDER BY v.permit_id, v.decided_at DESC
  )
  SELECT b.id, b.city, b.source, b.permit_number, b.permit_type, b.stage, b.residential, b.work_type, b.project_name,
         b.address, b.zip, b.lat, b.lng, b.submitted_on, b.issued_on, b.filed_on, b.declared_value, b.area_sf, b.contact,
         pr.plumber, pr.plumber_permit_on,
         n.verdict, n.reason, n.look_again_on, n.prospect_id, n.decided_by, u.name, n.decided_at
  FROM building b
  LEFT JOIN paired pr ON pr.building_id = b.id
  LEFT JOIN newest n ON n.permit_id = b.id
  LEFT JOIN public.users u ON u.id = n.decided_by
  ORDER BY b.filed_on DESC, b.permit_number DESC;
$$;
COMMENT ON FUNCTION public.research_permits(text, date, boolean) IS
  'Research (punch list #292): the ledger''s rows — a city''s building permits filed since a day, each with the plumber a plumbing permit on the same number or address names, and the newest verdict.';
GRANT EXECUTE ON FUNCTION public.research_permits(text, date, boolean) TO authenticated;

-- The nightly pull: 11:30 UTC is 5:30 AM Central, before the office opens; the feed itself runs a day or two behind.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'permit-pull';
SELECT cron.schedule('permit-pull', '30 11 * * *', $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/permit-pull',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')),
    body := '{}'::jsonb) AS request_id;
$$);

-- The four fences every CREATE TABLE migration closes with (CLAUDE.md → DB migrations).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
