SET lock_timeout = '3s';

-- Messages, cut 3: quick replies, the lines typed every day (to-dos/gc-mode/messages/BUILD_PLAN.md on branch
-- spike/gc-mode, "Cut 3 · Replying"). The kernel is src/lib/quickReplies/kernel.ts, whose types these columns hold.
--
--   * quick_replies: a line's words, who it is for (for_kind: trade, customer, arch or any), the flow step it belongs
--     to (step_key), the team's or one person's own (scope), who added it and when, and when it was removed. A removed
--     line stays, for its history and the Removed tab.
--   * quick_reply_versions: every change, with who and when: added, words, tags, removed, restored.
--   * quick_reply_uses: each press, by whom and in whose thread. A press fills the box; nothing sends.
--   * users.title: the title under a person's name in an email's signature (src/lib/messages/compose.ts).
--
-- The office team's (gc_office_team()); a line marked mine is its owner's alone. The three tables are read only for
-- authenticated: add_quick_reply, edit_quick_reply, remove_quick_reply, restore_quick_reply and press_quick_reply make
-- every change and write its version, so the history holds every change with who and when. Each refuses, in words,
-- someone signed out, a training account, a digital twin and anyone off the office team. contacts_fold_quick_replies
-- keeps a press's thread through the spine's fold, and quick_replies_seed adds the prototype's team lines once.

-- ---------- 1. The title under a signature ----------

-- Null: no title, and the signature is the name alone. Prod grants UPDATE on users column by column, so the title is
-- granted on its own; the own-profile policy then keeps it to each person's own row, as a dev sets anyone's.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS title text
  CONSTRAINT users_title_short CHECK (char_length(title) <= 80);
GRANT UPDATE (title) ON public.users TO authenticated;

COMMENT ON COLUMN public.users.title IS
  'Messages (cut 3): the title under the person''s name in an email''s signature ("Rosa · Office manager"). Null: none. 80 characters at most.';

-- ---------- 2. The lines ----------

CREATE TABLE IF NOT EXISTS public.quick_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text text NOT NULL
    CONSTRAINT quick_replies_text_said CHECK (btrim(text) <> '' AND char_length(text) <= 1000),
  -- Who it is for: trade partners, customers, architects, or anyone (an unknown number reads these).
  for_kind text NOT NULL
    CONSTRAINT quick_replies_for_known CHECK (for_kind IN ('trade', 'customer', 'arch', 'any')),
  -- The flow step it belongs to, by the step's id in its kind's flow (flow_steps.step_key); null for none. A plain id
  -- with no foreign key: the flows are a sibling cut's, a step the flow no longer has reads as no step, and a line for
  -- anyone has none.
  step_key text
    CONSTRAINT quick_replies_step_shape CHECK (step_key ~ '^[a-z][a-z0-9_]{0,39}$'),
  -- The team's lines are the whole office's; a line marked mine is on its owner's strip only.
  scope text NOT NULL DEFAULT 'team'
    CONSTRAINT quick_replies_scope_known CHECK (scope IN ('team', 'mine')),
  -- Who added it, and so whose own it is when it is mine. Null: the app's, from the seed.
  added_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  added_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  -- Off the strip and the list, still in the history; the Removed tab brings it back.
  removed_at timestamptz,
  CONSTRAINT quick_replies_any_has_no_step CHECK (for_kind <> 'any' OR step_key IS NULL)
);

CREATE INDEX IF NOT EXISTS quick_replies_added_by_idx ON public.quick_replies (added_by);

COMMENT ON TABLE public.quick_replies IS
  'Messages (cut 3): a quick reply, a line the office types every day: its words, who it is for (trade, customer, arch or any), its flow step (step_key, no foreign key), the team''s or its owner''s alone (scope mine), who added it and when, and when it was removed. The office team''s; read only, changed through add_quick_reply, edit_quick_reply, remove_quick_reply and restore_quick_reply.';

-- ---------- 3. Every change, with who and when ----------

