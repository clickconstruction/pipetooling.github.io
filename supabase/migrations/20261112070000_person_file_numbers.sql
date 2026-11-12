SET lock_timeout = '3s';

-- Rows the system numbers (punch list #315, upgrade 2): exhibit numbers, a case's open items and its log.
--
-- On a large HR file the numbers lived in prose. An evidence record's number was typed into its title by hand
-- ("Ev #41 ..."), the "next free number" was a line in the Agent notes document, and so were the case's open items
-- and its log. Two sessions working one file on one day took the same exhibit number and the same item number.
--
--   * person_file_counters: one row a person, the next exhibit number and the next item number. Only the functions
--     here move it, under a row lock, so two writers at once get two numbers.
--   * person_file_evidence.exhibit_no: set by the database on every insert. A record made before this migration
--     keeps exhibit_no null and its title as it is; the first number handed out on a file is one past the highest
--     number any of its titles already opens with, so a new record never takes a number an old title wears.
--   * dev_evidence_number_backfill(person, dry_run, number_rest): reads the number each unnumbered record's title
--     already opens with ("Ev #41", "Ev 41", "Ev. #41") and gives the record that number when exactly one record
--     wears it. It never guesses: a number two records wear is reported as a clash and left alone, a number with a
--     letter ("Ev #41a") is reported, a title with no number is reported and numbered after the highest only when
--     asked. A dry run by default. It is a dev's press per person, never run by a migration.
--   * person_case_items: an open item of a case, numbered by the database (or carried over with the number it
--     already has in prose, refused when that number is taken): what, who has it, open · done · dropped, why it closed.
--   * person_case_log: the case's log, append-only: when, who, from which session, one line, the item it is about.
--   * dev_case_write(p, dry_run): the one door for both, a dry run by default, for the dev seat's plan → apply.
--     Every change to an item also writes its own log line, so the log is the history. A plan names the number a new
--     item would take; another session adding one first changes the dry run, and the stale plan is refused.
--
-- The Agent notes document stays as prose for the standing rules and the map of a case. All three tables are a dev's
-- alone, as the HR file is, and end with the four fence calls.

-- ── the counter ──────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.person_file_counters (
  person_id uuid PRIMARY KEY REFERENCES public.people(id) ON DELETE CASCADE,
  next_exhibit_no integer NOT NULL DEFAULT 1 CHECK (next_exhibit_no >= 1),
  next_item_no integer NOT NULL DEFAULT 1 CHECK (next_item_no >= 1),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.person_file_counters IS
  'HR files (punch list #315): the next exhibit number and the next case item number a person''s file hands out. Moved only by person_file_take_number under a row lock; a dev reads it, nobody writes it directly.';

ALTER TABLE public.person_file_counters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS person_file_counters_dev_select ON public.person_file_counters;
CREATE POLICY person_file_counters_dev_select ON public.person_file_counters FOR SELECT TO authenticated USING (public.is_dev());
REVOKE ALL ON public.person_file_counters FROM anon, authenticated;
GRANT SELECT ON public.person_file_counters TO authenticated;

-- ── exhibit numbers ──────────────────────────────────────────────────────────────────────────────
-- The number a title opens with, in the one form the files use: Ev, an optional full stop, an optional #, the digits,
-- and then anything but a letter or a digit. "Ev #41a" answers null here; exhibit_title_has_letter says so.
CREATE OR REPLACE FUNCTION public.exhibit_no_from_title(p_title text)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN m IS NULL OR length(m[1]) > 6 THEN NULL ELSE m[1]::integer END
  FROM (SELECT regexp_match(COALESCE(p_title, ''), '^\s*[Ee][Vv]\.?\s*#?\s*(\d+)(?![A-Za-z0-9])')) AS x(m)
$$;
-- The digits a title opens with, whatever follows: the floor for a new number, so "Ev #41a" keeps 41 from reuse.
CREATE OR REPLACE FUNCTION public.exhibit_title_opens_with(p_title text)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT (regexp_match(COALESCE(p_title, ''), '^\s*[Ee][Vv]\.?\s*#?\s*(\d{1,6})'))[1]::integer
$$;
CREATE OR REPLACE FUNCTION public.exhibit_title_has_letter(p_title text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(p_title, '') ~ '^\s*[Ee][Vv]\.?\s*#?\s*\d+[A-Za-z]'
$$;

ALTER TABLE public.person_file_evidence ADD COLUMN IF NOT EXISTS exhibit_no integer;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'person_file_evidence_exhibit_no_positive') THEN
    ALTER TABLE public.person_file_evidence ADD CONSTRAINT person_file_evidence_exhibit_no_positive CHECK (exhibit_no IS NULL OR exhibit_no >= 1);
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS person_file_evidence_exhibit_no_once
  ON public.person_file_evidence (person_id, exhibit_no) WHERE exhibit_no IS NOT NULL;
COMMENT ON COLUMN public.person_file_evidence.exhibit_no IS
  'The record''s exhibit number on its person''s file (punch list #315), set by the database on insert and never reused. Null on a record made before 20261112070000 until a dev runs dev_evidence_number_backfill for the person; its title is left as it was either way.';

-- The next number of a kind on a person's file, taken. Definer and executable by nobody: the triggers and functions
-- here call it as their owner. The row lock makes two writers wait their turn.
CREATE OR REPLACE FUNCTION public.person_file_take_number(p_person_id uuid, p_what text, p_explicit integer DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_next integer;
  v_floor integer;
  v_take integer;
BEGIN
  INSERT INTO public.person_file_counters (person_id) VALUES (p_person_id) ON CONFLICT (person_id) DO NOTHING;
  IF p_what = 'exhibit' THEN
    SELECT c.next_exhibit_no INTO v_next FROM public.person_file_counters c WHERE c.person_id = p_person_id FOR UPDATE;
    SELECT COALESCE(max(GREATEST(COALESCE(e.exhibit_no, 0), COALESCE(public.exhibit_title_opens_with(e.title), 0))), 0)
      INTO v_floor FROM public.person_file_evidence e WHERE e.person_id = p_person_id;
  ELSIF p_what = 'item' THEN
    SELECT c.next_item_no INTO v_next FROM public.person_file_counters c WHERE c.person_id = p_person_id FOR UPDATE;
    SELECT COALESCE(max(i.item_no), 0) INTO v_floor FROM public.person_case_items i WHERE i.person_id = p_person_id;
  ELSE
    RAISE EXCEPTION 'person_file_take_number: unknown kind "%"', p_what;
  END IF;
  v_take := COALESCE(p_explicit, GREATEST(v_next, v_floor + 1));
  IF p_what = 'exhibit' THEN
    UPDATE public.person_file_counters SET next_exhibit_no = GREATEST(v_next, v_floor + 1, v_take + 1), updated_at = now() WHERE person_id = p_person_id;
  ELSE
    UPDATE public.person_file_counters SET next_item_no = GREATEST(v_next, v_floor + 1, v_take + 1), updated_at = now() WHERE person_id = p_person_id;
  END IF;
  RETURN v_take;
END
$fn$;
REVOKE ALL ON FUNCTION public.person_file_take_number(uuid, text, integer) FROM PUBLIC, anon, authenticated;

-- The number the next record would take, read and not taken: for a plan, and for the Add evidence window.
CREATE OR REPLACE FUNCTION public.person_file_next_exhibit_no(p_person_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN NOT public.is_dev() THEN NULL ELSE GREATEST(
    COALESCE((SELECT c.next_exhibit_no FROM public.person_file_counters c WHERE c.person_id = p_person_id), 1),
    COALESCE((SELECT max(GREATEST(COALESCE(e.exhibit_no, 0), COALESCE(public.exhibit_title_opens_with(e.title), 0))) FROM public.person_file_evidence e WHERE e.person_id = p_person_id), 0) + 1) END
$$;
REVOKE ALL ON FUNCTION public.person_file_next_exhibit_no(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.person_file_next_exhibit_no(uuid) TO authenticated;

-- Every new record takes the file's next number. A number sent by the client is ignored; only the backfill below
-- sets one by hand, on rows that already exist.
CREATE OR REPLACE FUNCTION public.person_file_evidence_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  NEW.exhibit_no := public.person_file_take_number(NEW.person_id, 'exhibit');
  RETURN NEW;
END
$fn$;
DROP TRIGGER IF EXISTS person_file_evidence_number ON public.person_file_evidence;
CREATE TRIGGER person_file_evidence_number BEFORE INSERT ON public.person_file_evidence
  FOR EACH ROW EXECUTE FUNCTION public.person_file_evidence_number();

-- Number the records a file already holds, from the numbers their titles open with. Devs only, a dry run by default.
CREATE OR REPLACE FUNCTION public.dev_evidence_number_backfill(p_person_id uuid, p_dry_run boolean DEFAULT true, p_number_rest boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_name text;
  v_out jsonb;
  v_assigned jsonb;
  v_clashes jsonb;
  v_lettered jsonb;
  v_rest jsonb;
  v_rest_numbered integer := 0;
  v_high integer;
  r record;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_dev() THEN
    RAISE EXCEPTION 'dev_evidence_number_backfill: devs only' USING ERRCODE = '42501';
  END IF;
  SELECT pe.name INTO v_name FROM public.people pe WHERE pe.id = p_person_id;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'dev_evidence_number_backfill: person % not found', p_person_id;
  END IF;

  BEGIN
    -- Hold the file's counter for the whole pass, so a record added meanwhile waits and takes a number after it.
    PERFORM public.person_file_take_number(p_person_id, 'exhibit', 0);

    -- 1. A number exactly one unnumbered record wears, and no numbered record holds: that record takes it.
    WITH worn AS (
      SELECT e.id, public.exhibit_no_from_title(e.title) AS n FROM public.person_file_evidence e
      WHERE e.person_id = p_person_id AND e.exhibit_no IS NULL
    ), clear AS (
      SELECT w.id, w.n FROM worn w
      WHERE w.n IS NOT NULL
        AND (SELECT count(*) FROM worn w2 WHERE w2.n = w.n) = 1
        AND NOT EXISTS (SELECT 1 FROM public.person_file_evidence h WHERE h.person_id = p_person_id AND h.exhibit_no = w.n)
    ), done AS (
      UPDATE public.person_file_evidence e SET exhibit_no = c.n FROM clear c WHERE e.id = c.id RETURNING e.id, e.exhibit_no
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', d.id, 'exhibit_no', d.exhibit_no) ORDER BY d.exhibit_no), '[]'::jsonb) INTO v_assigned FROM done d;

    -- 2. What it will not decide: a number more than one record wears (or a numbered record already holds), and a
    -- number with a letter. A counsel-only record is named as one, never by its title.
    SELECT COALESCE(jsonb_agg(c.clash ORDER BY c.n), '[]'::jsonb) INTO v_clashes FROM (
      SELECT x.n, jsonb_build_object('number', x.n, 'records', jsonb_agg(jsonb_build_object(
               'id', x.id, 'day', x.dated_on, 'kept', x.created_at, 'holds_it', x.exhibit_no IS NOT NULL,
               'title', CASE WHEN x.counsel_only THEN 'a counsel-only record' ELSE x.title END) ORDER BY x.created_at, x.id)) AS clash
      FROM (
        SELECT e.id, e.dated_on, e.created_at, e.counsel_only, e.title, e.exhibit_no, COALESCE(e.exhibit_no, public.exhibit_no_from_title(e.title)) AS n
        FROM public.person_file_evidence e WHERE e.person_id = p_person_id
      ) x
      WHERE x.n IS NOT NULL
      GROUP BY x.n
      HAVING count(*) > 1 AND count(*) FILTER (WHERE x.exhibit_no IS NULL) > 0
    ) c;
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', e.id, 'day', e.dated_on, 'kept', e.created_at,
             'title', CASE WHEN e.counsel_only THEN 'a counsel-only record' ELSE e.title END) ORDER BY e.created_at, e.id), '[]'::jsonb)
      INTO v_lettered FROM public.person_file_evidence e
      WHERE e.person_id = p_person_id AND e.exhibit_no IS NULL AND public.exhibit_title_has_letter(e.title);

    -- 3. A title with no number: reported, and numbered after the highest (oldest first) only when asked.
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', e.id, 'day', e.dated_on, 'kept', e.created_at,
             'title', CASE WHEN e.counsel_only THEN 'a counsel-only record' ELSE e.title END) ORDER BY e.created_at, e.id), '[]'::jsonb)
      INTO v_rest FROM public.person_file_evidence e
      WHERE e.person_id = p_person_id AND e.exhibit_no IS NULL AND public.exhibit_no_from_title(e.title) IS NULL AND NOT public.exhibit_title_has_letter(e.title);
    IF p_number_rest THEN
      FOR r IN
        SELECT e.id FROM public.person_file_evidence e
        WHERE e.person_id = p_person_id AND e.exhibit_no IS NULL AND public.exhibit_no_from_title(e.title) IS NULL AND NOT public.exhibit_title_has_letter(e.title)
        ORDER BY e.created_at, e.id
      LOOP
        UPDATE public.person_file_evidence SET exhibit_no = public.person_file_take_number(p_person_id, 'exhibit') WHERE id = r.id;
        v_rest_numbered := v_rest_numbered + 1;
      END LOOP;
    END IF;

    SELECT COALESCE(max(e.exhibit_no), 0) INTO v_high FROM public.person_file_evidence e WHERE e.person_id = p_person_id;
    v_out := jsonb_build_object(
      'dry_run', p_dry_run,
      'person', jsonb_build_object('id', p_person_id, 'name', v_name),
      'numbered', jsonb_array_length(v_assigned),
      'assigned', v_assigned,
      'clashes', v_clashes,
      'lettered', v_lettered,
      'no_number', v_rest,
      'no_number_numbered', v_rest_numbered,
      'highest', v_high,
      'next', public.person_file_next_exhibit_no(p_person_id),
      'still_unnumbered', (SELECT count(*) FROM public.person_file_evidence e WHERE e.person_id = p_person_id AND e.exhibit_no IS NULL));
    IF p_dry_run THEN
      RAISE EXCEPTION USING ERRCODE = 'P0DRY', MESSAGE = 'dry run';
    END IF;
    RETURN v_out;
  EXCEPTION
    WHEN SQLSTATE 'P0DRY' THEN
      RETURN v_out;
  END;
END
$fn$;
COMMENT ON FUNCTION public.dev_evidence_number_backfill(uuid, boolean, boolean) IS
  'HR files (punch list #315): number a person''s existing evidence records from the numbers their titles open with. A record takes its number only when exactly one record wears it; a number worn twice, a number with a letter and a title with none are reported, never guessed (p_number_rest numbers the last kind after the highest). Dry run by default; devs only.';
REVOKE ALL ON FUNCTION public.dev_evidence_number_backfill(uuid, boolean, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_evidence_number_backfill(uuid, boolean, boolean) TO authenticated;

-- ── a case's open items ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.person_case_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  item_no integer NOT NULL,
  title text NOT NULL,
  detail text NOT NULL DEFAULT '',
  owner_label text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT 'open',
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  closed_why text,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  author_label text,
  session_label text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT person_case_items_item_no_positive CHECK (item_no >= 1),
  CONSTRAINT person_case_items_title_length CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  CONSTRAINT person_case_items_detail_length CHECK (length(detail) <= 4000),
  CONSTRAINT person_case_items_owner_length CHECK (length(owner_label) <= 120),
  CONSTRAINT person_case_items_state_check CHECK (state IN ('open', 'done', 'dropped')),
  CONSTRAINT person_case_items_closed_with_why CHECK (
    (state = 'open' AND closed_at IS NULL AND closed_why IS NULL)
    OR (state <> 'open' AND closed_at IS NOT NULL AND length(btrim(COALESCE(closed_why, ''))) BETWEEN 1 AND 500))
);
COMMENT ON TABLE public.person_case_items IS
  'HR files (punch list #315): an open item of a person''s case, numbered by the database a person so no two sessions take one number: what, who has it, open · done · dropped, why it closed. Never deleted. Dev-only.';
CREATE UNIQUE INDEX IF NOT EXISTS person_case_items_number_once ON public.person_case_items (person_id, item_no);
CREATE INDEX IF NOT EXISTS person_case_items_open_idx ON public.person_case_items (person_id) WHERE state = 'open';

-- A new item takes the file's next number, or the number it was given when that number is free (an item carried
-- over from prose keeps the number people already call it by). After that its person and number never change.
CREATE OR REPLACE FUNCTION public.person_case_items_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.item_no IS NOT NULL AND EXISTS (SELECT 1 FROM public.person_case_items i WHERE i.person_id = NEW.person_id AND i.item_no = NEW.item_no) THEN
      RAISE EXCEPTION 'person_case_items: item % already stands on this file', NEW.item_no USING ERRCODE = '23505';
    END IF;
    NEW.item_no := public.person_file_take_number(NEW.person_id, 'item', NEW.item_no);
    NEW.updated_at := now();
    RETURN NEW;
  END IF;
  IF NEW.person_id <> OLD.person_id OR NEW.item_no <> OLD.item_no OR NEW.opened_at <> OLD.opened_at
     OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.author_label IS DISTINCT FROM OLD.author_label THEN
    RAISE EXCEPTION 'person_case_items: an item keeps its file, its number and who opened it' USING ERRCODE = '23514';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END
