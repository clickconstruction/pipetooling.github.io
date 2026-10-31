SET lock_timeout = '3s';

-- Robot fixtures, PR 1 of five (punch list #221, v2.6180, to-dos/robot-fixtures/README.md): the ground under
-- the window where the estimator takes the fixtures the robot found into her own count. The owner's picks of
-- 2026-10-30 hold here: the dollar score stays on an assisted bid, fixtures open once the robot seals, a count
-- and a price from day one (her book first, the robot's price where her book has none), and a fixture she does
-- not want is set aside with a reason, never deleted.
--
--  - bid_fixture_pulls / bid_fixture_pull_rows: what twin-mcp put_fixtures writes once after paste_counts, under
--    the human bid the shell is paired to. Read by the people who can price the bid; written by the verb (service
--    role) and the RPCs below (SECURITY DEFINER) only — no write policy for anyone.
--  - bids_count_rows.plan_tag, bid_count_sources.source_kind, twin_shadow_runs.assisted_at / assist_kind /
--    fixtures_score.
--  - robot_progress() gains the fixture columns (dropped and recreated: the return shape changed; the client reads
--    columns by name, so the old client is unaffected).
--  - take_robot_fixtures / untake_robot_fixtures / set_aside_robot_fixtures / put_back_robot_fixtures /
--    price_robot_fixtures: the window's five doors, each refusing on a sent bid.
--  - score_locked_shadows writes the fixtures score at send and a [robot fixtures SCORE] line on both ledgers.

-- ---------------------------------------------------------------- the tables

CREATE TABLE IF NOT EXISTS public.bid_fixture_pulls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The human bid (the shell's twin_source_bid_id; the shell itself for a backtest).
  bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  shell_bid_id uuid REFERENCES public.bids(id) ON DELETE SET NULL,
  shadow_run_id uuid REFERENCES public.twin_shadow_runs(id) ON DELETE SET NULL,
  -- The set the robot read (bids.plans_link at read time) and its CountTooling project (the From tile's door).
  plan_link text,
  ct_link text,
  sheet_count integer,
  source text NOT NULL DEFAULT 'robot'
    CONSTRAINT bid_fixture_pulls_source_known CHECK (source IN ('robot', 'derived')),
  -- {agree, conflict, unverifiable}: the robot's own check of its rows, counted.
  check_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Sum of count × the robot's unit price over the rows that have one.
  robot_total numeric(14,2),
  read_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.bid_fixture_pulls IS
  'Robot fixtures (v2.6180, punch list #221): one row per read the robot writes with twin-mcp put_fixtures — the human bid, the shell, the live run, the set it read, the sheet count, its check''s summary and its total for the fixtures. Read under can_access_bid_for_pricing(bid_id); written by the verb (service role) and the robot-fixture RPCs only.';
CREATE INDEX IF NOT EXISTS bid_fixture_pulls_bid_read ON public.bid_fixture_pulls (bid_id, read_at DESC);
CREATE INDEX IF NOT EXISTS bid_fixture_pulls_shell ON public.bid_fixture_pulls (shell_bid_id);

CREATE TABLE IF NOT EXISTS public.bid_fixture_pull_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pull_id uuid NOT NULL REFERENCES public.bid_fixture_pulls(id) ON DELETE CASCADE,
  bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  tag text NOT NULL CONSTRAINT bid_fixture_pull_rows_tag_length CHECK (length(tag) BETWEEN 1 AND 40),
  -- The name the robot priced it as: a fixture type's name, so her price book finds it by name when it lands.
  name text NOT NULL CONSTRAINT bid_fixture_pull_rows_name_length CHECK (length(name) BETWEEN 1 AND 300),
  description text,
  manufacturer text,
  model text,
  connections jsonb,
  count numeric(12,2) NOT NULL DEFAULT 0 CONSTRAINT bid_fixture_pull_rows_count_non_negative CHECK (count >= 0),
  unit text NOT NULL DEFAULT 'ea' CONSTRAINT bid_fixture_pull_rows_unit_known CHECK (unit IN ('ea', 'ft', 'px', 'sqft')),
  -- [{sheet, page, count, pins: [{x, y}]}] — where the robot counted, with its pins (0..1 of the page).
  per_sheet jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- [{kind: schedule|note|legend|callout, sheet, page, text, flags: []}] — every plan line that names the tag.
  backing jsonb NOT NULL DEFAULT '[]'::jsonb,
  scope_flag text CONSTRAINT bid_fixture_pull_rows_scope_known CHECK (scope_flag IS NULL OR scope_flag IN ('by_others', 'existing', 'alternate')),
  confidence numeric(4,3) CONSTRAINT bid_fixture_pull_rows_confidence_range CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  agreement text CONSTRAINT bid_fixture_pull_rows_agreement_known CHECK (agreement IS NULL OR agreement IN ('agree', 'conflict', 'unverifiable')),
  remark text,
  ct_pin_ids jsonb,
  robot_book_entry text,
  robot_unit_price numeric(10,2) CONSTRAINT bid_fixture_pull_rows_price_non_negative CHECK (robot_unit_price IS NULL OR robot_unit_price >= 0),
  sequence_order integer NOT NULL DEFAULT 0,
  -- The take: when she took it, how (added a row of its own, or updated a row of hers), on which version, her
  -- row's count before the robot's (an update, for Undo), the count row, how it was priced on landing.
  taken_at timestamptz,
  taken_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  taken_as text CONSTRAINT bid_fixture_pull_rows_taken_as_known CHECK (taken_as IS NULL OR taken_as IN ('added', 'updated')),
  taken_version_id uuid,
  prior_count numeric(12,2),
  -- Her number on the row the last time it left her count, so Put back restores hers, not the robot's.
  taken_count numeric(12,2),
  count_row_id uuid REFERENCES public.bids_count_rows(id) ON DELETE SET NULL,
  priced_as text CONSTRAINT bid_fixture_pull_rows_priced_as_known CHECK (priced_as IS NULL OR priced_as IN ('her_book', 'robot', 'unpriced')),
  custom_price_id uuid REFERENCES public.bid_count_row_custom_prices(id) ON DELETE SET NULL,
  -- Set aside, never deleted: when, by whom, and the reason she picked.
  set_aside_at timestamptz,
  set_aside_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  set_aside_reason text CONSTRAINT bid_fixture_pull_rows_reason_known CHECK (set_aside_reason IS NULL OR set_aside_reason IN ('by_others', 'existing', 'alternate', 'wrong_count', 'not_sure', 'other')),
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.bid_fixture_pull_rows IS
  'Robot fixtures (v2.6180, punch list #221): one fixture the robot found — tag, name, the schedule row, count per sheet with its pins, the plan text that backs it with flags, its check, its book entry and unit price — and what the estimator did with it: taken (added or updated, priced by her book or by the robot), or set aside with a reason. Read under can_access_bid_for_pricing(bid_id); written by put_fixtures and the robot-fixture RPCs only.';
CREATE INDEX IF NOT EXISTS bid_fixture_pull_rows_pull_seq ON public.bid_fixture_pull_rows (pull_id, sequence_order);
CREATE INDEX IF NOT EXISTS bid_fixture_pull_rows_bid ON public.bid_fixture_pull_rows (bid_id);
CREATE INDEX IF NOT EXISTS bid_fixture_pull_rows_count_row ON public.bid_fixture_pull_rows (count_row_id) WHERE count_row_id IS NOT NULL;

ALTER TABLE public.bid_fixture_pulls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bid_fixture_pull_rows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bid_fixture_pulls_select ON public.bid_fixture_pulls;
CREATE POLICY bid_fixture_pulls_select ON public.bid_fixture_pulls
  FOR SELECT TO authenticated USING (public.can_access_bid_for_pricing(bid_id));
DROP POLICY IF EXISTS bid_fixture_pull_rows_select ON public.bid_fixture_pull_rows;
CREATE POLICY bid_fixture_pull_rows_select ON public.bid_fixture_pull_rows
  FOR SELECT TO authenticated USING (public.can_access_bid_for_pricing(bid_id));
REVOKE ALL ON TABLE public.bid_fixture_pulls FROM anon;
REVOKE ALL ON TABLE public.bid_fixture_pull_rows FROM anon;
GRANT SELECT ON TABLE public.bid_fixture_pulls TO authenticated;
GRANT SELECT ON TABLE public.bid_fixture_pull_rows TO authenticated;
-- Closed by privilege, not only by policy: the verb writes with the service role and the RPCs below run as the owner.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.bid_fixture_pulls FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.bid_fixture_pull_rows FROM authenticated;

-- ---------------------------------------------------------------- the columns

ALTER TABLE public.bids_count_rows ADD COLUMN IF NOT EXISTS plan_tag text;
COMMENT ON COLUMN public.bids_count_rows.plan_tag IS
  'v2.6180: the plan tag (WC-1) on a row the robot''s fixtures landed, drawn as the chip beside the name; null on a row typed or pasted by a person.';

ALTER TABLE public.bid_count_sources ADD COLUMN IF NOT EXISTS source_kind text NOT NULL DEFAULT 'counttooling';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bid_count_sources_source_kind_known') THEN
    ALTER TABLE public.bid_count_sources
      ADD CONSTRAINT bid_count_sources_source_kind_known CHECK (source_kind IN ('counttooling', 'robot'));
  END IF;
END $$;
COMMENT ON COLUMN public.bid_count_sources.source_kind IS
  'v2.6180: counttooling for a project a person imported; robot for the one row take_robot_fixtures registers so the robot''s rows carry a share and the From pill reads Robot.';

ALTER TABLE public.twin_shadow_runs ADD COLUMN IF NOT EXISTS assisted_at timestamptz;
ALTER TABLE public.twin_shadow_runs ADD COLUMN IF NOT EXISTS assist_kind text;
ALTER TABLE public.twin_shadow_runs ADD COLUMN IF NOT EXISTS fixtures_score jsonb;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'twin_shadow_runs_assist_kind_known') THEN
    ALTER TABLE public.twin_shadow_runs
      ADD CONSTRAINT twin_shadow_runs_assist_kind_known CHECK (assist_kind IS NULL OR assist_kind IN ('fixtures'));
  END IF;
END $$;
COMMENT ON COLUMN public.twin_shadow_runs.assisted_at IS
  'v2.6180: set the first time a robot fixture lands on the reference bid''s count. The run keeps its dollar score (the owner''s pick) but leaves the gate, as a practice-teacher run does; Undo leaves the stamp — she saw them.';
COMMENT ON COLUMN public.twin_shadow_runs.fixtures_score IS
  'v2.6180: {found, taken, changed, set_aside, left, reasons, missed} written by score_locked_shadows at send when the reference bid holds a robot pull.';

-- ---------------------------------------------------------------- robot_progress, with the fixture columns

DROP FUNCTION IF EXISTS public.robot_progress(uuid[]);

CREATE FUNCTION public.robot_progress(p_bid_ids uuid[])
RETURNS TABLE (
  bid_id uuid,
  shell_bid_id uuid,
  shell_bid_number text,
  run_status text,
  claimed_at timestamptz,
  plans_filed boolean,
  read_at timestamptz,
  counted_at timestamptz,
  priced_at timestamptz,
  locked_at timestamptz,
  scored_at timestamptz,
  questions_at timestamptz,
  heartbeat_at timestamptz,
  heartbeat_state text,
  heartbeat_stage text,
  heartbeat_progress jsonb,
  heartbeat_is_round boolean,
  key_label text,
  key_last_seen_at timestamptz,
  median_minutes numeric,
  fixtures_at timestamptz,
  fixtures_found integer,
  fixtures_sure integer,
  fixtures_taken integer,
  fixtures_set_aside integer,
  assisted_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role])
  ),
  med AS (
    SELECT CASE WHEN count(*) >= 10
      THEN percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (r.locked_at - r.created_at)) / 60.0)
      END AS minutes
    FROM public.twin_shadow_runs r
    WHERE r.locked_at IS NOT NULL AND r.locked_at > r.created_at AND r.locked_at - r.created_at < interval '12 hours'
  )
  SELECT
    r.reference_bid_id AS bid_id,
    r.shadow_bid_id AS shell_bid_id,
    sb.bid_number::text AS shell_bid_number,
    r.status AS run_status,
    r.created_at AS claimed_at,
    (sb.plans_link IS NOT NULL AND sb.plans_link <> '') AS plans_filed,
    sub.created_at AS read_at,
    au.created_at AS counted_at,
    cr.created_at AS priced_at,
    r.locked_at,
    r.scored_at,
    tq.created_at AS questions_at,
    hb.started_at AS heartbeat_at,
    hb.state AS heartbeat_state,
    hb.stage AS heartbeat_stage,
    hb.progress AS heartbeat_progress,
    COALESCE(hb.is_round, false) AS heartbeat_is_round,
    cred.label AS key_label,
    cred.last_seen_at AS key_last_seen_at,
    (SELECT minutes FROM med) AS median_minutes,
    fx.read_at AS fixtures_at,
    fx.found AS fixtures_found,
    fx.sure AS fixtures_sure,
    fx.taken AS fixtures_taken,
    fx.set_aside AS fixtures_set_aside,
    r.assisted_at
  FROM public.twin_shadow_runs r
  JOIN public.bids sb ON sb.id = r.shadow_bid_id
  LEFT JOIN LATERAL (SELECT s.created_at FROM public.bids_plan_substrates s WHERE s.bid_id = sb.id ORDER BY s.created_at DESC LIMIT 1) sub ON true
  LEFT JOIN LATERAL (SELECT a.created_at FROM public.bid_audits a WHERE a.bid_id = sb.id ORDER BY a.created_at ASC LIMIT 1) au ON true
  LEFT JOIN LATERAL (SELECT min(c.created_at) AS created_at FROM public.bids_count_rows c WHERE c.bid_id = sb.id) cr ON true
  LEFT JOIN LATERAL (SELECT min(q.created_at) AS created_at FROM public.twin_questions q WHERE q.about_bid_id = sb.id) tq ON true
  LEFT JOIN LATERAL (
    SELECT t.started_at, t.state, t.stage, t.progress, t.is_round, t.credential_id
    FROM public.twin_runs t
    WHERE t.mission = 'heartbeat' AND t.bid_id = sb.id
    ORDER BY t.started_at DESC LIMIT 1
  ) hb ON true
  LEFT JOIN LATERAL (
    SELECT p.read_at,
      (SELECT count(*) FROM public.bid_fixture_pull_rows x WHERE x.pull_id = p.id)::integer AS found,
      (SELECT count(*) FROM public.bid_fixture_pull_rows x WHERE x.pull_id = p.id AND COALESCE(x.confidence, 1) >= 0.7 AND COALESCE(x.agreement, 'agree') = 'agree' AND x.scope_flag IS NULL)::integer AS sure,
      (SELECT count(*) FROM public.bid_fixture_pull_rows x WHERE x.pull_id = p.id AND x.taken_at IS NOT NULL AND x.count_row_id IS NOT NULL)::integer AS taken,
      (SELECT count(*) FROM public.bid_fixture_pull_rows x WHERE x.pull_id = p.id AND x.set_aside_at IS NOT NULL)::integer AS set_aside
    FROM public.bid_fixture_pulls p
    WHERE p.bid_id = r.reference_bid_id
    ORDER BY p.read_at DESC LIMIT 1
  ) fx ON true
  LEFT JOIN public.twin_credentials cred ON cred.id = hb.credential_id
  WHERE r.reference_bid_id = ANY (p_bid_ids)
    AND EXISTS (SELECT 1 FROM me)
  ORDER BY r.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.robot_progress(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.robot_progress(uuid[]) TO authenticated, service_role;

-- ---------------------------------------------------------------- the RPCs

-- The robot as a count source on the bid, once: the shade is the share.
CREATE OR REPLACE FUNCTION public.robot_fixture_source(p_bid_id uuid, p_pull_id uuid, p_user uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source_id uuid;
  v_link text;
BEGIN
  SELECT s.id INTO v_source_id FROM public.bid_count_sources s WHERE s.bid_id = p_bid_id AND s.source_kind = 'robot' LIMIT 1;
  IF v_source_id IS NOT NULL THEN RETURN v_source_id; END IF;
  SELECT COALESCE(NULLIF(p.ct_link, ''), NULLIF(p.plan_link, ''), 'https://counttooling.com/') INTO v_link
    FROM public.bid_fixture_pulls p WHERE p.id = p_pull_id;
  IF v_link IS NULL OR v_link !~ '^https?://' THEN v_link := 'https://counttooling.com/'; END IF;
  INSERT INTO public.bid_count_sources (bid_id, link, token, project_name, scope, imported_by, source_kind)
  VALUES (p_bid_id, left(v_link, 2000), NULL, 'Robot', 'all', p_user, 'robot')
  RETURNING id INTO v_source_id;
  RETURN v_source_id;
END;
$$;
REVOKE ALL ON FUNCTION public.robot_fixture_source(uuid, uuid, uuid) FROM public, anon, authenticated;

-- One robot fixture lands as a row of its own on the version: the robot's share, the tag, the pages it counted
-- on, and a price — her book by name first, the robot's unit price as a custom price where her book has none.
-- Returns how it was priced. Internal: the RPCs below call it.
CREATE OR REPLACE FUNCTION public.robot_fixture_land_row(p_row_id uuid, p_bid_version_id uuid, p_source_id uuid, p_price_version uuid, p_count numeric, p_user uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.bid_fixture_pull_rows;
  v_seq integer;
  v_page text;
  v_new uuid;
  v_entry uuid;
  v_custom uuid;
  v_as text := 'unpriced';
BEGIN
  SELECT pr.* INTO v_row FROM public.bid_fixture_pull_rows pr WHERE pr.id = p_row_id;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'robot_fixture_land_row: no such fixture row'; END IF;
  SELECT COALESCE(max(c.sequence_order), 0) + 1 INTO v_seq
    FROM public.bids_count_rows c
   WHERE c.bid_id = v_row.bid_id AND c.bid_version_id IS NOT DISTINCT FROM p_bid_version_id;
  SELECT NULLIF(string_agg(COALESCE(NULLIF(t.s->>'page', ''), t.s->>'sheet'), ', ' ORDER BY t.ord), '') INTO v_page
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_row.per_sheet) = 'array' THEN v_row.per_sheet ELSE '[]'::jsonb END)
         WITH ORDINALITY AS t(s, ord);
  INSERT INTO public.bids_count_rows (bid_id, bid_version_id, fixture, count, unit, page, group_tag, sequence_order, plan_tag, source_shares)
  VALUES (v_row.bid_id, p_bid_version_id, v_row.name, p_count, v_row.unit, left(v_page, 300), NULL, v_seq, v_row.tag,
          jsonb_build_object(p_source_id::text, p_count))
  RETURNING id INTO v_new;
  IF p_price_version IS NOT NULL THEN
    SELECT e.id INTO v_entry
      FROM public.price_book_entries e
      JOIN public.fixture_types ft ON ft.id = e.fixture_type_id
     WHERE e.version_id = p_price_version AND lower(ft.name) = lower(v_row.name)
     LIMIT 1;
    IF v_entry IS NOT NULL THEN
      v_as := 'her_book';
    ELSIF v_row.robot_unit_price IS NOT NULL THEN
      INSERT INTO public.bid_count_row_custom_prices (bid_id, count_row_id, price_book_version_id, unit_price)
      VALUES (v_row.bid_id, v_new, p_price_version, v_row.robot_unit_price)
      ON CONFLICT (bid_id, count_row_id, price_book_version_id) DO UPDATE SET unit_price = EXCLUDED.unit_price
      RETURNING id INTO v_custom;
      v_as := 'robot';
    END IF;
  END IF;
  UPDATE public.bid_fixture_pull_rows
     SET taken_at = now(), taken_by = p_user, taken_as = 'added', taken_version_id = p_bid_version_id,
         prior_count = NULL, taken_count = NULL, count_row_id = v_new, priced_as = v_as, custom_price_id = v_custom,
         set_aside_at = NULL, set_aside_by = NULL, set_aside_reason = NULL
   WHERE id = p_row_id;
  RETURN v_as;
END;
$$;
REVOKE ALL ON FUNCTION public.robot_fixture_land_row(uuid, uuid, uuid, uuid, numeric, uuid) FROM public, anon, authenticated;

-- The gate every door shares: the caller can price the bid, and the bid is not sent.
CREATE OR REPLACE FUNCTION public.robot_fixture_gate(p_bid_id uuid, p_door text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION '%: sign in first', p_door; END IF;
  IF p_bid_id IS NULL THEN RAISE EXCEPTION '%: no such fixture row', p_door; END IF;
  IF NOT public.can_access_bid_for_pricing(p_bid_id) THEN RAISE EXCEPTION '%: you cannot price this bid', p_door; END IF;
  IF EXISTS (SELECT 1 FROM public.bids b WHERE b.id = p_bid_id AND b.bid_date_sent IS NOT NULL) THEN
    RAISE EXCEPTION 'The bid is sent, the count is the record.';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.robot_fixture_gate(uuid, text) FROM public, anon, authenticated;

-- Add N fixtures: p_row_ids land as rows of their own on the version (a row whose count row is gone, through
-- History's Undo or a delete outside the window, may be taken again); p_updates ([{row_id, count_row_id}]) put
-- the robot's count on a row of hers that the window paired, keeping her parts, prices and prior count. Stamps
-- the run assisted and leaves a ledger line.
CREATE OR REPLACE FUNCTION public.take_robot_fixtures(p_row_ids uuid[], p_bid_version_id uuid DEFAULT NULL, p_updates jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_bid_id uuid;
  v_pull_id uuid;
  v_source_id uuid;
  v_price_version uuid;
  v_all uuid[];
  v_upd jsonb;
  v_row public.bid_fixture_pull_rows;
  v_her uuid;
  v_prior numeric;
  v_her_version uuid;
  v_as text;
  v_added integer := 0;
  v_updated integer := 0;
  v_book integer := 0;
  v_robot integer := 0;
  v_unpriced integer := 0;
  v_found integer;
BEGIN
  v_all := COALESCE(p_row_ids, ARRAY[]::uuid[])
        || COALESCE((SELECT array_agg((u->>'row_id')::uuid) FROM jsonb_array_elements(COALESCE(p_updates, '[]'::jsonb)) u), ARRAY[]::uuid[]);
  IF cardinality(v_all) = 0 THEN RAISE EXCEPTION 'take_robot_fixtures: nothing ticked'; END IF;
  SELECT p.bid_id, p.id INTO v_bid_id, v_pull_id
    FROM public.bid_fixture_pull_rows pr JOIN public.bid_fixture_pulls p ON p.id = pr.pull_id
   WHERE pr.id = v_all[1];
  PERFORM public.robot_fixture_gate(v_bid_id, 'take_robot_fixtures');
  IF EXISTS (SELECT 1 FROM public.bid_fixture_pull_rows pr WHERE pr.id = ANY (v_all) AND pr.pull_id <> v_pull_id) THEN
    RAISE EXCEPTION 'take_robot_fixtures: rows from more than one read';
  END IF;
  IF p_bid_version_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.bid_versions v WHERE v.id = p_bid_version_id AND v.bid_id = v_bid_id) THEN
    RAISE EXCEPTION 'take_robot_fixtures: that version is not this bid''s';
  END IF;
  SELECT b.selected_price_book_version_id INTO v_price_version FROM public.bids b WHERE b.id = v_bid_id;
  v_source_id := public.robot_fixture_source(v_bid_id, v_pull_id, v_user);

  FOR v_row IN
    SELECT pr.* FROM public.bid_fixture_pull_rows pr
     WHERE pr.id = ANY (COALESCE(p_row_ids, ARRAY[]::uuid[])) AND (pr.taken_at IS NULL OR pr.count_row_id IS NULL)
     ORDER BY pr.sequence_order
  LOOP
    v_as := public.robot_fixture_land_row(v_row.id, p_bid_version_id, v_source_id, v_price_version, v_row.count, v_user);
    v_added := v_added + 1;
    IF v_as = 'her_book' THEN v_book := v_book + 1;
    ELSIF v_as = 'robot' THEN v_robot := v_robot + 1;
    ELSE v_unpriced := v_unpriced + 1;
    END IF;
  END LOOP;

  FOR v_upd IN SELECT u FROM jsonb_array_elements(COALESCE(p_updates, '[]'::jsonb)) u LOOP
    SELECT pr.* INTO v_row FROM public.bid_fixture_pull_rows pr WHERE pr.id = (v_upd->>'row_id')::uuid AND (pr.taken_at IS NULL OR pr.count_row_id IS NULL);
    IF v_row.id IS NULL THEN CONTINUE; END IF;
    v_her := (v_upd->>'count_row_id')::uuid;
    SELECT c.count, c.bid_version_id INTO v_prior, v_her_version FROM public.bids_count_rows c WHERE c.id = v_her AND c.bid_id = v_bid_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'take_robot_fixtures: the row to update is not on this bid'; END IF;
    UPDATE public.bids_count_rows c
       SET count = v_row.count,
           plan_tag = COALESCE(c.plan_tag, v_row.tag),
           source_shares = COALESCE(c.source_shares, '{}'::jsonb) || jsonb_build_object(v_source_id::text, v_row.count)
     WHERE c.id = v_her;
    UPDATE public.bid_fixture_pull_rows
       SET taken_at = now(), taken_by = v_user, taken_as = 'updated', taken_version_id = v_her_version,
           prior_count = v_prior, taken_count = NULL, count_row_id = v_her, priced_as = 'her_book', custom_price_id = NULL,
           set_aside_at = NULL, set_aside_by = NULL, set_aside_reason = NULL
     WHERE id = v_row.id;
    v_updated := v_updated + 1;
  END LOOP;

  IF v_added + v_updated > 0 THEN
    UPDATE public.twin_shadow_runs r
       SET assisted_at = COALESCE(r.assisted_at, now()), assist_kind = COALESCE(r.assist_kind, 'fixtures')
     WHERE r.reference_bid_id = v_bid_id AND r.status <> 'void';
    SELECT count(*) INTO v_found FROM public.bid_fixture_pull_rows WHERE pull_id = v_pull_id;
    INSERT INTO public.bids_submission_entries (bid_id, notes, created_by)
    VALUES (v_bid_id,
            '[robot fixtures] took ' || (v_added + v_updated) || ' of ' || v_found || ' (' || v_added || ' added, ' || v_updated
            || ' updated; ' || v_book || ' priced by the book, ' || v_robot || ' at the robot''s price, ' || v_unpriced
            || ' unpriced) via take_robot_fixtures.',
            v_user);
  END IF;
  RETURN jsonb_build_object('added', v_added, 'updated', v_updated, 'priced_by_book', v_book, 'priced_by_robot', v_robot,
                            'unpriced', v_unpriced, 'source_id', v_source_id, 'pull_id', v_pull_id);
END;
$$;
REVOKE ALL ON FUNCTION public.take_robot_fixtures(uuid[], uuid, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.take_robot_fixtures(uuid[], uuid, jsonb) TO authenticated, service_role;

-- The toast's Undo: the rows it added that she has not touched go, an updated row goes back to her number, a row
-- she edited since stays hers, the robot source goes when no row carries it, the assisted stamp stays.
CREATE OR REPLACE FUNCTION public.untake_robot_fixtures(p_pull_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_bid_id uuid;
  v_source_id uuid;
  v_row public.bid_fixture_pull_rows;
  v_cnt numeric;
  v_removed integer := 0;
  v_restored integer := 0;
  v_kept integer := 0;
BEGIN
  SELECT p.bid_id INTO v_bid_id FROM public.bid_fixture_pulls p WHERE p.id = p_pull_id;
  PERFORM public.robot_fixture_gate(v_bid_id, 'untake_robot_fixtures');
  SELECT s.id INTO v_source_id FROM public.bid_count_sources s WHERE s.bid_id = v_bid_id AND s.source_kind = 'robot' LIMIT 1;
  FOR v_row IN
    SELECT pr.* FROM public.bid_fixture_pull_rows pr WHERE pr.pull_id = p_pull_id AND pr.taken_at IS NOT NULL ORDER BY pr.sequence_order
  LOOP
    SELECT c.count INTO v_cnt FROM public.bids_count_rows c WHERE c.id = v_row.count_row_id;
    IF v_row.taken_as = 'added' AND v_cnt IS NOT NULL AND v_cnt <> v_row.count THEN
      v_kept := v_kept + 1;
      CONTINUE; -- she changed it: it is hers now, share and all
    END IF;
    IF v_row.taken_as = 'updated' AND v_cnt IS NOT NULL THEN
      UPDATE public.bids_count_rows c
         SET count = COALESCE(v_row.prior_count, c.count),
             source_shares = CASE WHEN v_source_id IS NULL THEN c.source_shares
                                  ELSE NULLIF(COALESCE(c.source_shares, '{}'::jsonb) - v_source_id::text, '{}'::jsonb) END
       WHERE c.id = v_row.count_row_id;
      v_restored := v_restored + 1;
    END IF;
    UPDATE public.bid_fixture_pull_rows
       SET taken_at = NULL, taken_by = NULL, taken_as = NULL, taken_version_id = NULL, prior_count = NULL, taken_count = NULL,
           count_row_id = NULL, priced_as = NULL, custom_price_id = NULL
     WHERE id = v_row.id;
    -- The pull row let go first (see set_aside_robot_fixtures); the untouched row it added goes now.
    IF v_row.taken_as = 'added' AND v_cnt IS NOT NULL THEN
      DELETE FROM public.bids_count_rows WHERE id = v_row.count_row_id;
      v_removed := v_removed + 1;
    END IF;
  END LOOP;
  IF v_source_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.bids_count_rows c WHERE c.bid_id = v_bid_id AND c.source_shares ? v_source_id::text) THEN
    DELETE FROM public.bid_count_sources WHERE id = v_source_id;
  END IF;
  INSERT INTO public.bids_submission_entries (bid_id, notes, created_by)
  VALUES (v_bid_id, '[robot fixtures] undo: ' || v_removed || ' rows removed, ' || v_restored || ' put back to her number, ' || v_kept
                    || ' kept (edited since) via untake_robot_fixtures. The run stays assisted: she saw them.', v_user);
  RETURN jsonb_build_object('removed', v_removed, 'restored', v_restored, 'kept', v_kept);
END;
$$;
REVOKE ALL ON FUNCTION public.untake_robot_fixtures(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.untake_robot_fixtures(uuid) TO authenticated, service_role;

-- Set aside, never delete: a robot fixture leaves her count with her reason and waits for Put back. A row it
-- added goes (through the ledger, so History holds it too) and her number is kept for Put back; a row of hers
-- it updated goes back to her number and keeps its place.
CREATE OR REPLACE FUNCTION public.set_aside_robot_fixtures(p_row_ids uuid[], p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_bid_id uuid;
  v_source_id uuid;
  v_row public.bid_fixture_pull_rows;
  v_cnt numeric;
  v_reason text := NULLIF(trim(COALESCE(p_reason, '')), '');
  v_n integer := 0;
BEGIN
  IF v_reason IS NOT NULL AND v_reason NOT IN ('by_others', 'existing', 'alternate', 'wrong_count', 'not_sure', 'other') THEN
    RAISE EXCEPTION 'set_aside_robot_fixtures: the reason is not one of the list';
  END IF;
  IF p_row_ids IS NULL OR cardinality(p_row_ids) = 0 THEN RAISE EXCEPTION 'set_aside_robot_fixtures: nothing picked'; END IF;
  SELECT pr.bid_id INTO v_bid_id FROM public.bid_fixture_pull_rows pr WHERE pr.id = p_row_ids[1];
  PERFORM public.robot_fixture_gate(v_bid_id, 'set_aside_robot_fixtures');
  IF EXISTS (SELECT 1 FROM public.bid_fixture_pull_rows pr WHERE pr.id = ANY (p_row_ids) AND pr.bid_id <> v_bid_id) THEN
    RAISE EXCEPTION 'set_aside_robot_fixtures: rows from more than one bid';
  END IF;
  SELECT s.id INTO v_source_id FROM public.bid_count_sources s WHERE s.bid_id = v_bid_id AND s.source_kind = 'robot' LIMIT 1;
  FOR v_row IN
    SELECT pr.* FROM public.bid_fixture_pull_rows pr WHERE pr.id = ANY (p_row_ids) ORDER BY pr.sequence_order
  LOOP
    v_cnt := NULL;
    IF v_row.taken_at IS NOT NULL AND v_row.count_row_id IS NOT NULL THEN
      SELECT c.count INTO v_cnt FROM public.bids_count_rows c WHERE c.id = v_row.count_row_id;
      IF v_row.taken_as = 'updated' AND v_cnt IS NOT NULL THEN
        UPDATE public.bids_count_rows c
           SET count = COALESCE(v_row.prior_count, c.count),
               source_shares = CASE WHEN v_source_id IS NULL THEN c.source_shares
                                    ELSE NULLIF(COALESCE(c.source_shares, '{}'::jsonb) - v_source_id::text, '{}'::jsonb) END
         WHERE c.id = v_row.count_row_id;
        v_cnt := NULL; -- her row stays; nothing of hers to restore on Put back
      END IF;
    END IF;
    UPDATE public.bid_fixture_pull_rows
       SET set_aside_at = now(), set_aside_by = v_user, set_aside_reason = v_reason,
           taken_count = CASE WHEN v_row.taken_as = 'added' THEN v_cnt ELSE NULL END,
           taken_at = NULL, taken_by = NULL, taken_as = NULL, prior_count = NULL, count_row_id = NULL, priced_as = NULL, custom_price_id = NULL
     WHERE id = v_row.id;
    -- The pull row let go of the count row and its custom price above, so the delete's cascades find nothing
    -- of ours to touch (a key re-check on a row written in the same transaction would otherwise refuse).
    IF v_row.taken_as = 'added' AND v_row.count_row_id IS NOT NULL AND v_cnt IS NOT NULL THEN
      DELETE FROM public.bids_count_rows WHERE id = v_row.count_row_id;
    END IF;
    v_n := v_n + 1;
  END LOOP;
  IF v_source_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.bids_count_rows c WHERE c.bid_id = v_bid_id AND c.source_shares ? v_source_id::text) THEN
    DELETE FROM public.bid_count_sources WHERE id = v_source_id;
  END IF;
  INSERT INTO public.bids_submission_entries (bid_id, notes, created_by)
  VALUES (v_bid_id, '[robot fixtures] set aside ' || v_n || CASE WHEN v_reason IS NULL THEN '' ELSE ' (' || replace(v_reason, '_', ' ') || ')' END || ' via set_aside_robot_fixtures.', v_user);
  RETURN jsonb_build_object('set_aside', v_n);
END;
$$;
REVOKE ALL ON FUNCTION public.set_aside_robot_fixtures(uuid[], text) FROM public;
GRANT EXECUTE ON FUNCTION public.set_aside_robot_fixtures(uuid[], text) TO authenticated, service_role;

-- Put back: the set-aside is cleared; a fixture she had taken before lands again, at her number, on the version
-- it was on.
CREATE OR REPLACE FUNCTION public.put_back_robot_fixtures(p_row_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_bid_id uuid;
  v_price_version uuid;
  v_source_id uuid;
  v_row public.bid_fixture_pull_rows;
  v_n integer := 0;
  v_landed integer := 0;
BEGIN
  IF p_row_ids IS NULL OR cardinality(p_row_ids) = 0 THEN RAISE EXCEPTION 'put_back_robot_fixtures: nothing picked'; END IF;
  SELECT pr.bid_id INTO v_bid_id FROM public.bid_fixture_pull_rows pr WHERE pr.id = p_row_ids[1];
  PERFORM public.robot_fixture_gate(v_bid_id, 'put_back_robot_fixtures');
  IF EXISTS (SELECT 1 FROM public.bid_fixture_pull_rows pr WHERE pr.id = ANY (p_row_ids) AND pr.bid_id <> v_bid_id) THEN
    RAISE EXCEPTION 'put_back_robot_fixtures: rows from more than one bid';
  END IF;
  SELECT b.selected_price_book_version_id INTO v_price_version FROM public.bids b WHERE b.id = v_bid_id;
  FOR v_row IN
    SELECT pr.* FROM public.bid_fixture_pull_rows pr WHERE pr.id = ANY (p_row_ids) AND pr.set_aside_at IS NOT NULL ORDER BY pr.sequence_order
  LOOP
    IF v_row.taken_count IS NOT NULL THEN
      v_source_id := public.robot_fixture_source(v_bid_id, v_row.pull_id, v_user);
      PERFORM public.robot_fixture_land_row(v_row.id, v_row.taken_version_id, v_source_id, v_price_version, v_row.taken_count, v_user);
      v_landed := v_landed + 1;
    ELSE
      UPDATE public.bid_fixture_pull_rows SET set_aside_at = NULL, set_aside_by = NULL, set_aside_reason = NULL WHERE id = v_row.id;
    END IF;
    v_n := v_n + 1;
  END LOOP;
  IF v_n > 0 THEN
    INSERT INTO public.bids_submission_entries (bid_id, notes, created_by)
    VALUES (v_bid_id, '[robot fixtures] put back ' || v_n || ' (' || v_landed || ' landed again at her number) via put_back_robot_fixtures.', v_user);
  END IF;
  RETURN jsonb_build_object('put_back', v_n, 'landed', v_landed);
END;
$$;
REVOKE ALL ON FUNCTION public.put_back_robot_fixtures(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.put_back_robot_fixtures(uuid[]) TO authenticated, service_role;

-- Price N robot rows at the robot's prices: the taken rows that landed before a price book was picked. Her book
-- by name first; the robot's unit price as a custom price where her book has none; never over a custom price
-- she typed herself.
CREATE OR REPLACE FUNCTION public.price_robot_fixtures(p_bid_id uuid, p_price_book_version_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_row public.bid_fixture_pull_rows;
  v_entry uuid;
  v_custom uuid;
  v_book integer := 0;
  v_robot integer := 0;
BEGIN
  PERFORM public.robot_fixture_gate(p_bid_id, 'price_robot_fixtures');
  IF p_price_book_version_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.price_book_versions v WHERE v.id = p_price_book_version_id) THEN
    RAISE EXCEPTION 'price_robot_fixtures: pick a price book first';
  END IF;
  FOR v_row IN
    SELECT pr.* FROM public.bid_fixture_pull_rows pr
     WHERE pr.bid_id = p_bid_id AND pr.taken_at IS NOT NULL AND pr.taken_as = 'added' AND pr.count_row_id IS NOT NULL
       AND COALESCE(pr.priced_as, 'unpriced') = 'unpriced'
     ORDER BY pr.sequence_order
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.bids_count_rows c WHERE c.id = v_row.count_row_id) THEN CONTINUE; END IF;
    SELECT e.id INTO v_entry
      FROM public.price_book_entries e
      JOIN public.fixture_types ft ON ft.id = e.fixture_type_id
     WHERE e.version_id = p_price_book_version_id AND lower(ft.name) = lower(v_row.name)
     LIMIT 1;
    IF v_entry IS NOT NULL
       OR EXISTS (SELECT 1 FROM public.bid_count_row_custom_prices cp WHERE cp.count_row_id = v_row.count_row_id AND cp.price_book_version_id = p_price_book_version_id) THEN
      UPDATE public.bid_fixture_pull_rows SET priced_as = 'her_book' WHERE id = v_row.id;
      v_book := v_book + 1;
    ELSIF v_row.robot_unit_price IS NOT NULL THEN
      INSERT INTO public.bid_count_row_custom_prices (bid_id, count_row_id, price_book_version_id, unit_price)
      VALUES (p_bid_id, v_row.count_row_id, p_price_book_version_id, v_row.robot_unit_price)
      RETURNING id INTO v_custom;
      UPDATE public.bid_fixture_pull_rows SET priced_as = 'robot', custom_price_id = v_custom WHERE id = v_row.id;
      v_robot := v_robot + 1;
    END IF;
  END LOOP;
  IF v_book + v_robot > 0 THEN
    INSERT INTO public.bids_submission_entries (bid_id, notes, created_by)
    VALUES (p_bid_id, '[robot fixtures] priced ' || (v_book + v_robot) || ' (' || v_book || ' by the book, ' || v_robot || ' at the robot''s price) via price_robot_fixtures.', v_user);
  END IF;
  RETURN jsonb_build_object('priced_by_book', v_book, 'priced_by_robot', v_robot);
END;
$$;
REVOKE ALL ON FUNCTION public.price_robot_fixtures(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.price_robot_fixtures(uuid, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------- the fixtures score at send

CREATE OR REPLACE FUNCTION public.score_locked_shadows(p_reference_bid_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_ref_value numeric;
  v_kind text;
  v_delta numeric;
  v_teacher_id uuid;
  v_teacher_name text;
  v_teacher_standard boolean;
  v_teacher_label text;
  v_line text;
  v_scored integer := 0;
  v_pull_id uuid;
  v_fx jsonb;
  v_fx_line text;
  v_fx_version uuid;
BEGIN
  FOR r IN
    SELECT s.id, s.shadow_bid_id, s.reference_bid_id, s.axis, s.locked_total, s.twin_user_id,
           b.bid_number, b.project_name, b.bid_value, b.bid_date_sent,
           b.estimator_id, b.bid_date_sent_attested_by, b.created_by,
           be.value AS best_effort_value, be.recorded_by AS best_effort_by,
           COALESCE((
             SELECT sum((g.value->>'amount')::numeric)
               FROM jsonb_each(COALESCE(b.cover_letter_alt_texts->'groups', '{}'::jsonb)) AS g
              WHERE jsonb_typeof(b.cover_letter_alt_texts->'groups') = 'object'
                AND COALESCE(g.value->>'offered', 'true') <> 'false'
                AND (g.value->>'amount') ~ '^[0-9]+(\.[0-9]+)?$'
                AND (g.value->>'amount')::numeric > 0
           ), 0) AS alt_add_ons
      FROM public.twin_shadow_runs s
      JOIN public.bids b ON b.id = s.reference_bid_id
      LEFT JOIN public.bid_best_efforts be ON be.bid_id = b.id
     WHERE s.status = 'locked'
       AND (p_reference_bid_id IS NULL OR s.reference_bid_id = p_reference_bid_id)
       AND (
         be.value IS NOT NULL
         OR (b.bid_date_sent IS NOT NULL AND b.bid_value IS NOT NULL AND b.bid_value > 0)
       )
     ORDER BY s.locked_at NULLS LAST, s.created_at
  LOOP
    -- The blind human number when one was recorded; the sent value otherwise —
    -- the WHOLE bid (v2.4199): the base plus every offered alternate's stamped add-on
    -- (cover_letter_alt_texts.groups[*].amount where offered is not false). Mirrors
    -- supabase/functions/_shared/referenceWhole.ts.
    v_kind := CASE WHEN r.best_effort_value IS NOT NULL THEN 'best_effort' ELSE 'sent' END;
    v_ref_value := COALESCE(r.best_effort_value, r.bid_value + r.alt_add_ons);
    -- Mirrors twin-mcp score_shadows: round((locked - human) / human * 100, 1).
    v_delta := round(((r.locked_total - v_ref_value) / v_ref_value) * 100, 1);

    -- WHOSE number was this? Assigned estimator, else whoever recorded the best
    -- effort, else the sender who attested the send, else the creator.
    v_teacher_id := COALESCE(
      r.estimator_id,
      CASE WHEN v_kind = 'best_effort' THEN r.best_effort_by END,
      r.bid_date_sent_attested_by,
      r.created_by
    );
    v_teacher_name := NULL;
    v_teacher_standard := false;
    IF v_teacher_id IS NOT NULL THEN
      SELECT u.name, COALESCE(u.calibration_standard, false)
        INTO v_teacher_name, v_teacher_standard
        FROM public.users u
       WHERE u.id = v_teacher_id;
    END IF;

    UPDATE public.twin_shadow_runs
       SET status = 'scored',
           reference_value = v_ref_value,
           reference_kind = v_kind,
           delta_pct = v_delta,
           scored_at = now(),
           teacher_user_id = v_teacher_id,
           teacher_name = v_teacher_name
     WHERE id = r.id
       AND status = 'locked';
    IF NOT FOUND THEN
      CONTINUE; -- raced with score_shadows; that path stamped the ledger.
    END IF;

    v_teacher_label := CASE
      WHEN v_teacher_name IS NOT NULL THEN
        ' by ' || v_teacher_name || ' (' ||
        CASE WHEN v_teacher_standard THEN 'calibration standard' ELSE 'practice teacher — not a gate run' END || ')'
      ELSE ''
    END;

    v_line := '[shadow SCORECARD] Twin locked $' || public.shadow_fmt_money(r.locked_total)
      || ' (blind, pre-send) vs human '
      || CASE WHEN v_kind = 'best_effort' THEN 'best effort $' ELSE '$' END
      || public.shadow_fmt_money(v_ref_value)
      || CASE WHEN v_kind = 'best_effort' THEN ' (recorded before the reveal, unsent)' ELSE ' (sent)' END
      || v_teacher_label
      || ' = ' || CASE WHEN v_delta > 0 THEN '+' ELSE '' END || public.shadow_fmt_pct(v_delta) || '%'
      || ' — axis ' || COALESCE(r.axis, 'unclassified')
      || ', reference b' || COALESCE(r.bid_number, '?') || ' (' || COALESCE(r.project_name, '') || ').';

    INSERT INTO public.bids_submission_entries (bid_id, notes, created_by)
    VALUES (r.shadow_bid_id, v_line, r.twin_user_id);
    INSERT INTO public.bids_submission_entries (bid_id, notes, created_by)
    VALUES (r.reference_bid_id, v_line, r.twin_user_id);

    -- v2.6180 (punch list #221): the fixtures score, when the reference bid holds a robot pull.
    -- Her rows are read on the version she took the robot's rows on; with none taken, the newest version.
    SELECT p.id INTO v_pull_id FROM public.bid_fixture_pulls p WHERE p.bid_id = r.reference_bid_id ORDER BY p.read_at DESC LIMIT 1;
    IF v_pull_id IS NOT NULL THEN
      SELECT c.bid_version_id INTO v_fx_version
        FROM public.bid_fixture_pull_rows x
        JOIN public.bids_count_rows c ON c.id = x.count_row_id
       WHERE x.pull_id = v_pull_id
       LIMIT 1;
      IF NOT FOUND THEN
        SELECT v.id INTO v_fx_version FROM public.bid_versions v WHERE v.bid_id = r.reference_bid_id ORDER BY v.created_at DESC LIMIT 1;
      END IF;
      SELECT jsonb_build_object(
        'found', count(*),
        'taken', count(*) FILTER (WHERE x.taken_at IS NOT NULL AND c.id IS NOT NULL AND c.count = x.count),
        'changed', count(*) FILTER (WHERE x.taken_at IS NOT NULL AND c.id IS NOT NULL AND c.count <> x.count),
        'set_aside', count(*) FILTER (WHERE x.set_aside_at IS NOT NULL),
        'left', count(*) FILTER (WHERE x.taken_at IS NULL AND x.set_aside_at IS NULL),
        'reasons', COALESCE((
          SELECT jsonb_object_agg(t.reason, t.n)
            FROM (SELECT y.set_aside_reason AS reason, count(*) AS n
                    FROM public.bid_fixture_pull_rows y
                   WHERE y.pull_id = v_pull_id AND y.set_aside_reason IS NOT NULL
                   GROUP BY y.set_aside_reason) t), '{}'::jsonb),
        'missed', (
          SELECT count(*) FROM public.bids_count_rows m
           WHERE m.bid_id = r.reference_bid_id
             AND m.bid_version_id IS NOT DISTINCT FROM v_fx_version
             AND m.fixture !~* '^ft of'
             AND m.fixture !~* '(^|[\s·])(90|45|tee|ell|wye|coupling)($|[\s·/])'
             AND NOT EXISTS (
               SELECT 1 FROM public.bid_fixture_pull_rows z
                WHERE z.pull_id = v_pull_id
                  AND (z.count_row_id = m.id
                       OR (m.plan_tag IS NOT NULL AND lower(m.plan_tag) = lower(z.tag))
                       OR lower(m.fixture) = lower(z.name))))
      ) INTO v_fx
      FROM public.bid_fixture_pull_rows x
      LEFT JOIN public.bids_count_rows c ON c.id = x.count_row_id
      WHERE x.pull_id = v_pull_id;
      UPDATE public.twin_shadow_runs SET fixtures_score = v_fx WHERE id = r.id;
      v_fx_line := '[robot fixtures SCORE] ' || COALESCE(v_fx->>'taken', '0') || ' of ' || COALESCE(v_fx->>'found', '0')
        || ' taken as found, ' || COALESCE(v_fx->>'changed', '0') || ' changed, ' || COALESCE(v_fx->>'set_aside', '0')
        || ' set aside, ' || COALESCE(v_fx->>'left', '0') || ' left, ' || COALESCE(v_fx->>'missed', '0') || ' the robot missed.';
      INSERT INTO public.bids_submission_entries (bid_id, notes, created_by)
      VALUES (r.shadow_bid_id, v_fx_line, r.twin_user_id);
      INSERT INTO public.bids_submission_entries (bid_id, notes, created_by)
      VALUES (r.reference_bid_id, v_fx_line, r.twin_user_id);
    END IF;

    v_scored := v_scored + 1;
  END LOOP;

  RETURN v_scored;
END;
$$;

COMMENT ON FUNCTION public.score_locked_shadows(uuid) IS
  'v2.4199 — scores every LOCKED twin_shadow_runs row whose reference has a recorded best effort (bid_best_efforts — the blind human number, preferred) or, failing that, bid_date_sent + bid_value (the v2.3126 rule) — the sent reference being the WHOLE: bid_value plus every offered alternate''s stamped add-on in cover_letter_alt_texts.groups (v2.4199). Stamps reference_kind, delta_pct, teacher (estimator → best-effort recorder → attested sender → creator) and the [shadow SCORECARD] note on both ledgers. v2.6180: when the reference bid holds a robot fixtures pull, also writes twin_shadow_runs.fixtures_score ({found, taken, changed, set_aside, left, reasons, missed}) and a [robot fixtures SCORE] line on both ledgers. Fired by the best-effort insert, the run lock, and the send.';

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
