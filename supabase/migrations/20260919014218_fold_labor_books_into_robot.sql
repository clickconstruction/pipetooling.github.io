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
