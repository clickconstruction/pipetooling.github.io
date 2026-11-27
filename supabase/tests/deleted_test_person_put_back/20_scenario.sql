-- Presses nothing takes back (punch list #443, row 12): a deleted test person can be put back (migration
-- *_deleted_test_person_put_back). delete_fresh_person now writes a copy of a test person's users row and workday
-- template into deleted_records_archive under the People record's id, and answers copy_kept.
-- restore_deleted_test_person puts the users row, the People record, the pay row and the workday template back in one
-- transaction, for a developer alone and a person whose name starts with ZZ alone.
--
-- Devon the dev hires eight made-up people with add_worker, as the Hire form does. Ada is the one who goes and comes
-- back: her delete answers copy_kept on the dry run and on the real run, her bundle holds the four copies, the preview
-- answers the counts and leaves nothing behind, the put-back returns the four rows as they were with her employment
-- stint, and a second call finds nothing. She is deleted and put back a second time. Ben's name does not start with
-- ZZ: his delete is as it was, no users copy is kept, and neither door can put him back. Cy, Dee, Eli and Fay are each
-- refused for something that stands in their place. Gus is a test person by his card's name alone. Hal's workday
-- named a job and a bid that are gone, and comes back without them. Rosa the assistant, nobody signed in, a blank key
-- and a key nobody holds are refused, each in its own sentence. Two copies written by hand show the two refusals no
-- delete can stage: a copy whose name does not start with ZZ, and a copy with no id.
--
-- The pay log's trigger is deferred to the end of the transaction; SET CONSTRAINTS ALL IMMEDIATE stands in for that
-- end here, since the bed is one transaction that rolls back. Fixtures made as postgres; every call under test runs
-- as the signed-in person, through RLS. Raises on the first failed assertion; ends with
-- "deleted_test_person_put_back PASSED". See scripts/pgtest-deleted-test-person-put-back.sh. Never against prod.
-- Every person is made up.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA dpp;
CREATE FUNCTION dpp.id(p text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-0000-0000-00004430c1' || p)::uuid $$;
CREATE FUNCTION dpp.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION dpp.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
CREATE FUNCTION dpp.as_nobody() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
END $$;
-- A statement refused with words that hold `want`.
CREATE FUNCTION dpp.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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

-- Who is who: add_worker makes the ids, so the bed keeps them by a short tag.
CREATE TABLE dpp.who (tag text PRIMARY KEY, user_id uuid NOT NULL, person_id uuid NOT NULL);
CREATE FUNCTION dpp.hire(p_tag text, p_name text, p_email text DEFAULT NULL, p_start date DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
DECLARE j jsonb;
BEGIN
  j := public.add_worker(p_name, 'helper', p_email, NULL, NULL, p_start);
  INSERT INTO dpp.who (tag, user_id, person_id) VALUES (p_tag, (j ->> 'user_id')::uuid, (j ->> 'person_id')::uuid);
END $$;
CREATE FUNCTION dpp.u(p_tag text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT user_id FROM dpp.who WHERE tag = p_tag $$;
CREATE FUNCTION dpp.p(p_tag text) RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT person_id FROM dpp.who WHERE tag = p_tag $$;

-- The delete's answer in a few words, with every key it carries.
CREATE FUNCTION dpp.del_words(j jsonb) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT 'deleted=' || (j ->> 'deleted') || ' dry_run=' || (j ->> 'dry_run') || ' copy_kept=' || coalesce(j ->> 'copy_kept', 'absent')
      || ' holds=' || (j -> 'holds')::text || ' removed=' || (j -> 'removed')::text
      || ' keys=' || (SELECT string_agg(k, ',' ORDER BY k COLLATE "C") FROM jsonb_object_keys(j) AS k)
$$;
-- The put-back's answer in a few words: the counts, or the refusal's code, its sentence and its blockers.
CREATE FUNCTION dpp.words(j jsonb) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN (j ->> 'ok')::boolean THEN
      'ok dry_run=' || (j ->> 'dry_run') || ' total=' || (j ->> 'total') || ' inserted=' || (j -> 'inserted')::text
      || ' warnings=' || (j -> 'warnings')::text || ' blockers=' || (j -> 'blockers')::text || ' name=' || (j ->> 'name')
    ELSE (j ->> 'code') || ': ' || (j ->> 'error') || coalesce(' | blockers ' || (j -> 'blockers')::text, '')
  END
$$;

-- What stands for a person, past RLS: the four rows and the employment stint.
CREATE FUNCTION dpp.stands(p_tag text) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT 'users ' || (SELECT count(*) FROM public.users x WHERE x.id = dpp.u(p_tag))
      || ' / people ' || (SELECT count(*) FROM public.people x WHERE x.id = dpp.p(p_tag))
      || ' / pay ' || (SELECT count(*) FROM public.people_pay_config x WHERE x.person_id = dpp.p(p_tag))
      || ' / template ' || (SELECT count(*) FROM public.salary_work_schedule_templates x WHERE x.user_id = dpp.u(p_tag))
      || ' / stints ' || (SELECT count(*) FROM public.employment_stints x WHERE x.person_id = dpp.p(p_tag))
$$;
-- The person's employment stints, past RLS, as "start → end".
CREATE FUNCTION dpp.stint(p_tag text) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(string_agg(coalesce(s.start_date::text, 'unknown') || ' → ' || coalesce(s.end_date::text, 'open'), ', ' ORDER BY s.start_date), 'none')
  FROM public.employment_stints s WHERE s.person_id = dpp.p(p_tag)
$$;
-- The copies Deleted records holds for a person, past RLS, by table: the ones under the People record's id, and the
-- pay row, which its own trigger keeps under the person's name. A star marks a copy that has gone back.
CREATE FUNCTION dpp.archive(p_tag text) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(string_agg(a.table_name || CASE WHEN a.restored_at IS NULL THEN '' ELSE '*' END, ' ' ORDER BY a.table_name COLLATE "C", (a.restored_at IS NULL), a.id), 'nothing')
  FROM public.deleted_records_archive a
  WHERE a.group_key = dpp.p(p_tag)::text
     OR (a.table_name = 'people_pay_config' AND a.row_data ->> 'person_id' = dpp.p(p_tag)::text)
$$;
-- The handle each copy sits under: "id" for the People record's id, "name" for the person's name.
CREATE FUNCTION dpp.handles(p_tag text) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(string_agg(a.table_name || ':' || CASE WHEN a.group_key = dpp.p(p_tag)::text THEN 'id' ELSE 'name' END
                             || ':' || CASE WHEN a.record_id = dpp.u(p_tag)::text THEN 'user' WHEN a.record_id = dpp.p(p_tag)::text THEN 'person' WHEN a.record_id IS NULL THEN 'none' ELSE 'own' END,
                             ' ' ORDER BY a.table_name COLLATE "C"), 'nothing')
  FROM public.deleted_records_archive a
  WHERE a.restored_at IS NULL
    AND (a.group_key = dpp.p(p_tag)::text OR (a.table_name = 'people_pay_config' AND a.row_data ->> 'person_id' = dpp.p(p_tag)::text))
$$;
-- How many of a person's copies the dev's put-back marked as gone back.
CREATE FUNCTION dpp.marked_by_dev(p_tag text) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::text FROM public.deleted_records_archive a
  WHERE a.restored_by = dpp.id('a1') AND a.restored_at IS NOT NULL
    AND (a.group_key = dpp.p(p_tag)::text OR (a.table_name = 'people_pay_config' AND a.row_data ->> 'person_id' = dpp.p(p_tag)::text))
$$;
-- One row against its copy: "same", "missing" when either is not there, or the columns that differ. updated_at is left
-- out on both sides: it is the one column a trigger may write again.
CREATE FUNCTION dpp.cmp(label text, live jsonb, kept jsonb) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT label || ' ' || CASE
    WHEN live IS NULL OR kept IS NULL THEN 'missing'
    WHEN (live - 'updated_at') = (kept - 'updated_at') THEN 'same'
    ELSE 'differs in ' || coalesce((
      SELECT string_agg(k, ',' ORDER BY k COLLATE "C")
      FROM (SELECT jsonb_object_keys(live - 'updated_at') UNION SELECT jsonb_object_keys(kept - 'updated_at')) AS keys(k)
      WHERE (live -> k) IS DISTINCT FROM (kept -> k)), 'nothing named')
  END
$$;
-- The four rows that stand for a person against the copies that went back, past RLS.
CREATE FUNCTION dpp.as_it_was(p_tag text) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT dpp.cmp('users',
           (SELECT to_jsonb(x) FROM public.users x WHERE x.id = dpp.u(p_tag)),
           (SELECT a.row_data FROM public.deleted_records_archive a WHERE a.table_name = 'users' AND a.group_key = dpp.p(p_tag)::text AND a.restored_at IS NOT NULL LIMIT 1))
      || ' / ' || dpp.cmp('people',
           (SELECT to_jsonb(x) FROM public.people x WHERE x.id = dpp.p(p_tag)),
           (SELECT a.row_data FROM public.deleted_records_archive a WHERE a.table_name = 'people' AND a.group_key = dpp.p(p_tag)::text AND a.restored_at IS NOT NULL LIMIT 1))
      || ' / ' || dpp.cmp('pay',
           (SELECT to_jsonb(x) FROM public.people_pay_config x WHERE x.person_id = dpp.p(p_tag)),
           (SELECT a.row_data FROM public.deleted_records_archive a WHERE a.table_name = 'people_pay_config' AND a.row_data ->> 'person_id' = dpp.p(p_tag)::text AND a.restored_at IS NOT NULL LIMIT 1))
      || ' / ' || dpp.cmp('template',
           (SELECT to_jsonb(x) FROM public.salary_work_schedule_templates x WHERE x.user_id = dpp.u(p_tag)),
           (SELECT a.row_data FROM public.deleted_records_archive a WHERE a.table_name = 'salary_work_schedule_templates' AND a.group_key = dpp.p(p_tag)::text AND a.restored_at IS NOT NULL LIMIT 1))
$$;
-- The pay log for one person, past RLS: how many lines, and the newest line's by, writer and reason.
CREATE FUNCTION dpp.paylog(p_name text) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (SELECT count(*) FROM public.pay_admin_events WHERE person_name = p_name)::text || ' line(s)'
    || coalesce((SELECT ' · by ' || coalesce(payload ->> 'by', 'the door') || ' · written by ' || CASE WHEN actor = dpp.id('a1') THEN 'the dev' ELSE coalesce(actor::text, 'nobody') END || ' · ' || reason
                 FROM public.pay_admin_events WHERE person_name = p_name ORDER BY created_at DESC, id DESC LIMIT 1), '')
$$;
-- How Recently deleted lists a person's bundle to the signed-in caller: its kind, its label and its tables. The
-- client sends a bundle of kind person that holds a users copy to restore_deleted_test_person, and every other
-- bundle to restore_deleted_records (restoreFunctionFor).
CREATE FUNCTION dpp.listed(p_tag text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce((SELECT l.kind || ' · ' || l.label || ' · ' || array_to_string(l.tables, ',')
                   FROM public.list_deleted_records(100000) l WHERE l.group_key = dpp.p(p_tag)::text), 'not listed')
$$;
GRANT USAGE ON SCHEMA dpp TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA dpp TO anon, authenticated, service_role;
GRANT SELECT ON dpp.who TO anon, authenticated, service_role;
GRANT INSERT ON dpp.who TO authenticated;

-- Who: Devon the dev and Rosa the assistant, each with a login.
INSERT INTO auth.users (id, email) VALUES (dpp.id('a1'), 'devon@putback.test'), (dpp.id('a2'), 'rosa@putback.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  (dpp.id('a1'), 'devon@putback.test', 'Devon Dev Dpp', 'dev', false, false),
  (dpp.id('a2'), 'rosa@putback.test', 'Rosa Office Dpp', 'assistant', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

-- Devon hires eight people, as the Hire form does: add_worker makes the users row with no login and the People record.
SELECT dpp.as_user(dpp.id('a1'));
SET LOCAL ROLE authenticated;
SELECT dpp.hire('ada', 'ZZ Test Putback Ada', 'ada@putback.test', '2026-11-02');
SELECT dpp.hire('ben', 'Benito Putback Marsh', NULL, '2026-11-03');
SELECT dpp.hire('cy', 'ZZ Test Putback Cy');
SELECT dpp.hire('dee', 'ZZ Test Putback Dee', 'dee@putback.test');
SELECT dpp.hire('eli', 'ZZ Test Putback Eli');
SELECT dpp.hire('fay', 'zz test putback fay');
SELECT dpp.hire('gus', 'Gus Putback Field');
SELECT dpp.hire('hal', 'ZZ Test Putback Hal');
RESET ROLE;

-- The rows the Hire form writes beside them, made as postgres: a pay row for Ada, Ben and Eli, a workday template for
-- Ada and Hal. Gus is a test person by the name set for his card alone.
INSERT INTO public.people_pay_config (person_name, person_id, hourly_wage, is_salary) VALUES
  ('ZZ Test Putback Ada', dpp.p('ada'), 21, false),
  ('Benito Putback Marsh', dpp.p('ben'), 19, false),
  ('ZZ Test Putback Eli', dpp.p('eli'), 18, false);
INSERT INTO public.salary_work_schedule_templates (user_id, mode, segment_a_start_local) VALUES
  (dpp.u('ada'), 'continuous', '07:00'),
  (dpp.u('hal'), 'continuous', '06:30');
UPDATE public.users SET card_name = '  zz Test Card Gus' WHERE id = dpp.u('gus');
-- The fixtures' own pay rows each logged a line, as any new row with a wage does. They are not what is under test.
SET CONSTRAINTS ALL IMMEDIATE;
DELETE FROM public.pay_admin_events WHERE person_name LIKE '%Putback%';
SET CONSTRAINTS ALL DEFERRED;
SELECT dpp.same('the pay log starts clean', dpp.paylog('ZZ Test Putback Ada'), '0 line(s)');
SELECT dpp.same('Ada stands: her four rows and the stint her start date made', dpp.stands('ada'), 'users 1 / people 1 / pay 1 / template 1 / stints 1');
SELECT dpp.same('nothing of Ada is in Deleted records yet', dpp.archive('ada'), 'nothing');

-- ---------------------------------------------------------------------------------------------------------------
-- 1. The delete of a test person keeps a copy of the users row and of the workday template.
SELECT dpp.as_user(dpp.id('a1'));
SET LOCAL ROLE authenticated;
SELECT dpp.same('the dry run says a copy will be kept, and what goes with her',
  dpp.del_words(public.delete_fresh_person(dpp.u('ada'), true)),
  'deleted=false dry_run=true copy_kept=true holds=[] removed=["pay row", "workday template"] keys=copy_kept,deleted,dry_run,holds,name,person_id,removed,user_id');
SELECT dpp.same('the dry run deleted nothing', dpp.stands('ada'), 'users 1 / people 1 / pay 1 / template 1 / stints 1');
SELECT dpp.same('the dry run kept no copy', dpp.archive('ada'), 'nothing');
SELECT dpp.same('the delete says a copy was kept',
  dpp.del_words(public.delete_fresh_person(dpp.u('ada'), false)),
  'deleted=true dry_run=false copy_kept=true holds=[] removed=["pay row", "workday template"] keys=copy_kept,deleted,dry_run,holds,name,person_id,removed,user_id');
SELECT dpp.same('Ada is gone: the four rows, and the stint with the record', dpp.stands('ada'), 'users 0 / people 0 / pay 0 / template 0 / stints 0');
SELECT dpp.same('Deleted records holds the four copies', dpp.archive('ada'), 'people people_pay_config salary_work_schedule_templates users');
SELECT dpp.same('the users row, the template and the People record sit under the record''s id, the pay row under her name', dpp.handles('ada'),
  'people:id:person people_pay_config:name:none salary_work_schedule_templates:id:none users:id:user');
SELECT dpp.same('Recently deleted lists her as a person whose bundle holds a users copy', dpp.listed('ada'),
  'person · ZZ Test Putback Ada · people,salary_work_schedule_templates,users');
SELECT dpp.same('the delete wrote no line on the pay log', dpp.paylog('ZZ Test Putback Ada'), '0 line(s)');
RESET ROLE;

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Who may not put her back, and a key that names nobody.
SELECT dpp.as_user(dpp.id('a2'));
SET LOCAL ROLE authenticated;
SELECT dpp.same('an assistant is refused the preview', dpp.words(public.restore_deleted_test_person(dpp.p('ada')::text, true)), 'forbidden: Only devs can restore deleted records.');
SELECT dpp.same('an assistant is refused the put-back', dpp.words(public.restore_deleted_test_person(dpp.p('ada')::text, false)), 'forbidden: Only devs can restore deleted records.');
SELECT dpp.same('an assistant is listed nothing', dpp.listed('ada'), 'not listed');
RESET ROLE;
SELECT dpp.as_nobody();
SELECT dpp.same('with nobody signed in the door says so', dpp.words(public.restore_deleted_test_person(dpp.p('ada')::text, false)), 'not_authenticated: Not authenticated.');
SET LOCAL ROLE anon;
SELECT dpp.refused('signed out, the door refuses', format($q$SELECT public.restore_deleted_test_person(%L, false)$q$, dpp.p('ada')::text), 'permission denied');
SELECT dpp.refused('signed out, the delete refuses', format($q$SELECT public.delete_fresh_person(%L, true)$q$, dpp.u('ben')), 'permission denied');
RESET ROLE;
SELECT dpp.same('none of them put anything back', dpp.stands('ada') || ' | ' || dpp.archive('ada'),
  'users 0 / people 0 / pay 0 / template 0 / stints 0 | people people_pay_config salary_work_schedule_templates users');

SELECT dpp.as_user(dpp.id('a1'));
SET LOCAL ROLE authenticated;
SELECT dpp.same('a blank key is refused', dpp.words(public.restore_deleted_test_person('   ', false)), 'not_found: Say which person.');
SELECT dpp.same('no key is refused', dpp.words(public.restore_deleted_test_person(NULL, true)), 'not_found: Say which person.');
SELECT dpp.same('a key nobody holds is refused', dpp.words(public.restore_deleted_test_person(dpp.id('99')::text, true)),
  'not_found: No copy of this person’s account row was kept, so the person cannot be put back.');

-- ---------------------------------------------------------------------------------------------------------------
-- 3. The preview, then the put-back.
SELECT dpp.same('the preview answers the four counts',
  dpp.words(public.restore_deleted_test_person(dpp.p('ada')::text, true)),
  'ok dry_run=true total=4 inserted={"users": 1, "people": 1, "people_pay_config": 1, "salary_work_schedule_templates": 1} warnings=[] blockers=[] name=ZZ Test Putback Ada');
SELECT dpp.same('the preview names its key', public.restore_deleted_test_person(dpp.p('ada')::text, true) ->> 'group_key', dpp.p('ada')::text);
SELECT dpp.same('the preview left nothing behind', dpp.stands('ada') || ' | ' || dpp.archive('ada'),
  'users 0 / people 0 / pay 0 / template 0 / stints 0 | people people_pay_config salary_work_schedule_templates users');
SET CONSTRAINTS ALL IMMEDIATE;
SELECT dpp.same('the preview wrote no line on the pay log', dpp.paylog('ZZ Test Putback Ada'), '0 line(s)');
SET CONSTRAINTS ALL DEFERRED;

SELECT dpp.same('the put-back answers the four counts',
  dpp.words(public.restore_deleted_test_person(dpp.p('ada')::text, false)),
  'ok dry_run=false total=4 inserted={"users": 1, "people": 1, "people_pay_config": 1, "salary_work_schedule_templates": 1} warnings=[] blockers=[] name=ZZ Test Putback Ada');
SELECT dpp.same('Ada stands again: the four rows and her stint', dpp.stands('ada'), 'users 1 / people 1 / pay 1 / template 1 / stints 1');
SELECT dpp.same('each row is as it was when it was deleted', dpp.as_it_was('ada'), 'users same / people same / pay same / template same');
SELECT dpp.same('her stint is back from the record''s own start date', dpp.stint('ada'), '2026-11-02 → open');
SELECT dpp.same('the four copies are marked as gone back', dpp.archive('ada'), 'people* people_pay_config* salary_work_schedule_templates* users*');
SELECT dpp.same('and marked by the dev', dpp.marked_by_dev('ada'), '4');
SELECT dpp.same('Recently deleted lists her no more', dpp.listed('ada'), 'not listed');
SET CONSTRAINTS ALL IMMEDIATE;
SELECT dpp.same('the put-back wrote one line on the pay log, through the pay row''s own trigger', dpp.paylog('ZZ Test Putback Ada'),
  '1 line(s) · by screen · written by the dev · Changed on a screen. No reason was asked.');
SET CONSTRAINTS ALL DEFERRED;
SELECT dpp.same('a second put-back finds no copy', dpp.words(public.restore_deleted_test_person(dpp.p('ada')::text, false)),
  'not_found: No copy of this person’s account row was kept, so the person cannot be put back.');
SELECT dpp.same('and changes nothing', dpp.stands('ada'), 'users 1 / people 1 / pay 1 / template 1 / stints 1');

-- She can be deleted and put back again: the second delete keeps new copies, and the put-back takes the ones that
-- have not gone back.
SELECT dpp.same('deleted a second time, a copy is kept again', dpp.del_words(public.delete_fresh_person(dpp.u('ada'), false)),
  'deleted=true dry_run=false copy_kept=true holds=[] removed=["pay row", "workday template"] keys=copy_kept,deleted,dry_run,holds,name,person_id,removed,user_id');
SELECT dpp.same('the new copies stand beside the old ones', dpp.archive('ada'),
  'people* people people_pay_config* people_pay_config salary_work_schedule_templates* salary_work_schedule_templates users* users');
SELECT dpp.same('put back a second time', dpp.words(public.restore_deleted_test_person(dpp.p('ada')::text, false)),
  'ok dry_run=false total=4 inserted={"users": 1, "people": 1, "people_pay_config": 1, "salary_work_schedule_templates": 1} warnings=[] blockers=[] name=ZZ Test Putback Ada');
SELECT dpp.same('she stands again, one of each', dpp.stands('ada'), 'users 1 / people 1 / pay 1 / template 1 / stints 1');
RESET ROLE;

-- ---------------------------------------------------------------------------------------------------------------
-- 4. A person whose name does not start with ZZ: the delete is as it was, and no copy of the users row is kept.
SELECT dpp.as_user(dpp.id('a1'));
SET LOCAL ROLE authenticated;
SELECT dpp.same('the dry run says no copy will be kept', dpp.del_words(public.delete_fresh_person(dpp.u('ben'), true)),
  'deleted=false dry_run=true copy_kept=false holds=[] removed=["pay row"] keys=copy_kept,deleted,dry_run,holds,name,person_id,removed,user_id');
SELECT dpp.same('the delete says no copy was kept', dpp.del_words(public.delete_fresh_person(dpp.u('ben'), false)),
  'deleted=true dry_run=false copy_kept=false holds=[] removed=["pay row"] keys=copy_kept,deleted,dry_run,holds,name,person_id,removed,user_id');
SELECT dpp.same('Ben is gone', dpp.stands('ben'), 'users 0 / people 0 / pay 0 / template 0 / stints 0');
SELECT dpp.same('Deleted records holds what its own triggers kept, and no users row', dpp.archive('ben'), 'people people_pay_config');
SELECT dpp.same('Recently deleted lists him as a person with no users copy, so the client keeps the old function', dpp.listed('ben'),
  'person · Benito Putback Marsh · people');
SELECT dpp.same('the put-back says no copy was kept', dpp.words(public.restore_deleted_test_person(dpp.p('ben')::text, false)),
  'not_found: No copy of this person’s account row was kept, so the person cannot be put back.');
SELECT dpp.same('the old function still cannot put him back: a People record may not stand without its users row',
  left(dpp.words(public.restore_deleted_records(dpp.p('ben')::text, true)), 30), '23502: A person is a users row');
SELECT dpp.same('Ben stays gone', dpp.stands('ben') || ' | ' || dpp.archive('ben'), 'users 0 / people 0 / pay 0 / template 0 / stints 0 | people people_pay_config');

-- ---------------------------------------------------------------------------------------------------------------
-- 5. A test person is refused when something stands in their place. Each is deleted first, with a copy kept.
SELECT dpp.same('Cy, Dee, Eli and Fay are deleted with a copy kept',
  (public.delete_fresh_person(dpp.u('cy')) ->> 'copy_kept') || ' ' || (public.delete_fresh_person(dpp.u('dee')) ->> 'copy_kept') || ' '
  || (public.delete_fresh_person(dpp.u('eli')) ->> 'copy_kept') || ' ' || (public.delete_fresh_person(dpp.u('fay')) ->> 'copy_kept'),
  'true true true true');
-- Dee's address is taken by a person hired after she went.
SELECT dpp.hire('dee2', 'Odessa Putback Reyes', 'dee@putback.test');
RESET ROLE;
-- Made as postgres: a users row on Cy's id, a pay row under Eli's name, and a People record on Fay's id.
INSERT INTO public.users (id, email, name, role, login_attached_at) VALUES (dpp.u('cy'), NULL, 'Someone Else Putback', 'helpers', NULL);
INSERT INTO public.people_pay_config (person_name) VALUES ('ZZ Test Putback Eli');
INSERT INTO public.people (id, master_user_id, kind, name, account_user_id) VALUES (dpp.p('fay'), dpp.id('a1'), 'helper', 'Someone Else On Fay', dpp.id('a2'));
-- Two copies no delete can make: one whose name does not start with ZZ, one with no id.
INSERT INTO public.deleted_records_archive (table_name, record_id, group_key, row_data, deleted_by) VALUES
  ('users', dpp.id('f1')::text, 'dpp-not-a-test-person', jsonb_build_object('id', dpp.id('f1'), 'name', 'Real Putback Person', 'card_name', NULL), dpp.id('a1')),
  ('users', NULL, 'dpp-copy-with-no-id', jsonb_build_object('name', 'ZZ Test Putback Nameless'), dpp.id('a1'));

SELECT dpp.as_user(dpp.id('a1'));
SET LOCAL ROLE authenticated;
SELECT dpp.same('a person on the roster already is refused', dpp.words(public.restore_deleted_test_person(dpp.p('cy')::text, false)),
  'blocked: ZZ Test Putback Cy is on the roster already. Nothing was put back. | blockers ["ZZ Test Putback Cy is on the roster already."]');
SELECT dpp.same('a person whose email another holds is refused', dpp.words(public.restore_deleted_test_person(dpp.p('dee')::text, false)),
  'blocked: Another person has this person’s email now. Change that email first. | blockers ["Another person has this person’s email now."]');
SELECT dpp.same('a person whose name holds a pay row is refused', dpp.words(public.restore_deleted_test_person(dpp.p('eli')::text, false)),
  'blocked: A pay row stands under this person’s name now. Rename or delete that person first. | blockers ["A pay row stands under this person’s name now."]');
SELECT dpp.same('a person whose People record stands is refused', dpp.words(public.restore_deleted_test_person(dpp.p('fay')::text, false)),
  'blocked: zz test putback fay has a People record already. Nothing was put back. | blockers ["zz test putback fay has a People record already."]');
SELECT dpp.same('a copy whose name does not start with ZZ is refused', dpp.words(public.restore_deleted_test_person('dpp-not-a-test-person', false)),
  'not_test: Only a test person can be put back. This person’s name does not start with ZZ.');
SELECT dpp.same('a copy with no id is refused', dpp.words(public.restore_deleted_test_person('dpp-copy-with-no-id', false)),
  'blocked: The copy of the account row has no id. Nothing was put back. | blockers ["The copy of the account row has no id."]');
SELECT dpp.same('each preview is refused the same way',
  (public.restore_deleted_test_person(dpp.p('cy')::text, true) ->> 'code') || ' ' || (public.restore_deleted_test_person(dpp.p('dee')::text, true) ->> 'code') || ' '
  || (public.restore_deleted_test_person(dpp.p('eli')::text, true) ->> 'code') || ' ' || (public.restore_deleted_test_person(dpp.p('fay')::text, true) ->> 'code') || ' '
  || (public.restore_deleted_test_person('dpp-not-a-test-person', true) ->> 'code') || ' ' || (public.restore_deleted_test_person('dpp-copy-with-no-id', true) ->> 'code'),
  'blocked blocked blocked blocked not_test blocked');
SELECT dpp.same('no refusal put anything back: every copy is still waiting',
  dpp.archive('cy') || ' | ' || dpp.archive('dee') || ' | ' || dpp.archive('eli') || ' | ' || dpp.archive('fay'),
  'people users | people users | people people_pay_config users | people users');
SELECT dpp.same('Dee and Eli did not come back in part', dpp.stands('dee') || ' | ' || dpp.stands('eli'),
  'users 0 / people 0 / pay 0 / template 0 / stints 0 | users 0 / people 0 / pay 0 / template 0 / stints 0');

-- ---------------------------------------------------------------------------------------------------------------
-- 6. The ZZ convention reads the card's name too, in any case and after trimming. And a workday that named a job or a
-- bid which is gone comes back without that name.
SELECT dpp.same('a person is a test person by the name set for their card', dpp.del_words(public.delete_fresh_person(dpp.u('gus'), true)),
  'deleted=false dry_run=true copy_kept=true holds=[] removed=[] keys=copy_kept,deleted,dry_run,holds,name,person_id,removed,user_id');
SELECT dpp.same('Gus goes with a copy', public.delete_fresh_person(dpp.u('gus')) ->> 'copy_kept', 'true');
SELECT dpp.same('and comes back by his card''s name', dpp.words(public.restore_deleted_test_person(dpp.p('gus')::text, false)),
  'ok dry_run=false total=2 inserted={"users": 1, "people": 1} warnings=[] blockers=[] name=Gus Putback Field');
SELECT dpp.same('Gus stands again, with no pay row and no template, as he was', dpp.stands('gus'), 'users 1 / people 1 / pay 0 / template 0 / stints 0');
SELECT dpp.same('Hal is deleted with a copy', public.delete_fresh_person(dpp.u('hal')) ->> 'copy_kept', 'true');
RESET ROLE;
-- As postgres: Hal's kept workday is made to name a job and a bid that are not there, as if both were deleted since.
UPDATE public.deleted_records_archive
   SET row_data = row_data || jsonb_build_object('job_ledger_id', dpp.id('e1'), 'segment_b_bid_id', dpp.id('e2'))
 WHERE table_name = 'salary_work_schedule_templates' AND group_key = dpp.p('hal')::text;
SELECT dpp.as_user(dpp.id('a1'));
SET LOCAL ROLE authenticated;
SELECT dpp.same('Hal comes back, and the answer names what his workday lost',
  dpp.words(public.restore_deleted_test_person(dpp.p('hal')::text, false)),
  'ok dry_run=false total=3 inserted={"users": 1, "people": 1, "salary_work_schedule_templates": 1} warnings=["workday template: job_ledger_id cleared, because that job is gone", "workday template: segment_b_bid_id cleared, because that bid is gone"] blockers=[] name=ZZ Test Putback Hal');
RESET ROLE;
SELECT dpp.same('his workday keeps its hours and names no job and no bid',
  (SELECT t.mode || ' ' || t.segment_a_start_local::text || ' ' || coalesce(t.job_ledger_id::text, 'no job') || ' ' || coalesce(t.segment_b_bid_id::text, 'no bid')
   FROM public.salary_work_schedule_templates t WHERE t.user_id = dpp.u('hal')),
  'continuous 06:30:00 no job no bid');

DO $$ BEGIN RAISE NOTICE 'deleted_test_person_put_back PASSED'; END $$;
ROLLBACK;
