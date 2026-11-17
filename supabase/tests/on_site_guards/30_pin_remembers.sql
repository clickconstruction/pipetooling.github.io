-- Materials on site: a box's pin remembers who set it, when and how sure the phone was (punch list #372, step 1).
-- Here, each through RLS as a signed-in helper on the job's team unless it says otherwise: a pin from a client that
-- does not know the new columns is stamped with the caller, the server's time and no margin; a pin from one that does
-- keeps its own earlier time and its margin, and the name it claims is replaced with the caller's; a time ahead of
-- the server's becomes the server's; a pin's facts cannot be changed without the pin, and an edit to the box leaves
-- them alone; an older client moving the pin clears the margin an earlier pin left; a teammate moving it becomes its
-- who; taking the pin off clears all four; a new box takes the same rules; a dev's own label is kept; and the service
-- role's write is kept as sent. Fixtures made as postgres; everything runs inside one transaction that rolls back.
-- Raises on the first failed assertion; ends with "on_site_guards PASSED". See scripts/pgtest-on-site-guards.sh.
-- Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA osp;
CREATE FUNCTION osp.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION '% — got %, wanted %', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- Sign in as someone (the claims auth.uid() and auth.role() read).
CREATE FUNCTION osp.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- Nobody signed in: what the service role's own writes look like.
CREATE FUNCTION osp.as_nobody() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
END $$;
-- What the bed reads past RLS (as postgres).
CREATE FUNCTION osp.one(q text) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v text; BEGIN EXECUTE q INTO v; RETURN v; END $$;
-- A box's pin facts on one line: who, the name, how long ago in minutes (ahead reads negative), the margin.
CREATE FUNCTION osp.pin(p_box uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(right(pinned_by::text, 2), 'nobody') || ' · ' || COALESCE(pinned_by_name, 'no name') || ' · '
      || COALESCE(round(extract(epoch FROM now() - pinned_at) / 60)::int::text || ' min ago', 'no day') || ' · '
      || COALESCE(pin_accuracy_m::text || ' m', 'no margin')
    FROM public.job_containers WHERE id = p_box
$$;
GRANT USAGE ON SCHEMA osp TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA osp TO authenticated, service_role;

-- Who: a dev, a helper on the job's crew, a second helper on the same crew.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000372d1', 'dev@pin.test'),
  ('00000000-0000-0000-0000-0000000372d2', 'helper@pin.test'),
  ('00000000-0000-0000-0000-0000000372d3', 'other@pin.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000372d1', 'dev@pin.test', 'Pin Dev', 'dev'),
  ('00000000-0000-0000-0000-0000000372d2', 'helper@pin.test', 'Pin Helper', 'helpers'),
  ('00000000-0000-0000-0000-0000000372d3', 'other@pin.test', 'Pin Other', 'helpers')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;

INSERT INTO public.service_types (id, name, ledger_job_prefix) VALUES ('00000000-0000-0000-0000-0000000372f1', 'Pin bed work', 'JQ');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, hcp_number) VALUES
  ('00000000-0000-0000-0000-0000000372a1', '00000000-0000-0000-0000-0000000372d1', '00000000-0000-0000-0000-0000000372f1', 'Pin job', '3721');
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES
  ('00000000-0000-0000-0000-0000000372a1', '00000000-0000-0000-0000-0000000372d2'),
  ('00000000-0000-0000-0000-0000000372a1', '00000000-0000-0000-0000-0000000372d3');
INSERT INTO public.job_containers (id, job_id, label, kind) VALUES
  ('a3720c01-0000-0000-0000-0000000372c1', '00000000-0000-0000-0000-0000000372a1', 'A1', 'cage'),
  ('a3720c02-0000-0000-0000-0000000372c2', '00000000-0000-0000-0000-0000000372a1', 'A2', 'box');
SELECT osp.same('a box with no pin remembers nothing', osp.pin('a3720c01-0000-0000-0000-0000000372c1'), 'nobody · no name · no day · no margin');

-- ---------------------------------------------------------------------------------------------------------------
-- 1. The helper pins a box.
SELECT osp.as_user('00000000-0000-0000-0000-0000000372d2');
SET LOCAL ROLE authenticated;
-- A client that does not know the columns sends the point alone.
UPDATE public.job_containers SET lat = 29.5, lng = -98.4 WHERE id = 'a3720c01-0000-0000-0000-0000000372c1';
SELECT osp.same('a pin sent as a point alone is stamped with the caller, now and no margin', osp.pin('a3720c01-0000-0000-0000-0000000372c1'), 'd2 · Pin Helper · 0 min ago · no margin');
-- A client that knows them: a press that waited two hours on the phone, a margin, and a teammate's name claimed.
UPDATE public.job_containers SET lat = 29.6, lng = -98.5, pinned_at = now() - interval '2 hours', pin_accuracy_m = 6.5,
    pinned_by = '00000000-0000-0000-0000-0000000372d3', pinned_by_name = 'Pin Other'
  WHERE id = 'a3720c01-0000-0000-0000-0000000372c1';
