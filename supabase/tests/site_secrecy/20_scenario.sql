-- Secrecy on a site (punch list #439, piece 4, migration *_site_secrecy). The address rule in SQL is the app's on a
-- list of addresses whose keys the app wrote. A job whose rows name no site answers the gate's questions exactly as
-- the rule of before answers them, for every role. Turning secrecy on for a development puts the site's paper on each
-- of its jobs and on no other; a person who has not signed is shut out of all of them, and one signature opens them
-- all; a sub with a login is not asked and is not shut out; a new job at the site gets its row by the trigger; a job
-- moved away loses it and one moved back gets it again; an address is a site by its key and by a Same place answer;
-- a site's paper is not taken off one job; turning off opens the jobs and keeps the signatures, and turning on again
-- asks only those who never signed. Fixtures are written as postgres; the presses run as each user; everything rolls
-- back. Raises on the first failed assertion; ends with "site_secrecy PASSED". See scripts/pgtest-site-secrecy.sh.
-- Never against prod. Every person, job, development and address is made up.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA ss;
CREATE FUNCTION ss.id(p text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-0000-0000-0000004394' || p)::uuid $$;
CREATE FUNCTION ss.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION ss.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION ss.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
CREATE FUNCTION ss.signed_out() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', '', true);
END $$;
-- The gate's rule as it stood before this migration, written out: a user owes a job when one of its live papers has
-- no signed copy of theirs. No site is in it.
CREATE FUNCTION ss.owes_before(p_job uuid, p_user uuid) RETURNS boolean LANGUAGE sql AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.job_required_papers r
    WHERE r.job_id = p_job AND r.removed_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.person_contract_documents d JOIN public.people p ON p.id = d.person_id
        WHERE d.job_required_paper_id = r.id AND d.status = 'signed' AND p.account_user_id = p_user AND p.archived_at IS NULL
      )
  )
$$;
-- What one user is told about one job, as one line: closed to me | shut to me | in the shut set | in the closed set.
CREATE FUNCTION ss.told(p_job uuid) RETURNS text LANGUAGE sql AS $$
  SELECT CASE WHEN public.job_closed_to_me(p_job) THEN 't' ELSE 'f' END
    || CASE WHEN public.job_shut_to_me(p_job) THEN 't' ELSE 'f' END
    || CASE WHEN p_job = ANY (public.jobs_shut_to_me()) THEN 't' ELSE 'f' END
    || CASE WHEN p_job = ANY (public.jobs_closed_to_me()) THEN 't' ELSE 'f' END
$$;
-- The jobs that carry a live row of one site, by their numbers.
CREATE FUNCTION ss.jobs_of(p_site uuid) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(j.hcp_number, ', ' ORDER BY j.hcp_number), 'none')
  FROM public.job_required_papers r JOIN public.jobs_ledger j ON j.id = r.job_id
  WHERE r.site_secrecy_id = p_site AND r.removed_at IS NULL
$$;
GRANT USAGE ON SCHEMA ss TO authenticated, anon, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ss TO authenticated, anon, service_role;

-- 0 · The address rule in SQL is the app's rule. Each pair is an address and the key the app's normalizeAddressKey
--     writes for it; src/lib/addresses/addressKeyParity.test.ts reads this list and holds every key to the app.
CREATE TABLE ss.keys (address text, want text);
-- address-key-parity:begin
INSERT INTO ss.keys (address, want) VALUES
  ('118 Old Quarry Trl, Sampleton, TX', '118 old quarry trail sampleton tx'),
  ('118 Old Quarry Trl, Sampleton, TX 78701', '118 old quarry trail sampleton tx'),
  ('118 OLD QUARRY TRAIL  Sampleton TX 78701-1234', '118 old quarry trail sampleton tx'),
  ('  118 old quarry tr., sampleton, tx.  ', '118 old quarry trail sampleton tx'),
  ('2210 Example Ridge Rd, Placeholder, TX', '2210 example ridge road placeholder tx'),
  ('2210 Example Ridge Road Placeholder TX 78701', '2210 example ridge road placeholder tx'),
  ('40 Stone Rd #4, Sampleton, TX', '40 stone road 4 sampleton tx'),
  ('40 Stone Rd, Unit 4-B, Sampleton, TX', '40 stone road unit 4 b sampleton tx'),
  ('9 Elsewhere Ln', '9 elsewhere lane'),
  ('77 N Main St', '77 north main street'),
  ('77 North Main Street', '77 north main street'),
  ('5 S. W. Loop Dr', '5 south west loop drive'),
  ('12 E Example Ave', '12 east example avenue'),
  ('12 East Example Av', '12 east example avenue'),
  ('300 Example Ct, Springfield', '300 example court springfield'),
  ('8 Sample Cir', '8 sample circle'),
  ('8 Sample Blvd', '8 sample boulevard'),
  ('1500 Hwy 71 W', '1500 highway 71 west'),
  ('21 Placeholder Pkwy', '21 placeholder parkway'),
  ('3 Example Pl', '3 example place'),
  ('3 Example Ter', '3 example terrace'),
  ('3 Example Terr', '3 example terrace'),
  ('14 Sample Way', '14 sample way'),
  ('St Example St', 'street example street'),
  ('78701', '78701'),
  ('Lot 7 78701', 'lot 7'),
  ('Lot 7, 787011', 'lot 7 787011'),
  ('Lot 7 7870', 'lot 7 7870'),
  ('Lot 7 78701-12', 'lot 7 78701 12'),
  ('Lot 7 - 78701', 'lot 7'),
  ('100 – 102 Example Rd', '100 102 example road'),
  ('100-102 Example Rd', '100 102 example road'),
  ('Café Row 5', 'caf row 5'),
  ('O’Sample’s Rd', 'o sample south road'),
  ('5 Example Rd, Apt. 2', '5 example road apt 2'),
  ('5_Example_Rd', '5 example road'),
  ('', ''),
  ('   ', ''),
  ('---', ''),
  ('#', '');
