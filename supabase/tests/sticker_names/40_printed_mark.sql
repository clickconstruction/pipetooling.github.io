-- Stickers: the printed mark (punch list #373, 20261117140000_sticker_printed.sql). Through RLS as signed-in people:
-- a new sticker has no mark; whoever reads a sticker writes its mark, a reserved one and one on a box alike, and the
-- time kept is the server's whatever was sent; the mark comes back off; no other column of a sticker takes an update;
-- a helper on the job's crew writes it and a helper on no job changes nothing; a training account changes nothing; a
-- sticker still moves through its events after the revoke; and a caller that is not a direct one keeps its own time.
-- Fixtures made as postgres; everything inside one transaction that rolls back. Raises on the first failed
-- assertion; ends with "sticker_names PASSED". See scripts/pgtest-sticker-names.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA spm;
CREATE FUNCTION spm.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION '% — got %, wanted %', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION spm.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF position(want IN SQLERRM) = 0 THEN RAISE EXCEPTION '% was refused for another reason: %', label, SQLERRM; END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
-- How many rows a statement changed, as the caller. A refusal reads as `refused`.
CREATE FUNCTION spm.changed(stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  BEGIN
    EXECUTE stmt;
    GET DIAGNOSTICS n = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    RETURN 'refused';
  END;
  RETURN n::text;
END $$;
CREATE FUNCTION spm.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- What the bed reads past RLS (as postgres).
CREATE FUNCTION spm.one(q text) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v text; BEGIN EXECUTE q INTO v; RETURN v; END $$;
GRANT USAGE ON SCHEMA spm TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA spm TO authenticated, service_role;

-- Who: a dev, a helper on job A's crew, a helper on no job, a training account. Where: job A with a live box G12,
-- and job B.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000733d1', 'dev@stickermark.test'),
  ('00000000-0000-0000-0000-0000000733d2', 'crew@stickermark.test'),
  ('00000000-0000-0000-0000-0000000733d3', 'other@stickermark.test'),
  ('00000000-0000-0000-0000-0000000733d4', 'trainee@stickermark.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000733d1', 'dev@stickermark.test', 'Mark Dev', 'dev', false, false),
  ('00000000-0000-0000-0000-0000000733d2', 'crew@stickermark.test', 'Mark Crew', 'helpers', false, false),
  ('00000000-0000-0000-0000-0000000733d3', 'other@stickermark.test', 'Mark Other', 'helpers', false, false),
  ('00000000-0000-0000-0000-0000000733d4', 'trainee@stickermark.test', 'Mark Trainee', 'dev', true, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;
INSERT INTO public.service_types (id, name, ledger_job_prefix) VALUES ('00000000-0000-0000-0000-0000000733f1', 'Sticker mark bed work', 'JM');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, hcp_number) VALUES
  ('00000000-0000-0000-0000-0000000733a1', '00000000-0000-0000-0000-0000000733d1', '00000000-0000-0000-0000-0000000733f1', 'Mark job A', '7331'),
  ('00000000-0000-0000-0000-0000000733a2', '00000000-0000-0000-0000-0000000733d1', '00000000-0000-0000-0000-0000000733f1', 'Mark job B', '7332');
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES
  ('00000000-0000-0000-0000-0000000733a1', '00000000-0000-0000-0000-0000000733d2');
INSERT INTO public.job_containers (id, job_id, label, kind) VALUES
  ('a7330c01-0000-0000-0000-0000000733c1', '00000000-0000-0000-0000-0000000733a1', 'G12', 'cage');

SELECT spm.as_user('00000000-0000-0000-0000-0000000733d1');
SET LOCAL ROLE authenticated;

-- The stickers: G78 to G80 on job A, and one on job B. G78 goes on the box G12, so one sticker is on a box.
SELECT public.mint_sticker_run('00000000-0000-0000-0000-0000000733a1', 3, 1, ARRAY['G78', 'G79', 'G80']);
SELECT public.mint_sticker_run('00000000-0000-0000-0000-0000000733a2', 1, 1, ARRAY['H1']);
SELECT public.place_sticker((SELECT id FROM public.box_stickers WHERE box_name = 'G78'), 'a7330c01-0000-0000-0000-0000000733c1');

-- ---------------------------------------------------------------------------------------------------------------
-- 1. A new sticker has no mark.
SELECT spm.same('a new sticker has no mark', (SELECT count(*)::text FROM public.box_stickers WHERE box_name IN ('G78', 'G79', 'G80', 'H1') AND printed_at IS NULL), '4');

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Whoever reads a sticker writes its mark: a reserved one and one on a box. The time kept is the server's.
SELECT spm.same('the office marks two stickers', spm.changed($q$UPDATE public.box_stickers SET printed_at = '2001-01-01T00:00:00Z' WHERE box_name IN ('G78', 'G79')$q$), '2');
SELECT spm.same('the sticker on a box took the server''s time', (SELECT (printed_at = now())::text FROM public.box_stickers WHERE box_name = 'G78'), 'true');
SELECT spm.same('the reserved sticker took the server''s time', (SELECT (printed_at = now())::text FROM public.box_stickers WHERE box_name = 'G79'), 'true');
SELECT spm.same('a sticker left out keeps no mark', (SELECT (printed_at IS NULL)::text FROM public.box_stickers WHERE box_name = 'G80'), 'true');

-- ---------------------------------------------------------------------------------------------------------------
-- 3. The mark comes back off.
SELECT spm.same('the mark comes off one sticker', spm.changed($q$UPDATE public.box_stickers SET printed_at = NULL WHERE box_name = 'G79'$q$), '1');
SELECT spm.same('the sticker reads unmarked again', (SELECT (printed_at IS NULL)::text FROM public.box_stickers WHERE box_name = 'G79'), 'true');

-- ---------------------------------------------------------------------------------------------------------------
-- 4. No other column of a sticker takes an update, with the mark or alone.
SELECT spm.refused('the box a sticker is on is not a client''s to write', $q$UPDATE public.box_stickers SET container_id = NULL WHERE box_name = 'G78'$q$, 'permission denied');
SELECT spm.refused('lost is not a client''s to write', $q$UPDATE public.box_stickers SET lost_at = now() WHERE box_name = 'G79'$q$, 'permission denied');
SELECT spm.refused('a sticker''s name is not a client''s to write', $q$UPDATE public.box_stickers SET box_name = 'Z9' WHERE box_name = 'G79'$q$, 'permission denied');
SELECT spm.refused('another column beside the mark is refused whole', $q$UPDATE public.box_stickers SET printed_at = now(), lost_at = now() WHERE box_name = 'G79'$q$, 'permission denied');
SELECT spm.refused('a sticker is not a client''s to delete', $q$DO $do$ BEGIN DELETE FROM public.box_stickers WHERE box_name = 'G79'; IF NOT FOUND THEN RAISE EXCEPTION 'no row deleted'; END IF; END $do$$q$, 'no row deleted');

-- ---------------------------------------------------------------------------------------------------------------
-- 5. A sticker still moves through its events: the definer trigger is not touched by the revoke.
SELECT spm.same('a reserved sticker still goes on a box', (SELECT public.place_sticker((SELECT id FROM public.box_stickers WHERE box_name = 'G80'), 'a7330c01-0000-0000-0000-0000000733c1') ->> 'ok'), 'true');
SELECT spm.same('the sticker is on the box', (SELECT container_id::text FROM public.box_stickers WHERE box_name = 'G80'), 'a7330c01-0000-0000-0000-0000000733c1');
INSERT INTO public.box_sticker_events (sticker_id, kind) SELECT id, 'taken_off' FROM public.box_stickers WHERE box_name = 'G80';
SELECT spm.same('and comes back off it', (SELECT (container_id IS NULL)::text FROM public.box_stickers WHERE box_name = 'G80'), 'true');
RESET ROLE;

-- ---------------------------------------------------------------------------------------------------------------
-- 6. Who. A helper on the job's crew reads its stickers and writes the mark. A helper on no job changes nothing.
SELECT spm.as_user('00000000-0000-0000-0000-0000000733d2');
SET LOCAL ROLE authenticated;
SELECT spm.same('a helper on the crew marks the job''s stickers', spm.changed($q$UPDATE public.box_stickers SET printed_at = now() WHERE box_name IN ('G79', 'G80', 'H1')$q$), '2');
SELECT spm.refused('and writes no other column', $q$UPDATE public.box_stickers SET lost_at = now() WHERE box_name = 'G79'$q$, 'permission denied');
RESET ROLE;
SELECT spm.same('the other job''s sticker was not theirs to mark', spm.one($q$SELECT (printed_at IS NULL)::text FROM public.box_stickers WHERE box_name = 'H1'$q$), 'true');
SELECT spm.as_user('00000000-0000-0000-0000-0000000733d3');
SET LOCAL ROLE authenticated;
SELECT spm.same('a helper on no job changes nothing', spm.changed($q$UPDATE public.box_stickers SET printed_at = NULL WHERE box_name IN ('G78', 'G79', 'G80', 'H1')$q$), '0');
RESET ROLE;
SELECT spm.same('every mark still stands', spm.one($q$SELECT count(*)::text FROM public.box_stickers WHERE box_name IN ('G78', 'G79', 'G80') AND printed_at IS NOT NULL$q$), '3');

-- ---------------------------------------------------------------------------------------------------------------
-- 7. A training account leaves no mark and takes none off.
SELECT spm.as_user('00000000-0000-0000-0000-0000000733d4');
SET LOCAL ROLE authenticated;
SELECT spm.same('a training account''s mark is refused', spm.changed($q$UPDATE public.box_stickers SET printed_at = now() WHERE box_name = 'H1'$q$), 'refused');
SELECT spm.same('a training account''s take-back is refused', spm.changed($q$UPDATE public.box_stickers SET printed_at = NULL WHERE box_name = 'G78'$q$), 'refused');
RESET ROLE;
SELECT spm.same('the training account changed nothing', spm.one($q$SELECT count(*)::text FROM public.box_stickers WHERE (box_name = 'H1' AND printed_at IS NULL) OR (box_name = 'G78' AND printed_at IS NOT NULL)$q$), '2');

-- ---------------------------------------------------------------------------------------------------------------
-- 8. A caller that is not a direct one keeps the time it writes: the stamp speaks to authenticated and anon alone.
--    The claims go back to the dev first, since the training block reads the claims whatever the database role.
SELECT spm.as_user('00000000-0000-0000-0000-0000000733d1');
UPDATE public.box_stickers SET printed_at = '2001-01-01T00:00:00Z' WHERE box_name = 'H1';
SELECT spm.same('the owner''s own time is kept', (SELECT to_char(printed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') FROM public.box_stickers WHERE box_name = 'H1'), '2001-01-01');

SELECT 'sticker_names PASSED' AS result;
ROLLBACK;
