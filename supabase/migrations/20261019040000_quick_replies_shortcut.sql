SET lock_timeout = '3s';

-- Quick replies by keyboard, C: a one-word shortcut per line (punch list #126; docs/migrations/20261019040000_quick_replies_shortcut.md).
--
-- The reply box's / list (v2.5637) narrows the person's quick replies by the words typed after the /. A line may now
-- carry one short word of its own, so /bill then Enter lands on one line: the list puts an exact shortcut first, then
-- the shortcuts that start with the words, then the lines whose words hold them. The kernel is
-- src/lib/quickReplies/slash.ts (shortcutWord, slashLines). No new table, so the three fence appliers are not re-run;
-- the new function says who may in its body, through quick_reply_caller.
--
--   1. quick_replies.shortcut: lowercase letters, digits and dashes, 24 at most, starting with a letter or a digit.
--      Null: none. One live team line a word (a partial unique index), and one of a person's own lines a word among
--      theirs. A removed line keeps its word in the row, and frees it.
--   2. quick_reply_versions: the kinds gain shortcut, the word before and after in from_text and to_text, as es keeps
--      the Spanish, either side null for none.
--   3. set_quick_reply_shortcut(p_id, p_shortcut): sets or clears (null or blank) a line's word, a leading / and the
--      case forgiven; refuses a word another line holds (a team line's, or for a line of one's own, one's own other
--      lines'); one version; returns 1, or 0 when nothing changed. The quick replies' own refusals.
--   4. restore_quick_reply: a line brought back whose word another live line took meanwhile comes back without it,
--      with a shortcut version, rather than failing on the unique index.

-- ---------- 1. The word ----------

ALTER TABLE public.quick_replies
  ADD COLUMN IF NOT EXISTS shortcut text
    CONSTRAINT quick_replies_shortcut_word CHECK (shortcut ~ '^[a-z0-9][a-z0-9-]{0,23}$');

COMMENT ON COLUMN public.quick_replies.shortcut IS
  'Quick replies by keyboard (punch list #126): the line''s one-word shortcut for the reply box''s / list, lowercase letters, digits and dashes, 24 at most. Null: none. One live team line a word; a person''s own lines one each among theirs. Changed through set_quick_reply_shortcut, with a shortcut version.';

CREATE UNIQUE INDEX IF NOT EXISTS quick_replies_shortcut_team_one
  ON public.quick_replies (shortcut)
  WHERE shortcut IS NOT NULL AND removed_at IS NULL AND scope = 'team';

CREATE UNIQUE INDEX IF NOT EXISTS quick_replies_shortcut_mine_one
  ON public.quick_replies (added_by, shortcut)
  WHERE shortcut IS NOT NULL AND removed_at IS NULL AND scope = 'mine';

-- ---------- 2. The versions: shortcut ----------

ALTER TABLE public.quick_reply_versions DROP CONSTRAINT IF EXISTS quick_reply_versions_kind_known;
ALTER TABLE public.quick_reply_versions ADD CONSTRAINT quick_reply_versions_kind_known
  CHECK (kind IN ('added', 'words', 'tags', 'removed', 'restored', 'es', 'phone', 'shortcut'));

ALTER TABLE public.quick_reply_versions DROP CONSTRAINT IF EXISTS quick_reply_versions_kept;
ALTER TABLE public.quick_reply_versions ADD CONSTRAINT quick_reply_versions_kept CHECK (
  (kind = 'phone' OR (from_phone_order IS NULL AND to_phone_order IS NULL)) AND CASE kind
  WHEN 'added' THEN to_text IS NOT NULL AND to_for_kind IS NOT NULL
    AND from_text IS NULL AND from_for_kind IS NULL AND from_step_key IS NULL
  WHEN 'words' THEN from_text IS NOT NULL AND to_text IS NOT NULL
    AND from_for_kind IS NULL AND from_step_key IS NULL AND to_for_kind IS NULL AND to_step_key IS NULL
  WHEN 'tags' THEN from_for_kind IS NOT NULL AND to_for_kind IS NOT NULL AND from_text IS NULL AND to_text IS NULL
  WHEN 'es' THEN (from_text IS NOT NULL OR to_text IS NOT NULL) AND from_text IS DISTINCT FROM to_text
    AND from_for_kind IS NULL AND from_step_key IS NULL AND to_for_kind IS NULL AND to_step_key IS NULL
  WHEN 'shortcut' THEN (from_text IS NOT NULL OR to_text IS NOT NULL) AND from_text IS DISTINCT FROM to_text
    AND from_for_kind IS NULL AND from_step_key IS NULL AND to_for_kind IS NULL AND to_step_key IS NULL
  ELSE from_text IS NULL AND to_text IS NULL AND from_for_kind IS NULL AND from_step_key IS NULL
    AND to_for_kind IS NULL AND to_step_key IS NULL
END);

COMMENT ON TABLE public.quick_reply_versions IS
  'Messages (cut 3, R3, #126): every change to a quick reply, with who and when: added (the words and tags it started with), words (the text before and after), tags (who it is for and its step, before and after), es (the Spanish before and after), phone (its place on the tech''s phone before and after when the place changed, null for off the phone; neither when only the name changed), shortcut (the / word before and after, null for none), removed, restored. Ordered by id. Written only by the quick reply functions.';

-- ---------- 3. The office sets a line's word ----------

CREATE OR REPLACE FUNCTION public.set_quick_reply_shortcut(p_id uuid, p_shortcut text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := public.quick_reply_caller('change a quick reply');
  v public.quick_replies%ROWTYPE;
  v_word text := nullif(lower(ltrim(btrim(coalesce(p_shortcut, '')), '/')), '');
BEGIN
  IF v_word IS NOT NULL AND v_word !~ '^[a-z0-9][a-z0-9-]{0,23}$' THEN
    RAISE EXCEPTION 'A shortcut is one word of letters, numbers or dashes, 24 at most.' USING ERRCODE = 'P0001';
  END IF;
  SELECT q.* INTO v FROM public.quick_replies q
  WHERE q.id = p_id AND (q.scope = 'team' OR q.added_by = v_me)
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That line is not there.' USING ERRCODE = 'P0001';
  END IF;
  IF v.removed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Bring the line back before you change it.' USING ERRCODE = 'P0001';
  END IF;
  IF v_word IS NOT DISTINCT FROM v.shortcut THEN
    RETURN 0;
  END IF;
  -- A team line's word is the team's; a line of one's own also keeps clear of one's own other lines.
  IF v_word IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.quick_replies q
    WHERE q.id <> p_id AND q.removed_at IS NULL AND q.shortcut = v_word
      AND (q.scope = 'team' OR (v.scope = 'mine' AND q.scope = 'mine' AND q.added_by = v_me))
  ) THEN
    RAISE EXCEPTION '/% is another line''s shortcut.', v_word USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.quick_replies SET shortcut = v_word WHERE id = p_id;
  INSERT INTO public.quick_reply_versions (quick_reply_id, kind, from_text, to_text, by_user_id)
  VALUES (p_id, 'shortcut', v.shortcut, v_word, v_me);
  RETURN 1;
END;
$$;

COMMENT ON FUNCTION public.set_quick_reply_shortcut(uuid, text) IS
  'Quick replies by keyboard (punch list #126): sets a line''s one-word shortcut for the / list, or clears it (null or blank); a leading / and the case are forgiven. Refuses a word another live team line holds, or, for a line of one''s own, one of one''s own other lines. One shortcut version; returns 1, or 0 when nothing changed. The quick replies'' own refusals: signed out, a training account, a twin, off the office team.';

REVOKE ALL ON FUNCTION public.set_quick_reply_shortcut(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_quick_reply_shortcut(uuid, text) TO authenticated;

-- ---------- 4. A line brought back leaves a taken word behind ----------

CREATE OR REPLACE FUNCTION public.restore_quick_reply(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := public.quick_reply_caller('bring back a quick reply');
  v public.quick_replies%ROWTYPE;
BEGIN
  SELECT q.* INTO v FROM public.quick_replies q
  WHERE q.id = p_id AND (q.scope = 'team' OR q.added_by = v_me)
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That line is not there.' USING ERRCODE = 'P0001';
  END IF;
  IF v.removed_at IS NULL THEN
    RAISE EXCEPTION 'That line is on the list already.' USING ERRCODE = 'P0001';
  END IF;
  -- Its word went to another live line while it was away: it comes back without it, and the history says so.
  IF v.shortcut IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.quick_replies q
    WHERE q.id <> p_id AND q.removed_at IS NULL AND q.shortcut = v.shortcut
      AND ((v.scope = 'team' AND q.scope = 'team') OR (v.scope = 'mine' AND q.scope = 'mine' AND q.added_by = v.added_by))
  ) THEN
    UPDATE public.quick_replies SET shortcut = NULL WHERE id = p_id;
    INSERT INTO public.quick_reply_versions (quick_reply_id, kind, from_text, to_text, by_user_id)
    VALUES (p_id, 'shortcut', v.shortcut, NULL, v_me);
  END IF;
  UPDATE public.quick_replies SET removed_at = NULL WHERE id = p_id;
  INSERT INTO public.quick_reply_versions (quick_reply_id, kind, by_user_id) VALUES (p_id, 'restored', v_me);
END;
$$;

COMMENT ON FUNCTION public.restore_quick_reply(uuid) IS
  'Messages (cut 3): brings a removed line back to the list, with a restored version. Since #126 a line whose shortcut another live line took while it was away comes back without it, with a shortcut version first.';

REVOKE ALL ON FUNCTION public.restore_quick_reply(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_quick_reply(uuid) TO authenticated;
