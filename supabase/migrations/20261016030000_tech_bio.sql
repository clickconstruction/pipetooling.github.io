SET lock_timeout = '3s';

-- v2.5587 — The tech's bio, the ground (punch list #114; docs/migrations/20261016030000_tech_bio.md).
--
-- The office writes a short bio for each tech, like the resume handed over with a plumber: a few lines in the
-- company's words about the tech, with Spanish beside each. The first time a tech presses On my way to a customer who
-- has never had it, the bio follows the On my way text as a second text (the send is PR 3's, in quo-send's tech
-- path); every later On my way is the line alone. Four pieces, each idempotent:
--
--   1. user_bio_lines: the lines, one row each, in the office's order; removed_at retires one; off_by_user_at is the
--      tech's own veto (a line turned off leaves the bio by default). Read by the office team and by the tech for
--      their own; every write goes through the two functions below, so the table takes no insert, update or delete
--      from authenticated.
--   2. messages.introduces_user_id: the thread's memory — a line that carried a tech's bio names the tech, so the phone
--      and the server ask the same question, "has this customer had Luis's bio?", before offering or sending one.
--   3. edit_bio_line: the office adds, changes, moves or removes a line, refused in the quick replies' own words
--      (quick_reply_caller: signed out, a training account, a twin, off the office team), and refused when the whole
--      bio would pass 320 characters in either language (two text segments; the opener "A little about Luis: " counts).
--   4. bio_line_say: the tech turns one of their own lines off or on.
--
-- A table is created, so the three fence appliers run at the end: the read-only write blocks, the statement
-- trigger, and the digital-twin fence.

-- ---------- 1. The lines ----------

CREATE TABLE IF NOT EXISTS public.user_bio_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  text text NOT NULL,
  text_es text,
  position integer NOT NULL DEFAULT 1,
  added_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  removed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  off_by_user_at timestamptz
);

COMMENT ON TABLE public.user_bio_lines IS
  'The tech''s bio (v2.5587, punch list #114): the office''s lines about a tech, in the company''s words, joined in order into the bio a customer gets with the tech''s first On my way. removed_at retires a line; off_by_user_at is the tech''s own veto.';
COMMENT ON COLUMN public.user_bio_lines.text IS 'One sentence as a customer reads it: "Luis has been a plumber for twelve years."';
COMMENT ON COLUMN public.user_bio_lines.text_es IS 'The same in Spanish, or null while nobody wrote it; a Spanish-reading customer never gets a line without it.';
COMMENT ON COLUMN public.user_bio_lines.position IS 'The line''s place in the bio, 1 first.';
COMMENT ON COLUMN public.user_bio_lines.off_by_user_at IS 'When the tech turned this line off in Settings → Your account → Your bio; null while they say it.';

CREATE INDEX IF NOT EXISTS user_bio_lines_live ON public.user_bio_lines (user_id, position) WHERE removed_at IS NULL;

ALTER TABLE public.user_bio_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_bio_lines_select ON public.user_bio_lines;
CREATE POLICY user_bio_lines_select ON public.user_bio_lines
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.gc_office_team());

GRANT SELECT ON TABLE public.user_bio_lines TO authenticated;
GRANT ALL ON TABLE public.user_bio_lines TO service_role;

-- ---------- 2. The thread's memory ----------

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS introduces_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.messages.introduces_user_id IS
  'The tech''s bio (v2.5587): the tech this line introduced, set on the bio text that followed their first On my way to this contact. Null on every other line. The phone and quo-send read it to send a bio once per tech per customer.';

CREATE INDEX IF NOT EXISTS messages_introduces_user ON public.messages (contact_id, introduces_user_id) WHERE introduces_user_id IS NOT NULL;

-- ---------- 3. The bio's opener and the office's write ----------

