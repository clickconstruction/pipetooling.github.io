SET lock_timeout = '3s';

-- The bids of the day (punch list #445, to-dos/clock-out-bids-of-the-day), the ground. An estimator's clock out
-- asks "What did you work on?" and the person types it. The app already knows most of the answer: the bid history
-- ledger (bid_changes, #73) holds every change with its person and its time. What it does not hold is a bid that
-- was open and read with nothing changed. This file makes the places the rest goes and the one read the Clock out
-- sheet makes. Nothing on screen changes with it: no client calls these until the next PRs.
--
--   user_bid_activity          one row a person, a bid, a tab and a five-minute bucket: the seconds that bid was in
--                              front while the person was at work on it. Written by bump_user_bid_activity().
--   bid_day_entries            the list the person left at clock out: one row a person, a day and a bid, kept or
--                              taken off, read by the app or added by the person. Written by save_my_bid_day().
--   bump_user_bid_activity()   the beat. At most 60 seconds a call, 300 a bucket.
--   get_my_bid_day()           the caller's own day: their changes from the ledger in five-minute buckets, their
--                              beats, the list they kept, the bids' names and the day's clock sessions.
--   save_my_bid_day()          keeps the list, under the caller's own row policies.
--
-- Who reads what (docs/ACCESS_CONTROL.md):
--   user_bid_activity   the Activity tab's rule and no wider: the person, the owner, a dev, and anyone the owner or a
--                       dev put on user_app_activity_viewers.
--   bid_day_entries     whoever may read the person's clock sessions (the person, a dev, payroll access, the office),
--                       since the kept list is what the person hands in with the session.
-- The beat's table takes no client write: its function writes it. The kept list is written under the person's own
-- row policies (their own rows, today or yesterday, a bid they can read), so save_my_bid_day() needs no definer.

-- ---------------------------------------------------------------------------
-- 1) The beat, by bid
-- ---------------------------------------------------------------------------

-- A new table: nothing reads or writes it until this file commits, so its setup locks nothing in use. The bid's
-- foreign key takes a brief lock on bids, bounded by the lock timeout above.
CREATE TABLE IF NOT EXISTS public.user_bid_activity (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  -- The Bids tab the bid was open on ('pricing', 'takeoffs', ...), '' when the page named none.
  tab text NOT NULL DEFAULT '',
  -- The start of the five-minute bucket. The day a bucket belongs to is worked out at read time in the company's
  -- zone, so evening work never lands on the next day the way the UTC-day app activity tables put it.
  bucket_at timestamptz NOT NULL,
  active_seconds integer NOT NULL DEFAULT 0,
  CONSTRAINT user_bid_activity_seconds_in_bucket CHECK (active_seconds BETWEEN 0 AND 300),
  CONSTRAINT user_bid_activity_tab_short CHECK (char_length(tab) <= 40),
  PRIMARY KEY (user_id, bucket_at, bid_id, tab)
);

COMMENT ON TABLE public.user_bid_activity IS
  'The bids of the day (punch list #445): seconds a bid was in front while the person was at work on it, one row a person, a bid, a Bids tab and a five-minute bucket. Written only by bump_user_bid_activity(), as the caller. Read by the person, the owner, a dev and the app activity viewers.';

ALTER TABLE public.user_bid_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_bid_activity_select ON public.user_bid_activity;
CREATE POLICY user_bid_activity_select ON public.user_bid_activity
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT public.is_master_or_dev())
    OR EXISTS (SELECT 1 FROM public.user_app_activity_viewers v WHERE v.viewer_user_id = (SELECT auth.uid()))
  );
-- No INSERT / UPDATE / DELETE policy on purpose: the beat function writes it.

REVOKE ALL ON TABLE public.user_bid_activity FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.user_bid_activity FROM authenticated;
GRANT SELECT ON TABLE public.user_bid_activity TO authenticated;