CREATE TABLE IF NOT EXISTS public.quick_reply_versions (
  -- An identity, so the words and the tags saved together read back in the order they were written.
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  quick_reply_id uuid NOT NULL REFERENCES public.quick_replies(id) ON DELETE CASCADE,
  kind text NOT NULL
    CONSTRAINT quick_reply_versions_kind_known CHECK (kind IN ('added', 'words', 'tags', 'removed', 'restored')),
  -- The words before and after; added keeps the words it started with.
  from_text text,
  to_text text,
  -- The tags before and after, as ids, so a renamed step reads by its name today; added keeps the tags it started with.
  from_for_kind text
    CONSTRAINT quick_reply_versions_from_for_known CHECK (from_for_kind IN ('trade', 'customer', 'arch', 'any')),
  from_step_key text,
  to_for_kind text
    CONSTRAINT quick_reply_versions_to_for_known CHECK (to_for_kind IN ('trade', 'customer', 'arch', 'any')),
  to_step_key text,
  -- Who. Null: the app's, from the seed, or a person since deleted.
  by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  at timestamptz NOT NULL DEFAULT clock_timestamp(),
  -- What each kind keeps: added, the words and tags it started with; words, the text before and after; tags, who it
  -- is for and its step before and after; removed and restored, only who and when.
  CONSTRAINT quick_reply_versions_kept CHECK (CASE kind
    WHEN 'added' THEN to_text IS NOT NULL AND to_for_kind IS NOT NULL
      AND from_text IS NULL AND from_for_kind IS NULL AND from_step_key IS NULL
    WHEN 'words' THEN from_text IS NOT NULL AND to_text IS NOT NULL
      AND from_for_kind IS NULL AND from_step_key IS NULL AND to_for_kind IS NULL AND to_step_key IS NULL
    WHEN 'tags' THEN from_for_kind IS NOT NULL AND to_for_kind IS NOT NULL AND from_text IS NULL AND to_text IS NULL
    ELSE from_text IS NULL AND to_text IS NULL AND from_for_kind IS NULL AND from_step_key IS NULL
      AND to_for_kind IS NULL AND to_step_key IS NULL
  END)
);

CREATE INDEX IF NOT EXISTS quick_reply_versions_line_idx ON public.quick_reply_versions (quick_reply_id, id);

COMMENT ON TABLE public.quick_reply_versions IS
  'Messages (cut 3): every change to a quick reply, with who and when: added (the words and tags it started with), words (the text before and after), tags (who it is for and its step, before and after), removed, restored. Ordered by id. Written only by the quick reply functions.';

-- ---------- 4. Each press ----------

