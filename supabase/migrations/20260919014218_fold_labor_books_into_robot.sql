SET lock_timeout = '3s';

-- Labor refresh PR 6a — one book (v2.3596). The human labor books fold into their trade's
-- 🤖 Robot Default as entries and overrides; every entry records where its hours came from;
-- a twin's write never replaces a human's number; calibration can be proposed.
-- Read against prod 2026-09-18: Default (Plumbing, 15) vs Robot Plumbing (17) — 3 agree,
-- 3 conflict (equal totals, top-out/trim swapped; Robot's split wins, the owner's call),
-- 9 only in Default; Bill (Electrical, 3) seeds the empty Robot Electrical; Bryan and
-- default are empty and go. Idempotent: a second run finds nothing to fold.

-- ─── columns ─────────────────────────────────────────────────────────────────
ALTER TABLE public.labor_book_versions ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.labor_book_versions ADD COLUMN IF NOT EXISTS proposed_multiplier numeric(6,3);
ALTER TABLE public.labor_book_versions ADD COLUMN IF NOT EXISTS proposed_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.labor_book_versions ADD COLUMN IF NOT EXISTS proposed_at timestamptz;
ALTER TABLE public.labor_book_versions ADD COLUMN IF NOT EXISTS proposed_note text;
COMMENT ON COLUMN public.labor_book_versions.archived_at IS 'v2.3596: a human book folded into its trade''s robot book; hidden from every picker, kept for a rollback.';
COMMENT ON COLUMN public.labor_book_versions.proposed_multiplier IS 'v2.3596: an estimator''s calibration proposal (Book vs jobs → Set); a leader applies or clears it.';

ALTER TABLE public.labor_book_entries ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'human';
ALTER TABLE public.labor_book_entries DROP CONSTRAINT IF EXISTS labor_book_entries_origin_check;
ALTER TABLE public.labor_book_entries ADD CONSTRAINT labor_book_entries_origin_check CHECK (origin IN ('robot', 'human'));
ALTER TABLE public.labor_book_entries ADD COLUMN IF NOT EXISTS robot_rough_in_hrs numeric(8,2);
ALTER TABLE public.labor_book_entries ADD COLUMN IF NOT EXISTS robot_top_out_hrs numeric(8,2);
ALTER TABLE public.labor_book_entries ADD COLUMN IF NOT EXISTS robot_trim_set_hrs numeric(8,2);
ALTER TABLE public.labor_book_entries ADD COLUMN IF NOT EXISTS set_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.labor_book_entries ADD COLUMN IF NOT EXISTS set_at timestamptz;
ALTER TABLE public.labor_book_entries ADD COLUMN IF NOT EXISTS set_note text;
COMMENT ON COLUMN public.labor_book_entries.origin IS 'robot: a twin minted it (robot_*_hrs are its numbers); human: a person did (from a folded book, Add entry, or a queue answer).';
COMMENT ON COLUMN public.labor_book_entries.robot_rough_in_hrs IS 'The robot''s own hours, kept under a human override so Reset to robot works; a twin''s later write refreshes these, never the human''s number.';
COMMENT ON COLUMN public.labor_book_entries.set_by IS 'Who last set the hours by hand (an override, a calibration Set, a queue answer); NULL means the robot''s number stands.';
COMMENT ON COLUMN public.labor_book_entries.set_note IS 'Why: "from Default", "calibrated ×1.13 · 4 jobs", "learned from BP375", "Default had 2/3/2 — Robot kept".';

-- Robot-book entries that predate this: the robot's numbers are what they hold.
UPDATE public.labor_book_entries e
   SET origin = 'robot',
       robot_rough_in_hrs = COALESCE(e.robot_rough_in_hrs, e.rough_in_hrs),
       robot_top_out_hrs = COALESCE(e.robot_top_out_hrs, e.top_out_hrs),
       robot_trim_set_hrs = COALESCE(e.robot_trim_set_hrs, e.trim_set_hrs)
  FROM public.labor_book_versions v
 WHERE v.id = e.version_id AND v.is_robot AND e.robot_rough_in_hrs IS NULL;

-- ─── the fold ────────────────────────────────────────────────────────────────
DO $fold$
DECLARE
  hv record;
  rv record;
  he record;
  re record;
  n_same int := 0; n_conflict int := 0; n_added int := 0; n_books int := 0; n_bids int := 0; n_deleted int := 0;
