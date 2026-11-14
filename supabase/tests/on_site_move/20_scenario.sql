-- Materials on site moved from one job to another (v2.6808, punch list #209): dev_on_site_move_job carries a job's
-- places, cages and boxes, ledger, box moves and box photos to another job through on_site_carry_job, the rule the
-- whole-job combine uses. Here: who may call it and every refusal; a dry run that does the move, reports and unwinds;
-- the apply, with a same-name place, Unsorted on both sides, a label the target already holds (it takes the site's next
-- free name, punch list #351), a retired box, a box's own move and three photos; a replay refused; a move onto a job with nothing
-- on site; two Unsorted piles whose fold changes what a line reads, said and not refused; and the trigger that gives a
-- new ledger row or photo its container's job. Since v2.7265 the four tables of 2026-11-13 ride along: a part rename
-- whose undo is asked against the target, a sticker run, the job's own Same part? answers and prices onto a job on
-- no site (a pair both jobs answered keeping the newer answer) and, on the second move, onto a job on a site, where
-- they fold into the site's scope. Fixtures made as postgres; the door runs as a dev through RLS;
-- everything runs inside one transaction that rolls back. Raises on the first failed assertion; ends with
-- "on_site_move PASSED". See scripts/pgtest-on-site-move.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA osm;
CREATE FUNCTION osm.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION '% — got %, wanted %', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused with words that hold `want`. Its own writes go with the refusal (a subtransaction).
CREATE FUNCTION osm.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
-- Sign in as someone (the claims auth.uid() reads).
CREATE FUNCTION osm.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
CREATE FUNCTION osm.door(p_from uuid, p_to uuid, dry boolean DEFAULT true) RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.dev_on_site_move_job(jsonb_build_object('from_job', p_from, 'to_job', p_to), dry) $$;
-- What the bed reads past RLS (as postgres).
CREATE FUNCTION osm.counts(p_job uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (c->>'places') || ' places, ' || (c->>'containers') || ' containers, ' || (c->>'movements') || ' rows, '
      || (c->>'container_moves') || ' box moves, ' || (c->>'photos') || ' photos, ' || (c->>'parts_on_hand') || ' on hand'
  FROM (SELECT public.on_site_job_counts(p_job) AS c) s $$;
-- The four tables of 2026-11-13 (v2.7265), and the job's site's answers and prices.
CREATE FUNCTION osm.more(p_job uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (c->>'part_renames') || ' renames, ' || (c->>'sticker_runs') || ' runs, ' || (c->>'ties') || ' ties, ' || (c->>'prices') || ' prices, '
      || (c->>'site_ties') || ' site ties, ' || (c->>'site_prices') || ' site prices'
  FROM (SELECT public.on_site_job_counts(p_job) AS c) s $$;
CREATE FUNCTION osm.box(p uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT j.job_name || ' · ' || c.label || ' · ' || c.code || ' · ' || COALESCE(pl.name, 'no place') || CASE WHEN c.retired_at IS NULL THEN '' ELSE ' · retired' END
  FROM public.job_containers c JOIN public.jobs_ledger j ON j.id = c.job_id LEFT JOIN public.job_places pl ON pl.id = c.place_id WHERE c.id = p $$;
CREATE FUNCTION osm.one(q text) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v text; BEGIN EXECUTE q INTO v; RETURN v; END $$;
-- The plan the dry run gave, kept to hold the apply against.
CREATE TABLE osm.plan (r jsonb);
GRANT ALL ON osm.plan TO authenticated;
GRANT USAGE ON SCHEMA osm TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA osm TO authenticated;

-- Who: a dev, a helper, an estimator, a dev in training, a dev that is a twin.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000509d1', 'dev@onsite.test'),
  ('00000000-0000-0000-0000-0000000509d2', 'helper@onsite.test'),
  ('00000000-0000-0000-0000-0000000509d3', 'estimator@onsite.test'),
  ('00000000-0000-0000-0000-0000000509d4', 'trainee@onsite.test'),
  ('00000000-0000-0000-0000-0000000509d5', 'twin@onsite.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000509d1', 'dev@onsite.test', 'Site Dev', 'dev'),
  ('00000000-0000-0000-0000-0000000509d2', 'helper@onsite.test', 'Site Helper', 'helpers'),
  ('00000000-0000-0000-0000-0000000509d3', 'estimator@onsite.test', 'Site Estimator', 'estimator'),
  ('00000000-0000-0000-0000-0000000509d4', 'trainee@onsite.test', 'Site Trainee', 'dev'),
  ('00000000-0000-0000-0000-0000000509d5', 'twin@onsite.test', 'Site Twin', 'dev')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
UPDATE public.users SET read_only = true WHERE id = '00000000-0000-0000-0000-0000000509d4';
UPDATE public.users SET is_digital_twin = true WHERE id = '00000000-0000-0000-0000-0000000509d5';

-- Five jobs under the dev: A (the wrong job the count was recorded under), B (the right one, with material of its
-- own), C (nothing on site), D and E (an Unsorted pile each, for the fold that changes a line).
INSERT INTO public.service_types (id, name, ledger_job_prefix) VALUES ('00000000-0000-0000-0000-0000000509f1', 'On-site bed work', 'JQ');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, hcp_number) VALUES
  ('00000000-0000-0000-0000-0000000509a1', '00000000-0000-0000-0000-0000000509d1', '00000000-0000-0000-0000-0000000509f1', 'Bed job A', '901'),
  ('00000000-0000-0000-0000-0000000509a2', '00000000-0000-0000-0000-0000000509d1', '00000000-0000-0000-0000-0000000509f1', 'Bed job B', '902'),
  ('00000000-0000-0000-0000-0000000509a3', '00000000-0000-0000-0000-0000000509d1', '00000000-0000-0000-0000-0000000509f1', 'Bed job C', '903'),
  ('00000000-0000-0000-0000-0000000509a4', '00000000-0000-0000-0000-0000000509d1', '00000000-0000-0000-0000-0000000509f1', 'Bed job D', '904'),
  ('00000000-0000-0000-0000-0000000509a5', '00000000-0000-0000-0000-0000000509d1', '00000000-0000-0000-0000-0000000509f1', 'Bed job E', '905');
-- The helper is on A's crew and no other.
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES ('00000000-0000-0000-0000-0000000509a1', '00000000-0000-0000-0000-0000000509d2');
-- C is on a site (v2.7265): the second move folds a job's own Same part? answers and prices into it. The site has
-- answered the tee pair itself, newer than B will have.
INSERT INTO public.developments (id, master_user_id, name) VALUES ('00000000-0000-0000-0000-0000000509f2', '00000000-0000-0000-0000-0000000509d1', 'Bed site');
UPDATE public.jobs_ledger SET development_id = '00000000-0000-0000-0000-0000000509f2' WHERE id = '00000000-0000-0000-0000-0000000509a3';
INSERT INTO public.on_site_part_ties (id, development_id, job_id, a_key, b_key, a_name, b_name, verdict, by_user_id, by_name, at) VALUES
  ('00000000-0000-0000-0000-000000050981', '00000000-0000-0000-0000-0000000509f2', NULL, 'words:2in tee', 'words:2 inch tee', '2in tee', '2 inch tee', 'same', '00000000-0000-0000-0000-0000000509d1', 'Site Dev', '2026-11-06 08:00-06'),
-- A's own answers: the elbow pair is one part, the valve pair is not. B answered the elbow pair the other way round,
-- a day earlier, and the tee pair.
  ('00000000-0000-0000-0000-000000050982', NULL, '00000000-0000-0000-0000-0000000509a1', 'words:2in elbow', 'words:2 inch elbow', '2in elbow', '2 inch elbow', 'same', '00000000-0000-0000-0000-0000000509d1', 'Site Dev', '2026-11-05 08:00-06'),
  ('00000000-0000-0000-0000-000000050983', NULL, '00000000-0000-0000-0000-0000000509a1', 'words:gas valve', 'words:gas valve 1in', 'gas valve', 'gas valve 1in', 'different', '00000000-0000-0000-0000-0000000509d1', 'Site Dev', '2026-11-05 09:00-06'),
  ('00000000-0000-0000-0000-000000050984', NULL, '00000000-0000-0000-0000-0000000509a2', 'words:2 inch elbow', 'words:2in elbow', '2 inch elbow', '2in elbow', 'different', '00000000-0000-0000-0000-0000000509d1', 'Site Dev', '2026-11-04 08:00-06'),
  ('00000000-0000-0000-0000-000000050985', NULL, '00000000-0000-0000-0000-0000000509a2', 'words:2in tee', 'words:2 inch tee', '2in tee', '2 inch tee', 'same', '00000000-0000-0000-0000-0000000509d1', 'Site Dev', '2026-11-03 08:00-06');
-- A price each for the coupling: A's newer.
INSERT INTO public.on_site_prices (id, development_id, job_id, row_key, row_name, kind, unit_price, source, priced_on, by_user_id, by_name, at) VALUES
  ('00000000-0000-0000-0000-000000050991', NULL, '00000000-0000-0000-0000-0000000509a1', 'words:2in coupling', '2in coupling', 'price', 1.25, 'typed', '2026-11-05', '00000000-0000-0000-0000-0000000509d1', 'Site Dev', '2026-11-05 08:00-06'),
  ('00000000-0000-0000-0000-000000050992', NULL, '00000000-0000-0000-0000-0000000509a2', 'words:2in coupling', '2in coupling', 'price', 0.99, 'typed', '2026-11-02', '00000000-0000-0000-0000-0000000509d1', 'Site Dev', '2026-11-02 08:00-06');

-- A: two places, an Unsorted pile, a cage in Arena, a box in the Yard, a cage with no place, a retired cage. Two names
-- are from before the name rule (G7 TOILETS, A1 (2)), so the rows are written with the rule's trigger off, as prod's
-- old rows were (v2.7276).
INSERT INTO public.job_places (id, job_id, name) VALUES
  ('00000000-0000-0000-0000-0000000509b1', '00000000-0000-0000-0000-0000000509a1', 'Arena'),
  ('00000000-0000-0000-0000-0000000509b2', '00000000-0000-0000-0000-0000000509a1', 'Yard'),
  ('00000000-0000-0000-0000-0000000509b3', '00000000-0000-0000-0000-0000000509a2', 'ARENA'),
  ('00000000-0000-0000-0000-0000000509b4', '00000000-0000-0000-0000-0000000509a2', 'Dock');
ALTER TABLE public.job_containers DISABLE TRIGGER job_containers_name_rule;
INSERT INTO public.job_containers (id, job_id, label, kind, place_id, retired_at) VALUES
  ('a5090c01-0000-0000-0000-0000000509c1', '00000000-0000-0000-0000-0000000509a1', 'Unsorted', 'unsorted', NULL, NULL),
  ('a5090c02-0000-0000-0000-0000000509c2', '00000000-0000-0000-0000-0000000509a1', 'A1', 'cage', '00000000-0000-0000-0000-0000000509b1', NULL),
  ('a5090c03-0000-0000-0000-0000000509c3', '00000000-0000-0000-0000-0000000509a1', 'B2', 'box', '00000000-0000-0000-0000-0000000509b2', NULL),
  ('a5090c04-0000-0000-0000-0000000509c4', '00000000-0000-0000-0000-0000000509a1', 'G7 TOILETS', 'cage', NULL, NULL),
  ('a5090c05-0000-0000-0000-0000000509c5', '00000000-0000-0000-0000-0000000509a1', 'C3', 'cage', NULL, '2026-11-01 09:00-06'),
-- B: an Unsorted pile of its own, a live cage stencilled a1, a box already wearing A1 (2), a live C3.
  ('b5090c01-0000-0000-0000-0000000509e1', '00000000-0000-0000-0000-0000000509a2', 'Unsorted', 'unsorted', NULL, NULL),
  ('b5090c02-0000-0000-0000-0000000509e2', '00000000-0000-0000-0000-0000000509a2', 'a1', 'cage', '00000000-0000-0000-0000-0000000509b3', NULL),
  ('b5090c03-0000-0000-0000-0000000509e3', '00000000-0000-0000-0000-0000000509a2', 'A1 (2)', 'box', NULL, NULL),
  ('b5090c04-0000-0000-0000-0000000509e4', '00000000-0000-0000-0000-0000000509a2', 'C3', 'cage', NULL, NULL);
ALTER TABLE public.job_containers ENABLE TRIGGER job_containers_name_rule;
-- The ledger. A: 10 couplings into A1 then counted 8; 5 elbows into Unsorted, 2 of them put in B2; 4 valves into G7.
-- B: 6 elbows in its Unsorted, 7 couplings in a1. On hand: A 8 + 3 + 2 + 4 = 17, B 13.
INSERT INTO public.job_material_movements (id, job_id, part_name, quantity, reason, from_container_id, to_container_id, at) VALUES
  ('00000000-0000-0000-0000-000000050901', '00000000-0000-0000-0000-0000000509a1', '2in coupling', 10, 'delivered', NULL, 'a5090c02-0000-0000-0000-0000000509c2', '2026-11-02 08:00-06'),
  ('00000000-0000-0000-0000-000000050902', '00000000-0000-0000-0000-0000000509a1', '2in coupling', 8, 'counted', 'a5090c02-0000-0000-0000-0000000509c2', NULL, '2026-11-02 09:00-06'),
  ('00000000-0000-0000-0000-000000050903', '00000000-0000-0000-0000-0000000509a1', '2in elbow', 5, 'delivered', NULL, 'a5090c01-0000-0000-0000-0000000509c1', '2026-11-02 10:00-06'),
  ('00000000-0000-0000-0000-000000050904', '00000000-0000-0000-0000-0000000509a1', '2in elbow', 2, 'moved', 'a5090c01-0000-0000-0000-0000000509c1', 'a5090c03-0000-0000-0000-0000000509c3', '2026-11-02 11:00-06'),
  ('00000000-0000-0000-0000-000000050905', '00000000-0000-0000-0000-0000000509a1', 'gas valve', 4, 'delivered', NULL, 'a5090c04-0000-0000-0000-0000000509c4', '2026-11-02 12:00-06'),
  ('00000000-0000-0000-0000-000000050911', '00000000-0000-0000-0000-0000000509a2', '2in elbow', 6, 'delivered', NULL, 'b5090c01-0000-0000-0000-0000000509e1', '2026-11-03 08:00-06'),
  ('00000000-0000-0000-0000-000000050912', '00000000-0000-0000-0000-0000000509a2', '2in coupling', 7, 'delivered', NULL, 'b5090c02-0000-0000-0000-0000000509e2', '2026-11-03 09:00-06');
-- B2 was carried from Arena to the Yard.
INSERT INTO public.job_container_moves (id, container_id, from_place_id, to_place_id) VALUES
  ('00000000-0000-0000-0000-000000050921', 'a5090c03-0000-0000-0000-0000000509c3', '00000000-0000-0000-0000-0000000509b1', '00000000-0000-0000-0000-0000000509b2');
-- Three photos on A: A1's filed in Drive, B2's still waiting in the bucket, the Unsorted pile's filed.
INSERT INTO public.job_box_photos (id, job_id, container_id, file_name, status, storage_path, drive_file_id, filed_at) VALUES
  ('00000000-0000-0000-0000-000000050931', '00000000-0000-0000-0000-0000000509a1', 'a5090c02-0000-0000-0000-0000000509c2', 'A1 after Count.jpg', 'filed', NULL, 'drive-a1', now()),
  ('00000000-0000-0000-0000-000000050932', '00000000-0000-0000-0000-0000000509a1', 'a5090c03-0000-0000-0000-0000000509c3', 'B2.jpg', 'sending', '00000000-0000-0000-0000-0000000509a1/00000000-0000-0000-0000-000000050932.jpg', NULL, NULL),
  ('00000000-0000-0000-0000-000000050933', '00000000-0000-0000-0000-0000000509a1', 'a5090c01-0000-0000-0000-0000000509c1', 'Unsorted.jpg', 'filed', NULL, 'drive-unsorted', now());
-- D and E: an Unsorted pile each. D's holds 5 tees delivered on the 4th; E's was counted empty of tees on the 5th.
INSERT INTO public.job_containers (id, job_id, label, kind) VALUES
  ('d5090c01-0000-0000-0000-0000000509d1', '00000000-0000-0000-0000-0000000509a4', 'Unsorted', 'unsorted'),
  ('e5090c01-0000-0000-0000-0000000509e1', '00000000-0000-0000-0000-0000000509a5', 'Unsorted', 'unsorted');
INSERT INTO public.job_material_movements (id, job_id, part_name, quantity, reason, from_container_id, to_container_id, at) VALUES
  ('00000000-0000-0000-0000-000000050941', '00000000-0000-0000-0000-0000000509a4', '2in tee', 5, 'delivered', NULL, 'd5090c01-0000-0000-0000-0000000509d1', '2026-11-04 08:00-06'),
  ('00000000-0000-0000-0000-000000050942', '00000000-0000-0000-0000-0000000509a5', '2in tee', 0, 'counted', 'e5090c01-0000-0000-0000-0000000509e1', NULL, '2026-11-05 08:00-06');

-- The doors' rights: the move runs with the definer's rights, gated inside; the carry is nobody's to call.
SELECT osm.same('the move runs with the definer''s rights', (SELECT prosecdef::text FROM pg_proc WHERE proname = 'dev_on_site_move_job'), 'true');
SELECT osm.same('a signed-out caller cannot run the move', has_function_privilege('anon', 'public.dev_on_site_move_job(jsonb, boolean)', 'EXECUTE')::text, 'false');
SELECT osm.same('a signed-in caller can reach the move', has_function_privilege('authenticated', 'public.dev_on_site_move_job(jsonb, boolean)', 'EXECUTE')::text, 'true');
SELECT osm.same('a signed-in caller cannot call the carry itself', has_function_privilege('authenticated', 'public.on_site_carry_job(uuid, uuid)', 'EXECUTE')::text, 'false');
SELECT osm.same('a signed-out caller cannot call the carry itself', has_function_privilege('anon', 'public.on_site_carry_job(uuid, uuid)', 'EXECUTE')::text, 'false');
SELECT osm.same('the combine calls the carry', (SELECT (position('PERFORM public.on_site_carry_job(p_from, p_to)' IN prosrc) > 0)::text FROM pg_proc WHERE proname = 'migrate_job_ledger_costs_and_delete'), 'true');
SELECT osm.same('and keeps no copy of the rule', (SELECT (position('UPDATE public.job_material_movements' IN prosrc) > 0)::text FROM pg_proc WHERE proname = 'migrate_job_ledger_costs_and_delete'), 'false');

-- Before anything moves, the helper's press on A lands under A: one valve used from G7 (A now holds 16).
SELECT osm.as_user('00000000-0000-0000-0000-0000000509d2');
SET LOCAL ROLE authenticated;
INSERT INTO public.job_material_movements (id, job_id, part_name, quantity, reason, from_container_id, by_user_id, by_name, at)
  VALUES ('00000000-0000-0000-0000-000000050906', '00000000-0000-0000-0000-0000000509a1', 'gas valve', 1, 'used', 'a5090c04-0000-0000-0000-0000000509c4', '00000000-0000-0000-0000-0000000509d2', 'Site Helper', '2026-11-02 13:00-06');
RESET ROLE;
SELECT osm.same('A before', osm.counts('00000000-0000-0000-0000-0000000509a1'), '2 places, 5 containers, 6 rows, 1 box moves, 3 photos, 16 on hand');
SELECT osm.same('B before', osm.counts('00000000-0000-0000-0000-0000000509a2'), '2 places, 4 containers, 2 rows, 0 box moves, 0 photos, 13 on hand');

-- The dev fixes a name on A through the row Fix the name inserts (both gas valve rows, the helper's among them) and
-- prints a run of three stickers for A (v2.7265).
SELECT osm.as_user('00000000-0000-0000-0000-0000000509d1');
SET LOCAL ROLE authenticated;
INSERT INTO public.job_part_renames (id, job_id, old_name, new_name) VALUES ('00000000-0000-0000-0000-000000050961', '00000000-0000-0000-0000-0000000509a1', 'gas valve', 'gas valve 1in');
SELECT osm.same('the rename changed both valve rows', osm.one($q$SELECT row_count::text FROM public.job_part_renames WHERE id = '00000000-0000-0000-0000-000000050961'$q$), '2');
SELECT osm.same('a run of three stickers is printed for A', (public.mint_sticker_run('00000000-0000-0000-0000-0000000509a1', 3)->'run'->>'sticker_count'), '3');
RESET ROLE;
SELECT osm.same('A''s own records before', osm.more('00000000-0000-0000-0000-0000000509a1'), '1 renames, 1 runs, 2 ties, 1 prices, 0 site ties, 0 site prices');
SELECT osm.same('B''s own records before', osm.more('00000000-0000-0000-0000-0000000509a2'), '0 renames, 0 runs, 2 ties, 1 prices, 0 site ties, 0 site prices');
SELECT osm.same('C''s site has one answer', osm.more('00000000-0000-0000-0000-0000000509a3'), '0 renames, 0 runs, 0 ties, 0 prices, 1 site ties, 0 site prices');

-- Outside the door.
SELECT osm.as_user('00000000-0000-0000-0000-0000000509d3');
SET LOCAL ROLE authenticated;
SELECT osm.refused('an estimator is refused', $q$SELECT osm.door('00000000-0000-0000-0000-0000000509a1', '00000000-0000-0000-0000-0000000509a2')$q$, 'devs only');
RESET ROLE;
SELECT osm.as_user('00000000-0000-0000-0000-0000000509d2');
SET LOCAL ROLE authenticated;
SELECT osm.refused('a helper on the job is refused', $q$SELECT osm.door('00000000-0000-0000-0000-0000000509a1', '00000000-0000-0000-0000-0000000509a2')$q$, 'devs only');
RESET ROLE;
SELECT osm.as_user('00000000-0000-0000-0000-0000000509d4');
SET LOCAL ROLE authenticated;
SELECT osm.refused('a dev in training is refused', $q$SELECT osm.door('00000000-0000-0000-0000-0000000509a1', '00000000-0000-0000-0000-0000000509a2')$q$, 'a training account (read_only) cannot move');
RESET ROLE;
SELECT osm.as_user('00000000-0000-0000-0000-0000000509d5');
SET LOCAL ROLE authenticated;
SELECT osm.refused('a twin is refused', $q$SELECT osm.door('00000000-0000-0000-0000-0000000509a1', '00000000-0000-0000-0000-0000000509a2')$q$, 'a digital twin cannot move');
RESET ROLE;

-- As the dev: the call's own refusals.
SELECT osm.as_user('00000000-0000-0000-0000-0000000509d1');
SET LOCAL ROLE authenticated;
SELECT osm.refused('no jobs named is refused', $q$SELECT public.dev_on_site_move_job('{}'::jsonb, true)$q$, 'from_job and to_job are required');
SELECT osm.refused('one job named is refused', $q$SELECT public.dev_on_site_move_job('{"from_job":"00000000-0000-0000-0000-0000000509a1"}'::jsonb, true)$q$, 'from_job and to_job are required');
SELECT osm.refused('the same job twice is refused', $q$SELECT osm.door('00000000-0000-0000-0000-0000000509a1', '00000000-0000-0000-0000-0000000509a1')$q$, 'the same job');
SELECT osm.refused('a source that is no job is refused', $q$SELECT osm.door('00000000-0000-0000-0000-0000000509ff', '00000000-0000-0000-0000-0000000509a2')$q$, 'from_job 00000000-0000-0000-0000-0000000509ff not found');
SELECT osm.refused('a target that is no job is refused', $q$SELECT osm.door('00000000-0000-0000-0000-0000000509a1', '00000000-0000-0000-0000-0000000509ff')$q$, 'to_job 00000000-0000-0000-0000-0000000509ff not found');
SELECT osm.refused('a source with nothing on site is refused', $q$SELECT osm.door('00000000-0000-0000-0000-0000000509a3', '00000000-0000-0000-0000-0000000509a2')$q$, 'JQ903 has nothing on site to move');
SELECT osm.refused('the carry itself is refused to a dev', $q$SELECT public.on_site_carry_job('00000000-0000-0000-0000-0000000509a1', '00000000-0000-0000-0000-0000000509a2')$q$, 'permission denied');

-- The dry run does the move, reports it and unwinds.
INSERT INTO osm.plan SELECT osm.door('00000000-0000-0000-0000-0000000509a1', '00000000-0000-0000-0000-0000000509a2', true);
DO $$
DECLARE r jsonb;
BEGIN
  SELECT p.r INTO r FROM osm.plan p;
  PERFORM osm.same('the dry run says so', r->>'dry_run', 'true');
  PERFORM osm.same('the source is named as the app names it', (r->'from'->>'label') || ' ' || (r->'from'->>'name'), 'JQ901 Bed job A');
  PERFORM osm.same('the target is named as the app names it', (r->'to'->>'label') || ' ' || (r->'to'->>'name'), 'JQ902 Bed job B');
  PERFORM osm.same('the reply names the dev', r->>'by', 'Site Dev');
  PERFORM osm.same('four containers move, one of them retired', (r->'moved'->>'containers') || '/' || (r->'moved'->>'retired_containers'), '4/1');
  PERFORM osm.same('one place moves', r->'moved'->>'places', '1');
  PERFORM osm.same('every ledger row, box move and photo moves', (r->'moved'->>'movements') || '/' || (r->'moved'->>'container_moves') || '/' || (r->'moved'->>'photos'), '6/1/3');
  PERFORM osm.same('Arena becomes one with the target''s, with its one box', r->'places_merged'->0->>'name' || ' ' || (r->'places_merged'->0->>'containers') || ' of ' || jsonb_array_length(r->'places_merged'), 'ARENA 1 of 1');
  PERFORM osm.same('the Unsorted pile folds with its rows and its photo', (r->'unsorted_folded'->>'code') || ' into ' || (r->'unsorted_folded'->>'into_code') || ' ' || (r->'unsorted_folded'->>'movements') || '/' || (r->'unsorted_folded'->>'container_moves') || '/' || (r->'unsorted_folded'->>'photos'), 'A5090C01 into B5090C01 2/0/1');
  PERFORM osm.same('one label takes the site''s next free name (A, the target''s letter, one past A1; punch list #351)', jsonb_array_length(r->'labels_renamed') || ': ' || (r->'labels_renamed'->0->>'code') || ' ' || (r->'labels_renamed'->0->>'kind') || ' ' || (r->'labels_renamed'->0->>'from') || ' → ' || (r->'labels_renamed'->0->>'to'), '1: A5090C02 cage A1 → A2');
  PERFORM osm.same('the photos'' files are counted where they are', (r->'photos'->>'rows') || ' rows, ' || (r->'photos'->>'in_drive') || ' in Drive, ' || (r->'photos'->>'waiting') || ' waiting', '3 rows, 2 in Drive, 1 waiting');
  PERFORM osm.same('the photo words say the files stay', (position('2 files are already in Drive and stay in JQ901''s photo folder' IN r->'photos'->>'words') > 0)::text, 'true');
  PERFORM osm.same('and where a waiting one will be filed', (position('1 is still waiting for the photo sweep, which files by the row''s job: into JQ902''s photo folder' IN r->'photos'->>'words') > 0)::text, 'true');
  PERFORM osm.same('the parts on hand add up', (r->'on_hand'->>'holds') || ' ' || (r->'before'->'from'->>'parts_on_hand') || '+' || (r->'before'->'to'->>'parts_on_hand') || '=' || (r->'after'->'to'->>'parts_on_hand'), 'true 16+13=29');
  PERFORM osm.same('the plan commits to both jobs'' rows before', (r->'before'->'from'->>'containers') || '/' || (r->'before'->'from'->>'movements') || ' and ' || (r->'before'->'to'->>'containers') || '/' || (r->'before'->'to'->>'movements'), '5/6 and 4/2');
  PERFORM osm.same('and after: the source empty, the target with both', (r->'after'->'from'->>'containers') || '/' || (r->'after'->'from'->>'movements') || '/' || (r->'after'->'from'->>'places') || ' and ' || (r->'after'->'to'->>'containers') || '/' || (r->'after'->'to'->>'movements') || '/' || (r->'after'->'to'->>'places'), '0/0/0 and 8/8/3');
  PERFORM osm.same('the words say what moves', r->>'words', 'Everything on site on JQ901 moves to JQ902: 4 cages and boxes (1 retired), 2 places, 6 ledger rows, 1 box move, 3 photos, 1 part rename, 1 sticker run, 2 Same part? answers, 1 price. Every cage and box keeps its id and the code printed on its label; no ledger row is rewritten, only the job it sits under.');
  PERFORM osm.same('the target''s note names the renumbered label', (position('A1 is now A2' IN r->'notes'->>'to') > 0)::text, 'true');
  -- v2.7265: the job's own records.
  PERFORM osm.same('the rename, the run, the answers and the price are in the plan', (r->'moved'->>'part_renames') || '/' || (r->'moved'->>'sticker_runs') || '/' || (r->'moved'->>'ties') || '/' || (r->'moved'->>'prices'), '1/1/2/1');
  PERFORM osm.same('the answers land on the target job, the elbow pair keeping the source''s newer answer', (r->'ties'->>'into') || ' ' || jsonb_array_length(r->'ties'->'dropped') || ' ' || (r->'ties'->'dropped'->0->>'kept'), 'job 1 source');
  PERFORM osm.same('and the plan says so', r->'ties'->>'words', 'The job''s 2 Same part? answers and 1 price now belong to JQ902, which is on no site. 1 pair was answered on both sides; the newer answer stands: 2in elbow and 2 inch elbow (JQ901''s).');
  PERFORM osm.same('the plan commits to the four tables on both jobs', (r->'before'->'from'->>'part_renames') || '/' || (r->'before'->'from'->>'sticker_runs') || '/' || (r->'before'->'from'->>'ties') || '/' || (r->'before'->'from'->>'prices') || ' and ' || (r->'before'->'to'->>'ties') || '/' || (r->'before'->'to'->>'prices') || ' → ' || (r->'after'->'to'->>'ties') || '/' || (r->'after'->'to'->>'prices'), '1/1/2/1 and 2/1 → 3/2');
END $$;
SELECT osm.same('the dry run moved nothing off A', osm.counts('00000000-0000-0000-0000-0000000509a1'), '2 places, 5 containers, 6 rows, 1 box moves, 3 photos, 16 on hand');
SELECT osm.same('and nothing onto B', osm.counts('00000000-0000-0000-0000-0000000509a2'), '2 places, 4 containers, 2 rows, 0 box moves, 0 photos, 13 on hand');
SELECT osm.same('and the dry run left no photo marked due a move', osm.one($q$SELECT count(*)::text FROM public.job_box_photos WHERE refile_due_at IS NOT NULL$q$), '0');
SELECT osm.same('A1 still wears its stencil on A', osm.box('a5090c02-0000-0000-0000-0000000509c2'), 'Bed job A · A1 · A5090C02 · Arena');
SELECT osm.same('the dry run left no note', osm.one($q$SELECT count(*)::text FROM public.jobs_ledger_thread_notes WHERE job_id IN ('00000000-0000-0000-0000-0000000509a1', '00000000-0000-0000-0000-0000000509a2')$q$), '0');
SELECT osm.same('and dropped no answer and moved no record', osm.one($q$SELECT count(*)::text FROM public.on_site_part_ties$q$) || ' | ' || osm.more('00000000-0000-0000-0000-0000000509a1'), '5 | 1 renames, 1 runs, 2 ties, 1 prices, 0 site ties, 0 site prices');
-- The same plan twice reads the same, so its hash holds until something changes.
SELECT osm.same('a second dry run gives the same plan', (osm.door('00000000-0000-0000-0000-0000000509a1', '00000000-0000-0000-0000-0000000509a2', true) = (SELECT r FROM osm.plan))::text, 'true');

-- For real. The reply is the plan, but for dry_run.
DO $$
DECLARE r jsonb;
BEGIN
  r := osm.door('00000000-0000-0000-0000-0000000509a1', '00000000-0000-0000-0000-0000000509a2', false);
  PERFORM osm.same('the apply says it is no dry run', r->>'dry_run', 'false');
  PERFORM osm.same('the apply did what the plan said', ((r - 'dry_run') = ((SELECT p.r FROM osm.plan p) - 'dry_run'))::text, 'true');
END $$;
SELECT osm.same('A is empty', osm.counts('00000000-0000-0000-0000-0000000509a1'), '0 places, 0 containers, 0 rows, 0 box moves, 0 photos, 0 on hand');
SELECT osm.same('B holds both jobs'' rows', osm.counts('00000000-0000-0000-0000-0000000509a2'), '3 places, 8 containers, 8 rows, 1 box moves, 3 photos, 29 on hand');
SELECT osm.same('A1 keeps its id and code, wears the site''s next free name, stands in the target''s Arena', osm.box('a5090c02-0000-0000-0000-0000000509c2'), 'Bed job B · A2 · A5090C02 · ARENA');
SELECT osm.same('B2 moved with the Yard it stands in', osm.box('a5090c03-0000-0000-0000-0000000509c3'), 'Bed job B · B2 · A5090C03 · Yard');
SELECT osm.same('the cage with no place moved as it was', osm.box('a5090c04-0000-0000-0000-0000000509c4'), 'Bed job B · G7 TOILETS · A5090C04 · no place');
SELECT osm.same('the retired C3 moved, still retired, its stencil untouched beside the live one', osm.box('a5090c05-0000-0000-0000-0000000509c5'), 'Bed job B · C3 · A5090C05 · no place · retired');
SELECT osm.same('the target''s own boxes are as they were', osm.box('b5090c02-0000-0000-0000-0000000509e2') || ' | ' || osm.box('b5090c03-0000-0000-0000-0000000509e3'), 'Bed job B · a1 · B5090C02 · ARENA | Bed job B · A1 (2) · B5090C03 · no place');
SELECT osm.same('the source''s Arena is gone and its Yard moved', osm.one($q$SELECT string_agg(name, ', ' ORDER BY name) FROM public.job_places WHERE job_id = '00000000-0000-0000-0000-0000000509a2'$q$), 'ARENA, Dock, Yard');
SELECT osm.same('the source''s Unsorted row is gone', osm.one($q$SELECT count(*)::text FROM public.job_containers WHERE id = 'a5090c01-0000-0000-0000-0000000509c1'$q$), '0');
SELECT osm.same('a delivery into it names the target''s pile', osm.one($q$SELECT to_container_id::text FROM public.job_material_movements WHERE id = '00000000-0000-0000-0000-000000050903'$q$), 'b5090c01-0000-0000-0000-0000000509e1');
SELECT osm.same('a Put in… out of it names the target''s pile and the box', osm.one($q$SELECT from_container_id::text || ' to ' || to_container_id::text FROM public.job_material_movements WHERE id = '00000000-0000-0000-0000-000000050904'$q$), 'b5090c01-0000-0000-0000-0000000509e1 to a5090c03-0000-0000-0000-0000000509c3');
SELECT osm.same('the one pile holds both piles'' elbows', public.on_site_line_on_hand('b5090c01-0000-0000-0000-0000000509e1', NULL, '2in elbow')::text, '9');
SELECT osm.same('A1 still reads its count', public.on_site_line_on_hand('a5090c02-0000-0000-0000-0000000509c2', NULL, '2in coupling')::text, '8');
SELECT osm.same('the helper''s press moved with its row, its name and its time', osm.one($q$SELECT job_id::text || ' ' || by_name || ' ' || (at AT TIME ZONE 'America/Chicago')::text FROM public.job_material_movements WHERE id = '00000000-0000-0000-0000-000000050906'$q$), '00000000-0000-0000-0000-0000000509a2 Site Helper 2026-11-02 13:00:00');
SELECT osm.same('B2''s own move names the target''s Arena and the Yard', osm.one($q$SELECT from_place_id::text || ' to ' || to_place_id::text FROM public.job_container_moves WHERE id = '00000000-0000-0000-0000-000000050921'$q$), '00000000-0000-0000-0000-0000000509b3 to 00000000-0000-0000-0000-0000000509b2');
SELECT osm.same('a filed photo keeps its Drive file', osm.one($q$SELECT job_id::text || ' ' || container_id::text || ' ' || drive_file_id FROM public.job_box_photos WHERE id = '00000000-0000-0000-0000-000000050931'$q$), '00000000-0000-0000-0000-0000000509a2 a5090c02-0000-0000-0000-0000000509c2 drive-a1');
SELECT osm.same('a waiting photo keeps its bucket path, under the job the sweep will file it for', osm.one($q$SELECT job_id::text || ' ' || storage_path FROM public.job_box_photos WHERE id = '00000000-0000-0000-0000-000000050932'$q$), '00000000-0000-0000-0000-0000000509a2 00000000-0000-0000-0000-0000000509a1/00000000-0000-0000-0000-000000050932.jpg');
-- #297 (v2.6915): a filed photo whose job changed is due a move of its Drive file; a waiting one is not, since the sweep files it for the row's job.
SELECT osm.same('a filed photo is marked due a move of its file', osm.one($q$SELECT (refile_due_at IS NOT NULL)::text || ' ' || (refile_due_at <= now())::text || ' ' || COALESCE(fail_why, 'no reason') FROM public.job_box_photos WHERE id = '00000000-0000-0000-0000-000000050931'$q$), 'true true no reason');
SELECT osm.same('a waiting photo is not', osm.one($q$SELECT (refile_due_at IS NULL)::text FROM public.job_box_photos WHERE id = '00000000-0000-0000-0000-000000050932'$q$), 'true');
SELECT osm.same('both filed photos are due, and nothing else on either job', osm.one($q$SELECT count(*)::text FROM public.job_box_photos WHERE refile_due_at IS NOT NULL$q$), '2');
SELECT osm.same('the Unsorted pile''s photo names the target''s pile', osm.one($q$SELECT container_id::text FROM public.job_box_photos WHERE id = '00000000-0000-0000-0000-000000050933'$q$), 'b5090c01-0000-0000-0000-0000000509e1');
SELECT osm.same('a note on the target says where it came from', osm.one($q$SELECT body FROM public.jobs_ledger_thread_notes WHERE job_id = '00000000-0000-0000-0000-0000000509a2'$q$), 'Materials on site moved here from JQ901 (Bed job A), where the count was recorded: 4 cages and boxes (1 retired), 2 places, 6 ledger rows, 1 box move, 3 photos, 1 part rename, 1 sticker run, 2 Same part? answers, 1 price. Every box keeps its printed code. 1 took a numbered label because this job already had that stencil: A1 is now A2. The job''s 2 Same part? answers and 1 price now belong to JQ902, which is on no site. 1 pair was answered on both sides; the newer answer stands: 2in elbow and 2 inch elbow (JQ901''s).');
SELECT osm.same('a note on the source says where it went, in the dev''s name', osm.one($q$SELECT u.name || ': ' || n.body FROM public.jobs_ledger_thread_notes n JOIN public.users u ON u.id = n.author_user_id WHERE n.job_id = '00000000-0000-0000-0000-0000000509a1'$q$), 'Site Dev: Materials on site moved to JQ902 (Bed job B), the job the material belongs to: 4 cages and boxes (1 retired), 2 places, 6 ledger rows, 1 box move, 3 photos, 1 part rename, 1 sticker run, 2 Same part? answers, 1 price. Nothing on site is left on this job.');
-- v2.7265: the job's own records went too.
SELECT osm.same('A is empty of its own records', osm.more('00000000-0000-0000-0000-0000000509a1'), '0 renames, 0 runs, 0 ties, 0 prices, 0 site ties, 0 site prices');
SELECT osm.same('B holds both jobs'' records, less the older answer', osm.more('00000000-0000-0000-0000-0000000509a2'), '1 renames, 1 runs, 3 ties, 2 prices, 0 site ties, 0 site prices');
SELECT osm.same('the run printed for A names B, its three stickers still blank', osm.one($q$SELECT r.job_id::text || ' ' || (SELECT count(*) FROM public.box_stickers s WHERE s.run_id = r.id AND s.container_id IS NULL) FROM public.sticker_runs r$q$), '00000000-0000-0000-0000-0000000509a2 3');
SELECT osm.same('the elbow pair keeps the source''s newer answer, under B', osm.one($q$SELECT id::text || ' ' || verdict || ' ' || job_id::text FROM public.on_site_part_ties WHERE LEAST(a_key, b_key) = 'words:2 inch elbow'$q$), '00000000-0000-0000-0000-000000050982 same 00000000-0000-0000-0000-0000000509a2');
SELECT osm.same('the newest price of the coupling on B is the one A accepted', osm.one($q$SELECT unit_price::text FROM public.on_site_prices WHERE job_id = '00000000-0000-0000-0000-0000000509a2' AND row_key = 'words:2in coupling' ORDER BY at DESC LIMIT 1$q$), '1.2500');
-- The rename's undo, asked against B as Fix the name's Undo asks it: the judge finds the rename on B and puts the name back.
SELECT osm.as_user('00000000-0000-0000-0000-0000000509d1');
SET LOCAL ROLE authenticated;
INSERT INTO public.job_part_renames (id, job_id, undo_of) VALUES ('00000000-0000-0000-0000-000000050962', '00000000-0000-0000-0000-0000000509a2', '00000000-0000-0000-0000-000000050961');
RESET ROLE;
SELECT osm.same('the undo against the target puts the name back on both rows', osm.one($q$SELECT (SELECT row_count::text FROM public.job_part_renames WHERE id = '00000000-0000-0000-0000-000000050962') || ' ' || string_agg(DISTINCT part_name, ',') FROM public.job_material_movements WHERE id IN ('00000000-0000-0000-0000-000000050905', '00000000-0000-0000-0000-000000050906')$q$), '2 gas valve');

-- The same move again has nothing to move, so a replayed apply is refused by the door itself.
SELECT osm.refused('a second apply is refused', $q$SELECT osm.door('00000000-0000-0000-0000-0000000509a1', '00000000-0000-0000-0000-0000000509a2', false)$q$, 'JQ901 has nothing on site to move');

-- A row takes its container's job. The dev's phone still holds A: a press and a photo sent under A land on B.
INSERT INTO public.job_material_movements (id, job_id, part_name, quantity, reason, from_container_id, by_user_id, by_name)
  VALUES ('00000000-0000-0000-0000-000000050951', '00000000-0000-0000-0000-0000000509a1', 'gas valve', 1, 'used', 'a5090c04-0000-0000-0000-0000000509c4', '00000000-0000-0000-0000-0000000509d1', 'Site Dev');
SELECT osm.same('a press sent under the old job lands on the box''s job', osm.one($q$SELECT job_id::text FROM public.job_material_movements WHERE id = '00000000-0000-0000-0000-000000050951'$q$), '00000000-0000-0000-0000-0000000509a2');
INSERT INTO public.job_material_movements (id, job_id, part_name, quantity, reason, from_container_id, to_container_id, by_user_id, by_name)
  VALUES ('00000000-0000-0000-0000-000000050952', '00000000-0000-0000-0000-0000000509a1', '2in elbow', 1, 'moved', 'b5090c01-0000-0000-0000-0000000509e1', 'a5090c03-0000-0000-0000-0000000509c3', '00000000-0000-0000-0000-0000000509d1', 'Site Dev');
SELECT osm.same('a Put in… sent under the old job lands on the box''s job', osm.one($q$SELECT job_id::text FROM public.job_material_movements WHERE id = '00000000-0000-0000-0000-000000050952'$q$), '00000000-0000-0000-0000-0000000509a2');
INSERT INTO public.job_box_photos (id, job_id, container_id, file_name, by_user_id)
  VALUES ('00000000-0000-0000-0000-000000050953', '00000000-0000-0000-0000-0000000509a1', 'a5090c03-0000-0000-0000-0000000509c3', 'B2 again.jpg', '00000000-0000-0000-0000-0000000509d1');
SELECT osm.same('a photo sent under the old job lands on the box''s job', osm.one($q$SELECT job_id::text FROM public.job_box_photos WHERE id = '00000000-0000-0000-0000-000000050953'$q$), '00000000-0000-0000-0000-0000000509a2');
INSERT INTO public.job_material_movements (id, job_id, part_name, quantity, reason, to_container_id, by_user_id, by_name)
  VALUES ('00000000-0000-0000-0000-000000050954', '00000000-0000-0000-0000-0000000509a2', 'gas valve', 2, 'delivered', 'a5090c04-0000-0000-0000-0000000509c4', '00000000-0000-0000-0000-0000000509d1', 'Site Dev');
SELECT osm.same('a press under the right job is as it was sent', osm.one($q$SELECT job_id::text FROM public.job_material_movements WHERE id = '00000000-0000-0000-0000-000000050954'$q$), '00000000-0000-0000-0000-0000000509a2');
SELECT osm.same('nothing landed back on A', osm.counts('00000000-0000-0000-0000-0000000509a1'), '0 places, 0 containers, 0 rows, 0 box moves, 0 photos, 0 on hand');
RESET ROLE;
-- The helper is on A's crew and not on B's: the same press is judged on B, and refused in the open, not kept under A.
SELECT osm.as_user('00000000-0000-0000-0000-0000000509d2');
SET LOCAL ROLE authenticated;
SELECT osm.refused('a press from someone not on the new job is refused', $q$INSERT INTO public.job_material_movements (job_id, part_name, quantity, reason, from_container_id, by_user_id, by_name) VALUES ('00000000-0000-0000-0000-0000000509a1', 'gas valve', 1, 'used', 'a5090c04-0000-0000-0000-0000000509c4', '00000000-0000-0000-0000-0000000509d2', 'Site Helper')$q$, 'row-level security');
RESET ROLE;
-- Put on B's crew, the helper writes there, whichever job the phone still names.
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES ('00000000-0000-0000-0000-0000000509a2', '00000000-0000-0000-0000-0000000509d2');
SELECT osm.as_user('00000000-0000-0000-0000-0000000509d2');
SET LOCAL ROLE authenticated;
INSERT INTO public.job_material_movements (id, job_id, part_name, quantity, reason, from_container_id, by_user_id, by_name)
  VALUES ('00000000-0000-0000-0000-000000050955', '00000000-0000-0000-0000-0000000509a1', 'gas valve', 1, 'used', 'a5090c04-0000-0000-0000-0000000509c4', '00000000-0000-0000-0000-0000000509d2', 'Site Helper');
RESET ROLE;
SELECT osm.same('once on the new job''s crew, the helper''s press lands there', osm.one($q$SELECT job_id::text FROM public.job_material_movements WHERE id = '00000000-0000-0000-0000-000000050955'$q$), '00000000-0000-0000-0000-0000000509a2');

-- Onto a job with nothing on site: no place to join, no pile to fold into, no label to renumber.
SELECT osm.as_user('00000000-0000-0000-0000-0000000509d1');
SET LOCAL ROLE authenticated;
DO $$
DECLARE r jsonb;
BEGIN
  r := osm.door('00000000-0000-0000-0000-0000000509a2', '00000000-0000-0000-0000-0000000509a3', false);
  PERFORM osm.same('everything moves onto the empty job', (r->'moved'->>'containers') || '/' || (r->'moved'->>'places') || '/' || (r->'moved'->>'movements') || '/' || (r->'moved'->>'photos'), '8/3/12/4');
  PERFORM osm.same('nothing joined, folded or renumbered', jsonb_array_length(r->'places_merged') || ' ' || jsonb_typeof(r->'unsorted_folded') || ' ' || jsonb_array_length(r->'labels_renamed'), '0 null 0');
  PERFORM osm.same('the parts on hand add up onto nothing', (r->'on_hand'->>'holds') || ' ' || (r->'before'->'to'->>'parts_on_hand') || ' ' || ((r->'after'->'to'->>'parts_on_hand') = (r->'before'->'from'->>'parts_on_hand'))::text, 'true 0 true');
  -- v2.7265: C is on a site, so the job's own answers and prices fold into the site; the tee pair keeps the site's newer answer.
  PERFORM osm.same('the answers fold into the site, the tee pair keeping the site''s newer answer', (r->'ties'->>'into') || ' ' || (r->'moved'->>'ties') || '/' || (r->'moved'->>'prices') || ' ' || jsonb_array_length(r->'ties'->'dropped') || ' ' || (r->'ties'->'dropped'->0->>'kept'), 'site 2/2 1 target');
  PERFORM osm.same('the plan names the site', r->'ties'->>'words', 'The job''s 2 Same part? answers and 2 prices now belong to JQ903''s site, Bed site, where every job on it reads them. 1 pair was answered on both sides; the newer answer stands: 2in tee and 2 inch tee (JQ903''s).');
  PERFORM osm.same('both renames and the run follow', (r->'moved'->>'part_renames') || '/' || (r->'moved'->>'sticker_runs'), '2/1');
END $$;
SELECT osm.same('the Unsorted pile moved whole, still the job''s catch-all', osm.box('b5090c01-0000-0000-0000-0000000509e1'), 'Bed job C · Unsorted · B5090C01 · no place');
SELECT osm.same('B is empty of its own records', osm.more('00000000-0000-0000-0000-0000000509a2'), '0 renames, 0 runs, 0 ties, 0 prices, 0 site ties, 0 site prices');
SELECT osm.same('C holds the renames and the run, and its site the answers and prices', osm.more('00000000-0000-0000-0000-0000000509a3'), '2 renames, 1 runs, 0 ties, 0 prices, 3 site ties, 2 site prices');
SELECT osm.same('the site''s own tee answer stands, the folded rows beside it', osm.one($q$SELECT string_agg(id::text, ',' ORDER BY id) FROM public.on_site_part_ties WHERE development_id = '00000000-0000-0000-0000-0000000509f2' AND job_id IS NULL$q$), '00000000-0000-0000-0000-000000050981,00000000-0000-0000-0000-000000050982,00000000-0000-0000-0000-000000050983');

-- Two Unsorted piles where a count on one resets a line the other fed: said in the plan, and not refused.
DO $$
DECLARE r jsonb;
BEGIN
  r := osm.door('00000000-0000-0000-0000-0000000509a4', '00000000-0000-0000-0000-0000000509a5', true);
  PERFORM osm.same('the fold that changes a line is planned, not refused', (r->>'ok') || ' ' || jsonb_typeof(r->'unsorted_folded'), 'true object');
  PERFORM osm.same('and the plan says the parts do not add up', (r->'on_hand'->>'holds') || ' ' || (r->'before'->'from'->>'parts_on_hand') || '+' || (r->'before'->'to'->>'parts_on_hand') || '→' || (r->'after'->'to'->>'parts_on_hand'), 'false 5+0→0');
  PERFORM osm.same('in words', (position('The parts on hand do not add up: 5 from JQ904 and 0 already on JQ905 read 0 after.' IN r->'on_hand'->>'words') > 0)::text, 'true');
END $$;
RESET ROLE;
SELECT osm.same('that dry run moved nothing', osm.counts('00000000-0000-0000-0000-0000000509a4'), '0 places, 1 containers, 1 rows, 0 box moves, 0 photos, 5 on hand');

DO $$ BEGIN RAISE NOTICE 'on_site_move PASSED'; END $$;
ROLLBACK;