$fn$;
DROP TRIGGER IF EXISTS person_case_items_guard ON public.person_case_items;
CREATE TRIGGER person_case_items_guard BEFORE INSERT OR UPDATE ON public.person_case_items
  FOR EACH ROW EXECUTE FUNCTION public.person_case_items_guard();
-- item_no is filled by the guard before the NOT NULL is checked, so an insert may leave it out.

ALTER TABLE public.person_case_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS person_case_items_dev_select ON public.person_case_items;
CREATE POLICY person_case_items_dev_select ON public.person_case_items FOR SELECT TO authenticated USING (public.is_dev());
DROP POLICY IF EXISTS person_case_items_dev_insert ON public.person_case_items;
CREATE POLICY person_case_items_dev_insert ON public.person_case_items FOR INSERT TO authenticated WITH CHECK (public.is_dev());
DROP POLICY IF EXISTS person_case_items_dev_update ON public.person_case_items;
CREATE POLICY person_case_items_dev_update ON public.person_case_items FOR UPDATE TO authenticated USING (public.is_dev()) WITH CHECK (public.is_dev());
REVOKE ALL ON public.person_case_items FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.person_case_items TO authenticated;

-- ── a case's log ─────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.person_case_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  logged_at timestamptz NOT NULL DEFAULT now(),
  line text NOT NULL,
  item_no integer,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  author_label text,
  session_label text,
  CONSTRAINT person_case_log_line_length CHECK (length(btrim(line)) BETWEEN 1 AND 1000),
  CONSTRAINT person_case_log_session_length CHECK (session_label IS NULL OR length(session_label) <= 120)
);
COMMENT ON TABLE public.person_case_log IS
  'HR files (punch list #315): the log of a person''s case, append-only: when, who, from which session, one line, and the item it is about when it is about one. No UPDATE or DELETE policy exists. Dev-only.';
