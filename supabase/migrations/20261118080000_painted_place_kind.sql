SET lock_timeout = '3s';

-- Pins on a painted map, reading B (punch list #393, v2.7775): a place can say what kind of thing it is.
--
-- A place on a painted map was a numbered dot with a name, a word and a photo, and every dot looked the same. The
-- owner's ask of 2026-11-17 was to set points of interest on a map. This is the database half: one column. No screen
-- reads or writes it yet.
--
-- `kind` is a short word such as gate, meter or hazard, or null for a plain place. The list of kinds lives in the
-- app, where each kind has its mark, so a new kind needs no migration. The check holds the column to a short
-- lowercase word, and an app that meets a kind it does not know draws the plain dot.
--
-- Nothing else changes. The four policies on painted_map_places are by row, so whoever may set or change a place
-- may set or change its kind, and nobody else gains anything. The fences made with the table already stand.

ALTER TABLE public.painted_map_places
  ADD COLUMN IF NOT EXISTS kind text;

-- Named, so a second run finds it and adds nothing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.painted_map_places'::regclass AND conname = 'painted_map_places_kind_check'
  ) THEN
    ALTER TABLE public.painted_map_places
      ADD CONSTRAINT painted_map_places_kind_check CHECK (kind IS NULL OR kind ~ '^[a-z][a-z_]{1,23}$');
  END IF;
END $$;

COMMENT ON COLUMN public.painted_map_places.kind IS 'What kind of thing the place is, as a short lowercase word (gate, parking, door, meter, shutoff, cleanout, hazard). Null for a plain place. The app holds the list and each kind''s mark, and draws a kind it does not know as a plain dot.';