-- address-key-parity:end
SELECT ss.same('address_key is the app''s rule on every address of the list',
  coalesce((SELECT string_agg(quote_literal(k.address) || ' gave ' || quote_literal(public.address_key(k.address)) || ', the app writes ' || quote_literal(k.want), E'\n' ORDER BY k.address)
            FROM ss.keys k WHERE public.address_key(k.address) IS DISTINCT FROM k.want), 'every key matches'),
  'every key matches');
SELECT ss.same('a missing address has an empty key', public.address_key(NULL), '');
SELECT ss.same('the rule is immutable, so it can be worked out once a row',
  (SELECT provolatile::text FROM pg_proc WHERE oid = 'public.address_key(text)'::regprocedure), 'i');

-- Dana is the office and Marcus the jobs' master. Luis leads and Hector helps: both are on the ranch's jobs. Sam is
-- a sub with a login, on the same jobs. Priya estimates. Otis helps on a job somewhere else.
INSERT INTO auth.users (id, email) VALUES
  (ss.id('01'), 'dana@sitesecrecy.test'), (ss.id('02'), 'marcus@sitesecrecy.test'), (ss.id('03'), 'luis@sitesecrecy.test'),
  (ss.id('04'), 'hector@sitesecrecy.test'), (ss.id('06'), 'sam@sitesecrecy.test'), (ss.id('07'), 'priya@sitesecrecy.test'),
  (ss.id('09'), 'otis@sitesecrecy.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, is_sample, archived_at, login_attached_at) VALUES
  (ss.id('01'), 'dana@sitesecrecy.test', 'Dana Office Ssb', 'assistant', false, false, false, NULL, now()),
  (ss.id('02'), 'marcus@sitesecrecy.test', 'Marcus Master Ssb', 'master_technician', false, false, false, NULL, now()),
  (ss.id('03'), 'luis@sitesecrecy.test', 'Luis Lead Ssb', 'superintendent', false, false, false, NULL, now()),
  (ss.id('04'), 'hector@sitesecrecy.test', 'Hector Helper Ssb', 'helpers', false, false, false, NULL, now()),
  (ss.id('06'), 'sam@sitesecrecy.test', 'Sam Sub Ssb', 'subcontractor', false, false, false, NULL, now()),
  (ss.id('07'), 'priya@sitesecrecy.test', 'Priya Estimator Ssb', 'estimator', false, false, false, NULL, now()),
  (ss.id('09'), 'otis@sitesecrecy.test', 'Otis Other Ssb', 'helpers', false, false, false, NULL, now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, is_sample = EXCLUDED.is_sample, archived_at = EXCLUDED.archived_at,
    login_attached_at = EXCLUDED.login_attached_at;
INSERT INTO public.people (id, master_user_id, kind, name, account_user_id) VALUES
  (ss.id('21'), ss.id('02'), 'assistant', 'Dana Office Ssb', ss.id('01')),
  (ss.id('22'), ss.id('02'), 'master_technician', 'Marcus Master Ssb', ss.id('02')),
  (ss.id('23'), ss.id('02'), 'superintendent', 'Luis Lead Ssb', ss.id('03')),
  (ss.id('24'), ss.id('02'), 'helper', 'Hector Helper Ssb', ss.id('04')),
  (ss.id('26'), ss.id('02'), 'sub', 'Sam Sub Ssb', ss.id('06')),
  (ss.id('27'), ss.id('02'), 'estimator', 'Priya Estimator Ssb', ss.id('07')),
  (ss.id('29'), ss.id('02'), 'helper', 'Otis Other Ssb', ss.id('09'));

INSERT INTO public.developments (id, name, master_user_id) VALUES (ss.id('d1'), 'ZZ Test Secrecy Ranch', ss.id('02'));
INSERT INTO public.service_types (id, name) VALUES (ss.id('f9'), 'Site Secrecy Bed Work');
-- S101 and S102 are in the ranch. S201 and S202 are one address written two ways, in no development. S301 is at an
-- address of its own. S900 is nowhere near any of it, and requires a paper by itself.
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, hcp_number, job_address, development_id) VALUES
  (ss.id('41'), ss.id('02'), ss.id('f9'), 'ZZ Test Ranch Barn', 'S101', '118 Old Quarry Trl, Sampleton, TX', ss.id('d1')),
  (ss.id('42'), ss.id('02'), ss.id('f9'), 'ZZ Test Ranch House', 'S102', '120 Old Quarry Trl, Sampleton, TX', ss.id('d1')),
  (ss.id('43'), ss.id('02'), ss.id('f9'), 'ZZ Test Ridge Shop', 'S201', '2210 Example Ridge Rd, Placeholder, TX', NULL),
  (ss.id('44'), ss.id('02'), ss.id('f9'), 'ZZ Test Ridge Shop Two', 'S202', '2210 Example Ridge Road Placeholder TX 78701', NULL),
  (ss.id('45'), ss.id('02'), ss.id('f9'), 'ZZ Test Ridge Annex', 'S301', '2212 Example Ridge Rd, Placeholder, TX', NULL),
  (ss.id('49'), ss.id('02'), ss.id('f9'), 'ZZ Test Elsewhere', 'S900', '9 Elsewhere Ln', NULL);
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES
  (ss.id('41'), ss.id('03')), (ss.id('41'), ss.id('04')), (ss.id('41'), ss.id('06')),
  (ss.id('42'), ss.id('03')), (ss.id('42'), ss.id('04')), (ss.id('42'), ss.id('06')),
  (ss.id('43'), ss.id('04')), (ss.id('49'), ss.id('09')), (ss.id('49'), ss.id('04')), (ss.id('49'), ss.id('06'))
  ON CONFLICT DO NOTHING;

INSERT INTO public.contract_templates (id, name) VALUES (ss.id('60'), 'Site secrecy bed packet');
INSERT INTO public.contract_template_documents (id, template_id, document_name, book_body_html, book_body_format) VALUES
  (ss.id('61'), ss.id('60'), 'Site secrecy paper', '<p>Say nothing of this place.</p>', 'html'),
  (ss.id('62'), ss.id('60'), 'Site rules', '<p>No photos past the gate.</p>', 'html'),
  (ss.id('63'), ss.id('60'), 'Paper with no words', NULL, 'html');

-- 1 · The table: read by the office and the estimator, written by nobody but the functions.
SELECT ss.same('site_secrecy has one policy, a read',
  (SELECT string_agg(policyname || ' ' || cmd, ', ' ORDER BY policyname) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'site_secrecy' AND permissive = 'PERMISSIVE'),
  'site_secrecy_read SELECT');
SELECT ss.same('a signed-in user has no write on the table',
  concat_ws(' ', has_table_privilege('authenticated', 'public.site_secrecy', 'INSERT')::text, has_table_privilege('authenticated', 'public.site_secrecy', 'UPDATE')::text, has_table_privilege('authenticated', 'public.site_secrecy', 'DELETE')::text, has_table_privilege('anon', 'public.site_secrecy', 'SELECT')::text),
  'false false false false');
SELECT ss.same('the internal functions are granted to nobody signed in',
  concat_ws(' ', has_function_privilege('authenticated', 'public.site_secrecy_sync(uuid, uuid)', 'EXECUTE')::text, has_function_privilege('authenticated', 'public.site_paper_covers_user(uuid, uuid)', 'EXECUTE')::text, has_function_privilege('authenticated', 'public.site_secrecy_keys(text)', 'EXECUTE')::text, has_function_privilege('anon', 'public.site_secrecy_turn_on(uuid, text, uuid, text)', 'EXECUTE')::text),
  'false false false false');

-- 2 · A job whose rows name no site reads exactly as before. S900 requires a paper by itself; nobody has signed.
SELECT ss.as_user(ss.id('01'));
SET LOCAL ROLE authenticated;
SELECT ss.same('Dana requires the site rules on S900 by itself', public.job_papers_require(ss.id('49'), ARRAY[ss.id('62')])::text, '1');
RESET ROLE;
SELECT ss.same('that row names no site', (SELECT count(*) FILTER (WHERE site_secrecy_id IS NULL)::text || ' of ' || count(*)::text FROM public.job_required_papers), '1 of 1');
CREATE FUNCTION ss.as_before() RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_user record;
  v_job record;
  v_out text := '';
  v_prompt_only boolean;
BEGIN
  FOR v_user IN SELECT u.id, u.name, u.role::text AS role FROM public.users u WHERE u.id IN (ss.id('01'), ss.id('02'), ss.id('03'), ss.id('04'), ss.id('06'), ss.id('07'), ss.id('09')) ORDER BY u.id LOOP
    PERFORM ss.as_user(v_user.id);
    v_prompt_only := v_user.role IN ('dev', 'master_technician', 'assistant', 'controller', 'primary');
    FOR v_job IN SELECT j.id, j.hcp_number FROM public.jobs_ledger j WHERE j.id IN (ss.id('41'), ss.id('42'), ss.id('43'), ss.id('44'), ss.id('45'), ss.id('49')) ORDER BY j.id LOOP
      -- Only a job with no site row is held to the rule of before.
      IF EXISTS (SELECT 1 FROM public.job_required_papers r WHERE r.job_id = v_job.id AND r.removed_at IS NULL AND r.site_secrecy_id IS NOT NULL) THEN
        CONTINUE;
      END IF;
      IF public.job_closed_to_me(v_job.id) IS DISTINCT FROM ss.owes_before(v_job.id, v_user.id)
         OR public.job_shut_to_me(v_job.id) IS DISTINCT FROM (ss.owes_before(v_job.id, v_user.id) AND NOT v_prompt_only)
         OR public.job_shut_to_user(v_job.id, v_user.id) IS DISTINCT FROM (ss.owes_before(v_job.id, v_user.id) AND NOT v_prompt_only)
         OR (v_job.id = ANY (public.jobs_closed_to_me())) IS DISTINCT FROM ss.owes_before(v_job.id, v_user.id)
         OR (v_job.id = ANY (public.jobs_shut_to_me())) IS DISTINCT FROM (ss.owes_before(v_job.id, v_user.id) AND NOT v_prompt_only) THEN
        v_out := v_out || v_user.name || ' on ' || v_job.hcp_number || ' differs. ';
      END IF;
    END LOOP;
  END LOOP;
  PERFORM ss.signed_out();
  RETURN CASE WHEN v_out = '' THEN 'as before' ELSE v_out END;
END $$;
SELECT ss.same('with no site on, every role is told of every job what the rule of before tells them', ss.as_before(), 'as before');
SELECT ss.as_user(ss.id('04'));
SELECT ss.same('Hector owes S900 and is shut out of it, as before', ss.told(ss.id('49')), 'tttt');
SELECT ss.as_user(ss.id('06'));
SELECT ss.same('Sam the sub owes S900 and is shut out of it, as before: a job''s own paper is a sub''s to sign', ss.told(ss.id('49')), 'tttt');
SELECT ss.as_user(ss.id('01'));
SELECT ss.same('Dana owes it and keeps every read, as before', ss.told(ss.id('49')), 'tfft');
SELECT ss.signed_out();

-- 3 · Who may press. The estimator reads the table and presses nothing; a helper reads nothing.
SELECT ss.as_user(ss.id('07'));
SET LOCAL ROLE authenticated;
SELECT ss.refused('the estimator cannot turn it on', format('SELECT public.site_secrecy_turn_on(%L, NULL, %L)', ss.id('d1'), ss.id('61')), 'Only the office turns on secrecy for a site.');
SELECT ss.refused('or look at what it would reach', format('SELECT public.site_secrecy_preview(%L, NULL)', ss.id('d1')), 'Only the office turns on secrecy for a site.');
RESET ROLE;
SELECT ss.as_user(ss.id('04'));
SET LOCAL ROLE authenticated;
SELECT ss.refused('a helper cannot turn it on', format('SELECT public.site_secrecy_turn_on(%L, NULL, %L)', ss.id('d1'), ss.id('61')), 'Only the office turns on secrecy for a site.');
RESET ROLE;

-- 4 · What a press would reach, before it. Two jobs in the ranch. Our own people: the office, and the two on the
--     jobs' crews who are no sub.
SELECT ss.as_user(ss.id('01'));
SET LOCAL ROLE authenticated;
SELECT ss.same('the ranch is two jobs', (public.site_secrecy_preview(ss.id('d1'), NULL)->>'jobs'), '2');
RESET ROLE;
SELECT ss.same('and asks the office, Luis and Hector, and not Sam the sub',
  ((public.site_secrecy_preview(ss.id('d1'), NULL)->>'people')::int - (
    SELECT count(*) FROM public.users u
    WHERE u.role::text IN ('dev', 'master_technician', 'assistant', 'controller') AND u.archived_at IS NULL AND u.login_attached_at IS NOT NULL
      AND NOT u.is_digital_twin AND NOT u.is_sample AND NOT u.is_walk_tester))::text,
  '2');
SELECT ss.refused('a site is a development or an address, not both', format('SELECT public.site_secrecy_preview(%L, %L)', ss.id('d1'), '9 Elsewhere Ln'), 'Name one site');
SELECT ss.refused('and not neither', 'SELECT public.site_secrecy_preview(NULL, NULL)', 'Name one site');
SELECT ss.refused('a paper with no words is refused', format('SELECT public.site_secrecy_turn_on(%L, NULL, %L)', ss.id('d1'), ss.id('63')), 'has no words yet');
SELECT ss.same('a refused press wrote nothing', (SELECT count(*)::text FROM public.site_secrecy), '0');

-- 5 · Dana turns secrecy on for the ranch. Its two jobs take the paper, and no other job does.
SELECT ss.same('turning it on puts the paper on the ranch''s two jobs',
  (SELECT concat_ws(' ', r->>'added', r->>'jobs') FROM (SELECT public.site_secrecy_turn_on(ss.id('d1'), NULL, ss.id('61'), 'Project Heron') AS r) x), '2 2');
CREATE TEMP TABLE ss_site AS SELECT s.id FROM public.site_secrecy s WHERE s.development_id = ss.id('d1');
SELECT ss.same('the site keeps its paper''s words, its code name and who turned it on',
  (SELECT concat_ws(' | ', s.paper_name, s.body_html, s.code_name, right(s.turned_on_by::text, 2), (s.turned_off_at IS NULL)::text) FROM public.site_secrecy s JOIN ss_site x ON x.id = s.id),
  'Site secrecy paper | <p>Say nothing of this place.</p> | Project Heron | 01 | true');
SELECT ss.same('the rows are on S101 and S102 alone', ss.jobs_of((SELECT id FROM ss_site)), 'S101, S102');
SELECT ss.same('each row carries the site''s words', (SELECT string_agg(DISTINCT r.paper_name || ' ' || r.body_html, ' / ') FROM public.job_required_papers r WHERE r.site_secrecy_id = (SELECT id FROM ss_site)), 'Site secrecy paper <p>Say nothing of this place.</p>');
SELECT ss.same('pressed again, it is left on and nothing is added',
  (SELECT concat_ws(' ', r->>'added', r->>'jobs') FROM (SELECT public.site_secrecy_turn_on(ss.id('d1'), NULL, ss.id('61')) AS r) x), '0 2');
SELECT ss.refused('another paper is refused while it is on', format('SELECT public.site_secrecy_turn_on(%L, NULL, %L)', ss.id('d1'), ss.id('62')), 'Secrecy is on for this site already');
SELECT ss.same('one row is on for the ranch', (SELECT count(*)::text FROM public.site_secrecy WHERE turned_off_at IS NULL), '1');

-- 6 · A person who has not signed is shut out of every job of the site. The office owes and keeps its reads.
SELECT ss.as_user(ss.id('04'));
SELECT ss.same('Hector is shut out of S101', ss.told(ss.id('41')), 'tttt');
SELECT ss.same('and of S102', ss.told(ss.id('42')), 'tttt');
SELECT ss.same('and of no job that is not at the site', ss.told(ss.id('43')), 'ffff');
SELECT ss.as_user(ss.id('03'));
SELECT ss.same('Luis is shut out of both too', ss.told(ss.id('41')) || ' ' || ss.told(ss.id('42')), 'tttt tttt');
SELECT ss.as_user(ss.id('01'));
SELECT ss.same('Dana owes the paper and keeps every read', ss.told(ss.id('41')), 'tfft');
SELECT ss.signed_out();
SELECT ss.same('the service role is told the same of a named user', concat_ws(' ', public.job_shut_to_user(ss.id('41'), ss.id('04'))::text, public.job_shut_to_user(ss.id('42'), ss.id('03'))::text, public.job_shut_to_user(ss.id('41'), ss.id('01'))::text), 'true true false');

-- 7 · A sub with a login is an outside company: not asked the site's paper, and not shut out by it.
SELECT ss.as_user(ss.id('06'));
SELECT ss.same('Sam the sub is not shut out of S101 or S102', ss.told(ss.id('41')) || ' ' || ss.told(ss.id('42')), 'ffff ffff');
SELECT ss.same('and is still shut out of S900, whose own paper is theirs to sign', ss.told(ss.id('49')), 'tttt');
SELECT ss.signed_out();
SELECT ss.same('the service role is told so too', public.job_shut_to_user(ss.id('41'), ss.id('06'))::text || ' ' || public.job_shut_to_user(ss.id('49'), ss.id('06'))::text, 'false true');
SELECT ss.same('a sub''s page is shown no paper of the site', (public.job_papers_for_person(ss.id('41'), ss.id('26'))->'papers')::text, '[]');
SELECT ss.same('and is still shown a job''s own paper', (public.job_papers_for_person(ss.id('49'), ss.id('26'))->'papers'->0->>'paper_name'), 'Site rules');

-- 8 · One signature opens every job of the site, to that person alone.
SELECT ss.as_user(ss.id('04'));
-- Hector's own press: the function reads who asks from the login, and the copy's id is kept for the lines below.
CREATE TEMP TABLE ss_copy AS SELECT public.job_paper_start((SELECT (m->'papers'->0->>'id')::uuid FROM (SELECT public.job_papers_mine(ss.id('41')) AS m) x)) AS id;
SELECT ss.same('Hector starts his copy on S101', ((SELECT id FROM ss_copy) IS NOT NULL)::text, 'true');
SELECT ss.same('before he signs, S102 hands him the same copy and makes no second one',
  (public.job_paper_start((SELECT (m->'papers'->0->>'id')::uuid FROM (SELECT public.job_papers_mine(ss.id('42')) AS m) x)) = (SELECT id FROM ss_copy))::text, 'true');
SELECT ss.same('he holds one copy', (SELECT count(*)::text FROM public.person_contract_documents d WHERE d.person_id = ss.id('24')), '1');
UPDATE public.person_contract_documents SET status = 'signed', signed_at = public.app_today() WHERE id = (SELECT id FROM ss_copy);
SELECT ss.as_user(ss.id('04'));
SELECT ss.same('signed once, Hector opens S101', ss.told(ss.id('41')), 'ffff');
SELECT ss.same('and S102, which he never signed for by itself', ss.told(ss.id('42')), 'ffff');
SELECT ss.same('his own papers read signed on S102', (public.job_papers_mine(ss.id('42'))->'papers'->0->>'status'), 'signed');
SELECT ss.same('and he still owes S900''s own paper', ss.told(ss.id('49')), 'tttt');
SELECT ss.as_user(ss.id('03'));
SELECT ss.same('Luis, who has not signed, is still shut out of both', ss.told(ss.id('41')) || ' ' || ss.told(ss.id('42')), 'tttt tttt');
SELECT ss.signed_out();
SELECT ss.same('the service role is told Hector is in and Luis is out', public.job_shut_to_user(ss.id('42'), ss.id('04'))::text || ' ' || public.job_shut_to_user(ss.id('42'), ss.id('03'))::text, 'false true');

-- 9 · Needs you counts what is still owed, a site's paper once it is signed among it.
SELECT ss.as_user(ss.id('04'));
SELECT ss.same('Hector''s list holds S900 alone', (SELECT string_agg(x->>'job_number' || ' owes ' || (x->>'owed'), ', ' ORDER BY x->>'job_number') FROM jsonb_array_elements(public.job_papers_needing_me()) x), 'S900 owes 1');
SELECT ss.as_user(ss.id('03'));
SELECT ss.same('Luis''s list holds the ranch''s two jobs', (SELECT string_agg(x->>'job_number' || ' owes ' || (x->>'owed'), ', ' ORDER BY x->>'job_number') FROM jsonb_array_elements(public.job_papers_needing_me()) x), 'S101 owes 1, S102 owes 1');
SELECT ss.signed_out();

-- 10 · The office's roster: the paper says its site, Hector reads signed on the job he never signed for, and Sam the
--      sub is marked as not asked.
SELECT ss.as_user(ss.id('01'));
SELECT ss.same('S102''s paper names its site', ((public.job_papers_roster(ss.id('42'))->'papers'->0->>'site_secrecy_id')::uuid = (SELECT id FROM ss_site))::text, 'true');
SELECT ss.same('on S102 Hector reads signed, Luis has no copy, and Sam is not asked',
  (SELECT string_agg(split_part(p->>'name', ' ', 1) || ' ' || (p->'papers'->0->>'status') || ' asked ' || (p->'papers'->0->>'asked'), ', ' ORDER BY p->>'name')
   FROM jsonb_array_elements(public.job_papers_roster(ss.id('42'))->'people') p WHERE p->>'name' IN ('Hector Helper Ssb', 'Luis Lead Ssb', 'Sam Sub Ssb')),
  'Hector signed asked true, Luis none asked true, Sam none asked false');
SELECT ss.same('on S900, whose paper is the job''s own, everyone is asked, Sam among them',
  (SELECT string_agg(DISTINCT p->'papers'->0->>'asked', ',') FROM jsonb_array_elements(public.job_papers_roster(ss.id('49'))->'people') p), 'true');
SELECT ss.refused('a site''s paper is not taken off one job', format('SELECT public.job_paper_remove(%L)', (SELECT r.id FROM public.job_required_papers r WHERE r.job_id = ss.id('41') AND r.site_secrecy_id IS NOT NULL AND r.removed_at IS NULL)), 'This paper is the site''s.');
SELECT ss.signed_out();

-- 11 · A new job at a site that is on gets its row by the trigger. Hector, who signed, opens it. Luis does not.
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, hcp_number, job_address, development_id) VALUES
  (ss.id('46'), ss.id('02'), ss.id('f9'), 'ZZ Test Ranch Shed', 'S103', '122 Old Quarry Trl, Sampleton, TX', ss.id('d1'));
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES (ss.id('46'), ss.id('03')), (ss.id('46'), ss.id('04')) ON CONFLICT DO NOTHING;
SELECT ss.same('a job made in the ranch takes the paper', ss.jobs_of((SELECT id FROM ss_site)), 'S101, S102, S103');
SELECT ss.as_user(ss.id('04'));
SELECT ss.same('Hector opens the new job on the signature he gave', ss.told(ss.id('46')), 'ffff');
SELECT ss.as_user(ss.id('03'));
SELECT ss.same('Luis is shut out of it', ss.told(ss.id('46')), 'tttt');
SELECT ss.signed_out();
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, hcp_number, job_address, development_id) VALUES
  (ss.id('47'), ss.id('02'), ss.id('f9'), 'ZZ Test Far Field', 'S950', '7 Far Field Rd', NULL);
