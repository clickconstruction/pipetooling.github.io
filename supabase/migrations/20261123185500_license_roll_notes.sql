SET lock_timeout = '3s';

-- State roll, step three (punch list #411): the office's own notes on a person on the state's roll, and the
-- Leave off press. Step one made license_roll_left_off and the pull honours it, but nobody could add to it.
--
--   license_roll_notes         a note a person here writes on a license on the roll. Kept by the license's number
--                              (source, class, number) and the person's name_key, not by the roll row's id: a row
--                              is taken off when a person moves out of our counties or is left off, and a new rank
--                              is a new row with a new number. A note outlives both, and the sheet finds it again
--                              by the number or by name and ZIP.
--   license_roll_left_off      gains shown_as (the name and license as the sheet showed them, so the way back can
--                              say who it is) and noted_by_name, and a DELETE policy: Put back is a delete of the
--                              row, and the person comes back on the next pull.
--   license_roll_leave_off()   the press. Writes the left-off row and takes the person's rows off the kept roll at
--                              once, by number and by name_key, as the next pull would. Their line of history goes
--                              with the rows. Our notes stay.
--
-- Who: the people who hold the Hiring switch, through user_can_read_license_roll(), as for every roll table. A note
-- is written as its author and only its author deletes it. Nobody edits one. Additive and idempotent.

-- ── Our notes ────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.license_roll_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('tsbpe', 'tdlr')),
  license_class text NOT NULL CHECK (length(btrim(license_class)) > 0),
  license_number text NOT NULL CHECK (length(btrim(license_number)) > 0),
  -- The roll row's name_key when the note was written: last name, first name, middle initial and ZIP.
  name_key text NOT NULL DEFAULT '',
  body text NOT NULL CHECK (length(btrim(body)) > 0 AND length(body) <= 2000),
  -- Who and when are the server's, whatever the client sent (license_roll_notes_stamp).
  noted_by uuid REFERENCES public.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  noted_by_name text NOT NULL DEFAULT '',
  noted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS license_roll_notes_number_idx ON public.license_roll_notes (source, license_number, noted_at DESC);
CREATE INDEX IF NOT EXISTS license_roll_notes_name_idx ON public.license_roll_notes (name_key) WHERE name_key <> '';
COMMENT ON TABLE public.license_roll_notes IS
  'State roll (punch list #411): a note a person here wrote on a license on the state''s roll. Kept by the license''s source, class and number and the name_key, not by license_roll.id, so it outlives the row being taken off and finds a new rank by name and ZIP. Read and written by the Hiring switch holders; the author alone deletes a note; nobody edits one.';

CREATE OR REPLACE FUNCTION public.license_roll_notes_stamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.noted_by := auth.uid();
  NEW.noted_at := now();
  NEW.noted_by_name := COALESCE((SELECT u.name FROM public.users u WHERE u.id = auth.uid()), '');
  NEW.body := btrim(NEW.body);
  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.license_roll_notes_stamp() IS
  'State roll (punch list #411): stamps a new note with its author, the author''s name and the time, whatever the client sent.';
REVOKE EXECUTE ON FUNCTION public.license_roll_notes_stamp() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS license_roll_notes_stamp ON public.license_roll_notes;
CREATE TRIGGER license_roll_notes_stamp
  BEFORE INSERT ON public.license_roll_notes
  FOR EACH ROW EXECUTE FUNCTION public.license_roll_notes_stamp();

ALTER TABLE public.license_roll_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS license_roll_notes_select ON public.license_roll_notes;
CREATE POLICY license_roll_notes_select ON public.license_roll_notes
  FOR SELECT TO authenticated
  USING ((SELECT public.user_can_read_license_roll()));
DROP POLICY IF EXISTS license_roll_notes_insert ON public.license_roll_notes;
CREATE POLICY license_roll_notes_insert ON public.license_roll_notes
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.user_can_read_license_roll()));
DROP POLICY IF EXISTS license_roll_notes_delete ON public.license_roll_notes;
CREATE POLICY license_roll_notes_delete ON public.license_roll_notes
  FOR DELETE TO authenticated
  USING (noted_by = (SELECT auth.uid()) AND (SELECT public.user_can_read_license_roll()));
REVOKE ALL ON TABLE public.license_roll_notes FROM anon;
REVOKE ALL ON TABLE public.license_roll_notes FROM authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.license_roll_notes TO authenticated;
GRANT ALL ON TABLE public.license_roll_notes TO service_role;