BEGIN
  FOR hv IN
    SELECT v.* FROM public.labor_book_versions v
     WHERE NOT v.is_robot AND v.archived_at IS NULL
       AND EXISTS (SELECT 1 FROM public.labor_book_entries e WHERE e.version_id = v.id)
     ORDER BY v.created_at
  LOOP
    SELECT r.* INTO rv FROM public.labor_book_versions r
     WHERE r.is_robot AND r.service_type_id = hv.service_type_id AND r.archived_at IS NULL
     ORDER BY r.created_at LIMIT 1;
    IF rv.id IS NULL THEN
      RAISE NOTICE 'fold: no robot book for the trade of "%" — left as is', hv.name;
      CONTINUE;
    END IF;
    FOR he IN SELECT * FROM public.labor_book_entries WHERE version_id = hv.id ORDER BY sequence_order, created_at LOOP
      SELECT * INTO re FROM public.labor_book_entries
       WHERE version_id = rv.id AND fixture_type_id = he.fixture_type_id
       ORDER BY created_at LIMIT 1;
      IF re.id IS NULL THEN
        INSERT INTO public.labor_book_entries
          (version_id, fixture_type_id, rough_in_hrs, top_out_hrs, trim_set_hrs, sequence_order, alias_names, unit, kind, origin, set_at, set_note)
        VALUES
          (rv.id, he.fixture_type_id, he.rough_in_hrs, he.top_out_hrs, he.trim_set_hrs,
           (SELECT COALESCE(max(sequence_order), 0) + 1 FROM public.labor_book_entries WHERE version_id = rv.id),
           COALESCE(he.alias_names, '{}'), he.unit, he.kind, 'human', now(), 'from ' || hv.name);
        n_added := n_added + 1;
      ELSIF re.rough_in_hrs = he.rough_in_hrs AND re.top_out_hrs = he.top_out_hrs AND re.trim_set_hrs = he.trim_set_hrs THEN
        UPDATE public.labor_book_entries
           SET alias_names = (SELECT array_agg(DISTINCT a) FROM unnest(COALESCE(re.alias_names, '{}') || COALESCE(he.alias_names, '{}')) a)
         WHERE id = re.id;
        n_same := n_same + 1;
      ELSE
        -- The owner's pick (2026-09-18): the robot's split stands; the human split is kept in the note.
        UPDATE public.labor_book_entries
           SET alias_names = (SELECT array_agg(DISTINCT a) FROM unnest(COALESCE(re.alias_names, '{}') || COALESCE(he.alias_names, '{}')) a),
               set_note = concat_ws(' · ', re.set_note, format('%s had %s/%s/%s — Robot kept', hv.name, he.rough_in_hrs, he.top_out_hrs, he.trim_set_hrs))
         WHERE id = re.id;
        RAISE NOTICE 'fold: conflict on % — "%" %/%/% vs Robot %/%/% (Robot kept)',
          (SELECT name FROM public.fixture_types WHERE id = he.fixture_type_id), hv.name,
          he.rough_in_hrs, he.top_out_hrs, he.trim_set_hrs, re.rough_in_hrs, re.top_out_hrs, re.trim_set_hrs;
        n_conflict := n_conflict + 1;
      END IF;
    END LOOP;
    UPDATE public.bids SET selected_labor_book_version_id = rv.id WHERE selected_labor_book_version_id = hv.id;
    GET DIAGNOSTICS n_bids = ROW_COUNT;
    UPDATE public.labor_book_versions SET archived_at = now() WHERE id = hv.id;
    n_books := n_books + 1;
    RAISE NOTICE 'fold: "%" → "%" (bids re-pointed: %)', hv.name, rv.name, n_bids;
  END LOOP;

  -- Empty human books never held an hour; nothing to keep.
  DELETE FROM public.labor_book_versions v
   WHERE NOT v.is_robot AND v.archived_at IS NULL
     AND NOT EXISTS (SELECT 1 FROM public.labor_book_entries e WHERE e.version_id = v.id)
     AND NOT EXISTS (SELECT 1 FROM public.bids b WHERE b.selected_labor_book_version_id = v.id);
  GET DIAGNOSTICS n_deleted = ROW_COUNT;

  RAISE NOTICE 'fold report: % book(s) folded · % same · % conflict · % added · % empty book(s) deleted', n_books, n_same, n_conflict, n_added, n_deleted;