SELECT ss.same('a job made anywhere else takes nothing', (SELECT count(*)::text FROM public.job_required_papers r WHERE r.job_id = ss.id('47')), '0');

-- 12 · A job moved away from the site loses its row, and one moved back gets the same row again.
CREATE TEMP TABLE ss_row AS SELECT r.id FROM public.job_required_papers r WHERE r.job_id = ss.id('42') AND r.site_secrecy_id = (SELECT id FROM ss_site) AND r.removed_at IS NULL;
UPDATE public.jobs_ledger SET development_id = NULL WHERE id = ss.id('42');
SELECT ss.same('S102 moved out of the ranch: its row is off', ss.jobs_of((SELECT id FROM ss_site)), 'S101, S103');
SELECT ss.as_user(ss.id('03'));
SELECT ss.same('and Luis opens S102', ss.told(ss.id('42')), 'ffff');
SELECT ss.signed_out();
UPDATE public.jobs_ledger SET job_name = 'ZZ Test Ranch House renamed' WHERE id = ss.id('42');
SELECT ss.same('a change that is not its address or its development touches nothing', ss.jobs_of((SELECT id FROM ss_site)), 'S101, S103');
UPDATE public.jobs_ledger SET development_id = ss.id('d1') WHERE id = ss.id('42');
SELECT ss.same('moved back: the same row is on again, not a new one',
  ss.jobs_of((SELECT id FROM ss_site)) || ' | ' || (SELECT (r.removed_at IS NULL)::text FROM public.job_required_papers r JOIN ss_row x ON x.id = r.id) || ' | ' || (SELECT count(*)::text FROM public.job_required_papers r WHERE r.job_id = ss.id('42')),
  'S101, S102, S103 | true | 1');