-- "A little about Luis: " / "Un poco sobre Luis: ", from the first word of the person's name. The same rule as the
-- client's kernel (src/lib/bio/bio.ts), so the desk's count and this function's cap agree.
CREATE OR REPLACE FUNCTION public.bio_opener(p_user_id uuid, p_lang text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN p_lang = 'es' THEN 'Un poco sobre ' ELSE 'A little about ' END
         || coalesce(nullif(split_part(btrim(u.name), ' ', 1), ''), 'me') || ': '
  FROM public.users u WHERE u.id = p_user_id
$$;

COMMENT ON FUNCTION public.bio_opener(uuid, text) IS
  'The tech''s bio (v2.5587): the words the bio opens with, "A little about Luis: " or "Un poco sobre Luis: ", from the first word of the person''s name.';

REVOKE ALL ON FUNCTION public.bio_opener(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bio_opener(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.edit_bio_line(
  p_user_id uuid,
  p_id uuid,
  p_text text,
  p_text_es text,
  p_position integer DEFAULT NULL,
  p_remove boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := public.quick_reply_caller('change a tech''s bio');
  v_text text := nullif(btrim(coalesce(p_text, '')), '');
  v_es text := nullif(btrim(coalesce(p_text_es, '')), '');
  v_id uuid := p_id;
  v_row public.user_bio_lines%ROWTYPE;
  v_place integer;
  v_whole_en text;
  v_whole_es text;
  v_len integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = p_user_id AND u.is_sample = false AND u.is_digital_twin = false) THEN
    RAISE EXCEPTION 'That person has no account here.' USING ERRCODE = 'P0001';
  END IF;
  IF v_id IS NOT NULL THEN
    SELECT l.* INTO v_row FROM public.user_bio_lines l WHERE l.id = v_id FOR UPDATE;
    IF NOT FOUND OR v_row.user_id <> p_user_id THEN
      RAISE EXCEPTION 'That line is not there.' USING ERRCODE = 'P0001';
    END IF;
    IF v_row.removed_at IS NOT NULL THEN
      RAISE EXCEPTION 'That line was removed.' USING ERRCODE = 'P0001';
    END IF;
    IF coalesce(p_remove, false) THEN
      UPDATE public.user_bio_lines SET removed_at = now(), removed_by = v_me WHERE id = v_id;
      RETURN v_id;
    END IF;
  ELSIF coalesce(p_remove, false) THEN
    RAISE EXCEPTION 'That line is not there.' USING ERRCODE = 'P0001';
  END IF;
  IF v_text IS NULL THEN
    RAISE EXCEPTION 'Write the line first.' USING ERRCODE = 'P0001';
  END IF;
  IF v_text ~ E'[\r\n]' OR coalesce(v_es, '') ~ E'[\r\n]' THEN
    RAISE EXCEPTION 'A line is one line.' USING ERRCODE = 'P0001';
  END IF;

  -- The whole bio with this line's new words must fit 320 characters in each language. The office's count holds every
  -- live line, whichever the tech turns off, since the tech may turn them back on.
  SELECT string_agg(CASE WHEN l.id = v_id THEN v_text ELSE l.text END, ' ' ORDER BY l.position, l.added_at, l.id),
         string_agg(CASE WHEN l.id = v_id THEN v_es ELSE l.text_es END, ' ' ORDER BY l.position, l.added_at, l.id)
    INTO v_whole_en, v_whole_es
    FROM public.user_bio_lines l
   WHERE l.user_id = p_user_id AND l.removed_at IS NULL;
  IF v_id IS NULL THEN
    v_whole_en := concat_ws(' ', v_whole_en, v_text);
    v_whole_es := concat_ws(' ', v_whole_es, v_es);
  END IF;
  v_len := length(public.bio_opener(p_user_id, 'en') || coalesce(v_whole_en, ''));
  IF v_len > 320 THEN
    RAISE EXCEPTION 'The bio would run % characters. 320 is the most.', v_len USING ERRCODE = 'P0001';
  END IF;
  IF nullif(v_whole_es, '') IS NOT NULL THEN
    v_len := length(public.bio_opener(p_user_id, 'es') || v_whole_es);
    IF v_len > 320 THEN
      RAISE EXCEPTION 'The Spanish bio would run % characters. 320 is the most.', v_len USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF v_id IS NULL THEN
    SELECT coalesce(max(l.position), 0) + 1 INTO v_place FROM public.user_bio_lines l WHERE l.user_id = p_user_id AND l.removed_at IS NULL;
    INSERT INTO public.user_bio_lines (user_id, text, text_es, position, added_by)
    VALUES (p_user_id, v_text, v_es, coalesce(p_position, v_place), v_me)
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.user_bio_lines
       SET text = v_text, text_es = v_es, position = coalesce(p_position, position)
     WHERE id = v_id;
  END IF;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.edit_bio_line(uuid, uuid, text, text, integer, boolean) IS
  'The tech''s bio (v2.5587): the office adds a line (p_id null), changes its words, Spanish or place, or removes it (p_remove). Refused in the quick replies'' own words (signed out, a training account, a twin, off the office team), for a person with no real account, an empty line, a removed line, and a bio that would pass 320 characters in either language. Returns the line''s id.';

REVOKE ALL ON FUNCTION public.edit_bio_line(uuid, uuid, text, text, integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.edit_bio_line(uuid, uuid, text, text, integer, boolean) TO authenticated;

-- ---------- 4. The tech's own veto ----------

CREATE OR REPLACE FUNCTION public.bio_line_say(p_id uuid, p_say boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.user_bio_lines%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to change your bio.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot change a bio.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot change a bio.' USING ERRCODE = '42501';
  END IF;
  SELECT l.* INTO v_row FROM public.user_bio_lines l WHERE l.id = p_id FOR UPDATE;
  IF NOT FOUND OR v_row.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'That line is not yours.' USING ERRCODE = '42501';
  END IF;
  IF v_row.removed_at IS NOT NULL THEN
    RAISE EXCEPTION 'That line was removed.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.user_bio_lines
     SET off_by_user_at = CASE WHEN coalesce(p_say, true) THEN NULL ELSE coalesce(off_by_user_at, now()) END
   WHERE id = p_id;
END;
$$;

COMMENT ON FUNCTION public.bio_line_say(uuid, boolean) IS
  'The tech''s bio (v2.5587): the tech turns one of their own lines on (p_say true) or off. Refused signed out, for a training account, a twin, a line that is not theirs, and a removed line.';

REVOKE ALL ON FUNCTION public.bio_line_say(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bio_line_say(uuid, boolean) TO authenticated;

-- ---------- The fences, for the new table ----------

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
