SET lock_timeout = '3s';

-- A box's pin remembers who set it, when, and how sure the phone was (punch list #372, step 1; the owner's word of
-- 2026-11-17, "Build all the steps").
--
-- A cage or a box can carry a pin on the site map: lat and lng on its own row, set from the phone's Pin on map sheet.
-- Until now the pin was two numbers and nothing else. A move between places is kept with who and when
-- (job_container_moves); a pin was not. So the app could not say "pinned three weeks ago by Jordan", and for a box
-- somebody is looking for that is the fact that matters: boxes get moved by other trades, and a bare dot reads as
-- the truth.
--
-- Four columns on the box, all NULL while it has no pin:
--   pinned_at        when the pin was set. A press that waited on the phone for signal keeps its own, earlier time.
--   pinned_by        who set it: the signed-in caller, stamped here, never what the phone sent.
--   pinned_by_name   that person's name, kept on the row as a box move keeps by_name, because the crew's roles cannot
--                    read the users table. A dev's own words are kept, for the dev seat's agent label.
--   pin_accuracy_m   the phone's own margin in metres when the pin came from a reading. NULL when the map was dragged
--                    by hand, and NULL for a pin written by a client that does not know the column.
--
-- One trigger keeps them honest, BEFORE INSERT OR UPDATE on job_containers:
--   * The pin did not change (lat, lng and pinned_at as they were): a direct caller's pinned_by, pinned_by_name and
--     pin_accuracy_m are put back as they were. A pin's facts change only with the pin.
--   * The pin was taken off (lat or lng NULL): all four go to NULL.
--   * The pin was set or moved: pinned_by is the caller and pinned_by_name the caller's own name. When the same write
--     carries a new pinned_at, the client knows these columns: its time is kept unless it is ahead of the server's,
--     and its pin_accuracy_m is kept as sent. When it carries none, the client is an older one: the time is now and
--     the margin is NULL, so a margin left by an earlier pin never stands under a new point.
-- The service role and definer functions pass through the same rules, with the who taken from auth.uid() when there
-- is one. on_site_carry_job changes a box's job and never its pin, so a combine and the dev seat's move keep every
-- pin's facts as they are.
--
-- Written by the screens the way every other change to a box is written: an UPDATE of the row under the table's own
-- policy, job_containers_update, which asks on_site_can_touch_job. No new table, no new policy, no new grant. The
-- read-only blocks, the twin fence and the archived seal already stand on job_containers.
--
-- Additive and idempotent. Four nullable columns with no default are a catalog change alone: no row is rewritten. The
-- foreign key on pinned_by checks an empty column. No CREATE TABLE, so no fence calls. No live box had a pin when
-- this was written (0 of 96, read 2026-11-16), so there is no old pin to backfill; one made before this reads as
-- pinned with no day. Nothing reads the columns until the client that follows.

ALTER TABLE public.job_containers
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz,
  ADD COLUMN IF NOT EXISTS pinned_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pinned_by_name text CHECK (pinned_by_name IS NULL OR length(pinned_by_name) <= 120),
  ADD COLUMN IF NOT EXISTS pin_accuracy_m double precision CHECK (pin_accuracy_m IS NULL OR (pin_accuracy_m >= 0 AND pin_accuracy_m < 100000));

COMMENT ON COLUMN public.job_containers.pinned_at IS 'Materials on site (#372): when this box''s pin (lat, lng) was set. A press that waited on the phone keeps its own earlier time; a time ahead of the server''s becomes the server''s. NULL with no pin.';
COMMENT ON COLUMN public.job_containers.pinned_by IS 'Materials on site (#372): who set the pin, stamped by the database from the signed-in caller. NULL with no pin.';
COMMENT ON COLUMN public.job_containers.pinned_by_name IS 'Materials on site (#372): the name of who set the pin, kept on the row because the crew''s roles cannot read users. The caller''s own name; a dev''s words are kept. NULL with no pin.';
COMMENT ON COLUMN public.job_containers.pin_accuracy_m IS 'Materials on site (#372): the phone''s own margin in metres when the pin came from a reading. NULL when the map was dragged by hand, when the client did not say, and with no pin.';

CREATE OR REPLACE FUNCTION public.on_site_stamp_box_pin()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
DECLARE
  v_direct boolean := current_user IN ('authenticated', 'anon');
  v_fresh boolean;
  v_name text;
BEGIN
  -- OLD is read only inside an UPDATE: a new box has none.
  IF TG_OP = 'UPDATE' THEN
    IF NEW.lat IS NOT DISTINCT FROM OLD.lat
       AND NEW.lng IS NOT DISTINCT FROM OLD.lng
       AND NEW.pinned_at IS NOT DISTINCT FROM OLD.pinned_at THEN
      -- The pin did not change, so neither do its facts.
      IF v_direct THEN
        NEW.pinned_by := OLD.pinned_by;
        NEW.pinned_by_name := OLD.pinned_by_name;
        NEW.pin_accuracy_m := OLD.pin_accuracy_m;
      END IF;
      RETURN NEW;
    END IF;
    v_fresh := NEW.pinned_at IS NOT NULL AND NEW.pinned_at IS DISTINCT FROM OLD.pinned_at;
  ELSE
    v_fresh := NEW.pinned_at IS NOT NULL;
  END IF;

  IF NEW.lat IS NULL OR NEW.lng IS NULL THEN
    -- No pin: nothing to remember. A new box with none lands here too.
    NEW.pinned_at := NULL;
    NEW.pinned_by := NULL;
    NEW.pinned_by_name := NULL;
    NEW.pin_accuracy_m := NULL;
    RETURN NEW;
  END IF;

  -- A pin was set or moved. A write that carries its own new time comes from a client that knows these columns.
  IF NOT v_fresh THEN
    NEW.pin_accuracy_m := NULL;
  END IF;
  IF NOT v_fresh OR NEW.pinned_at > now() THEN
    NEW.pinned_at := now();
  END IF;

  v_name := public.on_site_caller_name();
  IF v_direct THEN
    NEW.pinned_by := auth.uid();
    IF NOT (public.is_dev() AND v_fresh AND btrim(COALESCE(NEW.pinned_by_name, '')) <> '') THEN
      NEW.pinned_by_name := NULLIF(v_name, '');
    END IF;
  ELSE
    -- The service role and definer functions: the caller when there is one, else what the write itself said.
    IF auth.uid() IS NOT NULL THEN
      NEW.pinned_by := auth.uid();
      NEW.pinned_by_name := COALESCE(NULLIF(v_name, ''), NEW.pinned_by_name);
    ELSIF NOT v_fresh THEN
      NEW.pinned_by := NULL;
      NEW.pinned_by_name := NULL;
    END IF;
  END IF;
  NEW.pinned_by_name := left(NEW.pinned_by_name, 120);
  RETURN NEW;
END
$fn$;
COMMENT ON FUNCTION public.on_site_stamp_box_pin() IS 'Materials on site (#372): a box''s pin remembers who set it, when and how sure the phone was. The who is the caller, never what the phone sent; a pin''s facts change only with the pin and go when the pin goes; a write that carries no new pinned_at gets the server''s time and no margin.';
REVOKE EXECUTE ON FUNCTION public.on_site_stamp_box_pin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.on_site_stamp_box_pin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.on_site_stamp_box_pin() FROM authenticated;

CREATE OR REPLACE TRIGGER job_containers_stamp_pin BEFORE INSERT OR UPDATE ON public.job_containers
  FOR EACH ROW EXECUTE FUNCTION public.on_site_stamp_box_pin();
