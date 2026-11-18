-- Tell the dev (migrations *_help_feedback_page_notes and *_read_only_may_tell_the_dev, punch list #380): a note to
-- the dev from any page, kept in help_feedback, and a training account allowed to send one. What a note needs, who
-- may write and read one, what a training account may and may not do, and that the fence's sweep leaves the table's
-- row guard alone. Fixtures are written as postgres; presses run as each user; everything rolls back. Raises on the
-- first failed assertion; ends with "tell_the_dev PASSED". See scripts/pgtest-tell-the-dev.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Dana is the office. Tara is in training. Devon is a dev and Marcus the owner. Tess is a digital twin.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000003800a1', 'dana@tellthedev.test'),
  ('00000000-0000-0000-0000-0000003800a2', 'tara@tellthedev.test'),
  ('00000000-0000-0000-0000-0000003800a3', 'devon@tellthedev.test'),
  ('00000000-0000-0000-0000-0000003800a4', 'marcus@tellthedev.test'),
  ('00000000-0000-0000-0000-0000003800a5', 'tess@tellthedev.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, is_sample, archived_at, login_attached_at) VALUES
  ('00000000-0000-0000-0000-0000003800a1', 'dana@tellthedev.test', 'Dana Office', 'assistant', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003800a2', 'tara@tellthedev.test', 'Tara Training', 'estimator', true, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003800a3', 'devon@tellthedev.test', 'Devon Dev', 'dev', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003800a4', 'marcus@tellthedev.test', 'Marcus Master', 'master_technician', false, false, false, NULL, now()),
  ('00000000-0000-0000-0000-0000003800a5', 'tess@tellthedev.test', 'Tess Twin', 'estimator', false, true, false, NULL, now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, is_sample = EXCLUDED.is_sample, archived_at = EXCLUDED.archived_at,
    login_attached_at = EXCLUDED.login_attached_at;

CREATE SCHEMA ttd;
CREATE FUNCTION ttd.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION ttd.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF position(want IN SQLERRM) = 0 THEN RAISE EXCEPTION E'% was refused for another reason.\n--- got ---\n%\n--- want it to hold ---\n%', label, SQLERRM, want; END IF;
    RAISE NOTICE 'ok: % (%)', label, SQLERRM;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION ttd.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- Two definer functions, as an RPC a later feature might add: a row guard has to stop these too, which row
-- security alone does not.
CREATE FUNCTION ttd.definer_update() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.help_feedback SET body = 'changed through a definer' WHERE from_user_id = auth.uid() $$;
CREATE FUNCTION ttd.definer_delete() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.help_feedback WHERE from_user_id = auth.uid() $$;
CREATE FUNCTION ttd.definer_insert_closed() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.help_feedback (from_user_id, kind, body, page_key, status, closed_note) VALUES (auth.uid(), 'want', 'I want it', 'jobs', 'closed', 'answered by myself') $$;
GRANT USAGE ON SCHEMA ttd TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ttd TO authenticated;

-- 1 · What a note needs. Dana, an ordinary account.
SELECT ttd.as_user('00000000-0000-0000-0000-0000003800a1');
SET LOCAL ROLE authenticated;
INSERT INTO public.help_feedback (id, from_user_id, kind, body, page_key, page_path, context)
  VALUES ('00000000-0000-0000-0000-0000003800b1', auth.uid(), 'want', 'I want a search box', 'jobs:stages', '/jobs?tab=stages', '{"v":1,"page_label":"Jobs · Stages"}');
SELECT ttd.same('a note from a page lands with its page', (SELECT kind || ' ' || page_key || ' ' || page_path || ' ' || (context->>'page_label') || ' ' || status FROM public.help_feedback WHERE id = '00000000-0000-0000-0000-0000003800b1'), 'want jobs:stages /jobs?tab=stages Jobs · Stages open');
INSERT INTO public.help_feedback (id, from_user_id, kind, body, page_key) VALUES ('00000000-0000-0000-0000-0000003800b2', auth.uid(), 'confusing', '', 'bids:pricing');
INSERT INTO public.help_feedback (id, from_user_id, kind, body, page_key) VALUES ('00000000-0000-0000-0000-0000003800b3', auth.uid(), 'broken', '', 'dashboard');
SELECT ttd.same('confusing and went wrong land with no words', (SELECT count(*)::text FROM public.help_feedback WHERE id IN ('00000000-0000-0000-0000-0000003800b2', '00000000-0000-0000-0000-0000003800b3') AND body = ''), '2');
SELECT ttd.refused('I want with no words', $q$INSERT INTO public.help_feedback (from_user_id, kind, body, page_key) VALUES (auth.uid(), 'want', '   ', 'jobs')$q$, 'help_feedback_body_words');
SELECT ttd.refused('a page note with no page', $q$INSERT INTO public.help_feedback (from_user_id, kind, body) VALUES (auth.uid(), 'broken', '')$q$, 'help_feedback_where_check');
SELECT ttd.refused('a kind that is not one', $q$INSERT INTO public.help_feedback (from_user_id, kind, body, page_key) VALUES (auth.uid(), 'rant', 'x', 'jobs')$q$, 'help_feedback_kind_check');
SELECT ttd.refused('a note over 2000 characters', $q$INSERT INTO public.help_feedback (from_user_id, kind, body, page_key) VALUES (auth.uid(), 'want', repeat('x', 2001), 'jobs')$q$, 'help_feedback_body_len');
SELECT ttd.refused('an address over 600 characters', $q$INSERT INTO public.help_feedback (from_user_id, kind, body, page_key, page_path) VALUES (auth.uid(), 'want', 'x', 'jobs', '/' || repeat('a', 600))$q$, 'help_feedback_page_size');

-- 2 · The guides' box, as it wrote before this card.
INSERT INTO public.help_feedback (id, from_user_id, guide_slug, body) VALUES ('00000000-0000-0000-0000-0000003800b4', auth.uid(), 'task-mode', 'Step two is out of date.');
SELECT ttd.same('a guide note still lands, and is kind guide', (SELECT kind || ' ' || guide_slug FROM public.help_feedback WHERE id = '00000000-0000-0000-0000-0000003800b4'), 'guide task-mode');
SELECT ttd.refused('a guide note with no guide', $q$INSERT INTO public.help_feedback (from_user_id, body) VALUES (auth.uid(), 'words')$q$, 'help_feedback_where_check');
SELECT ttd.refused('a guide note with no words', $q$INSERT INTO public.help_feedback (from_user_id, guide_slug, body) VALUES (auth.uid(), 'task-mode', '')$q$, 'help_feedback_body_words');

-- 3 · Nobody writes a note as someone else, or changes one.
SELECT ttd.refused('a note written as the dev', $q$INSERT INTO public.help_feedback (from_user_id, kind, body, page_key) VALUES ('00000000-0000-0000-0000-0000003800a3', 'want', 'x', 'jobs')$q$, 'row-level security');
UPDATE public.help_feedback SET body = 'rewritten' WHERE id = '00000000-0000-0000-0000-0000003800b1';
SELECT ttd.same('the sender cannot rewrite a sent note', (SELECT body FROM public.help_feedback WHERE id = '00000000-0000-0000-0000-0000003800b1'), 'I want a search box');
SELECT ttd.same('a sender reads their own notes', (SELECT count(*)::text FROM public.help_feedback), '4');
RESET ROLE;

-- 4 · Tara, in training: her own open note, and nothing else.
SELECT ttd.as_user('00000000-0000-0000-0000-0000003800a2');
SET LOCAL ROLE authenticated;
INSERT INTO public.help_feedback (id, from_user_id, kind, body, page_key) VALUES ('00000000-0000-0000-0000-0000003800c1', auth.uid(), 'confusing', 'This page is confusing because I am new', 'bids:pricing');
SELECT ttd.same('a training account sends its own note', (SELECT count(*)::text FROM public.help_feedback), '1');
-- The row guard runs before row security, so its words are the ones a training account meets.
SELECT ttd.refused('a training account writing as someone else', $q$INSERT INTO public.help_feedback (from_user_id, kind, body, page_key) VALUES ('00000000-0000-0000-0000-0000003800a1', 'want', 'x', 'jobs')$q$, 'Read-only (training) mode');
SELECT ttd.refused('a training account writing a note already answered', $q$INSERT INTO public.help_feedback (from_user_id, kind, body, page_key, status, closed_note) VALUES (auth.uid(), 'want', 'x', 'jobs', 'closed', 'answered by myself')$q$, 'Read-only (training) mode');
SELECT ttd.refused('the same through a definer function', $q$SELECT ttd.definer_insert_closed()$q$, 'Read-only (training) mode');
SELECT ttd.refused('a training account changing a note through a definer function', $q$SELECT ttd.definer_update()$q$, 'Read-only (training) mode');
SELECT ttd.refused('a training account deleting a note through a definer function', $q$SELECT ttd.definer_delete()$q$, 'Read-only (training) mode');
UPDATE public.help_feedback SET body = 'rewritten' WHERE id = '00000000-0000-0000-0000-0000003800c1';
DELETE FROM public.help_feedback WHERE id = '00000000-0000-0000-0000-0000003800c1';
SELECT ttd.same('her note is as she sent it', (SELECT body FROM public.help_feedback WHERE id = '00000000-0000-0000-0000-0000003800c1'), 'This page is confusing because I am new');
-- Every other table is as closed to her as before: the guides' box is the one door.
SELECT ttd.refused('a training account writing anywhere else', $q$INSERT INTO public.ui_nav_clicks (user_id, role, control, target) VALUES (auth.uid(), 'estimator', 'x', '/x')$q$, 'Read-only (training) mode');
RESET ROLE;

-- 5 · A digital twin may still send one, as before this card.
SELECT ttd.as_user('00000000-0000-0000-0000-0000003800a5');
SET LOCAL ROLE authenticated;
INSERT INTO public.help_feedback (from_user_id, kind, body, page_key) VALUES (auth.uid(), 'broken', 'Something went wrong when I priced a fixture', 'bids:pricing');
SELECT ttd.same('a twin sends a note', (SELECT count(*)::text FROM public.help_feedback), '1');
RESET ROLE;

-- 6 · The dev and the owner read every note, and one answers the training account's.
SELECT ttd.as_user('00000000-0000-0000-0000-0000003800a4');
SET LOCAL ROLE authenticated;
SELECT ttd.same('the owner reads every note', (SELECT count(*)::text FROM public.help_feedback WHERE from_user_id::text LIKE '00000000-0000-0000-0000-0000003800a%'), '6');
RESET ROLE;
SELECT ttd.as_user('00000000-0000-0000-0000-0000003800a3');
SET LOCAL ROLE authenticated;
UPDATE public.help_feedback SET status = 'closed', closed_at = now(), closed_by_user_id = auth.uid(), closed_note = 'On the list. Thank you.' WHERE id = '00000000-0000-0000-0000-0000003800c1';
SELECT ttd.same('a dev answers a training account''s note', (SELECT status || ': ' || closed_note FROM public.help_feedback WHERE id = '00000000-0000-0000-0000-0000003800c1'), 'closed: On the list. Thank you.');
RESET ROLE;
SELECT ttd.as_user('00000000-0000-0000-0000-0000003800a2');
SET LOCAL ROLE authenticated;
SELECT ttd.same('and she reads the answer', (SELECT closed_note FROM public.help_feedback WHERE id = '00000000-0000-0000-0000-0000003800c1'), 'On the list. Thank you.');
RESET ROLE;

-- 7 · The fence's sweep, as every CREATE TABLE migration ends with it, leaves the row guard in place.
SELECT ttd.same('the table carries the row guard and no statement trigger', (SELECT string_agg(tgname, ', ' ORDER BY tgname) FROM pg_trigger WHERE tgrelid = 'public.help_feedback'::regclass AND NOT tgisinternal AND tgname LIKE 'read_only_block%'), 'read_only_block_row');
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT ttd.same('after the sweep, still', (SELECT string_agg(tgname, ', ' ORDER BY tgname) FROM pg_trigger WHERE tgrelid = 'public.help_feedback'::regclass AND NOT tgisinternal AND tgname LIKE 'read_only_block%'), 'read_only_block_row');
SELECT ttd.same('the insert policy keeps its own-note escape', (SELECT (with_check LIKE '%from_user_id%')::text FROM pg_policies WHERE schemaname = 'public' AND tablename = 'help_feedback' AND policyname = 'read_only_users_cannot_insert'), 'true');
SELECT ttd.same('every other table kept its statement trigger', (SELECT count(*)::text FROM pg_trigger WHERE tgrelid = 'public.ui_nav_clicks'::regclass AND tgname = 'read_only_block_stmt'), '1');

DO $$ BEGIN RAISE NOTICE 'tell_the_dev PASSED'; END $$;
ROLLBACK;
