SET lock_timeout = '3s';

-- Employment stints (v2.6481, punch list #256 PR 2): every stretch a person worked, kept.
--
-- people.start_date / people.end_date hold ONE pair, so a teammate who leaves and comes back
-- had their first stint's dates written over. This table keeps every stint. The people row's
-- pair stays the CURRENT stint, so the salary clamp, roster_people, tenure and every other
-- reader keep working unchanged (the owner's call 1: tenure counts from the day back).
--
-- One AFTER trigger on public.people is the single choke point, like the roadmap's
-- (roadmap_assignees_follow_user_archive): whatever path writes the dates — End employment,
-- Pay & schedule, the Employment tab, the sub bench, Bring back — the stints follow.
--   * The first dates on a row open its first stint.
--   * An end cleared with a NEW start on or after the old end is a return: a new open stint;
--     the old one stays as it ended (Bring back, and the sub bench's Reactivate).
--   * Anything else is the current stint's own dates changing: an edit, an end, or an end
--     undone (Ended by mistake keeps the old start, so the old stint reopens).
-- Rows written before today get one stint each from their pair (the backfill below).

CREATE TABLE IF NOT EXISTS public.employment_stints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  start_date date,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT employment_stints_dates CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date),
  CONSTRAINT employment_stints_some_date CHECK (start_date IS NOT NULL OR end_date IS NOT NULL)
);

COMMENT ON TABLE public.employment_stints IS
  'Every stretch a roster person worked (v2.6481). The people row''s start_date/end_date is the current stint; earlier stints stay here. Written only by the people_stints_follow_dates trigger; read with the same visibility as the people row.';
COMMENT ON COLUMN public.employment_stints.start_date IS 'Stint start (inclusive). NULL = unknown (a legacy row that had only an end date).';
COMMENT ON COLUMN public.employment_stints.end_date IS 'Stint end (inclusive). NULL = the open, current stint.';

-- At most one open stint a person.
CREATE UNIQUE INDEX IF NOT EXISTS employment_stints_one_open ON public.employment_stints (person_id) WHERE end_date IS NULL;
CREATE INDEX IF NOT EXISTS employment_stints_person_start ON public.employment_stints (person_id, start_date);

ALTER TABLE public.employment_stints ENABLE ROW LEVEL SECURITY;

-- Whoever can see the people row sees its stints: the EXISTS runs under people's own policies.
DROP POLICY IF EXISTS "Read stints of people you can see" ON public.employment_stints;
CREATE POLICY "Read stints of people you can see" ON public.employment_stints
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.people p WHERE p.id = employment_stints.person_id));

-- No write policies: the trigger below is the only writer.
REVOKE ALL ON public.employment_stints FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.employment_stints FROM authenticated;
GRANT SELECT ON public.employment_stints TO authenticated;

CREATE OR REPLACE FUNCTION public.people_stints_follow_dates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur_id uuid;
BEGIN
  IF NEW.start_date IS NULL AND NEW.end_date IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND OLD.start_date IS NOT DISTINCT FROM NEW.start_date
     AND OLD.end_date IS NOT DISTINCT FROM NEW.end_date THEN
    RETURN NEW;
  END IF;

  -- The current stint: the open one, else the one that ended last.
  SELECT s.id INTO cur_id
  FROM public.employment_stints s
  WHERE s.person_id = NEW.id
  ORDER BY (s.end_date IS NULL) DESC, s.end_date DESC NULLS LAST, s.start_date DESC NULLS LAST, s.created_at DESC
  LIMIT 1;

  IF cur_id IS NULL THEN
    INSERT INTO public.employment_stints (person_id, start_date, end_date)
    VALUES (NEW.id, NEW.start_date, NEW.end_date);
    RETURN NEW;
  END IF;

  -- A return: the end cleared and a new start on or after the old end.
  IF TG_OP = 'UPDATE'
     AND OLD.end_date IS NOT NULL
     AND NEW.end_date IS NULL
     AND NEW.start_date IS NOT NULL
     AND NEW.start_date IS DISTINCT FROM OLD.start_date
     AND NEW.start_date >= OLD.end_date THEN
    INSERT INTO public.employment_stints (person_id, start_date, end_date)
    VALUES (NEW.id, NEW.start_date, NULL);
    RETURN NEW;
  END IF;

  -- Otherwise the current stint's own dates changed: an edit, an end, or an end undone.
  UPDATE public.employment_stints
  SET start_date = NEW.start_date, end_date = NEW.end_date, updated_at = now()
  WHERE id = cur_id;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.people_stints_follow_dates() IS
  'people.start_date/end_date changed: open the first stint, open a new stint on a return (end cleared, new start on or after the old end), else move the current stint''s dates (an edit, an end, an end undone). v2.6481.';

REVOKE EXECUTE ON FUNCTION public.people_stints_follow_dates() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS people_stints_follow_dates ON public.people;
CREATE TRIGGER people_stints_follow_dates
  AFTER INSERT OR UPDATE OF start_date, end_date ON public.people
  FOR EACH ROW EXECUTE FUNCTION public.people_stints_follow_dates();

-- Backfill: one stint from each row's pair, for rows that have no stint yet (a rerun adds nothing).
INSERT INTO public.employment_stints (person_id, start_date, end_date)
SELECT p.id, p.start_date, p.end_date
FROM public.people p
WHERE (p.start_date IS NOT NULL OR p.end_date IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM public.employment_stints s WHERE s.person_id = p.id);

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