-- ── Left off: who it was, and the way back ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.license_roll_left_off ADD COLUMN IF NOT EXISTS shown_as text NOT NULL DEFAULT '';
ALTER TABLE public.license_roll_left_off ADD COLUMN IF NOT EXISTS noted_by_name text NOT NULL DEFAULT '';
COMMENT ON COLUMN public.license_roll_left_off.shown_as IS
  'The name and license as the sheet showed them when Leave off was pressed, so the way back can say who it is.';
COMMENT ON TABLE public.license_roll_left_off IS
  'State roll (punch list #411): a person who asked not to be listed, kept by license number and by name_key so a new rank does not bring them back. license-roll-pull keeps no row that matches one. Added by the Leave off press (license_roll_leave_off), taken back by Put back on the list (a delete), after which the next pull keeps the person again.';

DROP POLICY IF EXISTS license_roll_left_off_delete ON public.license_roll_left_off;
CREATE POLICY license_roll_left_off_delete ON public.license_roll_left_off
  FOR DELETE TO authenticated
  USING ((SELECT public.user_can_read_license_roll()));
GRANT DELETE ON TABLE public.license_roll_left_off TO authenticated;

-- ── Leave off ────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.license_roll_leave_off(p_roll_id uuid, p_note text DEFAULT '')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.license_roll%ROWTYPE;
  v_left uuid;
  v_taken integer;
  v_shown text;
BEGIN
  IF NOT public.user_can_read_license_roll() THEN
    RAISE EXCEPTION 'Only a person who holds the Hiring switch can leave someone off the state roll.' USING ERRCODE = '42501';
  END IF;
  -- A definer function runs past the row fences, so it holds them itself.
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot leave someone off the state roll.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot leave someone off the state roll.' USING ERRCODE = '42501';
  END IF;
  IF public.caller_is_archived() THEN
    RAISE EXCEPTION 'An archived account cannot leave someone off the state roll.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.license_roll r WHERE r.id = p_roll_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That license is no longer on the roll.' USING ERRCODE = 'P0002';
  END IF;
  -- Our own licenses stay: Our own checks them against the state, and the pull would take them off too.
  IF v_row.ours OR EXISTS (SELECT 1 FROM public.license_roll r WHERE r.name_key = v_row.name_key AND r.ours) THEN
    RAISE EXCEPTION 'This person holds one of our own licenses, so they stay on the roll for Our own.' USING ERRCODE = '22023';
  END IF;

  v_shown := btrim(concat_ws(' ', NULLIF(v_row.first_name, ''), NULLIF(v_row.middle_name, ''), NULLIF(v_row.last_name, ''), NULLIF(v_row.suffix, '')))
    || ', ' || replace(v_row.license_class, '_', ' ') || ' ' || v_row.license_number;

  SELECT l.id INTO v_left FROM public.license_roll_left_off l
    WHERE l.source = v_row.source AND l.license_number = v_row.license_number
    LIMIT 1;
  IF v_left IS NULL THEN
    INSERT INTO public.license_roll_left_off (source, license_class, license_number, name_key, note, shown_as, noted_by, noted_by_name)
    VALUES (v_row.source, v_row.license_class, v_row.license_number, v_row.name_key, btrim(COALESCE(p_note, '')), v_shown,
            auth.uid(), COALESCE((SELECT u.name FROM public.users u WHERE u.id = auth.uid()), ''))
    RETURNING id INTO v_left;
  END IF;

  -- As the next pull would: by number, and by name and ZIP. The rows' history goes with them.
  DELETE FROM public.license_roll r
    WHERE (r.license_number = v_row.license_number) OR (r.name_key = v_row.name_key);
  GET DIAGNOSTICS v_taken = ROW_COUNT;

  RETURN jsonb_build_object('left_off_id', v_left, 'taken_off', v_taken, 'shown_as', v_shown);
END;
$$;
COMMENT ON FUNCTION public.license_roll_leave_off(uuid, text) IS
  'State roll (punch list #411): Leave off. Writes the person''s license_roll_left_off row (number and name_key) and takes their rows off the kept roll at once, as the next pull would. Refuses a person who holds one of our own licenses. Put back is a delete of the left-off row.';
REVOKE EXECUTE ON FUNCTION public.license_roll_leave_off(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.license_roll_leave_off(uuid, text) TO authenticated, service_role;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