-- The beat. Best effort, like bump_user_app_activity(): it never raises, so a lost beat costs a few seconds of
-- a rough size and nothing else. It writes nothing for a session someone else opened as the person, for a person
-- in training mode and for a digital twin (a twin's work on a bid is in twin_runs).
CREATE OR REPLACE FUNCTION public.bump_user_bid_activity(p_bid uuid, p_tab text DEFAULT NULL, p_seconds integer DEFAULT 60)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sec integer;
  v_tab text;
BEGIN
  IF v_uid IS NULL OR p_bid IS NULL THEN
    RETURN;
  END IF;
  IF public.session_opened_by_imitation() OR public.is_read_only() OR public.is_digital_twin() THEN
    RETURN;
  END IF;
  v_sec := LEAST(GREATEST(COALESCE(p_seconds, 0), 0), 60);
  IF v_sec = 0 THEN
    RETURN;
  END IF;
  v_tab := LEFT(regexp_replace(lower(COALESCE(p_tab, '')), '[^a-z0-9_-]', '', 'g'), 40);

  BEGIN
    INSERT INTO public.user_bid_activity (user_id, bid_id, tab, bucket_at, active_seconds)
    VALUES (v_uid, p_bid, v_tab, date_bin('5 minutes', now(), TIMESTAMPTZ '2000-01-01 00:00:00+00'), v_sec)
    ON CONFLICT (user_id, bucket_at, bid_id, tab) DO UPDATE
      SET active_seconds = LEAST(public.user_bid_activity.active_seconds + EXCLUDED.active_seconds, 300);
  EXCEPTION WHEN OTHERS THEN
    -- A bid that is gone, a person who is gone: the beat is dropped.
    NULL;
  END;
END;
$$;

COMMENT ON FUNCTION public.bump_user_bid_activity(uuid, text, integer) IS
  'The bids of the day (punch list #445): adds up to 60 seconds to the caller''s five-minute bucket for one bid and one Bids tab. Never raises. Writes nothing under View as, in training mode or for a digital twin.';

REVOKE ALL ON FUNCTION public.bump_user_bid_activity(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bump_user_bid_activity(uuid, text, integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2) The list the person left
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.bid_day_entries (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- The company's day (public.app_today()), never the UTC day.
  work_date date NOT NULL,
  bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  -- kept: the bid counts for the day. off: the person took it off the list.
  state text NOT NULL,
  -- app: the app read it from the day. person: the person added a bid the app did not see.
  source text NOT NULL,
  -- What the sheet showed when the list was kept. A rough size, never a figure to bill by.
  seen_seconds integer,
  tabs text[] NOT NULL DEFAULT '{}',
  changes integer NOT NULL DEFAULT 0,
  saved_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bid_day_entries_state_known CHECK (state IN ('kept', 'off')),
  CONSTRAINT bid_day_entries_source_known CHECK (source IN ('app', 'person')),
  CONSTRAINT bid_day_entries_seen_in_a_day CHECK (seen_seconds IS NULL OR seen_seconds BETWEEN 0 AND 86400),
  CONSTRAINT bid_day_entries_changes_not_negative CHECK (changes >= 0),
  PRIMARY KEY (user_id, work_date, bid_id)
);

COMMENT ON TABLE public.bid_day_entries IS
  'The bids of the day (punch list #445): the list a person left at clock out, one row a person, a company day and a bid, kept or taken off, read by the app or added by the person. A person writes their own rows for today or yesterday, through save_my_bid_day(). Read by whoever may read the person''s clock sessions.';

ALTER TABLE public.bid_day_entries ENABLE ROW LEVEL SECURITY;

-- The clock sessions' own read rule (clock_sessions select access): the kept list rides with the session.
DROP POLICY IF EXISTS bid_day_entries_select ON public.bid_day_entries;
CREATE POLICY bid_day_entries_select ON public.bid_day_entries
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT public.is_dev())
    OR (SELECT public.has_payroll_access())
    OR (SELECT public.is_assistant())
  );

-- A person writes their own rows, for today or yesterday by the company's day, on a bid they can read: the bids
-- subquery runs under the caller's own policies on bids. No DELETE: a bid taken off stays as an 'off' row.
DROP POLICY IF EXISTS bid_day_entries_insert_own ON public.bid_day_entries;
CREATE POLICY bid_day_entries_insert_own ON public.bid_day_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND work_date BETWEEN (SELECT public.app_today()) - 1 AND (SELECT public.app_today())
    AND EXISTS (SELECT 1 FROM public.bids b WHERE b.id = bid_day_entries.bid_id)
  );
DROP POLICY IF EXISTS bid_day_entries_update_own ON public.bid_day_entries;
CREATE POLICY bid_day_entries_update_own ON public.bid_day_entries
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND work_date BETWEEN (SELECT public.app_today()) - 1 AND (SELECT public.app_today())
    AND EXISTS (SELECT 1 FROM public.bids b WHERE b.id = bid_day_entries.bid_id)
  );

REVOKE ALL ON TABLE public.bid_day_entries FROM anon;
REVOKE DELETE, TRUNCATE ON TABLE public.bid_day_entries FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.bid_day_entries TO authenticated;