CREATE INDEX IF NOT EXISTS person_case_log_person_idx ON public.person_case_log (person_id, logged_at DESC);

ALTER TABLE public.person_case_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS person_case_log_dev_select ON public.person_case_log;
CREATE POLICY person_case_log_dev_select ON public.person_case_log FOR SELECT TO authenticated USING (public.is_dev());
DROP POLICY IF EXISTS person_case_log_dev_insert ON public.person_case_log;
CREATE POLICY person_case_log_dev_insert ON public.person_case_log FOR INSERT TO authenticated WITH CHECK (public.is_dev());
REVOKE ALL ON public.person_case_log FROM anon, authenticated;
GRANT SELECT, INSERT ON public.person_case_log TO authenticated;

-- ── the one door for both ────────────────────────────────────────────────────────────────────────
-- p: { person_id, session?,
--      items?: [ { add: { title, detail?, owner?, item_no? } }
--              | { item_no, set: { title?, detail?, owner? } }
--              | { item_no, close: { why, state? (done | dropped; done when left out) } }
--              | { item_no, reopen: true } ],
--      log?:   [ "a line" | { line, item_no? } ] }
-- At most 50 item changes and 50 log lines a call. The reply carries no clock and no id the run made, so a plan and
-- its apply hash alike; a new item is named by the number it takes.
CREATE OR REPLACE FUNCTION public.dev_case_write(p jsonb, p_dry_run boolean DEFAULT true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_dev_name text;
  v_dev_email text;
  v_label text;
  v_person uuid;
  v_person_name text;
  v_session text;
  v_items jsonb := COALESCE(p->'items', '[]'::jsonb);
  v_log jsonb := COALESCE(p->'log', '[]'::jsonb);
  x jsonb;
  op jsonb;
  v_no integer;
  v_row public.person_case_items%ROWTYPE;
  v_before jsonb;
  v_state text;
  v_why text;
  v_line text;
  v_done jsonb := '[]'::jsonb;
  v_logged jsonb := '[]'::jsonb;
  v_out jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_dev() THEN
    RAISE EXCEPTION 'dev_case_write: devs only' USING ERRCODE = '42501';
  END IF;
  SELECT u.name, u.email INTO v_dev_name, v_dev_email FROM public.users u WHERE u.id = auth.uid();
  v_label := COALESCE(NULLIF(btrim(v_dev_name), ''), v_dev_email);
  IF v_label IS NULL THEN
    RAISE EXCEPTION 'dev_case_write: no users row for the caller';
  END IF;
  IF COALESCE(p->>'person_id', '') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
    RAISE EXCEPTION 'dev_case_write: person_id is required';
  END IF;
  v_person := (p->>'person_id')::uuid;
  SELECT pe.name INTO v_person_name FROM public.people pe WHERE pe.id = v_person;
  IF v_person_name IS NULL THEN
    RAISE EXCEPTION 'dev_case_write: person % not found', v_person;
  END IF;
  v_session := NULLIF(left(btrim(COALESCE(p->>'session', '')), 120), '');
  IF jsonb_typeof(v_items) <> 'array' OR jsonb_typeof(v_log) <> 'array' THEN
    RAISE EXCEPTION 'dev_case_write: items and log are lists';
  END IF;
  IF jsonb_array_length(v_items) = 0 AND jsonb_array_length(v_log) = 0 THEN
    RAISE EXCEPTION 'dev_case_write: nothing to write — name an item change or a log line';
  END IF;
  IF jsonb_array_length(v_items) > 50 OR jsonb_array_length(v_log) > 50 THEN
    RAISE EXCEPTION 'dev_case_write: at most 50 item changes and 50 log lines a call';
  END IF;

  BEGIN
    FOR x IN SELECT * FROM jsonb_array_elements(v_items) LOOP
      IF jsonb_typeof(x) <> 'object' THEN
        RAISE EXCEPTION 'dev_case_write: an item change is { add } or { item_no, set | close | reopen }';
      END IF;
      IF x ? 'add' THEN
        op := x->'add';
        IF jsonb_typeof(op) <> 'object' OR length(btrim(COALESCE(op->>'title', ''))) NOT BETWEEN 1 AND 200 THEN
          RAISE EXCEPTION 'dev_case_write: add needs a title (1 to 200 characters)';
        END IF;
        IF op ? 'item_no' AND (jsonb_typeof(op->'item_no') <> 'number' OR (op->>'item_no') !~ '^[1-9][0-9]{0,5}$') THEN
          RAISE EXCEPTION 'dev_case_write: add.item_no is a whole number from 1';
        END IF;
        INSERT INTO public.person_case_items (person_id, item_no, title, detail, owner_label, created_by, author_label, session_label, updated_by)
        VALUES (v_person, (op->>'item_no')::integer, btrim(op->>'title'), COALESCE(op->>'detail', ''), left(btrim(COALESCE(op->>'owner', '')), 120), auth.uid(), v_label, v_session, auth.uid())
        RETURNING * INTO v_row;
        v_line := format('Item %s opened: %s', v_row.item_no, v_row.title) || CASE WHEN v_row.owner_label <> '' THEN format(' (with %s)', v_row.owner_label) ELSE '' END;
        v_done := v_done || jsonb_build_object('op', 'add', 'item_no', v_row.item_no, 'before', NULL,
          'after', jsonb_build_object('title', v_row.title, 'owner', v_row.owner_label, 'state', v_row.state, 'detail_chars', length(v_row.detail)));
      ELSE
        IF jsonb_typeof(x->'item_no') <> 'number' OR (x->>'item_no') !~ '^[1-9][0-9]{0,5}$' THEN
          RAISE EXCEPTION 'dev_case_write: a change names its item by item_no';
        END IF;
        v_no := (x->>'item_no')::integer;
        SELECT * INTO v_row FROM public.person_case_items i WHERE i.person_id = v_person AND i.item_no = v_no FOR UPDATE;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'dev_case_write: no item % on this file', v_no;
        END IF;
        v_before := jsonb_build_object('title', v_row.title, 'owner', v_row.owner_label, 'state', v_row.state, 'detail_chars', length(v_row.detail));
        IF x ? 'set' THEN
          op := x->'set';
          IF jsonb_typeof(op) <> 'object' OR NOT (op ? 'title' OR op ? 'detail' OR op ? 'owner') THEN
            RAISE EXCEPTION 'dev_case_write: set names a title, a detail or an owner';
          END IF;
          IF op ? 'title' AND length(btrim(COALESCE(op->>'title', ''))) NOT BETWEEN 1 AND 200 THEN
            RAISE EXCEPTION 'dev_case_write: set.title is 1 to 200 characters';
          END IF;
          UPDATE public.person_case_items i
             SET title = CASE WHEN op ? 'title' THEN btrim(op->>'title') ELSE i.title END,
                 detail = CASE WHEN op ? 'detail' THEN COALESCE(op->>'detail', '') ELSE i.detail END,
                 owner_label = CASE WHEN op ? 'owner' THEN left(btrim(COALESCE(op->>'owner', '')), 120) ELSE i.owner_label END,
                 updated_by = auth.uid()
           WHERE i.id = v_row.id RETURNING * INTO v_row;
          v_line := format('Item %s changed:', v_no)
            || CASE WHEN op ? 'owner' THEN CASE WHEN v_row.owner_label = '' THEN ' with nobody now;' ELSE format(' now with %s;', v_row.owner_label) END ELSE '' END
            || CASE WHEN op ? 'title' THEN format(' retitled %s;', v_row.title) ELSE '' END
            || CASE WHEN op ? 'detail' THEN ' detail rewritten;' ELSE '' END;
          v_line := rtrim(v_line, ';');
          v_state := 'set';
        ELSIF x ? 'close' THEN
          op := x->'close';
          v_state := COALESCE(op->>'state', 'done');
          v_why := btrim(COALESCE(op->>'why', ''));
          IF jsonb_typeof(op) <> 'object' OR v_state NOT IN ('done', 'dropped') OR length(v_why) NOT BETWEEN 1 AND 500 THEN
            RAISE EXCEPTION 'dev_case_write: close needs why (1 to 500 characters) and a state of done or dropped';
          END IF;
          IF v_row.state <> 'open' THEN
            RAISE EXCEPTION 'dev_case_write: item % is already % — reopen it first', v_no, v_row.state;
          END IF;
          UPDATE public.person_case_items i SET state = v_state, closed_at = now(), closed_why = v_why, updated_by = auth.uid()
           WHERE i.id = v_row.id RETURNING * INTO v_row;
          v_line := format('Item %s %s: %s', v_no, v_state, v_why);
          v_state := 'close';
        ELSIF x ? 'reopen' THEN
          IF v_row.state = 'open' THEN
            RAISE EXCEPTION 'dev_case_write: item % is open already', v_no;
          END IF;
          UPDATE public.person_case_items i SET state = 'open', closed_at = NULL, closed_why = NULL, updated_by = auth.uid()
           WHERE i.id = v_row.id RETURNING * INTO v_row;
          v_line := format('Item %s reopened', v_no);
          v_state := 'reopen';
        ELSE
          RAISE EXCEPTION 'dev_case_write: an item change is { add } or { item_no, set | close | reopen }';
        END IF;
        v_done := v_done || jsonb_build_object('op', v_state, 'item_no', v_no, 'before', v_before,
          'after', jsonb_build_object('title', v_row.title, 'owner', v_row.owner_label, 'state', v_row.state, 'detail_chars', length(v_row.detail))
                   || CASE WHEN v_row.closed_why IS NOT NULL THEN jsonb_build_object('closed_why', v_row.closed_why) ELSE '{}'::jsonb END);
      END IF;
      -- Every change to an item is a line of the log, so the log is the item's history.
      INSERT INTO public.person_case_log (person_id, line, item_no, created_by, author_label, session_label)
      VALUES (v_person, left(v_line, 1000), v_row.item_no, auth.uid(), v_label, v_session);
      v_logged := v_logged || jsonb_build_object('line', left(v_line, 1000), 'item_no', v_row.item_no, 'from', 'the change');
    END LOOP;

    FOR x IN SELECT * FROM jsonb_array_elements(v_log) LOOP
      IF jsonb_typeof(x) = 'string' THEN
        v_line := btrim(x #>> '{}'); v_no := NULL;
      ELSIF jsonb_typeof(x) = 'object' THEN
        v_line := btrim(COALESCE(x->>'line', ''));
        IF x ? 'item_no' AND (jsonb_typeof(x->'item_no') <> 'number' OR (x->>'item_no') !~ '^[1-9][0-9]{0,5}$') THEN
          RAISE EXCEPTION 'dev_case_write: a log line''s item_no is a whole number from 1';
        END IF;
        v_no := (x->>'item_no')::integer;
      ELSE
        RAISE EXCEPTION 'dev_case_write: a log line is words, or { line, item_no? }';
      END IF;
      IF length(v_line) NOT BETWEEN 1 AND 1000 THEN
        RAISE EXCEPTION 'dev_case_write: a log line is 1 to 1,000 characters';
      END IF;
      IF v_no IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.person_case_items i WHERE i.person_id = v_person AND i.item_no = v_no) THEN
        RAISE EXCEPTION 'dev_case_write: no item % on this file for that log line', v_no;
      END IF;
      INSERT INTO public.person_case_log (person_id, line, item_no, created_by, author_label, session_label)
      VALUES (v_person, v_line, v_no, auth.uid(), v_label, v_session);
      v_logged := v_logged || jsonb_build_object('line', v_line, 'item_no', v_no, 'from', 'the call');
    END LOOP;

    v_out := jsonb_build_object(
      'dry_run', p_dry_run,
      'person', jsonb_build_object('id', v_person, 'name', v_person_name),
      'author_label', v_label,
      'session', v_session,
      'items', v_done,
      'log', v_logged,
      'standing', (SELECT jsonb_build_object(
          'open', count(*) FILTER (WHERE i.state = 'open'), 'done', count(*) FILTER (WHERE i.state = 'done'), 'dropped', count(*) FILTER (WHERE i.state = 'dropped'))
        FROM public.person_case_items i WHERE i.person_id = v_person),
      'log_lines', (SELECT count(*) FROM public.person_case_log l WHERE l.person_id = v_person));
    IF p_dry_run THEN
      RAISE EXCEPTION USING ERRCODE = 'P0DRY', MESSAGE = 'dry run';
    END IF;
    RETURN v_out;
  EXCEPTION
    WHEN SQLSTATE 'P0DRY' THEN
      RETURN v_out;
  END;
END
$fn$;
COMMENT ON FUNCTION public.dev_case_write(jsonb, boolean) IS
  'HR files (punch list #315): open, change, close or reopen an item of a person''s case and add lines to its log, as the dev; the database numbers a new item, and every item change writes its own log line. p_dry_run = true (default) performs and unwinds the write, returning what would be written. Devs only.';
REVOKE ALL ON FUNCTION public.dev_case_write(jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_case_write(jsonb, boolean) TO authenticated;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
