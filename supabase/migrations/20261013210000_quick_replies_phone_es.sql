SET lock_timeout = '3s';

-- Messages, residential R3 (quick replies, the four additions; to-dos/gc-mode/messages/RESIDENTIAL_BUILD_PLAN.md on
-- branch spike/gc-mode, "R3" and section 3's data row): a quick reply gains its Spanish words and its place on the
-- tech's phone, and a sent text remembers the line it came from. The kernels are src/lib/quickReplies/phone.ts
-- (PhoneLine: phoneOrder, phoneName, textEs) and blanks.ts. No new table, so no fences.
--
--   * quick_replies.text_es: the line in Spanish, read by a contact whose language is Spanish (R8 · 16). Null: none,
--     and the English goes.
--   * quick_replies.phone_order: the line's place on the tech's phone, 1 first. Null: not on the phone. No unique index:
--     the Phone tab's kernel (phoneLines) breaks a tie by the line's id, and a removed line keeping its number must not
--     block another, nor a swap of two fail half way.
--   * quick_replies.phone_name: the button's name on the phone. Null: the kernel's shortName reads it from the words.
--   * quick_reply_versions: the kinds gain es (the Spanish before and after, in from_text and to_text, either side
--     null when there was none or it was cleared) and phone (a change to the phone's place or name). A phone row keeps
--     the place before and after in from_phone_order and to_phone_order when the place changed, null for off the phone,
--     so the history tells put on, taken off and moved apart; a change to the name alone keeps neither. The history
--     still holds every change.
--   * Who a line is for widens to the seven kinds of contact (R0, #5565's QR_KINDS): leads, subs, supply houses and
--     candidates join trade partners, customers, architects and anyone, on the line, on its versions and in
--     quick_reply_step.
--   * messages.quick_reply_id: the quick reply a sent text came from. quo-send fills it later; null on everything else.
--     The spine's table-wide SELECT already reads it; nobody signed in writes it.
--   * edit_quick_reply gains three trailing parameters that keep by default, so one Save stays atomic and the
--     four-argument calls already written still resolve: p_text_es (null keeps, blank clears), p_phone_order (null
--     keeps, 0 takes the line off the phone) and p_phone_name (null keeps, blank clears). Only the team's lines for
--     customers go on the phone, as the Phone tab reads them.

-- ---------- 1. The Spanish and the phone ----------

ALTER TABLE public.quick_replies
  ADD COLUMN IF NOT EXISTS text_es text
    CONSTRAINT quick_replies_text_es_said CHECK (btrim(text_es) <> '' AND char_length(text_es) <= 1000);
ALTER TABLE public.quick_replies
  ADD COLUMN IF NOT EXISTS phone_order integer
    CONSTRAINT quick_replies_phone_order_counts CHECK (phone_order > 0);
ALTER TABLE public.quick_replies
  ADD COLUMN IF NOT EXISTS phone_name text
    CONSTRAINT quick_replies_phone_name_said CHECK (btrim(phone_name) <> '' AND char_length(phone_name) <= 60);

COMMENT ON COLUMN public.quick_replies.text_es IS
  'Messages (R3): the line in Spanish, for a contact whose language is Spanish. Null: none, and the English goes. Changed through edit_quick_reply, with an es version.';
COMMENT ON COLUMN public.quick_replies.phone_order IS
  'Messages (R3): the line''s place on the tech''s phone, 1 first. Null: not on the phone. Only the team''s lines for customers. No unique index: the kernel (phoneLines) breaks a tie by id. Changed through edit_quick_reply, with a phone version.';
COMMENT ON COLUMN public.quick_replies.phone_name IS
  'Messages (R3): the button''s name on the tech''s phone, 60 characters at most. Null: the kernel (shortName) reads it from the words.';

-- ---------- 2. The versions: es and phone ----------

-- A phone row's place before and after, when the place changed. Null: off the phone, or only the name changed.
ALTER TABLE public.quick_reply_versions
  ADD COLUMN IF NOT EXISTS from_phone_order integer
    CONSTRAINT quick_reply_versions_from_phone_order_counts CHECK (from_phone_order > 0);
ALTER TABLE public.quick_reply_versions
  ADD COLUMN IF NOT EXISTS to_phone_order integer
    CONSTRAINT quick_reply_versions_to_phone_order_counts CHECK (to_phone_order > 0);

ALTER TABLE public.quick_reply_versions DROP CONSTRAINT IF EXISTS quick_reply_versions_kind_known;
ALTER TABLE public.quick_reply_versions ADD CONSTRAINT quick_reply_versions_kind_known
  CHECK (kind IN ('added', 'words', 'tags', 'removed', 'restored', 'es', 'phone'));

-- What each kind keeps: es, the Spanish before and after (one side may be none); phone, the place before and after
-- and nothing else; removed and restored, only who and when. Only a phone row holds a place.
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
  ELSE from_text IS NULL AND to_text IS NULL AND from_for_kind IS NULL AND from_step_key IS NULL
    AND to_for_kind IS NULL AND to_step_key IS NULL
END);

COMMENT ON TABLE public.quick_reply_versions IS
  'Messages (cut 3, R3): every change to a quick reply, with who and when: added (the words and tags it started with), words (the text before and after), tags (who it is for and its step, before and after), es (the Spanish before and after), phone (its place on the tech''s phone before and after when the place changed, null for off the phone; neither when only the name changed), removed, restored. Ordered by id. Written only by the quick reply functions.';

-- ---------- 3. Who a line is for: the seven kinds ----------

ALTER TABLE public.quick_replies DROP CONSTRAINT IF EXISTS quick_replies_for_known;
ALTER TABLE public.quick_replies ADD CONSTRAINT quick_replies_for_known
  CHECK (for_kind IN ('trade', 'customer', 'arch', 'lead', 'sub', 'supply_house', 'candidate', 'any'));
ALTER TABLE public.quick_reply_versions DROP CONSTRAINT IF EXISTS quick_reply_versions_from_for_known;
ALTER TABLE public.quick_reply_versions ADD CONSTRAINT quick_reply_versions_from_for_known
  CHECK (from_for_kind IN ('trade', 'customer', 'arch', 'lead', 'sub', 'supply_house', 'candidate', 'any'));
ALTER TABLE public.quick_reply_versions DROP CONSTRAINT IF EXISTS quick_reply_versions_to_for_known;
ALTER TABLE public.quick_reply_versions ADD CONSTRAINT quick_reply_versions_to_for_known
  CHECK (to_for_kind IN ('trade', 'customer', 'arch', 'lead', 'sub', 'supply_house', 'candidate', 'any'));

-- Who a line is for and its step, tidied as the kernel's tidyTags does: a line for anyone has no step, and a blank
-- step is none. The seven kinds, as QR_KINDS names them.
CREATE OR REPLACE FUNCTION public.quick_reply_step(p_for text, p_step text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_step text := nullif(btrim(coalesce(p_step, '')), '');
BEGIN
  IF p_for IS NULL OR p_for NOT IN ('trade', 'customer', 'arch', 'lead', 'sub', 'supply_house', 'candidate', 'any') THEN
    RAISE EXCEPTION 'Say who the line is for: trade partners, customers, architects, leads, subs, supply houses, candidates or anyone.'
      USING ERRCODE = 'P0001';
  END IF;
  IF p_for = 'any' THEN
    RETURN NULL;
  END IF;
  IF v_step !~ '^[a-z][a-z0-9_]{0,39}$' THEN
    RAISE EXCEPTION 'Pick the step from the flow.' USING ERRCODE = 'P0001';
  END IF;
  RETURN v_step;
END;
$$;

REVOKE ALL ON FUNCTION public.quick_reply_step(text, text) FROM PUBLIC, anon, authenticated;

-- ---------- 4. The line a sent text came from ----------

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS quick_reply_id uuid REFERENCES public.quick_replies(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS messages_quick_reply_idx ON public.messages (quick_reply_id) WHERE quick_reply_id IS NOT NULL;

COMMENT ON COLUMN public.messages.quick_reply_id IS
  'Messages (R3): the quick reply a sent text came from; quo-send fills it. Null on everything else, and when the line is deleted.';

-- ---------- 5. One Save, the Spanish and the phone with it ----------

DROP FUNCTION IF EXISTS public.edit_quick_reply(uuid, text, text, text);

-- Save a line from the editor (the kernel's editQuickReply): a version for each part that changed, in the order words,
-- tags, es, phone. Nothing changed is refused. A removed line comes back before it changes. The three trailing
-- parameters keep by default: p_text_es null keeps and blank clears, p_phone_order null keeps and 0 takes the line off
-- the phone, p_phone_name null keeps and blank clears. Returns how many versions it wrote.
CREATE OR REPLACE FUNCTION public.edit_quick_reply(
  p_id uuid,
  p_text text,
  p_for text,
  p_step text DEFAULT NULL,
  p_text_es text DEFAULT NULL,
  p_phone_order integer DEFAULT NULL,
  p_phone_name text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := public.quick_reply_caller('change a quick reply');
  v public.quick_replies%ROWTYPE;
  v_text text := btrim(coalesce(p_text, ''));
  v_step text;
  v_es text;
  v_order integer;
  v_name text;
  v_wrote integer := 0;
BEGIN
  SELECT q.* INTO v FROM public.quick_replies q
  WHERE q.id = p_id AND (q.scope = 'team' OR q.added_by = v_me)
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That line is not there.' USING ERRCODE = 'P0001';
  END IF;
  IF v.removed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Bring the line back before you change it.' USING ERRCODE = 'P0001';
  END IF;
  IF v_text = '' THEN
    RAISE EXCEPTION 'Write something, or Cancel.' USING ERRCODE = 'P0001';
  END IF;
  IF char_length(v_text) > 1000 THEN
    RAISE EXCEPTION 'A quick reply holds 1,000 characters at most.' USING ERRCODE = 'P0001';
  END IF;
  v_step := public.quick_reply_step(p_for, p_step);

  v_es := CASE WHEN p_text_es IS NULL THEN v.text_es ELSE nullif(btrim(p_text_es), '') END;
  IF char_length(v_es) > 1000 THEN
    RAISE EXCEPTION 'A quick reply holds 1,000 characters at most.' USING ERRCODE = 'P0001';
  END IF;
  IF p_phone_order < 0 THEN
    RAISE EXCEPTION 'Put the line on the phone at 1 or later, or 0 to take it off.' USING ERRCODE = 'P0001';
  END IF;
  v_order := CASE WHEN p_phone_order IS NULL THEN v.phone_order ELSE nullif(p_phone_order, 0) END;
  v_name := CASE WHEN p_phone_name IS NULL THEN v.phone_name ELSE nullif(btrim(p_phone_name), '') END;
  IF char_length(v_name) > 60 THEN
    RAISE EXCEPTION 'A name on the phone holds 60 characters at most.' USING ERRCODE = 'P0001';
  END IF;
  -- The Phone tab reads the team's lines for customers; a line kept for one person never reaches every tech's phone.
  IF v_order IS NOT NULL AND (v.scope <> 'team' OR p_for <> 'customer') THEN
    RAISE EXCEPTION 'Only the team''s lines for customers go on the phone.' USING ERRCODE = 'P0001';
  END IF;

  IF v_text <> v.text THEN
    INSERT INTO public.quick_reply_versions (quick_reply_id, kind, from_text, to_text, by_user_id)
    VALUES (p_id, 'words', v.text, v_text, v_me);
    v_wrote := v_wrote + 1;
  END IF;
  IF p_for <> v.for_kind OR v_step IS DISTINCT FROM v.step_key THEN
    INSERT INTO public.quick_reply_versions (quick_reply_id, kind, from_for_kind, from_step_key, to_for_kind, to_step_key, by_user_id)
    VALUES (p_id, 'tags', v.for_kind, v.step_key, p_for, v_step, v_me);
    v_wrote := v_wrote + 1;
  END IF;
  IF v_es IS DISTINCT FROM v.text_es THEN
    INSERT INTO public.quick_reply_versions (quick_reply_id, kind, from_text, to_text, by_user_id)
    VALUES (p_id, 'es', v.text_es, v_es, v_me);
    v_wrote := v_wrote + 1;
  END IF;
  -- The place before and after only when the place changed, so the history tells put on, taken off and moved apart.
  IF v_order IS DISTINCT FROM v.phone_order THEN
    INSERT INTO public.quick_reply_versions (quick_reply_id, kind, from_phone_order, to_phone_order, by_user_id)
    VALUES (p_id, 'phone', v.phone_order, v_order, v_me);
    v_wrote := v_wrote + 1;
  ELSIF v_name IS DISTINCT FROM v.phone_name THEN
    INSERT INTO public.quick_reply_versions (quick_reply_id, kind, by_user_id) VALUES (p_id, 'phone', v_me);
    v_wrote := v_wrote + 1;
  END IF;
  IF v_wrote = 0 THEN
    RAISE EXCEPTION 'Nothing changed.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.quick_replies
  SET text = v_text, for_kind = p_for, step_key = v_step, text_es = v_es, phone_order = v_order, phone_name = v_name
  WHERE id = p_id;
  RETURN v_wrote;
END;
$$;

COMMENT ON FUNCTION public.edit_quick_reply(uuid, text, text, text, text, integer, text) IS
  'Messages (cut 3, R3): the editor''s Save. A version for each part that changed (words, tags, es, phone); refuses Nothing changed, a blank save, a removed line, another person''s own line, and the phone on a line that is not the team''s for customers. The three trailing parameters keep by default: p_text_es and p_phone_name null keep and blank clear; p_phone_order null keeps and 0 takes the line off the phone.';

REVOKE ALL ON FUNCTION public.edit_quick_reply(uuid, text, text, text, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.edit_quick_reply(uuid, text, text, text, text, integer, text) TO authenticated;
