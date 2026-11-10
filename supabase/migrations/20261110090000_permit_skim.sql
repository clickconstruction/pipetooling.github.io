-- v2.6835 — Permits: builders with a mark, the hand-off, the put-back and the count
-- (punch list #302, PR 6 to 8). One migration for the rest of the first build, so prod is
-- pushed once:
--   * `permits.builder_key`: the name a permit was pulled under, keyed the way the ledger keys a
--     name, so every permit of one company finds its siblings. `permit-pull` fills it.
--   * `builders`: what the office says about a name (its kind, the customer it is), one row per
--     key, made the first time someone says something. A name with no row is still a builder.
--   * `builder_marks`: good, avoid or cleared, append-only, with who and why.
--   * `permit_verdicts`: a reason code beside the words, the person a keep is handed to, what a
--     pursue is for, and a fifth verdict, `back`, which puts a permit back on the skim.
--   * `research_permits`: the same shape; a permit whose newest verdict is `back` reads as unanswered.
--   * `research_permits_v2`, `research_builders`, `permit_funnel`, `permit_skim_wait`: the reads the
--     skim, the lists, the Builders page, the count and the nudge stand on.
SET lock_timeout = '3s';

-- 1. The builder's key on a permit.
ALTER TABLE public.permits ADD COLUMN IF NOT EXISTS builder_key text;
COMMENT ON COLUMN public.permits.builder_key IS
  'Permits (punch list #302): the company (else the person) on the contact line, as research_name_key keys a name. Filled by permit-pull; null until then and when the feed names nobody.';
CREATE INDEX IF NOT EXISTS permits_city_builder_key_idx ON public.permits (city, builder_key) WHERE builder_key IS NOT NULL;

-- permit-pull hands the keys of the rows it already holds back in one statement per batch.
CREATE OR REPLACE FUNCTION public.permit_set_builder_keys(p_pairs jsonb)
RETURNS integer
LANGUAGE sql
SET search_path = public
AS $$
  WITH pairs AS (
    SELECT x.id, NULLIF(btrim(x.key), '') AS key
    FROM jsonb_to_recordset(COALESCE(p_pairs, '[]'::jsonb)) AS x(id uuid, key text)
  ),
  done AS (
    UPDATE public.permits p
    SET builder_key = pairs.key
    FROM pairs
    WHERE p.id = pairs.id AND p.builder_key IS DISTINCT FROM pairs.key
    RETURNING 1
  )
  SELECT count(*)::integer FROM done;
$$;
COMMENT ON FUNCTION public.permit_set_builder_keys(jsonb) IS
  'Permits (punch list #302): sets permits.builder_key for a batch of [{id, key}] pairs. Called by permit-pull as the service role.';
REVOKE ALL ON FUNCTION public.permit_set_builder_keys(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.permit_set_builder_keys(jsonb) TO service_role;

-- 2. What the office says about a name.
CREATE TABLE IF NOT EXISTS public.builders (
  key text PRIMARY KEY CHECK (length(btrim(key)) > 0),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  -- gc | owner | developer | architect | plumber | files_for_others | person; null until someone says.
  kind text CHECK (kind IS NULL OR kind IN ('gc', 'owner', 'developer', 'architect', 'plumber', 'files_for_others', 'person')),
  -- The customer this builder already is, when the office links one.
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.builders IS 'Permits (punch list #302): what the office says about a name that pulls permits — its kind and the customer it is — one row per builder key, made the first time someone says something. Its permits are permits.builder_key; its marks are builder_marks.';

ALTER TABLE public.builders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS builders_select ON public.builders;
CREATE POLICY builders_select ON public.builders
  FOR SELECT TO authenticated
  USING (public.user_can_research_permits());
DROP POLICY IF EXISTS builders_insert ON public.builders;
CREATE POLICY builders_insert ON public.builders
  FOR INSERT TO authenticated
  WITH CHECK (public.user_can_research_permits() AND updated_by = auth.uid());
DROP POLICY IF EXISTS builders_update ON public.builders;
CREATE POLICY builders_update ON public.builders
  FOR UPDATE TO authenticated
  USING (public.user_can_research_permits())
  WITH CHECK (public.user_can_research_permits() AND updated_by = auth.uid());
REVOKE ALL ON TABLE public.builders FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.builders TO authenticated;
GRANT ALL ON TABLE public.builders TO service_role;

-- 3. Our mark on a builder: append-only, the newest wins, a reason on a good and on an avoid.
CREATE TABLE IF NOT EXISTS public.builder_marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_key text NOT NULL CHECK (length(btrim(builder_key)) > 0),
  mark text NOT NULL CHECK (mark IN ('good', 'avoid', 'none')),
  reason text NOT NULL DEFAULT '',
  marked_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  marked_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT builder_marks_reason_check CHECK (mark = 'none' OR length(btrim(reason)) > 0)
);
CREATE INDEX IF NOT EXISTS builder_marks_key_marked_idx ON public.builder_marks (builder_key, marked_at DESC);
COMMENT ON TABLE public.builder_marks IS 'Permits (punch list #302): the office''s mark on a builder — good, avoid, or none to clear it — append-only; the newest per key is the mark. A good and an avoid carry their reason.';

ALTER TABLE public.builder_marks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS builder_marks_select ON public.builder_marks;
CREATE POLICY builder_marks_select ON public.builder_marks
  FOR SELECT TO authenticated
  USING (public.user_can_research_permits());
DROP POLICY IF EXISTS builder_marks_insert ON public.builder_marks;
CREATE POLICY builder_marks_insert ON public.builder_marks
  FOR INSERT TO authenticated
  WITH CHECK (marked_by = auth.uid() AND public.user_can_research_permits());
REVOKE ALL ON TABLE public.builder_marks FROM anon;
GRANT SELECT, INSERT ON TABLE public.builder_marks TO authenticated;
GRANT ALL ON TABLE public.builder_marks TO service_role;

-- 4. More on a verdict: the reason as a code, who a keep is for, what a pursue is for, and `back`.
ALTER TABLE public.permit_verdicts ADD COLUMN IF NOT EXISTS reason_code text;
ALTER TABLE public.permit_verdicts ADD COLUMN IF NOT EXISTS for_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.permit_verdicts ADD COLUMN IF NOT EXISTS pursue_for text;
ALTER TABLE public.permit_verdicts DROP CONSTRAINT IF EXISTS permit_verdicts_pursue_for_check;
ALTER TABLE public.permit_verdicts ADD CONSTRAINT permit_verdicts_pursue_for_check CHECK (pursue_for IS NULL OR pursue_for IN ('this_job', 'next_jobs', 'both'));
ALTER TABLE public.permit_verdicts DROP CONSTRAINT IF EXISTS permit_verdicts_verdict_check;
ALTER TABLE public.permit_verdicts ADD CONSTRAINT permit_verdicts_verdict_check CHECK (verdict IN ('look', 'approach', 'not_for_us', 'taken', 'back'));
COMMENT ON COLUMN public.permit_verdicts.reason_code IS 'Permits (punch list #302): the one-tap reason as a code (too_small, too_far, not_our_work, not_this_builder, has_a_plumber, no_answer, too_far_along, too_old), so reasons can be counted. The words stay in reason.';
COMMENT ON COLUMN public.permit_verdicts.for_user_id IS 'Permits (punch list #302): the person a kept or pursued permit is handed to. Null is nobody yet.';
COMMENT ON COLUMN public.permit_verdicts.pursue_for IS 'Permits (punch list #302): what a pursue is for — this_job, next_jobs or both.';

-- 5. The ledger's read, same shape: a permit put back reads as unanswered.
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
  plumbing AS (
    SELECT b.id AS building_id,
           q.contact,
           q.permit_number <> b.permit_number AS own_number,
           COALESCE(q.issued_on, q.submitted_on) AS on_day,
           -- A name counts only when it is not the building permit's own applicant.
           (q.contact IS NOT NULL AND public.research_name_key(q.contact) IS DISTINCT FROM public.research_name_key(b.contact)) AS names_someone_else
    FROM building b
    JOIN public.permits q
      ON q.city = b.city
     AND q.kind = 'plumbing'
     AND (q.permit_number = b.permit_number OR (b.address_key IS NOT NULL AND q.address_key = b.address_key))
     AND COALESCE(q.issued_on, q.submitted_on) >= COALESCE(b.submitted_on, b.issued_on) - 30
  ),
  paired AS (
    SELECT building_id,
           (array_agg(contact ORDER BY own_number DESC, on_day DESC NULLS LAST) FILTER (WHERE names_someone_else))[1] AS plumber,
           max(on_day) AS plumber_permit_on
    FROM plumbing
    GROUP BY building_id
  ),
  latest AS (
    SELECT DISTINCT ON (v.permit_id) v.permit_id, v.verdict, v.reason, v.look_again_on, v.prospect_id, v.decided_by, v.decided_at
    FROM public.permit_verdicts v
    JOIN building b ON b.id = v.permit_id
    ORDER BY v.permit_id, v.decided_at DESC
  ),
  -- Put back: the newest word on the permit is that it waits again.
  newest AS (
    SELECT * FROM latest WHERE verdict <> 'back'
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

-- 6. The same rows with the builder and the rest of the verdict beside them.
CREATE OR REPLACE FUNCTION public.research_permits_v2(p_city text, p_since date, p_residential boolean DEFAULT false)
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
  verdict_at timestamptz,
  verdict_reason_code text,
  verdict_for_user uuid,
  verdict_for_name text,
  verdict_pursue_for text,
  builder_key text,
  builder_name text,
  builder_kind text,
  builder_mark text,
  builder_mark_reason text,
  builder_mark_by_name text,
  builder_mark_at timestamptz,
  builder_permits integer,
  builder_open integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH base AS (
    SELECT r.*, p.builder_key AS bkey
    FROM public.research_permits(p_city, p_since, p_residential) r
    JOIN public.permits p ON p.id = r.id
  ),
  latest AS (
    SELECT DISTINCT ON (v.permit_id) v.permit_id, v.verdict, v.reason_code, v.for_user_id, v.pursue_for
    FROM public.permit_verdicts v
    JOIN base r ON r.id = v.permit_id
    ORDER BY v.permit_id, v.decided_at DESC
  ),
  -- A builder's building permits in the last year, and whether a plumbing permit sits on each.
  theirs AS (
    SELECT q.builder_key,
           EXISTS (
             SELECT 1 FROM public.permits pl
             WHERE pl.city = q.city AND pl.kind = 'plumbing'
               AND (pl.permit_number = q.permit_number OR (q.address_key IS NOT NULL AND pl.address_key = q.address_key))
           ) AS has_plumbing
    FROM public.permits q
    WHERE q.city = p_city AND q.kind = 'building' AND NOT q.residential AND q.builder_key IS NOT NULL
      AND COALESCE(q.issued_on, q.submitted_on) >= public.app_today() - 365
  ),
  stats AS (
    SELECT builder_key, count(*)::integer AS permits, count(*) FILTER (WHERE NOT has_plumbing)::integer AS open
    FROM theirs
    GROUP BY builder_key
  ),
  marks AS (
    SELECT DISTINCT ON (m.builder_key) m.builder_key, m.mark, m.reason, m.marked_by, m.marked_at
    FROM public.builder_marks m
    ORDER BY m.builder_key, m.marked_at DESC
  )
  SELECT r.id, r.city, r.source, r.permit_number, r.permit_type, r.stage, r.residential, r.work_type, r.project_name,
         r.address, r.zip, r.lat, r.lng, r.submitted_on, r.issued_on, r.filed_on, r.declared_value, r.area_sf, r.contact,
         r.plumber, r.plumber_permit_on,
         r.verdict, r.verdict_reason, r.verdict_look_again_on, r.verdict_prospect_id, r.verdict_by, r.verdict_by_name, r.verdict_at,
         CASE WHEN r.verdict IS NULL THEN NULL ELSE l.reason_code END,
         CASE WHEN r.verdict IS NULL THEN NULL ELSE l.for_user_id END,
         CASE WHEN r.verdict IS NULL THEN NULL ELSE fu.name END,
         CASE WHEN r.verdict IS NULL THEN NULL ELSE l.pursue_for END,
         r.bkey, bd.name, bd.kind,
         NULLIF(mk.mark, 'none'),
         CASE WHEN mk.mark IS NULL OR mk.mark = 'none' THEN NULL ELSE mk.reason END,
         CASE WHEN mk.mark IS NULL OR mk.mark = 'none' THEN NULL ELSE mu.name END,
         CASE WHEN mk.mark IS NULL OR mk.mark = 'none' THEN NULL ELSE mk.marked_at END,
         COALESCE(st.permits, 0), COALESCE(st.open, 0)
  FROM base r
  LEFT JOIN latest l ON l.permit_id = r.id
  LEFT JOIN public.users fu ON fu.id = l.for_user_id
  LEFT JOIN public.builders bd ON bd.key = r.bkey
  LEFT JOIN marks mk ON mk.builder_key = r.bkey
  LEFT JOIN public.users mu ON mu.id = mk.marked_by
  LEFT JOIN stats st ON st.builder_key = r.bkey
  ORDER BY r.filed_on DESC, r.permit_number DESC;
$$;
COMMENT ON FUNCTION public.research_permits_v2(text, date, boolean) IS
  'Permits (punch list #302): research_permits with the builder beside each row (its key, kind, mark and how many permits it pulled in a year, how many with no plumbing permit) and the rest of the newest verdict (reason code, who it is for, what a pursue is for).';
REVOKE ALL ON FUNCTION public.research_permits_v2(text, date, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.research_permits_v2(text, date, boolean) TO authenticated;

-- 7. Builders: every name that pulled a commercial building permit in a city in the last year.
CREATE OR REPLACE FUNCTION public.research_builders(p_city text)
RETURNS TABLE (
  key text,
  name text,
  sample_contact text,
  kind text,
  customer_id uuid,
  mark text,
  mark_reason text,
  mark_by_name text,
  mark_at timestamptz,
  permits integer,
  open integer,
  last_permit_on date,
  plumber text,
  plumber_jobs integer,
  bids integer,
  won integer,
  last_bid_on date
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH mine AS (
    SELECT q.id, q.builder_key, q.contact, q.permit_number, q.address_key, q.city, COALESCE(q.issued_on, q.submitted_on) AS filed_on
    FROM public.permits q
    WHERE q.city = p_city AND q.kind = 'building' AND NOT q.residential AND q.builder_key IS NOT NULL
      AND COALESCE(q.issued_on, q.submitted_on) >= public.app_today() - 365
  ),
  plumb AS (
    SELECT m.id, m.builder_key, pl.contact AS plumber,
           (pl.contact IS NOT NULL AND public.research_name_key(pl.contact) IS DISTINCT FROM public.research_name_key(m.contact)) AS named
    FROM mine m
    JOIN public.permits pl
      ON pl.city = m.city AND pl.kind = 'plumbing'
     AND (pl.permit_number = m.permit_number OR (m.address_key IS NOT NULL AND pl.address_key = m.address_key))
  ),
  taken AS (
    SELECT DISTINCT id FROM plumb
  ),
  per AS (
    SELECT m.builder_key,
           count(*)::integer AS permits,
           count(*) FILTER (WHERE t.id IS NULL)::integer AS open,
           max(m.filed_on) AS last_permit_on,
           (array_agg(m.contact ORDER BY m.filed_on DESC NULLS LAST))[1] AS sample_contact
    FROM mine m
    LEFT JOIN taken t ON t.id = m.id
    GROUP BY m.builder_key
  ),
  used AS (
    SELECT builder_key, plumber, count(DISTINCT id)::integer AS jobs,
           row_number() OVER (PARTITION BY builder_key ORDER BY count(DISTINCT id) DESC, plumber) AS rn
    FROM plumb
    WHERE named
    GROUP BY builder_key, plumber
  ),
  named_bids AS (
    SELECT b.id, b.outcome, b.created_at::date AS bid_on,
           public.research_name_key(c.name) AS customer_key,
           public.research_name_key(g.name) AS gc_key
    FROM public.bids b
    LEFT JOIN public.customers c ON c.id = b.customer_id
    LEFT JOIN public.bids_gc_builders g ON g.id = b.gc_builder_id
  ),
  ours AS (
    SELECT p.builder_key,
           count(DISTINCT nb.id)::integer AS bids,
           count(DISTINCT nb.id) FILTER (WHERE nb.outcome IN ('won', 'started_or_complete'))::integer AS won,
           max(nb.bid_on) AS last_bid_on
    FROM per p
    JOIN named_bids nb ON nb.customer_key = p.builder_key OR nb.gc_key = p.builder_key
    GROUP BY p.builder_key
  ),
  marks AS (
    SELECT DISTINCT ON (m.builder_key) m.builder_key, m.mark, m.reason, m.marked_by, m.marked_at
    FROM public.builder_marks m
    ORDER BY m.builder_key, m.marked_at DESC
  )
  SELECT p.builder_key, bd.name, p.sample_contact, bd.kind, bd.customer_id,
         NULLIF(mk.mark, 'none'),
         CASE WHEN mk.mark IS NULL OR mk.mark = 'none' THEN NULL ELSE mk.reason END,
         CASE WHEN mk.mark IS NULL OR mk.mark = 'none' THEN NULL ELSE mu.name END,
         CASE WHEN mk.mark IS NULL OR mk.mark = 'none' THEN NULL ELSE mk.marked_at END,
         p.permits, p.open, p.last_permit_on,
         u.plumber, COALESCE(u.jobs, 0),
         COALESCE(o.bids, 0), COALESCE(o.won, 0), o.last_bid_on
  FROM per p
  LEFT JOIN public.builders bd ON bd.key = p.builder_key
  LEFT JOIN marks mk ON mk.builder_key = p.builder_key
  LEFT JOIN public.users mu ON mu.id = mk.marked_by
  LEFT JOIN used u ON u.builder_key = p.builder_key AND u.rn = 1
  LEFT JOIN ours o ON o.builder_key = p.builder_key
  ORDER BY p.permits DESC, p.last_permit_on DESC NULLS LAST, p.builder_key;
$$;
COMMENT ON FUNCTION public.research_builders(text) IS
  'Permits (punch list #302): the names that pulled a commercial building permit in a city in the last year — how many, how many with no plumbing permit, the last one, the plumber named most on their jobs, our bids and wins with the name, and our mark.';
REVOKE ALL ON FUNCTION public.research_builders(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.research_builders(text) TO authenticated;

-- 8. The count: what arrived, what was skimmed and how it was answered, and what became a bid.
CREATE OR REPLACE FUNCTION public.permit_funnel(p_city text, p_since date)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH b AS (
    SELECT p.id, COALESCE(p.issued_on, p.submitted_on) AS filed_on
    FROM public.permits p
    WHERE p.city = p_city AND p.kind = 'building' AND NOT p.residential
  ),
  ev AS (
    SELECT v.permit_id, v.verdict, v.reason_code, v.pursue_for, v.prospect_id, v.decided_by, v.decided_at,
           (v.decided_at AT TIME ZONE 'America/Chicago')::date AS decided_on,
           row_number() OVER (PARTITION BY v.permit_id ORDER BY v.decided_at) AS first_rn,
           row_number() OVER (PARTITION BY v.permit_id ORDER BY v.decided_at DESC) AS last_rn
    FROM public.permit_verdicts v
    JOIN b ON b.id = v.permit_id
  ),
  -- The first answer a permit got, in the period: the skim.
  firsts AS (
    SELECT * FROM ev WHERE first_rn = 1 AND decided_on >= p_since
  ),
  -- Where a permit stands now, for every permit touched in the period.
  lasts AS (
    SELECT * FROM ev
    WHERE last_rn = 1 AND verdict <> 'back'
      AND permit_id IN (SELECT permit_id FROM ev WHERE decided_on >= p_since)
  ),
  named_bids AS (
    SELECT bd.id, bd.outcome, bd.created_at,
           public.research_name_key(c.name) AS customer_key,
           public.research_name_key(g.name) AS gc_key
    FROM public.bids bd
    LEFT JOIN public.customers c ON c.id = bd.customer_id
    LEFT JOIN public.bids_gc_builders g ON g.id = bd.gc_builder_id
  ),
  -- A pursued permit became a bid when a bid to the lead's name was made after the pursue.
  pursued AS (
    SELECT l.permit_id,
           bool_or(nb.id IS NOT NULL) AS bid,
           bool_or(nb.outcome IN ('won', 'started_or_complete')) AS won
    FROM lasts l
    JOIN public.prospects pr ON pr.id = l.prospect_id
    LEFT JOIN named_bids nb
      ON (nb.customer_key = public.research_name_key(pr.company_name) OR nb.gc_key = public.research_name_key(pr.company_name))
     AND nb.created_at >= l.decided_at
    WHERE l.verdict = 'approach'
    GROUP BY l.permit_id
  )
  SELECT jsonb_build_object(
    'since', p_since,
    'arrived', (SELECT count(*) FROM b WHERE filed_on >= p_since),
    'skimmed', (SELECT count(*) FROM firsts),
    'kept', (SELECT count(*) FROM lasts WHERE verdict = 'look'),
    'passed', (SELECT count(*) FROM lasts WHERE verdict = 'not_for_us'),
    'pursuing', (SELECT count(*) FROM lasts WHERE verdict = 'approach'),
    'has_plumber', (SELECT count(*) FROM lasts WHERE verdict = 'taken'),
    'bid', (SELECT count(*) FROM pursued WHERE bid),
    'won', (SELECT count(*) FROM pursued WHERE COALESCE(won, false)),
    'by_person', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', x.name, 'n', x.n) ORDER BY x.n DESC, x.name)
      FROM (SELECT COALESCE(u.name, 'someone') AS name, count(*) AS n FROM firsts f LEFT JOIN public.users u ON u.id = f.decided_by GROUP BY 1) x
    ), '[]'::jsonb),
    'pass_reasons', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('code', x.code, 'n', x.n) ORDER BY x.n DESC, x.code)
      FROM (SELECT COALESCE(reason_code, 'none') AS code, count(*) AS n FROM lasts WHERE verdict = 'not_for_us' GROUP BY 1) x
    ), '[]'::jsonb),
    'pursue_for', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('code', x.code, 'n', x.n) ORDER BY x.n DESC, x.code)
      FROM (SELECT COALESCE(pursue_for, 'unsaid') AS code, count(*) AS n FROM lasts WHERE verdict = 'approach' GROUP BY 1) x
    ), '[]'::jsonb)
  );