-- Keeps the caller's list for one day. p_entries is a JSON array of
--   { "bid_id": uuid, "state": "kept" | "off", "source": "app" | "person",
--     "seen_seconds": int | null, "tabs": [text], "changes": int }
-- A bid named twice keeps its last entry. Only today and yesterday can be kept, by the company's day: the sheet
-- keeps today, and the My Time card keeps a day the sheet was never opened on. A bid the caller cannot read is
-- left out, since the list is of the caller's own work. Returns how many rows it kept.
-- SECURITY INVOKER: the rows are written under bid_day_entries' own policies, and the bids subquery below reads
-- bids as the caller, so the function can do nothing the caller's own rows could not.
CREATE OR REPLACE FUNCTION public.save_my_bid_day(p_work_date date, p_entries jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_today date := public.app_today();
  v_count integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to keep your list.' USING ERRCODE = '42501';
  END IF;
  IF public.session_opened_by_imitation() THEN
    RAISE EXCEPTION 'The list is the person''s own. It is not kept while you look as them.' USING ERRCODE = '42501';
  END IF;
  IF public.is_read_only() OR public.is_digital_twin() THEN
    RAISE EXCEPTION 'This account cannot keep a list of bids.' USING ERRCODE = '42501';
  END IF;
  IF p_work_date IS NULL OR p_work_date > v_today OR p_work_date < v_today - 1 THEN
    RAISE EXCEPTION 'Only today''s list and yesterday''s can be kept.' USING ERRCODE = '22023';
  END IF;
  IF p_entries IS NULL OR jsonb_typeof(p_entries) <> 'array' THEN
    RAISE EXCEPTION 'The list did not arrive as a list.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_entries) > 200 THEN
    RAISE EXCEPTION 'A day holds at most 200 bids.' USING ERRCODE = '22023';
  END IF;

  WITH given AS (
    SELECT DISTINCT ON ((e.value ->> 'bid_id')::uuid)
      (e.value ->> 'bid_id')::uuid AS bid_id,
      CASE WHEN e.value ->> 'state' = 'off' THEN 'off' ELSE 'kept' END AS state,
      CASE WHEN e.value ->> 'source' = 'person' THEN 'person' ELSE 'app' END AS source,
      CASE WHEN jsonb_typeof(e.value -> 'seen_seconds') = 'number'
           THEN LEAST(GREATEST((e.value ->> 'seen_seconds')::numeric, 0), 86400)::integer END AS seen_seconds,
      CASE WHEN jsonb_typeof(e.value -> 'tabs') = 'array'
           THEN ARRAY(SELECT LEFT(t, 40) FROM jsonb_array_elements_text(e.value -> 'tabs') AS t LIMIT 12)
           ELSE '{}'::text[] END AS tabs,
      CASE WHEN jsonb_typeof(e.value -> 'changes') = 'number'
           THEN LEAST(GREATEST((e.value ->> 'changes')::numeric, 0), 100000)::integer ELSE 0 END AS changes
    FROM jsonb_array_elements(p_entries) WITH ORDINALITY AS e(value, ord)
    WHERE jsonb_typeof(e.value) = 'object'
      AND (e.value ->> 'bid_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ORDER BY (e.value ->> 'bid_id')::uuid, e.ord DESC
  ),
  kept AS (
    INSERT INTO public.bid_day_entries (user_id, work_date, bid_id, state, source, seen_seconds, tabs, changes, saved_at)
    SELECT v_uid, p_work_date, g.bid_id, g.state, g.source, g.seen_seconds, g.tabs, g.changes, now()
    FROM given g
    WHERE EXISTS (SELECT 1 FROM public.bids b WHERE b.id = g.bid_id)
    ON CONFLICT (user_id, work_date, bid_id) DO UPDATE
      SET state = EXCLUDED.state,
          source = EXCLUDED.source,
          seen_seconds = EXCLUDED.seen_seconds,
          tabs = EXCLUDED.tabs,
          changes = EXCLUDED.changes,
          saved_at = EXCLUDED.saved_at
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM kept;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.save_my_bid_day(date, jsonb) IS
  'The bids of the day (punch list #445): keeps the caller''s list of bids for today or yesterday (the company''s day), one row a bid, kept or taken off. Returns the rows kept. Refuses under View as, in training mode and for a digital twin.';

REVOKE ALL ON FUNCTION public.save_my_bid_day(date, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_my_bid_day(date, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) The read
-- ---------------------------------------------------------------------------

-- The caller's own day, for the Clock out sheet and the My Time card. SECURITY INVOKER: every table is read under
-- the caller's own policies, so the answer is never wider than what the caller can open (a bid they can no longer
-- read drops out, an archived caller reads nothing).
--
-- The ledger has one index, by bid, and none on changed_at on purpose (its write path stays light). So the day's
-- rows are found by walking the primary key backwards to the last row before the day: id grows with time, and the
-- walk stops at the first row it meets from before the day began. For today that is a walk over today's rows.
--
-- The app's own writes (by_app, such as the Labor tab's sync on open) are counted apart from the person's, so a bid
-- that only the app wrote reads as opened, not as changed.
CREATE OR REPLACE FUNCTION public.get_my_bid_day(p_work_date date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_day date := COALESCE(p_work_date, public.app_today());
  v_from timestamptz;
  v_to timestamptz;
  v_floor bigint;
  v_changes jsonb;
  v_beats jsonb;
  v_kept jsonb;
  v_sessions jsonb;
  v_bids jsonb;
  v_ids uuid[];
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;
  v_from := v_day::timestamp AT TIME ZONE 'America/Chicago';
  v_to := (v_day + 1)::timestamp AT TIME ZONE 'America/Chicago';

  SELECT c.id INTO v_floor FROM public.bid_changes c WHERE c.changed_at < v_from ORDER BY c.id DESC LIMIT 1;
  v_floor := COALESCE(v_floor, 0);

  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.at, x.bid_id), '[]'::jsonb) INTO v_changes
  FROM (
    SELECT t.bid_id,
           date_bin('5 minutes', t.at, TIMESTAMPTZ '2000-01-01 00:00:00+00') AS at,
           (count(*) FILTER (WHERE NOT t.by_app))::integer AS own,
           (count(*) FILTER (WHERE t.by_app))::integer AS app,
           array_agg(DISTINCT t.table_name ORDER BY t.table_name) AS tables
    FROM (
      SELECT c.bid_id, c.changed_at AS at, COALESCE(c.by_app, false) AS by_app, c.table_name
      FROM public.bid_changes c
      WHERE c.id > v_floor AND c.changed_by = v_uid AND c.changed_at >= v_from AND c.changed_at < v_to
      UNION ALL
      SELECT e.bid_id, e.created_at, false, 'bids_submission_entries'
      FROM public.bids_submission_entries e
      WHERE e.created_by = v_uid AND e.created_at >= v_from AND e.created_at < v_to
      UNION ALL
      SELECT r.bid_id, r.created_at, false, 'bid_rfqs'
      FROM public.bid_rfqs r
      WHERE r.created_by = v_uid AND r.created_at >= v_from AND r.created_at < v_to
    ) t
    WHERE t.bid_id IS NOT NULL
    GROUP BY 1, 2
  ) x;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('bid_id', a.bid_id, 'tab', a.tab, 'at', a.bucket_at, 'seconds', a.active_seconds)
                            ORDER BY a.bucket_at, a.bid_id, a.tab), '[]'::jsonb) INTO v_beats
  FROM public.user_bid_activity a
  WHERE a.user_id = v_uid AND a.bucket_at >= v_from AND a.bucket_at < v_to;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('bid_id', k.bid_id, 'state', k.state, 'source', k.source, 'saved_at', k.saved_at)
                            ORDER BY k.saved_at, k.bid_id), '[]'::jsonb) INTO v_kept
  FROM public.bid_day_entries k
  WHERE k.user_id = v_uid AND k.work_date = v_day;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('in', s.clocked_in_at, 'out', s.clocked_out_at) ORDER BY s.clocked_in_at), '[]'::jsonb)
    INTO v_sessions
  FROM public.clock_sessions s
  WHERE s.user_id = v_uid AND s.work_date = v_day AND s.revoked_at IS NULL AND s.rejected_at IS NULL;

  SELECT array_agg(DISTINCT i.bid_id) INTO v_ids
  FROM (
    SELECT (j ->> 'bid_id')::uuid AS bid_id FROM jsonb_array_elements(v_changes) AS j
    UNION ALL SELECT (j ->> 'bid_id')::uuid FROM jsonb_array_elements(v_beats) AS j
    UNION ALL SELECT (j ->> 'bid_id')::uuid FROM jsonb_array_elements(v_kept) AS j
  ) i;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', b.id, 'bid_number', b.bid_number, 'project_name', b.project_name,
                                               'service_type_id', b.service_type_id) ORDER BY b.id), '[]'::jsonb) INTO v_bids
  FROM public.bids b
  WHERE b.id = ANY (COALESCE(v_ids, '{}'::uuid[]));

  RETURN jsonb_build_object(
    'day', v_day, 'from', v_from, 'to', v_to, 'now', now(),
    'changes', v_changes, 'beats', v_beats, 'kept', v_kept, 'sessions', v_sessions, 'bids', v_bids
  );
END;
$$;

COMMENT ON FUNCTION public.get_my_bid_day(date) IS
  'The bids of the day (punch list #445): the caller''s own day on bids, read under the caller''s own row policies. Their changes from bid_changes, notes and price requests in five-minute buckets (the person''s own and the app''s counted apart), their beats from user_bid_activity, the list they kept, the bids'' names and the day''s clock sessions. The day is the company''s day, today when none is given.';

REVOKE ALL ON FUNCTION public.get_my_bid_day(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_bid_day(date) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4) House rules for a new table
-- ---------------------------------------------------------------------------

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