SELECT osp.same('a press that waited keeps its time and its margin, and the name it claimed is the caller''s', osp.pin('a3720c01-0000-0000-0000-0000000372c1'), 'd2 · Pin Helper · 120 min ago · 6.5 m');
-- A phone whose clock runs a day fast.
UPDATE public.job_containers SET lat = 29.7, lng = -98.6, pinned_at = now() + interval '1 day', pin_accuracy_m = 12 WHERE id = 'a3720c01-0000-0000-0000-0000000372c1';
SELECT osp.same('a time ahead of the server''s becomes the server''s', osp.pin('a3720c01-0000-0000-0000-0000000372c1'), 'd2 · Pin Helper · 0 min ago · 12 m');
-- The facts alone, with the pin where it was.
UPDATE public.job_containers SET pinned_by = '00000000-0000-0000-0000-0000000372d3', pinned_by_name = 'Pin Other', pin_accuracy_m = 1 WHERE id = 'a3720c01-0000-0000-0000-0000000372c1';
SELECT osp.same('a pin''s facts cannot be changed without the pin', osp.pin('a3720c01-0000-0000-0000-0000000372c1'), 'd2 · Pin Helper · 0 min ago · 12 m');
-- What the screens do to a box leaves the pin's facts alone.
UPDATE public.job_containers SET where_note = 'by the north fence' WHERE id = 'a3720c01-0000-0000-0000-0000000372c1';
SELECT osp.same('an edit to the box keeps the pin''s facts', osp.pin('a3720c01-0000-0000-0000-0000000372c1') || ' · ' || osp.one($q$SELECT where_note FROM public.job_containers WHERE id = 'a3720c01-0000-0000-0000-0000000372c1'$q$), 'd2 · Pin Helper · 0 min ago · 12 m · by the north fence');

-- ---------------------------------------------------------------------------------------------------------------
-- 2. A teammate on an older client drags the pin: the margin the earlier pin left must not stand under the new point.
SELECT osp.as_user('00000000-0000-0000-0000-0000000372d3');
UPDATE public.job_containers SET lat = 29.8, lng = -98.7 WHERE id = 'a3720c01-0000-0000-0000-0000000372c1';
SELECT osp.same('a teammate who moves the pin becomes its who, and the old margin goes', osp.pin('a3720c01-0000-0000-0000-0000000372c1'), 'd3 · Pin Other · 0 min ago · no margin');
-- Taking the pin off.
UPDATE public.job_containers SET lat = NULL, lng = NULL WHERE id = 'a3720c01-0000-0000-0000-0000000372c1';
SELECT osp.same('taking the pin off clears who, when and how sure', osp.pin('a3720c01-0000-0000-0000-0000000372c1'), 'nobody · no name · no day · no margin');
-- A new box added with a pin, and one added with a name and no pin.
INSERT INTO public.job_containers (id, job_id, label, kind, lat, lng, pinned_at, pin_accuracy_m, pinned_by, pinned_by_name) VALUES
  ('a3720c03-0000-0000-0000-0000000372c3', '00000000-0000-0000-0000-0000000372a1', 'A3', 'box', 29.5, -98.4, now() - interval '5 minutes', 8, '00000000-0000-0000-0000-0000000372d2', 'Pin Helper'),
  ('a3720c04-0000-0000-0000-0000000372c4', '00000000-0000-0000-0000-0000000372a1', 'A4', 'box', NULL, NULL, now(), 8, '00000000-0000-0000-0000-0000000372d2', 'Pin Helper');
SELECT osp.same('a box added with a pin is stamped with the caller', osp.pin('a3720c03-0000-0000-0000-0000000372c3'), 'd3 · Pin Other · 5 min ago · 8 m');
SELECT osp.same('a box added with no pin remembers nothing, whatever was sent', osp.pin('a3720c04-0000-0000-0000-0000000372c4'), 'nobody · no name · no day · no margin');
RESET ROLE;

-- ---------------------------------------------------------------------------------------------------------------
-- 3. A dev's own label is kept, as a box move keeps it: the dev seat's agent writes as the dev.
SELECT osp.as_user('00000000-0000-0000-0000-0000000372d1');
SET LOCAL ROLE authenticated;
UPDATE public.job_containers SET lat = 29.9, lng = -98.8, pinned_at = now() - interval '1 minute', pinned_by_name = 'Claude for Pin Dev' WHERE id = 'a3720c02-0000-0000-0000-0000000372c2';
SELECT osp.same('a dev''s label is kept, with the dev as the who', osp.pin('a3720c02-0000-0000-0000-0000000372c2'), 'd1 · Claude for Pin Dev · 1 min ago · no margin');
UPDATE public.job_containers SET lat = 30.0, lng = -98.9 WHERE id = 'a3720c02-0000-0000-0000-0000000372c2';
SELECT osp.same('a dev who sends no label gets their own name', osp.pin('a3720c02-0000-0000-0000-0000000372c2'), 'd1 · Pin Dev · 0 min ago · no margin');
RESET ROLE;

-- ---------------------------------------------------------------------------------------------------------------
-- 4. The office's own code. A definer function running for a signed-in person (here, as postgres with the dev's
--    claims) that changes anything but the pin leaves the facts alone: on_site_carry_job is that path.
UPDATE public.job_containers SET where_note = 'moved by the office' WHERE id = 'a3720c02-0000-0000-0000-0000000372c2';
SELECT osp.same('the office''s own code keeps a pin''s facts', osp.pin('a3720c02-0000-0000-0000-0000000372c2'), 'd1 · Pin Dev · 0 min ago · no margin');
-- The service role, with nobody signed in, is kept as sent.
SELECT osp.as_nobody();
SET LOCAL ROLE service_role;
UPDATE public.job_containers SET lat = 30.1, lng = -99.0, pinned_at = now() - interval '3 minutes', pin_accuracy_m = 4,
    pinned_by = '00000000-0000-0000-0000-0000000372d3', pinned_by_name = 'Pin Other'
  WHERE id = 'a3720c02-0000-0000-0000-0000000372c2';
RESET ROLE;
SELECT osp.same('the service role''s pin is kept as sent', osp.pin('a3720c02-0000-0000-0000-0000000372c2'), 'd3 · Pin Other · 3 min ago · 4 m');

DO $$ BEGIN RAISE NOTICE 'on_site_guards PASSED'; END $$;
ROLLBACK;