SELECT ss.as_user(ss.id('03'));
SELECT ss.same('and Luis is shut out of it again', ss.told(ss.id('42')), 'tttt');
SELECT ss.signed_out();
UPDATE public.jobs_ledger SET development_id = ss.id('d1') WHERE id = ss.id('47');
SELECT ss.same('a job moved into the ranch takes the paper', ss.jobs_of((SELECT id FROM ss_site)), 'S101, S102, S103, S950');
UPDATE public.jobs_ledger SET development_id = NULL WHERE id = ss.id('47');

-- 13 · An address is a site by its cleaned key: two spellings of one address are one site, and a neighbour is not.
SELECT ss.as_user(ss.id('01'));
SELECT ss.same('the address is two jobs, written two ways', (public.site_secrecy_preview(NULL, '2210 Example Ridge Rd, Placeholder, TX')->>'jobs'), '2');
SELECT ss.same('turning it on for the address reaches both',
  (SELECT concat_ws(' ', r->>'added', r->>'jobs') FROM (SELECT public.site_secrecy_turn_on(NULL, ' 2210  Example Ridge Rd, Placeholder, TX ', ss.id('61')) AS r) x), '2 2');
CREATE TEMP TABLE ss_ridge AS SELECT s.id FROM public.site_secrecy s WHERE s.address_key IS NOT NULL AND s.turned_off_at IS NULL;
SELECT ss.same('the site keeps the key and the address as written, with one space',
  (SELECT s.address_key || ' | ' || s.address FROM public.site_secrecy s JOIN ss_ridge x ON x.id = s.id), '2210 example ridge road placeholder tx | 2210 Example Ridge Rd, Placeholder, TX');