CREATE TABLE IF NOT EXISTS public.quick_reply_uses (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  quick_reply_id uuid NOT NULL REFERENCES public.quick_replies(id) ON DELETE CASCADE,
  -- Who pressed it. Null: a person since deleted, whose presses still count for the team.
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  -- Whose thread it was pressed in; null outside one. A fold moves it with the person.
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS quick_reply_uses_line_idx ON public.quick_reply_uses (quick_reply_id, user_id);
CREATE INDEX IF NOT EXISTS quick_reply_uses_contact_idx ON public.quick_reply_uses (contact_id) WHERE contact_id IS NOT NULL;

COMMENT ON TABLE public.quick_reply_uses IS
  'Messages (cut 3): each press on a quick reply, by whom and in whose thread. A press fills the box; nothing sends. The strip counts them per person, so the lines a person uses most come first. Written only by press_quick_reply.';

-- ---------- 5. The office team's, a line marked mine its owner's ----------

ALTER TABLE public.quick_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_reply_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_reply_uses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS quick_replies_team ON public.quick_replies;
CREATE POLICY quick_replies_team ON public.quick_replies FOR SELECT TO authenticated
  USING ((SELECT public.gc_office_team()) AND (scope = 'team' OR added_by = (SELECT auth.uid())));
DROP POLICY IF EXISTS quick_reply_versions_team ON public.quick_reply_versions;
CREATE POLICY quick_reply_versions_team ON public.quick_reply_versions FOR SELECT TO authenticated
  USING ((SELECT public.gc_office_team()) AND EXISTS (
    SELECT 1 FROM public.quick_replies q
    WHERE q.id = quick_reply_versions.quick_reply_id AND (q.scope = 'team' OR q.added_by = (SELECT auth.uid()))));
DROP POLICY IF EXISTS quick_reply_uses_team ON public.quick_reply_uses;
CREATE POLICY quick_reply_uses_team ON public.quick_reply_uses FOR SELECT TO authenticated
  USING ((SELECT public.gc_office_team()) AND EXISTS (
    SELECT 1 FROM public.quick_replies q
    WHERE q.id = quick_reply_uses.quick_reply_id AND (q.scope = 'team' OR q.added_by = (SELECT auth.uid()))));

-- Read only: every change goes through the functions below, which write its version.
REVOKE ALL ON TABLE public.quick_replies, public.quick_reply_versions, public.quick_reply_uses FROM anon, authenticated;
GRANT SELECT ON TABLE public.quick_replies, public.quick_reply_versions, public.quick_reply_uses TO authenticated;

-- ---------- 6. Who may, and the tags ----------

-- The four refusals every change below starts with, in words; p_what finishes "Sign in to ...". Returns who asks.
CREATE OR REPLACE FUNCTION public.quick_reply_caller(p_what text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to %.', p_what USING ERRCODE = 'P0001';
  END IF;
  -- The functions below are definers, past the tables' read-only blocks and the twin fence, so each is said here.
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot %.', p_what USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot %.', p_what USING ERRCODE = '42501';
  END IF;
  IF NOT public.gc_office_team() THEN
    RAISE EXCEPTION 'Only the office can %.', p_what USING ERRCODE = '42501';
  END IF;
  RETURN auth.uid();
END;
$$;

-- Who a line is for and its step, tidied as the kernel's tidyTags does: a line for anyone has no step, and a blank
-- step is none.
CREATE OR REPLACE FUNCTION public.quick_reply_step(p_for text, p_step text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_step text := nullif(btrim(coalesce(p_step, '')), '');
BEGIN
  IF p_for IS NULL OR p_for NOT IN ('trade', 'customer', 'arch', 'any') THEN
    RAISE EXCEPTION 'Say who the line is for: trade partners, customers, architects or anyone.' USING ERRCODE = 'P0001';
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

-- ---------- 7. Add, change, remove, bring back, press ----------

-- Add a line, for the team or just for me, with its first version (the kernel's addQuickReply). Returns its id.
CREATE OR REPLACE FUNCTION public.add_quick_reply(p_text text, p_for text, p_step text DEFAULT NULL, p_mine boolean DEFAULT false)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := public.quick_reply_caller('add a quick reply');
  v_text text := btrim(coalesce(p_text, ''));
  v_step text;
  v_id uuid;
BEGIN
  IF v_text = '' THEN
    RAISE EXCEPTION 'Write the line first.' USING ERRCODE = 'P0001';
  END IF;
  IF char_length(v_text) > 1000 THEN
    RAISE EXCEPTION 'A quick reply holds 1,000 characters at most.' USING ERRCODE = 'P0001';
  END IF;
  v_step := public.quick_reply_step(p_for, p_step);
  INSERT INTO public.quick_replies (text, for_kind, step_key, scope, added_by)
  VALUES (v_text, p_for, v_step, CASE WHEN p_mine THEN 'mine' ELSE 'team' END, v_me)
  RETURNING id INTO v_id;
  INSERT INTO public.quick_reply_versions (quick_reply_id, kind, to_text, to_for_kind, to_step_key, by_user_id)
  VALUES (v_id, 'added', v_text, p_for, v_step, v_me);
  RETURN v_id;
END;
$$;

-- Save a line from the editor (the kernel's editQuickReply): a version for the words and one for the tags, each only
-- when it changed, the words first. Nothing changed is refused. A removed line comes back before it changes. Returns
-- how many versions it wrote.
CREATE OR REPLACE FUNCTION public.edit_quick_reply(p_id uuid, p_text text, p_for text, p_step text DEFAULT NULL)
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
  IF v_wrote = 0 THEN
    RAISE EXCEPTION 'Nothing changed.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.quick_replies SET text = v_text, for_kind = p_for, step_key = v_step WHERE id = p_id;
  RETURN v_wrote;
END;
$$;

-- Remove a line (the kernel's removeQuickReply): off the strip and the list, still in the history.
CREATE OR REPLACE FUNCTION public.remove_quick_reply(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := public.quick_reply_caller('remove a quick reply');
  v_removed timestamptz;
BEGIN
  SELECT q.removed_at INTO v_removed FROM public.quick_replies q
  WHERE q.id = p_id AND (q.scope = 'team' OR q.added_by = v_me)
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That line is not there.' USING ERRCODE = 'P0001';
  END IF;
  IF v_removed IS NOT NULL THEN
    RAISE EXCEPTION 'That line is removed already.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.quick_replies SET removed_at = clock_timestamp() WHERE id = p_id;
  INSERT INTO public.quick_reply_versions (quick_reply_id, kind, by_user_id) VALUES (p_id, 'removed', v_me);
END;
$$;

-- Bring a removed line back (the kernel's restoreQuickReply).
CREATE OR REPLACE FUNCTION public.restore_quick_reply(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := public.quick_reply_caller('bring back a quick reply');
  v_removed timestamptz;
BEGIN
  SELECT q.removed_at INTO v_removed FROM public.quick_replies q
  WHERE q.id = p_id AND (q.scope = 'team' OR q.added_by = v_me)
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That line is not there.' USING ERRCODE = 'P0001';
  END IF;
  IF v_removed IS NULL THEN
    RAISE EXCEPTION 'That line is on the list already.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.quick_replies SET removed_at = NULL WHERE id = p_id;
  INSERT INTO public.quick_reply_versions (quick_reply_id, kind, by_user_id) VALUES (p_id, 'restored', v_me);
END;
$$;

-- A press on a line (the kernel's pressQuickReply): it fills the box and counts, so the lines a person uses most come
-- first on their strip. Nothing sends. p_contact_id is the thread it was pressed in, or null.
CREATE OR REPLACE FUNCTION public.press_quick_reply(p_id uuid, p_contact_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := public.quick_reply_caller('use a quick reply');
  v_removed timestamptz;
BEGIN
  SELECT q.removed_at INTO v_removed FROM public.quick_replies q
  WHERE q.id = p_id AND (q.scope = 'team' OR q.added_by = v_me);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That line is not there.' USING ERRCODE = 'P0001';
  END IF;
  IF v_removed IS NOT NULL THEN
    RAISE EXCEPTION 'That line was removed. The Removed tab brings it back.' USING ERRCODE = 'P0001';
  END IF;
  IF p_contact_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = p_contact_id) THEN
    RAISE EXCEPTION 'That person is not there.' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.quick_reply_uses (quick_reply_id, user_id, contact_id) VALUES (p_id, v_me, p_contact_id);
END;
$$;

-- ---------- 8. A fold keeps the thread a line was pressed in ----------

-- The spine's contacts_fold runs every contacts_fold_<something>(p_from, p_into) after it moves the lines, numbers and
-- jobs, and before p_from goes; without this, p_from's delete would leave its presses in no one's thread. A definer,
-- since the presses are read only. Outside a trigger, a call from someone signed in who is not on the office team, or
-- is a twin, moves nothing, as the fold's own statements move nothing for them.
CREATE OR REPLACE FUNCTION public.contacts_fold_quick_replies(p_from uuid, p_into uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_from IS NULL OR p_into IS NULL OR p_from = p_into THEN
    RETURN;
  END IF;
  IF auth.uid() IS NOT NULL AND pg_trigger_depth() = 0 AND (NOT public.gc_office_team() OR public.is_digital_twin()) THEN
    RETURN;
  END IF;
  UPDATE public.quick_reply_uses SET contact_id = p_into WHERE contact_id = p_from;
END;
$$;

-- ---------- 9. The prototype's lines, once ----------

-- The Messages prototype's team lines (v1.178) that read for any job, in its order, as the app's (added_by null). Its
-- three that name a demo job's details are left out, and so are the three its viewer keeps as their own: a person's
-- own lines are theirs to add. A line whose words a line already has, or started with, is skipped, so a second run
-- adds nothing and a line the team removed or reworded stays as they left it. Returns how many it added. The
-- database's own: the migration runs it once.
CREATE OR REPLACE FUNCTION public.quick_replies_seed()
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  r record;
  v_id uuid;
  v_added integer := 0;
BEGIN
  FOR r IN
    SELECT s.words, s.for_kind, s.step_key
    FROM (VALUES
      (1, 'Your quote is in your portal now, thank you.', 'trade', 'ask'),
      (2, 'Did the invite come through?', 'trade', 'invited'),
      (3, 'Checking on the number. Still good for today?', 'trade', 'ask'),
      (5, 'Thanks, we will call you back within the hour.', 'any', NULL),
      (6, 'The plans are in your portal; questions close Monday.', 'trade', 'invited'),
      (7, 'We received it, thank you. We will be in touch after we compare.', 'trade', 'ask'),
      (8, 'The site is open from 7. Check in with the super when you arrive.', 'trade', NULL),
      (9, 'Your pay application is sent; the architect has it.', 'customer', 'payapp'),
      (13, 'Send the W-9 when you can; the insurance certificate too.', 'trade', 'papers'),
      (14, 'Got it, thank you.', 'any', NULL),
      (15, 'The change order is in your portal to sign.', 'customer', 'co'),
      (16, 'We will have the start date to you by Friday.', 'customer', 'start'),
      (18, 'The submittal is back to you with comments.', 'arch', 'submittals')
    ) AS s(n, words, for_kind, step_key)
    ORDER BY s.n
  LOOP
    CONTINUE WHEN EXISTS (SELECT 1 FROM public.quick_replies q WHERE q.text = r.words)
      OR EXISTS (SELECT 1 FROM public.quick_reply_versions v WHERE v.kind = 'added' AND v.to_text = r.words);
    INSERT INTO public.quick_replies (text, for_kind, step_key, scope)
    VALUES (r.words, r.for_kind, r.step_key, 'team')
    RETURNING id INTO v_id;
    INSERT INTO public.quick_reply_versions (quick_reply_id, kind, to_text, to_for_kind, to_step_key)
    VALUES (v_id, 'added', r.words, r.for_kind, r.step_key);
    v_added := v_added + 1;
  END LOOP;
  RETURN v_added;
END;
$$;

-- ---------- 10. What each function says, and who may call it ----------

COMMENT ON FUNCTION public.quick_reply_caller(text) IS
  'Messages (cut 3): the refusals every quick reply change starts with, in words: signed out, a training account, a digital twin, off the office team. Returns who asks. The functions'' own.';
COMMENT ON FUNCTION public.quick_reply_step(text, text) IS
  'Messages (cut 3): who a quick reply is for and its step, tidied as the kernel''s tidyTags does: a line for anyone has no step. Refuses an unknown kind and a step id of the wrong shape. The functions'' own.';
COMMENT ON FUNCTION public.add_quick_reply(text, text, text, boolean) IS
  'Messages (cut 3): adds a quick reply for the team, or for the caller alone, with its added version. The office team''s; a definer, since the tables are read only. Returns its id.';
COMMENT ON FUNCTION public.edit_quick_reply(uuid, text, text, text) IS
  'Messages (cut 3): saves a quick reply''s words and tags, a version for each that changed (the words first). Refuses nothing changed, a blank line, a removed line and another person''s own line. Returns how many versions it wrote.';
COMMENT ON FUNCTION public.remove_quick_reply(uuid) IS
  'Messages (cut 3): takes a quick reply off the strip and the list, with a removed version; it stays in the history.';
COMMENT ON FUNCTION public.restore_quick_reply(uuid) IS
  'Messages (cut 3): brings a removed quick reply back, with a restored version.';
COMMENT ON FUNCTION public.press_quick_reply(uuid, uuid) IS
  'Messages (cut 3): counts a press on a quick reply, by the caller, in a contact''s thread or none. A press fills the box; nothing sends.';
COMMENT ON FUNCTION public.contacts_fold_quick_replies(uuid, uuid) IS
  'Messages (cut 3): the spine''s contacts_fold runs it, so a folded contact''s presses move to the contact it folds into. A definer, since the presses are read only. Outside a trigger, a call from someone signed in off the office team, or a twin, moves nothing.';
COMMENT ON FUNCTION public.quick_replies_seed() IS
  'Messages (cut 3): adds the Messages prototype''s thirteen team lines that read for any job, once, as the app''s. Skips a line whose words a line has or started with, so a second run adds nothing. Returns how many it added. The database''s own.';

-- The changes, to the signed in; each says who may in its body.
REVOKE ALL ON FUNCTION public.add_quick_reply(text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_quick_reply(text, text, text, boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.edit_quick_reply(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.edit_quick_reply(uuid, text, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.remove_quick_reply(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_quick_reply(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.restore_quick_reply(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_quick_reply(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.press_quick_reply(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.press_quick_reply(uuid, uuid) TO authenticated;
-- The fold's, as the spine's fold calls it as whoever folds.
REVOKE ALL ON FUNCTION public.contacts_fold_quick_replies(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contacts_fold_quick_replies(uuid, uuid) TO authenticated, service_role;
-- The functions' own helpers and the seed are the database's.
REVOKE ALL ON FUNCTION public.quick_reply_caller(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quick_reply_step(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.quick_replies_seed() FROM PUBLIC, anon, authenticated;

-- ---------- The fences on the new tables ----------

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();

-- The team's lines, once.
SELECT public.quick_replies_seed();
