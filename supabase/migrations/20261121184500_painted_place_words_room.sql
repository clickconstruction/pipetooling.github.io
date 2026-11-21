SET lock_timeout = '3s';

-- A photo keeps its spot on the job (punch list #413, step 0): room for a description on a place.
--
-- A place's words were one line for whoever comes next, held to 200 characters by the table and to 160 by the app.
-- Taunya asked on 2026-11-21 for an open-ended description on a place, so a plumber can say what is buried, how deep
-- and which way it runs. This lifts the table's cap to 4,000 characters. No new column: the words a place has are the
-- description it gets, so every reader of a place already reads it.
--
-- The old check was written inside the column's own line and so wears the name the database gave it. This looks for
-- it by what it says and not by that name, drops it, and adds the new one under a name of its own. A second run finds
-- the new name and changes nothing.
--
-- Additive: every row that passed the old check passes the new one. No CREATE TABLE, so no fence calls. The lock is an
-- ALTER TABLE on a small table (no row on prod on 2026-11-21), under the timeout above.

DO $$
DECLARE
  c record;
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.painted_map_places'::regclass AND contype = 'c' AND conname = 'painted_map_places_words_room'
  ) THEN
    RETURN;
  END IF;
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.painted_map_places'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ~ 'length\(words\)'
  LOOP
    EXECUTE format('ALTER TABLE public.painted_map_places DROP CONSTRAINT %I', c.conname);
  END LOOP;
  ALTER TABLE public.painted_map_places
    ADD CONSTRAINT painted_map_places_words_room CHECK (length(words) <= 4000);
END $$;

COMMENT ON COLUMN public.painted_map_places.words IS 'What whoever comes next should know about the place, in the setter''s own words: one line or a whole description, up to 4,000 characters. Empty when nobody wrote any. Never a gate code or a lock code: a link shows a map to anyone who holds it.';