SELECT ss.same('S201 and S202 carry it, and the neighbour S301 does not', ss.jobs_of((SELECT id FROM ss_ridge)), 'S201, S202');
-- A Same place answer joins the neighbour's spelling to the site, and Undo takes it off again.
INSERT INTO public.address_place_answers (key_a, key_b, same) VALUES ('2210 example ridge road placeholder tx', '2212 example ridge road placeholder tx', true);
SELECT ss.same('answered Same place, the neighbour is at the site', ss.jobs_of((SELECT id FROM ss_ridge)), 'S201, S202, S301');
DELETE FROM public.address_place_answers WHERE key_a = '2210 example ridge road placeholder tx' AND key_b = '2212 example ridge road placeholder tx';
SELECT ss.same('the answer undone, it is not', ss.jobs_of((SELECT id FROM ss_ridge)), 'S201, S202');
UPDATE public.jobs_ledger SET job_address = '2210 Example Ridge Rd., Placeholder TX' WHERE id = ss.id('47');
SELECT ss.same('a job whose address is changed to the site''s takes the paper', ss.jobs_of((SELECT id FROM ss_ridge)), 'S201, S202, S950');
UPDATE public.jobs_ledger SET job_address = '7 Far Field Rd' WHERE id = ss.id('47');
SELECT ss.same('and loses it when the address is changed away', ss.jobs_of((SELECT id FROM ss_ridge)), 'S201, S202');
SELECT ss.signed_out();
SELECT ss.as_user(ss.id('04'));
SELECT ss.same('Hector signed for the ranch, not for the ridge: he is shut out of S201', ss.told(ss.id('43')), 'tttt');
SELECT ss.signed_out();