$$;
COMMENT ON FUNCTION public.permit_funnel(text, date) IS
  'Permits (punch list #302): the count since a day — permits that arrived, first answers given (the skim) and by whom, where the touched permits stand now, the pass reasons, what the pursues are for, and how many pursued permits became a bid and a win.';
REVOKE ALL ON FUNCTION public.permit_funnel(text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.permit_funnel(text, date) TO authenticated;

-- 9. The nudge: how many permits wait on a skim and the day the oldest arrived, as one row. Arrived, not
-- filed: the feed runs days behind the city, and a permit cannot wait on us before we hold it.
CREATE OR REPLACE FUNCTION public.permit_skim_wait(p_city text, p_floor numeric DEFAULT 25000)
RETURNS TABLE (waiting integer, oldest_on date)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT count(*)::integer, min((p.first_seen_at AT TIME ZONE 'America/Chicago')::date)
  FROM public.research_permits(p_city, DATE '2000-01-01', false) r
  JOIN public.permits p ON p.id = r.id
  WHERE r.verdict IS NULL AND r.plumber IS NULL AND r.plumber_permit_on IS NULL
    AND (r.declared_value IS NULL OR r.declared_value >= p_floor);
$$;
COMMENT ON FUNCTION public.permit_skim_wait(text, numeric) IS
  'Permits (punch list #302): how many commercial building permits wait on a skim (no answer, no plumbing permit, at or above the value floor or with no value declared) and the day the oldest arrived from the feed. The Needs you line reads it.';
REVOKE ALL ON FUNCTION public.permit_skim_wait(text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.permit_skim_wait(text, numeric) TO authenticated;

-- The four fences every CREATE TABLE migration closes with (CLAUDE.md → DB migrations).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