END
$fold$;

-- ─── provenance trigger ──────────────────────────────────────────────────────
-- A twin's write lands in robot_*_hrs; the visible hours follow only when no person has set
-- them. A person's write stamps set_by / set_at; a write that restores the robot's numbers is
-- a reset and clears the stamp. Runs after the fold so the fold's rows are not re-stamped.
CREATE OR REPLACE FUNCTION public.labor_book_entries_provenance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  twin boolean := public.is_digital_twin();
  hours_changed boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF twin THEN
      NEW.origin := 'robot';
      NEW.robot_rough_in_hrs := NEW.rough_in_hrs;
      NEW.robot_top_out_hrs := NEW.top_out_hrs;
      NEW.robot_trim_set_hrs := NEW.trim_set_hrs;
      NEW.set_by := NULL; NEW.set_at := NULL;
    ELSIF auth.uid() IS NOT NULL AND NEW.set_by IS NULL THEN
      NEW.set_by := auth.uid(); NEW.set_at := now();
    END IF;
    RETURN NEW;
  END IF;

  hours_changed := NEW.rough_in_hrs IS DISTINCT FROM OLD.rough_in_hrs
                OR NEW.top_out_hrs IS DISTINCT FROM OLD.top_out_hrs
                OR NEW.trim_set_hrs IS DISTINCT FROM OLD.trim_set_hrs;

  IF twin THEN
    -- The robot's numbers refresh; a human's stay.
    IF hours_changed THEN
      NEW.robot_rough_in_hrs := NEW.rough_in_hrs;
      NEW.robot_top_out_hrs := NEW.top_out_hrs;
      NEW.robot_trim_set_hrs := NEW.trim_set_hrs;
      IF OLD.set_by IS NOT NULL THEN
        NEW.rough_in_hrs := OLD.rough_in_hrs;
        NEW.top_out_hrs := OLD.top_out_hrs;
        NEW.trim_set_hrs := OLD.trim_set_hrs;
      END IF;
    END IF;
    NEW.origin := OLD.origin;
    NEW.set_by := OLD.set_by; NEW.set_at := OLD.set_at; NEW.set_note := OLD.set_note;
    RETURN NEW;
  END IF;

  IF hours_changed AND auth.uid() IS NOT NULL THEN
    IF NEW.robot_rough_in_hrs IS NOT NULL
       AND NEW.rough_in_hrs = NEW.robot_rough_in_hrs
       AND NEW.top_out_hrs = NEW.robot_top_out_hrs
       AND NEW.trim_set_hrs = NEW.robot_trim_set_hrs THEN
      -- Back to the robot's numbers: the stamp goes.
      NEW.set_by := NULL; NEW.set_at := NULL; NEW.set_note := NULL;
    ELSIF NEW.set_by IS NOT DISTINCT FROM OLD.set_by THEN
      NEW.set_by := auth.uid(); NEW.set_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS labor_book_entries_provenance ON public.labor_book_entries;
CREATE TRIGGER labor_book_entries_provenance
  BEFORE INSERT OR UPDATE ON public.labor_book_entries
  FOR EACH ROW EXECUTE FUNCTION public.labor_book_entries_provenance();

-- Twins may still write robot books; the trigger decides what of a twin's write shows.
SELECT public.apply_digital_twin_write_blocks();