-- 14 · A job that already requires the same Contract Book paper by itself keeps its own row and takes no second one.
SELECT ss.as_user(ss.id('01'));
SET LOCAL ROLE authenticated;
SELECT ss.same('Dana requires the secrecy paper on S950 by itself', public.job_papers_require(ss.id('47'), ARRAY[ss.id('61')])::text, '1');
RESET ROLE;
UPDATE public.jobs_ledger SET development_id = ss.id('d1') WHERE id = ss.id('47');
SELECT ss.same('moved into the ranch, S950 keeps its one row, which names no site',
  (SELECT count(*)::text || ' ' || count(*) FILTER (WHERE r.site_secrecy_id IS NULL)::text FROM public.job_required_papers r WHERE r.job_id = ss.id('47') AND r.removed_at IS NULL), '1 1');
UPDATE public.jobs_ledger SET development_id = NULL WHERE id = ss.id('47');
SELECT ss.same('with no site row on any job but the sites'' own, every other job still reads as before', ss.as_before(), 'as before');

-- 15 · Turning it off opens the jobs at once and keeps every signature.
SELECT ss.as_user(ss.id('07'));
SELECT ss.refused('the estimator cannot turn it off', format('SELECT public.site_secrecy_turn_off(%L)', (SELECT id FROM ss_site)), 'Only the office turns off secrecy for a site.');
SET LOCAL ROLE authenticated;
SELECT ss.same('the estimator reads the sites', (SELECT count(*)::text FROM public.site_secrecy), '2');
RESET ROLE;
SELECT ss.as_user(ss.id('04'));
SET LOCAL ROLE authenticated;
SELECT ss.same('a helper reads none', (SELECT count(*)::text FROM public.site_secrecy), '0');
RESET ROLE;
SELECT ss.as_user(ss.id('01'));
SELECT public.site_secrecy_turn_off((SELECT id FROM ss_site));
SELECT ss.same('turned off: no job carries the ranch''s paper', ss.jobs_of((SELECT id FROM ss_site)), 'none');
SELECT ss.same('the row stays, with who turned it off', (SELECT right(s.turned_off_by::text, 2) || ' ' || (s.turned_off_at IS NOT NULL)::text FROM public.site_secrecy s JOIN ss_site x ON x.id = s.id), '01 true');
SELECT ss.as_user(ss.id('03'));
SELECT ss.same('Luis opens the ranch''s jobs at once', ss.told(ss.id('41')) || ' ' || ss.told(ss.id('42')) || ' ' || ss.told(ss.id('46')), 'ffff ffff ffff');
SELECT ss.signed_out();
SELECT ss.same('Hector''s signed copy is still on his file', (SELECT d.status FROM public.person_contract_documents d JOIN ss_copy c ON c.id = d.id), 'signed');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, hcp_number, job_address, development_id) VALUES
  (ss.id('48'), ss.id('02'), ss.id('f9'), 'ZZ Test Ranch Gate', 'S104', '124 Old Quarry Trl, Sampleton, TX', ss.id('d1'));
