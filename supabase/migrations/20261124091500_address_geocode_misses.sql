SET lock_timeout = '3s';

-- Remember an address the map cannot place (punch list #408, step 1 of 3): a place to keep a miss.
--
-- address_geocodes keeps an address the map services placed, and its lat and lng are NOT NULL, so it cannot hold an
-- address nobody could place. Such an address was kept nowhere, so every screen that lists its record asked
-- OpenStreetMap, Google and the Census again on every open.
--
--   address_geocode_misses          one row an address no service could place: the same key address_geocodes uses
--                                   (trimmed, single-spaced, lower case), the reason, and the day it was checked.
--   address_geocode_misses_stamp()  checked_at is the server's clock on every write, whatever the caller sent, so
--                                   nobody can write a miss that stands for years.
--   address_geocodes_clears_miss()  a saved point takes its miss away, whoever saved it. Every writer of
--                                   address_geocodes is covered at once, and no caller needs a delete of its own.
--
-- Who: any signed-in user reads and writes a miss, as address_geocodes has been since v2.3131. The functions that
-- ask the services write it through the caller's own JWT. A miss holds nothing the address on the record does not.
-- Nobody deletes one by hand: the saved point does, through the trigger. Training mode, a digital twin and an
-- archived account are held by the four fences at the end. Nothing reads or writes the table until step 2 ships.
-- Additive and idempotent.

CREATE TABLE IF NOT EXISTS public.address_geocode_misses (
  address_normalized text PRIMARY KEY CHECK (length(address_normalized) >= 3),
  -- Why it could not be placed, in the functions' own codes (not_found today).
  error_code text NOT NULL DEFAULT 'not_found' CHECK (length(btrim(error_code)) BETWEEN 1 AND 60),
  -- What each service said, for the list a person reads.
  detail text CHECK (detail IS NULL OR length(detail) <= 2000),
  -- The server's clock on every write (address_geocode_misses_stamp).
  checked_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.address_geocode_misses IS
  'Punch list #408: an address no map service could place, kept beside address_geocodes by the same normalized key, with the reason and the day it was checked, so a screen that reads it does not ask again. Any signed-in user reads, inserts and updates; nobody deletes by hand. A point saved to address_geocodes takes its miss away (address_geocodes_clears_miss). How long a miss stands is the functions'' rule, not the table''s.';

CREATE OR REPLACE FUNCTION public.address_geocode_misses_stamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.checked_at := now();
  NEW.error_code := btrim(NEW.error_code);
  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.address_geocode_misses_stamp() IS
  'Punch list #408: stamps a miss with the server''s clock on every insert and update, whatever the caller sent.';
REVOKE EXECUTE ON FUNCTION public.address_geocode_misses_stamp() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS address_geocode_misses_stamp ON public.address_geocode_misses;
CREATE TRIGGER address_geocode_misses_stamp
  BEFORE INSERT OR UPDATE ON public.address_geocode_misses
  FOR EACH ROW EXECUTE FUNCTION public.address_geocode_misses_stamp();

-- A saved point takes its miss away. Definer, because no caller holds a delete on the misses; it fires only after
-- the caller's own write to address_geocodes has passed that table's policies and fences.
CREATE OR REPLACE FUNCTION public.address_geocodes_clears_miss()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.address_geocode_misses WHERE address_normalized = NEW.address_normalized;
  RETURN NULL;
END;
$$;
COMMENT ON FUNCTION public.address_geocodes_clears_miss() IS
  'Punch list #408: after a point is saved to address_geocodes, deletes the miss kept for the same address.';
REVOKE EXECUTE ON FUNCTION public.address_geocodes_clears_miss() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS address_geocodes_clears_miss ON public.address_geocodes;
CREATE TRIGGER address_geocodes_clears_miss
  AFTER INSERT OR UPDATE ON public.address_geocodes
  FOR EACH ROW EXECUTE FUNCTION public.address_geocodes_clears_miss();

ALTER TABLE public.address_geocode_misses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS address_geocode_misses_select ON public.address_geocode_misses;
CREATE POLICY address_geocode_misses_select ON public.address_geocode_misses
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL);
DROP POLICY IF EXISTS address_geocode_misses_insert ON public.address_geocode_misses;
CREATE POLICY address_geocode_misses_insert ON public.address_geocode_misses
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);
DROP POLICY IF EXISTS address_geocode_misses_update ON public.address_geocode_misses;
CREATE POLICY address_geocode_misses_update ON public.address_geocode_misses
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL)
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);
REVOKE ALL ON TABLE public.address_geocode_misses FROM anon;
REVOKE ALL ON TABLE public.address_geocode_misses FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.address_geocode_misses TO authenticated;
GRANT ALL ON TABLE public.address_geocode_misses TO service_role;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