-- ─── the mint picks a live book ──────────────────────────────────────────────
-- mint_labor_rows_from_book (v2.3369) fell back to the trade's first book BY NAME, which after
-- the fold is the archived "Default". Same body; only the book choice changes: an archived
-- pick is ignored, and the fallback is the trade's robot book.
CREATE OR REPLACE FUNCTION public.mint_labor_rows_from_book(p_bid_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bid public.bids%ROWTYPE;
  v_est_id uuid;
  v_book uuid;
  v_book_name text;
  v_seq integer;
  v_minted integer := 0;
  r record;
  v_hit boolean;
  v_has boolean;
  v_r numeric; v_t numeric; v_tr numeric; v_unit text; v_kind text; v_src text; v_note text;
  v_prefix text;
BEGIN
  SELECT * INTO v_bid FROM public.bids WHERE id = p_bid_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  -- The count sheet: the active version's rows, else the unversioned ones.
  IF NOT EXISTS (
    SELECT 1 FROM public.bids_count_rows c
     WHERE c.bid_id = p_bid_id AND (c.bid_version_id IS NOT DISTINCT FROM v_bid.selected_bid_version_id OR c.bid_version_id IS NULL)
  ) THEN
    RETURN 0;
  END IF;

  -- The book: the bid's, else its trade's robot book (v2.3596 — never an archived one; the oldest
  -- unarchived book of the trade as a last resort, the way the Labor tab's list is ordered).
  v_book := v_bid.selected_labor_book_version_id;
  IF v_book IS NOT NULL AND EXISTS (SELECT 1 FROM public.labor_book_versions v WHERE v.id = v_book AND v.archived_at IS NOT NULL) THEN
    v_book := NULL;
  END IF;
  IF v_book IS NULL THEN
    SELECT id INTO v_book FROM public.labor_book_versions
     WHERE service_type_id = v_bid.service_type_id AND archived_at IS NULL
     ORDER BY is_robot DESC, created_at ASC LIMIT 1;
  END IF;
  IF v_book IS NOT NULL THEN
    SELECT name INTO v_book_name FROM public.labor_book_versions WHERE id = v_book;
  END IF;

  -- The cost estimate row (one per bid).
  SELECT id INTO v_est_id FROM public.cost_estimates WHERE bid_id = p_bid_id;
  IF v_est_id IS NULL THEN
    INSERT INTO public.cost_estimates (bid_id) VALUES (p_bid_id)
    ON CONFLICT (bid_id) DO NOTHING;
    SELECT id INTO v_est_id FROM public.cost_estimates WHERE bid_id = p_bid_id;
  END IF;
  IF v_est_id IS NULL THEN RETURN 0; END IF;

  SELECT coalesce(max(sequence_order), 0) INTO v_seq FROM public.cost_estimate_labor_rows WHERE cost_estimate_id = v_est_id;

  FOR r IN
    SELECT c.fixture, sum(coalesce(c.count, 0)) AS cnt, min(c.sequence_order) AS seq
      FROM public.bids_count_rows c
     WHERE c.bid_id = p_bid_id AND (c.bid_version_id IS NOT DISTINCT FROM v_bid.selected_bid_version_id OR c.bid_version_id IS NULL)
     GROUP BY c.fixture
     ORDER BY min(c.sequence_order)
  LOOP
    -- Hours: book entry by fixture-type name, then by alias, then fixture_labor_defaults, then nothing.
    v_hit := false; v_r := 0; v_t := 0; v_tr := 0; v_unit := 'each'; v_kind := 'fixture'; v_src := NULL; v_note := NULL;
    IF v_book IS NOT NULL THEN
      SELECT e.rough_in_hrs, e.top_out_hrs, e.trim_set_hrs, e.unit, e.kind, 'book', ft.name || CASE WHEN v_book_name IS NOT NULL THEN ' · ' || v_book_name ELSE '' END
        INTO v_r, v_t, v_tr, v_unit, v_kind, v_src, v_note
        FROM public.labor_book_entries e JOIN public.fixture_types ft ON ft.id = e.fixture_type_id
       WHERE e.version_id = v_book AND lower(regexp_replace(trim(ft.name), '\s+', ' ', 'g')) = lower(regexp_replace(trim(r.fixture), '\s+', ' ', 'g'))
       ORDER BY e.sequence_order LIMIT 1;
      v_hit := FOUND;
      IF NOT v_hit THEN
        SELECT e.rough_in_hrs, e.top_out_hrs, e.trim_set_hrs, e.unit, e.kind, 'alias', ft.name || CASE WHEN v_book_name IS NOT NULL THEN ' · ' || v_book_name ELSE '' END || ' (by alias)'
          INTO v_r, v_t, v_tr, v_unit, v_kind, v_src, v_note
          FROM public.labor_book_entries e JOIN public.fixture_types ft ON ft.id = e.fixture_type_id
         WHERE e.version_id = v_book
           AND EXISTS (SELECT 1 FROM unnest(coalesce(e.alias_names, '{}'::text[])) a WHERE lower(regexp_replace(trim(a), '\s+', ' ', 'g')) = lower(regexp_replace(trim(r.fixture), '\s+', ' ', 'g')))
         ORDER BY e.sequence_order LIMIT 1;
        v_hit := FOUND;
      END IF;
    END IF;
    -- prefix (v2.3369, second file): the letters at the front of a plan code — `LAV2` → lav, `WC 1&2` → wc, `FS-1` → fs —
    -- equal an entry's name or alias. Two letters or more, then a digit (optionally after a space or -_/#.), the way
    -- laborBookMatch.fixtureCodePrefix reads it; `ft of 3/4IN WATER` never becomes "ft".
    IF NOT v_hit AND v_book IS NOT NULL THEN
      v_prefix := lower((regexp_match(trim(r.fixture), '^([A-Za-z]{2,})\s*[-_/#.]?\s*[0-9]'))[1]);
      IF v_prefix IS NOT NULL THEN
        SELECT e.rough_in_hrs, e.top_out_hrs, e.trim_set_hrs, e.unit, e.kind, 'alias', ft.name || CASE WHEN v_book_name IS NOT NULL THEN ' · ' || v_book_name ELSE '' END || ' (by code prefix)'
          INTO v_r, v_t, v_tr, v_unit, v_kind, v_src, v_note
          FROM public.labor_book_entries e JOIN public.fixture_types ft ON ft.id = e.fixture_type_id
         WHERE e.version_id = v_book
           AND (lower(regexp_replace(trim(ft.name), '\s+', ' ', 'g')) = v_prefix
                OR EXISTS (SELECT 1 FROM unnest(coalesce(e.alias_names, '{}'::text[])) a WHERE lower(regexp_replace(trim(a), '\s+', ' ', 'g')) = v_prefix))
         ORDER BY e.sequence_order LIMIT 1;
        v_hit := FOUND;
      END IF;
    END IF;
    IF NOT v_hit THEN
      SELECT d.rough_in_hrs, d.top_out_hrs, d.trim_set_hrs, 'each', 'fixture', 'book', 'fixture defaults'
        INTO v_r, v_t, v_tr, v_unit, v_kind, v_src, v_note
        FROM public.fixture_labor_defaults d
       WHERE lower(trim(d.fixture)) = lower(trim(r.fixture))
       LIMIT 1;
      v_hit := FOUND;
    END IF;
    IF NOT v_hit THEN v_r := 0; v_t := 0; v_tr := 0; v_unit := 'each'; v_kind := 'fixture'; v_src := NULL; v_note := NULL; END IF;
    v_has := v_hit AND (coalesce(v_r, 0) + coalesce(v_t, 0) + coalesce(v_tr, 0)) > 0;

    IF NOT EXISTS (SELECT 1 FROM public.cost_estimate_labor_rows l WHERE l.cost_estimate_id = v_est_id AND l.fixture = r.fixture) THEN
      v_seq := v_seq + 1;
      INSERT INTO public.cost_estimate_labor_rows
        (cost_estimate_id, fixture, count, rough_in_hrs_per_unit, top_out_hrs_per_unit, trim_set_hrs_per_unit, sequence_order, is_fixed, kind, unit, source, source_note)
      VALUES
        (v_est_id, r.fixture, r.cnt,
         coalesce(v_r, 0), coalesce(v_t, 0), coalesce(v_tr, 0),
         v_seq,
         coalesce(v_kind, 'fixture') = 'task',
         coalesce(v_kind, 'fixture'),
         coalesce(v_unit, 'each'),
         CASE WHEN v_has THEN v_src END,
         CASE WHEN v_has THEN v_note END);
      v_minted := v_minted + 1;
    ELSIF v_has THEN
      -- A row that says nothing yet (zero hours, no source) takes the book's hours; anything a person touched stays.
      UPDATE public.cost_estimate_labor_rows l
         SET rough_in_hrs_per_unit = v_r, top_out_hrs_per_unit = v_t, trim_set_hrs_per_unit = v_tr,
             kind = coalesce(v_kind, l.kind), unit = coalesce(v_unit, l.unit), is_fixed = coalesce(v_kind, l.kind) = 'task',
             source = v_src, source_note = v_note
       WHERE l.cost_estimate_id = v_est_id AND l.fixture = r.fixture
         AND l.source IS NULL AND l.kind <> 'sub'
         AND coalesce(l.rough_in_hrs_per_unit, 0) = 0 AND coalesce(l.top_out_hrs_per_unit, 0) = 0 AND coalesce(l.trim_set_hrs_per_unit, 0) = 0;
      IF FOUND THEN v_minted := v_minted + 1; END IF;
    END IF;
  END LOOP;

  RETURN v_minted;
END;
$$;