SELECT ss.same('a job made in the ranch while it is off takes nothing', (SELECT count(*)::text FROM public.job_required_papers r WHERE r.job_id = ss.id('48')), '0');

-- 16 · Turning it on again with the same paper brings the same site back, and asks only those who never signed.
SELECT ss.as_user(ss.id('01'));
SELECT ss.same('on again: the same row, now with four jobs, the one made while it was off among them',
  (SELECT ((r->>'id')::uuid = (SELECT id FROM ss_site))::text || ' ' || (r->>'jobs') FROM (SELECT public.site_secrecy_turn_on(ss.id('d1'), NULL, ss.id('61')) AS r) x), 'true 4');
SELECT ss.same('it kept its code name', (SELECT s.code_name FROM public.site_secrecy s JOIN ss_site x ON x.id = s.id), 'Project Heron');
SELECT ss.as_user(ss.id('04'));
SELECT ss.same('Hector, who signed before, opens all four', ss.told(ss.id('41')) || ' ' || ss.told(ss.id('42')) || ' ' || ss.told(ss.id('46')) || ' ' || ss.told(ss.id('48')), 'ffff ffff ffff ffff');
SELECT ss.as_user(ss.id('03'));
SELECT ss.same('Luis, who never signed, is asked', ss.told(ss.id('41')) || ' ' || ss.told(ss.id('48')), 'tttt tttt');
SELECT ss.signed_out();

