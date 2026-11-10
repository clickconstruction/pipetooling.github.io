-- Bid photos (punch list #306 PR 1, migration *_bid_photos): the table's gate is the bid's own, read through bids
-- under the caller's RLS. Whoever reads a bid reads its photos and adds one as themselves; a primary only on a bid
-- they estimate, manage or made; a subcontractor, a superintendent and a primary on no bid read nothing and add
-- nothing. The adder and the office change a photo; an estimator does not change another's. Only an un-added shot of
-- one's own is deleted. A training account writes nothing; a twin writes only on a bid of its own. One Drive file makes
-- one row. The bucket's objects follow the same gate from the path's first folder, and a path that is not a bid's is
-- refused as a row-level violation, never a cast error. Fixtures are written as postgres; the tries run as each account
-- under RLS; everything rolls back. Raises on the first failed assertion; ends with "bid_photos PASSED". See
-- scripts/pgtest-bid-photos.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Dee is a dev, Ann an assistant, Eve an estimator, Pat a primary who manages bid A, Quinn a primary on no bid,
-- Sam a subcontractor, Sue a superintendent, Tess an estimator in training, Tom an estimator twin with bid T.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000306a001', 'dee@bidphotos.test'),
  ('00000000-0000-0000-0000-00000306a002', 'ann@bidphotos.test'),
  ('00000000-0000-0000-0000-00000306a003', 'eve@bidphotos.test'),
  ('00000000-0000-0000-0000-00000306a004', 'pat@bidphotos.test'),
  ('00000000-0000-0000-0000-00000306a005', 'quinn@bidphotos.test'),
  ('00000000-0000-0000-0000-00000306a006', 'sam@bidphotos.test'),
  ('00000000-0000-0000-0000-00000306a007', 'sue@bidphotos.test'),
  ('00000000-0000-0000-0000-00000306a008', 'tess@bidphotos.test'),
  ('00000000-0000-0000-0000-00000306a009', 'tom@bidphotos.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-00000306a001', 'dee@bidphotos.test', 'Dee Dev', 'dev', false, false),
  ('00000000-0000-0000-0000-00000306a002', 'ann@bidphotos.test', 'Ann Assistant', 'assistant', false, false),
  ('00000000-0000-0000-0000-00000306a003', 'eve@bidphotos.test', 'Eve Estimator', 'estimator', false, false),
  ('00000000-0000-0000-0000-00000306a004', 'pat@bidphotos.test', 'Pat Primary', 'primary', false, false),
  ('00000000-0000-0000-0000-00000306a005', 'quinn@bidphotos.test', 'Quinn Primary', 'primary', false, false),
  ('00000000-0000-0000-0000-00000306a006', 'sam@bidphotos.test', 'Sam Sub', 'subcontractor', false, false),
  ('00000000-0000-0000-0000-00000306a007', 'sue@bidphotos.test', 'Sue Super', 'superintendent', false, false),
  ('00000000-0000-0000-0000-00000306a008', 'tess@bidphotos.test', 'Tess Training', 'estimator', true, false),
  ('00000000-0000-0000-0000-00000306a009', 'tom@bidphotos.test', 'Tom Twin', 'estimator', false, true)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-00000306f001', 'Bid Photos Bed Work');
-- Bid A: Eve made it, Pat manages it. Bid B: Eve's alone. Bid T: the twin's own.
INSERT INTO public.bids (id, created_by, account_manager_id, service_type_id, project_name) VALUES
  ('00000000-0000-0000-0000-00000306b001', '00000000-0000-0000-0000-00000306a003', '00000000-0000-0000-0000-00000306a004', '00000000-0000-0000-0000-00000306f001', 'Bid photos bed A'),
  ('00000000-0000-0000-0000-00000306b002', '00000000-0000-0000-0000-00000306a003', NULL, '00000000-0000-0000-0000-00000306f001', 'Bid photos bed B'),
  ('00000000-0000-0000-0000-00000306b003', '00000000-0000-0000-0000-00000306a009', NULL, '00000000-0000-0000-0000-00000306f001', 'Bid photos bed T');
-- One photo on B, Eve's, already added: what a primary off the bid must not see.
INSERT INTO public.bid_photos (id, bid_id, by_user_id, by_name, added_at, storage_path) VALUES
  ('00000000-0000-0000-0000-00000306c900', '00000000-0000-0000-0000-00000306b002', '00000000-0000-0000-0000-00000306a003', 'Eve Estimator', now(), '00000000-0000-0000-0000-00000306b002/00000000-0000-0000-0000-00000306c900.jpg');

CREATE SCHEMA bp;
GRANT USAGE ON SCHEMA bp TO authenticated;
CREATE FUNCTION bp.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- The claims PostgREST would set for a signed-in account, for the rest of the transaction.
CREATE FUNCTION bp.sign_in(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
CREATE FUNCTION bp.sign_out() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
END $$;
-- What a write does under the caller's RLS: 'rows N', or the sqlstate it raised (42501 is a row-level violation).
CREATE FUNCTION bp.try(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  EXECUTE p_sql;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN 'rows ' || n;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END $$;
-- A write that must not land, whatever refuses it (a policy's 42501, a training trigger's own code).
CREATE FUNCTION bp.refused(p_sql text) RETURNS text LANGUAGE sql AS $$
  SELECT CASE WHEN t.r LIKE 'rows %' AND t.r <> 'rows 0' THEN 'landed' ELSE 'refused' END FROM (SELECT bp.try(p_sql) AS r) t
$$;
-- A photo's row, read past RLS.
CREATE FUNCTION bp.photo(p_id uuid) RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT name || ' · ' || CASE WHEN removed_at IS NULL THEN 'stands' ELSE 'removed' END FROM public.bid_photos WHERE id = p_id), 'gone')
$$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA bp TO authenticated;

-- The structure: RLS is on, and the four fences reached the new table.
SELECT bp.same('row security is on', (SELECT relrowsecurity::text FROM pg_class WHERE oid = 'public.bid_photos'::regclass), 'true');
SELECT bp.same('the twin fence and the archived fence are on the table', (
  SELECT count(*)::text FROM pg_policies WHERE schemaname = 'public' AND tablename = 'bid_photos'
    AND policyname IN ('digital_twin_write_fence_insert', 'digital_twin_write_fence_update', 'digital_twin_write_fence_delete', 'archived_fence')
), '4');
SELECT bp.same('the bucket is private, 2 MB, images only', (SELECT public::text || ' ' || file_size_limit::text || ' ' || array_to_string(allowed_mime_types, ',') FROM storage.buckets WHERE id = 'bid-photos'), 'false 2097152 image/jpeg,image/png,image/webp');

SET ROLE authenticated;

-- Eve, an estimator: reads, adds as herself, never as someone else.
SELECT bp.sign_in('00000000-0000-0000-0000-00000306a003');
SELECT bp.same('Eve reads the photo on B', (SELECT count(*) FROM public.bid_photos WHERE bid_id = '00000000-0000-0000-0000-00000306b002')::text, '1');
SELECT bp.same('Eve adds a photo to A as herself', bp.try($q$
  INSERT INTO public.bid_photos (id, bid_id, by_user_id, by_name, name, storage_path)
  VALUES ('00000000-0000-0000-0000-00000306c001', '00000000-0000-0000-0000-00000306b001', '00000000-0000-0000-0000-00000306a003', 'Eve Estimator', 'Mechanical room', '00000000-0000-0000-0000-00000306b001/00000000-0000-0000-0000-00000306c001.jpg')
$q$), 'rows 1');
SELECT bp.same('Eve cannot add one in Dee''s name', bp.try($q$
  INSERT INTO public.bid_photos (bid_id, by_user_id) VALUES ('00000000-0000-0000-0000-00000306b001', '00000000-0000-0000-0000-00000306a001')
$q$), '42501');
SELECT bp.same('Eve takes a second shot she has not added', bp.try($q$
  INSERT INTO public.bid_photos (id, bid_id, by_user_id) VALUES ('00000000-0000-0000-0000-00000306c002', '00000000-0000-0000-0000-00000306b001', '00000000-0000-0000-0000-00000306a003')
$q$), 'rows 1');
SELECT bp.same('Eve presses Add on the first', bp.try($q$UPDATE public.bid_photos SET added_at = now() WHERE id = '00000000-0000-0000-0000-00000306c001'$q$), 'rows 1');
SELECT bp.same('an added photo is not deleted, even by its adder', bp.try($q$DELETE FROM public.bid_photos WHERE id = '00000000-0000-0000-0000-00000306c001'$q$), 'rows 0');
SELECT bp.same('Eve puts the shot in the bucket under bid A', bp.try($q$
  INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('bid-photos', '00000000-0000-0000-0000-00000306b001/00000000-0000-0000-0000-00000306c001.jpg', '00000000-0000-0000-0000-00000306a003')
$q$), 'rows 1');
SELECT bp.same('a path that is not a bid''s is refused, not an error', bp.try($q$
  INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('bid-photos', 'not-a-bid/shot.jpg', '00000000-0000-0000-0000-00000306a003')
$q$), '42501');
SELECT bp.same('a path with no folder is refused too', bp.try($q$
  INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('bid-photos', 'shot.jpg', '00000000-0000-0000-0000-00000306a003')
$q$), '42501');

-- Pat, a primary who manages A: A is theirs, B is not.
SELECT bp.sign_in('00000000-0000-0000-0000-00000306a004');
SELECT bp.same('Pat reads A''s photos', (SELECT count(*) FROM public.bid_photos WHERE bid_id = '00000000-0000-0000-0000-00000306b001')::text, '2');
SELECT bp.same('Pat reads none of B''s', (SELECT count(*) FROM public.bid_photos WHERE bid_id = '00000000-0000-0000-0000-00000306b002')::text, '0');
SELECT bp.same('Pat adds a photo to A', bp.try($q$
  INSERT INTO public.bid_photos (id, bid_id, by_user_id, by_name, name, added_at)
  VALUES ('00000000-0000-0000-0000-00000306c003', '00000000-0000-0000-0000-00000306b001', '00000000-0000-0000-0000-00000306a004', 'Pat Primary', 'Gas meter', now())
$q$), 'rows 1');
SELECT bp.same('Pat cannot add one to B', bp.try($q$
  INSERT INTO public.bid_photos (bid_id, by_user_id) VALUES ('00000000-0000-0000-0000-00000306b002', '00000000-0000-0000-0000-00000306a004')
$q$), '42501');
SELECT bp.same('Pat does not rename Eve''s photo', bp.try($q$UPDATE public.bid_photos SET name = 'Mine now' WHERE id = '00000000-0000-0000-0000-00000306c001'$q$), 'rows 0');
SELECT bp.same('Pat does not delete Eve''s un-added shot', bp.try($q$DELETE FROM public.bid_photos WHERE id = '00000000-0000-0000-0000-00000306c002'$q$), 'rows 0');
SELECT bp.same('Pat puts a shot in the bucket under A', bp.try($q$
  INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('bid-photos', '00000000-0000-0000-0000-00000306b001/00000000-0000-0000-0000-00000306c003.jpg', '00000000-0000-0000-0000-00000306a004')
$q$), 'rows 1');
SELECT bp.same('and none under B', bp.try($q$
  INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('bid-photos', '00000000-0000-0000-0000-00000306b002/00000000-0000-0000-0000-00000306c004.jpg', '00000000-0000-0000-0000-00000306a004')
$q$), '42501');
SELECT bp.same('Pat reads A''s two objects', (SELECT count(*) FROM storage.objects WHERE bucket_id = 'bid-photos')::text, '2');

-- Eve again: an estimator changes her own, not Pat's, and discards her un-added shot.
SELECT bp.sign_in('00000000-0000-0000-0000-00000306a003');
SELECT bp.same('Eve renames her own photo', bp.try($q$UPDATE public.bid_photos SET name = 'Mechanical room north' WHERE id = '00000000-0000-0000-0000-00000306c001'$q$), 'rows 1');
SELECT bp.same('Eve does not change Pat''s', bp.try($q$UPDATE public.bid_photos SET name = 'Mine now' WHERE id = '00000000-0000-0000-0000-00000306c003'$q$), 'rows 0');
SELECT bp.same('Eve discards her un-added shot', bp.try($q$DELETE FROM public.bid_photos WHERE id = '00000000-0000-0000-0000-00000306c002'$q$), 'rows 1');
SELECT bp.same('Eve deletes her own object and not Pat''s', bp.try($q$DELETE FROM storage.objects WHERE bucket_id = 'bid-photos'$q$), 'rows 1');

-- Ann, the office: removes anyone's photo, and the row stays for an Undo.
SELECT bp.sign_in('00000000-0000-0000-0000-00000306a002');
SELECT bp.same('Ann removes Pat''s photo', bp.try($q$UPDATE public.bid_photos SET removed_at = now(), removed_by = '00000000-0000-0000-0000-00000306a002' WHERE id = '00000000-0000-0000-0000-00000306c003'$q$), 'rows 1');
SELECT bp.same('the row stays', bp.photo('00000000-0000-0000-0000-00000306c003'), 'Gas meter · removed');
SELECT bp.same('Ann brings it back', bp.try($q$UPDATE public.bid_photos SET removed_at = NULL, removed_by = NULL WHERE id = '00000000-0000-0000-0000-00000306c003'$q$), 'rows 1');

-- Quinn (a primary on no bid), Sam (a subcontractor) and Sue (a superintendent): nothing to read, nothing to add.
SELECT bp.sign_in('00000000-0000-0000-0000-00000306a005');
SELECT bp.same('Quinn reads no photo', (SELECT count(*) FROM public.bid_photos)::text, '0');
SELECT bp.same('Quinn cannot add one to A', bp.try($q$INSERT INTO public.bid_photos (bid_id, by_user_id) VALUES ('00000000-0000-0000-0000-00000306b001', '00000000-0000-0000-0000-00000306a005')$q$), '42501');
SELECT bp.sign_in('00000000-0000-0000-0000-00000306a006');
SELECT bp.same('Sam reads no photo', (SELECT count(*) FROM public.bid_photos)::text, '0');
SELECT bp.same('Sam cannot add one', bp.try($q$INSERT INTO public.bid_photos (bid_id, by_user_id) VALUES ('00000000-0000-0000-0000-00000306b001', '00000000-0000-0000-0000-00000306a006')$q$), '42501');
SELECT bp.same('Sam reads no object', (SELECT count(*) FROM storage.objects WHERE bucket_id = 'bid-photos')::text, '0');
SELECT bp.same('Sam cannot put one in the bucket', bp.try($q$
  INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('bid-photos', '00000000-0000-0000-0000-00000306b001/00000000-0000-0000-0000-00000306c005.jpg', '00000000-0000-0000-0000-00000306a006')
$q$), '42501');
SELECT bp.sign_in('00000000-0000-0000-0000-00000306a007');
SELECT bp.same('Sue reads no photo', (SELECT count(*) FROM public.bid_photos)::text, '0');
SELECT bp.same('Sue cannot add one', bp.try($q$INSERT INTO public.bid_photos (bid_id, by_user_id) VALUES ('00000000-0000-0000-0000-00000306b001', '00000000-0000-0000-0000-00000306a007')$q$), '42501');

-- Tess, in training: sees the photos, writes nothing.
SELECT bp.sign_in('00000000-0000-0000-0000-00000306a008');
SELECT bp.same('Tess reads A''s photos', (SELECT count(*) FROM public.bid_photos WHERE bid_id = '00000000-0000-0000-0000-00000306b001')::text, '2');
SELECT bp.same('Tess cannot add one', bp.refused($q$INSERT INTO public.bid_photos (bid_id, by_user_id) VALUES ('00000000-0000-0000-0000-00000306b001', '00000000-0000-0000-0000-00000306a008')$q$), 'refused');

-- Tom, a twin: writes on a bid of its own and nowhere else.
SELECT bp.sign_in('00000000-0000-0000-0000-00000306a009');
SELECT bp.same('Tom cannot add a photo to Eve''s bid', bp.try($q$INSERT INTO public.bid_photos (bid_id, by_user_id) VALUES ('00000000-0000-0000-0000-00000306b001', '00000000-0000-0000-0000-00000306a009')$q$), '42501');
SELECT bp.same('Tom adds one to its own bid', bp.try($q$INSERT INTO public.bid_photos (bid_id, by_user_id) VALUES ('00000000-0000-0000-0000-00000306b003', '00000000-0000-0000-0000-00000306a009')$q$), 'rows 1');

SELECT bp.sign_out();
RESET ROLE;

-- The service role's adoption: one Drive file, one row.
INSERT INTO public.bid_photos (bid_id, name, drive_file_id, added_at, filed_at) VALUES ('00000000-0000-0000-0000-00000306b001', 'From Drive', 'drive-file-306', now(), now());
SELECT bp.same('the same Drive file is not adopted twice', bp.try($q$INSERT INTO public.bid_photos (bid_id, name, drive_file_id) VALUES ('00000000-0000-0000-0000-00000306b001', 'From Drive again', 'drive-file-306')$q$), '23505');
-- A bid that goes takes its photo rows with it.
DELETE FROM public.bids WHERE id = '00000000-0000-0000-0000-00000306b002';
SELECT bp.same('a deleted bid''s photo rows go with it', bp.photo('00000000-0000-0000-0000-00000306c900'), 'gone');

SELECT 'bid_photos PASSED';
ROLLBACK;