-- 17 · What a plain read of jobs costs. The fence asks jobs_shut_to_me once a statement, as it did, and the read
--      never works out an address key.
CREATE FUNCTION ss.plan_of(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v_line text; v_out text := '';
BEGIN
  FOR v_line IN EXECUTE 'EXPLAIN (VERBOSE, COSTS OFF) ' || p_sql LOOP v_out := v_out || v_line || E'\n'; END LOOP;
  RETURN v_out;
END $$;
CREATE TABLE ss.plan (plan text);
GRANT EXECUTE ON FUNCTION ss.plan_of(text) TO authenticated;
GRANT INSERT ON ss.plan TO authenticated;
SELECT ss.as_user(ss.id('04'));
SET LOCAL ROLE authenticated;
INSERT INTO ss.plan SELECT ss.plan_of('SELECT id FROM public.jobs_ledger');
RESET ROLE;
SELECT ss.signed_out();
SELECT ss.same('a helper''s read of jobs asks the fence''s set once, in an InitPlan, and never calls address_key',
  concat_ws(' ', (position('InitPlan' IN (SELECT plan FROM ss.plan)) > 0)::text, (position('jobs_shut_to_me' IN (SELECT plan FROM ss.plan)) > 0)::text, (position('address_key' IN (SELECT plan FROM ss.plan)) > 0)::text),
  'true true false');
-- The lines of that plan that name the fence, for whoever reads this bed's output.
DO $$
DECLARE v_line text;
BEGIN
  FOR v_line IN SELECT l FROM regexp_split_to_table((SELECT plan FROM ss.plan), E'\n') AS l WHERE l ~ 'InitPlan|shut_to_me|Scan' LOOP
    RAISE NOTICE 'ok: plan: %', left(btrim(v_line), 220);
  END LOOP;
END $$;

DO $$ BEGIN RAISE NOTICE 'site_secrecy PASSED'; END $$;
ROLLBACK;
