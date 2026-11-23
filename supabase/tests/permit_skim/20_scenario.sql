-- Permits, the skim's ground (v2.6835, punch list #302, migration *_permit_skim): the builder's key on a permit, what
-- the office says about a builder and its marks, the hand-off and the put-back on a verdict, and the three reads the
-- skim, the Builders page and the count stand on. Fixtures are written as postgres; the tries run as an estimator and
-- as a helper under RLS; everything rolls back. Raises on the first failed assertion; ends with "permit_skim PASSED".
-- See scripts/pgtest-permit-skim.sh. Never against prod. Every name and street is made up.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000003020a1', 'eve@skim.test'),
  ('00000000-0000-0000-0000-0000003020a2', 'sam@skim.test'),
  ('00000000-0000-0000-0000-0000003020a3', 'hal@skim.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at) VALUES
  ('00000000-0000-0000-0000-0000003020a1', 'eve@skim.test', 'Eve Estimator', 'estimator', false, false, NULL),
  ('00000000-0000-0000-0000-0000003020a2', 'sam@skim.test', 'Sam Second', 'estimator', false, false, NULL),
  ('00000000-0000-0000-0000-0000003020a3', 'hal@skim.test', 'Hal Helper', 'helpers', false, false, NULL)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;

-- Three commercial building permits and a house. Ridgeway pulled two; a plumber is on one of them.
INSERT INTO public.permits (id, city, source, permit_number, permit_type, kind, stage, residential, work_type, address, address_key, submitted_on, contact) VALUES
  ('00000000-0000-0000-0000-0000003020b1', 'Skim City', 'bed', 'COM-1', 'Comm New Building Permit', 'building', 'applied', false, 'New commercial', '100 SAMPLE ST', '100 sample st', CURRENT_DATE - 5, 'Dana Whitlock, Ridgeway Builders'),
  ('00000000-0000-0000-0000-0000003020b2', 'Skim City', 'bed', 'COM-2', 'Comm Remodel Permit', 'building', 'applied', false, 'Commercial remodel', '77 KILN ST', '77 kiln st', CURRENT_DATE - 9, 'RIDGEWAY BUILDERS LLC'),
  ('00000000-0000-0000-0000-0000003020b3', 'Skim City', 'bed', 'COM-3', 'Commercial Project Application', 'building', 'applied', false, 'Commercial project', '5 ASTER RDG', '5 aster rdg', CURRENT_DATE - 2, 'Tall Pine Development'),
  ('00000000-0000-0000-0000-0000003020b4', 'Skim City', 'bed', 'RES-1', 'Res New Building Permit', 'building', 'applied', true, 'New house', '9 LARKSPUR CT', '9 larkspur ct', CURRENT_DATE - 3, 'Ridgeway Builders'),
  ('00000000-0000-0000-0000-0000003020c2', 'Skim City', 'bed', 'COM-2', 'Plumbing Permit', 'plumbing', 'issued', false, 'Plumbing', '77 KILN ST', '77 kiln st', CURRENT_DATE - 4, 'Blue Heron Plumbing');

-- San Antonio, where a project's plumbing permit rides the project's number (migration *_permit_plumbing_ties). At
-- 800 Tower Blvd Ridgeline applied six days ago; another tenant's project has its plumbing permit, a plumber pulled one
-- of his own, and Ridgeline's old job there has one from last year. At 12 Orchard Way Ridgeline's application was
-- issued on another number, and the plumbing permit on that number lists another person at Ridgeline.
INSERT INTO public.permits (id, city, source, permit_number, permit_type, kind, stage, residential, work_type, address, address_key, submitted_on, issued_on, contact, builder_key) VALUES
  ('00000000-0000-0000-0000-0000003020d1', 'San Antonio', 'bed', 'SA-APP-1', 'Commercial Project Application', 'building', 'applied', false, 'Commercial project', '800 TOWER BLVD', '800 tower blvd', CURRENT_DATE - 6, NULL, 'Nora Vance, Ridgeline Interiors', 'ridgelineinteriors'),
  ('00000000-0000-0000-0000-0000003020d2', 'San Antonio', 'bed', 'SA-PMT-9', 'Comm Remodel Permit', 'building', 'issued', false, 'Commercial remodel', '800 TOWER BLVD', '800 tower blvd', CURRENT_DATE - 20, NULL, 'Otis Reed, Harbor Fitouts', 'harborfitouts'),
  ('00000000-0000-0000-0000-0000003020d3', 'San Antonio', 'bed', 'SA-PMT-9', 'Plumbing General Permit', 'plumbing', 'issued', false, 'Plumbing', '800 TOWER BLVD', '800 tower blvd', NULL, CURRENT_DATE - 3, 'Otis Reed, Harbor Fitouts', 'harborfitouts'),
  ('00000000-0000-0000-0000-0000003020d4', 'San Antonio', 'bed', 'MEP-1', 'Plumbing General Permit', 'plumbing', 'issued', false, 'Plumbing', '800 TOWER BLVD', '800 tower blvd', NULL, CURRENT_DATE - 2, 'Quill Plumbing', 'quillplumbing'),
  ('00000000-0000-0000-0000-0000003020d5', 'San Antonio', 'bed', 'SA-OLD-1', 'Plumbing General Permit', 'plumbing', 'issued', false, 'Plumbing', '800 TOWER BLVD', '800 tower blvd', NULL, CURRENT_DATE - 300, 'Nora Vance, Ridgeline Interiors', 'ridgelineinteriors'),
  ('00000000-0000-0000-0000-0000003020d6', 'San Antonio', 'bed', 'SA-APP-2', 'Commercial Project Application', 'building', 'applied', false, 'Commercial project', '12 ORCHARD WAY', '12 orchard way', CURRENT_DATE - 40, NULL, 'Nora Vance, Ridgeline Interiors', 'ridgelineinteriors'),
  ('00000000-0000-0000-0000-0000003020d7', 'San Antonio', 'bed', 'SA-PMT-2', 'Comm Remodel Permit', 'building', 'issued', false, 'Commercial remodel', '12 ORCHARD WAY', '12 orchard way', CURRENT_DATE - 40, CURRENT_DATE - 10, 'Nora Vance, Ridgeline Interiors', 'ridgelineinteriors'),
  ('00000000-0000-0000-0000-0000003020d8', 'San Antonio', 'bed', 'SA-PMT-2', 'Plumbing General Permit', 'plumbing', 'issued', false, 'Plumbing', '12 ORCHARD WAY', '12 orchard way', NULL, CURRENT_DATE - 5, 'Ian Holt, Ridgeline Interiors', 'ridgelineinteriors'),
  -- A city where plumbers pull their own permits: the address is the only tie, and it stands.
  ('00000000-0000-0000-0000-0000003020e1', 'Elm City', 'bed', 'EC-1', 'Comm Remodel Permit', 'building', 'issued', false, 'Commercial remodel', '4 ELM ST', '4 elm st', CURRENT_DATE - 5, NULL, 'Pat Lime, Lime Build', 'limebuild'),
  ('00000000-0000-0000-0000-0000003020e2', 'Elm City', 'bed', 'EC-P1', 'Plumbing Permit', 'plumbing', 'issued', false, 'Plumbing', '4 ELM ST', '4 elm st', NULL, CURRENT_DATE - 2, 'Wren Plumbing', 'wrenplumbing');

-- The plumber's own permit at 800 Tower Blvd says what the work is.
UPDATE public.permits SET project_name = 'Water heater, suite 210' WHERE id = '00000000-0000-0000-0000-0000003020d4';

-- COM-1 arrived three days ago; the rest arrived now.
UPDATE public.permits SET first_seen_at = now() - interval '3 days' WHERE id = '00000000-0000-0000-0000-0000003020b1';

-- Our bids with Lime Build (migration *_research_builders_our_bids): Builders counts them as Market's table of
-- companies does. Six count: under the customer, under the old builders list's name, and one under both, once. Four do
-- not: two practice bids, one a day past two years, and none is lost to a name that only starts with ZZZ. Each is
-- made at noon of its day on the company calendar, so the day never turns on the hour the bed runs.
-- A customer's master is a master technician: Mo holds the customer, and Eve, the estimator, made the bids.
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-0000003020a4', 'mo@skim.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at) VALUES
  ('00000000-0000-0000-0000-0000003020a4', 'mo@skim.test', 'Mo Master', 'master_technician', false, false, NULL)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000003020f0', 'Skim Plumbing');
INSERT INTO public.customers (id, name, master_user_id) VALUES ('00000000-0000-0000-0000-0000003020f1', 'Lime Build, Inc.', '00000000-0000-0000-0000-0000003020a4');
INSERT INTO public.bids_gc_builders (id, name, created_by) VALUES ('00000000-0000-0000-0000-0000003020f2', 'Lime Build LLC', '00000000-0000-0000-0000-0000003020a1');
INSERT INTO public.bids (id, created_by, service_type_id, project_name, customer_id, gc_builder_id, outcome, created_at)
SELECT ('00000000-0000-0000-0000-0000003021' || lpad(b.n::text, 2, '0'))::uuid, '00000000-0000-0000-0000-0000003020a1', '00000000-0000-0000-0000-0000003020f0',
       b.project_name,
       CASE WHEN b.customer THEN '00000000-0000-0000-0000-0000003020f1'::uuid END,
       CASE WHEN b.gc THEN '00000000-0000-0000-0000-0000003020f2'::uuid END,
       b.outcome,
       ((public.app_today() - b.days_ago)::timestamp + interval '12 hours') AT TIME ZONE 'America/Chicago'
FROM (VALUES
  (1, 'Mill Street Lofts', true, false, 'won', 10),
  (2, 'Kiln Street Offices', true, false, 'lost', 100),
  (3, 'ZZ Shadow MILL STREET LOFTS', true, false, NULL, 5),
  (4, 'zz test', true, false, NULL, 4),
  (5, 'Aster Ridge Clinic', true, false, 'won', 731),
  (6, 'Larkspur Court Retail', true, false, 'lost', 730),
  (7, 'Orchard Way Retail', false, true, NULL, 20),
  (8, 'Tower Blvd Fitout', true, true, NULL, 30),
  (9, 'ZZZ Corp Tower', true, false, 'lost', 40)
) AS b(n, project_name, customer, gc, outcome, days_ago);

CREATE SCHEMA ps;
GRANT USAGE ON SCHEMA ps TO authenticated, service_role;
CREATE FUNCTION ps.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION ps.sign_in(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ps TO authenticated, service_role;

-- The service role hands the keys back, the way permit-pull does; nobody signed in can.
SET LOCAL ROLE service_role;
SELECT ps.same('the pull sets four keys', public.permit_set_builder_keys('[
  {"id":"00000000-0000-0000-0000-0000003020b1","key":"ridgewaybuilders"},
  {"id":"00000000-0000-0000-0000-0000003020b2","key":"ridgewaybuilders"},
  {"id":"00000000-0000-0000-0000-0000003020b3","key":"tallpinedevelopment"},
  {"id":"00000000-0000-0000-0000-0000003020b4","key":"ridgewaybuilders"}]'::jsonb)::text, '4');
SELECT ps.same('a second run changes nothing', public.permit_set_builder_keys('[{"id":"00000000-0000-0000-0000-0000003020b1","key":"ridgewaybuilders"}]'::jsonb)::text, '0');
RESET ROLE;

SELECT ps.sign_in('00000000-0000-0000-0000-0000003020a1');
SET LOCAL ROLE authenticated;

DO $$ BEGIN
  PERFORM public.permit_set_builder_keys('[]'::jsonb);
  RAISE EXCEPTION 'an estimator set builder keys';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: only the service role sets builder keys';
END $$;

-- The nudge's read: two wait (the third has a plumber), the oldest since the day the feed brought it.
SELECT ps.same('two permits wait on a skim, the oldest for three days', (SELECT waiting || ' for ' || ((now() AT TIME ZONE 'America/Chicago')::date - oldest_on) FROM public.permit_skim_wait('Skim City')), '2 for 3');

-- The read: three commercial rows, the builder beside each, the taken one paired.
SELECT ps.same('v2 lists the commercial permits, newest first',
  (SELECT string_agg(permit_number || ':' || COALESCE(builder_key, '-') || ':' || builder_permits || '/' || builder_open || ':' || COALESCE(plumber, 'none'), ' ' ORDER BY filed_on DESC)
   FROM public.research_permits_v2('Skim City', CURRENT_DATE - 30, false)),
  'COM-3:tallpinedevelopment:1/1:none COM-1:ridgewaybuilders:2/1:none COM-2:ridgewaybuilders:2/1:Blue Heron Plumbing');

-- San Antonio: another tenant's plumbing permit and a plumber's own permit at the address close nothing and name
-- nobody; an application is closed by the plumbing permit on the number it was issued under, which the same company
-- filed; and that company's own name is never the plumber.
SELECT ps.same('in San Antonio a plumbing permit counts only on the number or from the same applicant',
  (SELECT string_agg(permit_number || ':' || builder_permits || '/' || builder_open || ':' || COALESCE(plumber, 'none') || ':' || COALESCE((CURRENT_DATE - plumber_permit_on)::text, 'open'), ' ' ORDER BY filed_on DESC)
   FROM public.research_permits_v2('San Antonio', CURRENT_DATE - 60, false)),
  'SA-APP-1:3/1:none:open SA-PMT-2:3/1:none:5 SA-PMT-9:1/0:none:3 SA-APP-2:3/1:none:5');
SELECT ps.same('and one San Antonio permit waits on a skim', (SELECT waiting::text FROM public.permit_skim_wait('San Antonio')), '1');
SELECT ps.same('Builders counts the same open permit and names no other tenant as the plumber',
  (SELECT string_agg(key || ':' || permits || '/' || open || ':' || COALESCE(plumber, 'nobody') || 'x' || plumber_jobs, ' ' ORDER BY key) FROM public.research_builders('San Antonio')),
  'harborfitouts:1/0:nobodyx0 ridgelineinteriors:3/1:nobodyx0');
-- Elsewhere a plumber's own permit at the address still closes the job and names him, on both reads.
SELECT ps.same('where plumbers pull their own permits the address still ties them',
  (SELECT permit_number || ':' || builder_permits || '/' || builder_open || ':' || COALESCE(plumber, 'none') FROM public.research_permits_v2('Elm City', CURRENT_DATE - 60, false))
  || ' ' || (SELECT key || ':' || permits || '/' || open || ':' || COALESCE(plumber, 'nobody') || 'x' || plumber_jobs FROM public.research_builders('Elm City')),
  'EC-1:1/0:Wren Plumbing limebuild:1/0:Wren Plumbingx1');

-- What does not count is still said (migration *_permit_plumbing_nearby): the open San Antonio row carries the two
-- permits at its address inside the 30 days, the newest first, and never the year-old one. A row with a plumbing
-- permit of its own carries none, and neither does a city where the address always ties.
SELECT ps.same('v3 says what sits at an open row''s address uncounted',
  (SELECT string_agg(permit_number || ':' || plumbing_nearby || ':' || COALESCE(plumbing_nearby_by, '-') || ':' || COALESCE((CURRENT_DATE - plumbing_nearby_on)::text, '-') || ':' || COALESCE(plumbing_nearby_what, '-'), ' ' ORDER BY filed_on DESC)
   FROM public.research_permits_v3('San Antonio', CURRENT_DATE - 60, false)),
  'SA-APP-1:2:Quill Plumbing:2:Water heater, suite 210 SA-PMT-2:0:-:-:- SA-PMT-9:0:-:-:- SA-APP-2:0:-:-:-');
SELECT ps.same('v3 is v2 with those four columns and nothing else moved',
  (SELECT count(*)::text FROM (
     SELECT to_jsonb(v3) - 'plumbing_nearby' - 'plumbing_nearby_on' - 'plumbing_nearby_by' - 'plumbing_nearby_what' AS j FROM public.research_permits_v3('San Antonio', CURRENT_DATE - 60, false) v3
     EXCEPT
     SELECT to_jsonb(v2) FROM public.research_permits_v2('San Antonio', CURRENT_DATE - 60, false) v2) d)
  || '/' || (SELECT count(*)::text FROM public.research_permits_v3('Skim City', CURRENT_DATE - 30, false)),
  '0/3');
SELECT ps.same('where the address always ties, nothing is left uncounted',
  (SELECT permit_number || ':' || COALESCE(plumber, 'none') || ':' || plumbing_nearby FROM public.research_permits_v3('Elm City', CURRENT_DATE - 60, false)), 'EC-1:Wren Plumbing:0');

-- A keep handed to Sam, with its reason code.
INSERT INTO public.permit_verdicts (permit_id, verdict, reason, reason_code, for_user_id, decided_by, decided_at)
VALUES ('00000000-0000-0000-0000-0000003020b1', 'look', 'Kept on the skim.', NULL, '00000000-0000-0000-0000-0000003020a2', '00000000-0000-0000-0000-0000003020a1', now() - interval '3 hours');
SELECT ps.same('a keep shows who it is for',
  (SELECT verdict || ' for ' || verdict_for_name FROM public.research_permits_v2('Skim City', CURRENT_DATE - 30, false) WHERE permit_number = 'COM-1'),
  'look for Sam Second');

-- A pass with a code, then a put-back: the permit waits again on both reads.
INSERT INTO public.permit_verdicts (permit_id, verdict, reason, reason_code, decided_by, decided_at)
VALUES ('00000000-0000-0000-0000-0000003020b3', 'not_for_us', 'Passed on the skim: too far.', 'too_far', '00000000-0000-0000-0000-0000003020a1', now() - interval '2 hours');
SELECT ps.same('a pass carries its code',
  (SELECT verdict || ':' || verdict_reason_code FROM public.research_permits_v2('Skim City', CURRENT_DATE - 30, false) WHERE permit_number = 'COM-3'), 'not_for_us:too_far');
INSERT INTO public.permit_verdicts (permit_id, verdict, reason, decided_by, decided_at)
VALUES ('00000000-0000-0000-0000-0000003020b3', 'back', 'Put back on the skim.', '00000000-0000-0000-0000-0000003020a1', now() - interval '1 hour');
SELECT ps.same('a put-back reads as unanswered on the ledger read',
  (SELECT COALESCE(verdict, 'none') FROM public.research_permits('Skim City', CURRENT_DATE - 30, false) WHERE permit_number = 'COM-3'), 'none');
SELECT ps.same('and on v2, with nothing left of the old answer',
  (SELECT COALESCE(verdict, 'none') || ':' || COALESCE(verdict_reason_code, 'none') || ':' || COALESCE(verdict_reason, 'none') FROM public.research_permits_v2('Skim City', CURRENT_DATE - 30, false) WHERE permit_number = 'COM-3'), 'none:none:none');

-- A pursue says what it is for, and only one of the three.
INSERT INTO public.permit_verdicts (permit_id, verdict, reason, pursue_for, decided_by, decided_at)
VALUES ('00000000-0000-0000-0000-0000003020b1', 'approach', 'Our size.', 'next_jobs', '00000000-0000-0000-0000-0000003020a1', now() - interval '30 minutes');
DO $$ BEGIN
  INSERT INTO public.permit_verdicts (permit_id, verdict, reason, pursue_for, decided_by) VALUES ('00000000-0000-0000-0000-0000003020b1', 'approach', 'x', 'someday', '00000000-0000-0000-0000-0000003020a1');
  RAISE EXCEPTION 'a pursue took an unknown purpose';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: a pursue is for this job, their next jobs or both';
END $$;

-- The mark: a good needs its reason, the newest wins, none clears it.
DO $$ BEGIN
  INSERT INTO public.builder_marks (builder_key, mark, reason, marked_by) VALUES ('ridgewaybuilders', 'good', '  ', '00000000-0000-0000-0000-0000003020a1');
  RAISE EXCEPTION 'a mark landed with no reason';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok: a good mark needs its reason';
END $$;
INSERT INTO public.builder_marks (builder_key, mark, reason, marked_by, marked_at) VALUES ('ridgewaybuilders', 'good', 'Pays on time.', '00000000-0000-0000-0000-0000003020a1', now() - interval '2 hours');
SELECT ps.same('the mark rides on every permit of the builder',
  (SELECT string_agg(permit_number || ':' || COALESCE(builder_mark, 'none') || ':' || COALESCE(builder_mark_by_name, '-'), ' ' ORDER BY permit_number) FROM public.research_permits_v2('Skim City', CURRENT_DATE - 30, false)),
  'COM-1:good:Eve Estimator COM-2:good:Eve Estimator COM-3:none:-');
INSERT INTO public.builder_marks (builder_key, mark, marked_by) VALUES ('ridgewaybuilders', 'none', '00000000-0000-0000-0000-0000003020a1');
SELECT ps.same('none clears the mark',
  (SELECT COALESCE(builder_mark, 'none') || ':' || COALESCE(builder_mark_reason, 'none') FROM public.research_permits_v2('Skim City', CURRENT_DATE - 30, false) WHERE permit_number = 'COM-1'), 'none:none');
INSERT INTO public.builder_marks (builder_key, mark, reason, marked_by, marked_at) VALUES ('tallpinedevelopment', 'avoid', 'Slow pay.', '00000000-0000-0000-0000-0000003020a1', now() + interval '1 second');

-- What the office says about a name: its kind, written by the one who says it.
INSERT INTO public.builders (key, name, kind, updated_by) VALUES ('ridgewaybuilders', 'Ridgeway Builders', 'gc', '00000000-0000-0000-0000-0000003020a1');
DO $$ BEGIN
  INSERT INTO public.builders (key, name, kind, updated_by) VALUES ('tallpinedevelopment', 'Tall Pine Development', 'gc', '00000000-0000-0000-0000-0000003020a2');
  RAISE EXCEPTION 'a builder row was written in another name';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: a builder row is written in the writer''s own name';
END $$;

SELECT ps.same('Builders lists each name with its permits, its open ones, its plumber and its mark',
  (SELECT string_agg(key || ':' || COALESCE(name, '-') || ':' || COALESCE(kind, '-') || ':' || permits || '/' || open || ':' || COALESCE(plumber, 'nobody') || 'x' || plumber_jobs || ':' || COALESCE(mark, 'none') || ':' || bids, ' ' ORDER BY key)
   FROM public.research_builders('Skim City')),
  'ridgewaybuilders:Ridgeway Builders:gc:2/1:Blue Heron Plumbingx1:none:0 tallpinedevelopment:-:-:1/1:nobodyx0:avoid:0');

-- Neither the read nor the table carries a customer (migration *_builders_customer_id_dropped): the customers a
-- name is tied to are builder_customer_answers. The read's return, the table's columns and its foreign keys, by name.
SELECT ps.same('research_builders returns no customer, and builders holds none',
  (SELECT count(*)::text FROM unnest((SELECT proargnames FROM pg_proc WHERE oid = 'public.research_builders(text)'::regprocedure)) a(name) WHERE a.name = 'customer_id')
  || '/' || (SELECT count(*)::text FROM pg_attribute WHERE attrelid = 'public.builders'::regclass AND attname = 'customer_id' AND NOT attisdropped)
  || '/' || (SELECT count(*)::text FROM pg_constraint WHERE conrelid = 'public.builders'::regclass AND contype = 'f' AND conname = 'builders_customer_id_fkey'),
  '0/0/0');

-- Our bids with a name, by the one rule (migration *_research_builders_our_bids).
SELECT ps.same('Builders counts our bids of two years that are no practice bid, each once',
  (SELECT bids || ' bids, ' || won || ' won, the last ' || (public.app_today() - last_bid_on) || ' days ago' FROM public.research_builders('Elm City') WHERE key = 'limebuild'),
  '6 bids, 1 won, the last 10 days ago');
SELECT ps.same('a bid counts when it is no practice bid and was made within two years',
  concat_ws(' ',
    public.research_bid_counts('Mill Street Lofts', now())::text,
    public.research_bid_counts('ZZ Shadow MILL STREET LOFTS', now())::text,
    public.research_bid_counts('  zz test', now())::text,
    public.research_bid_counts('ZZZ Corp Tower', now())::text,
    public.research_bid_counts(NULL, now())::text,
    public.research_bid_counts('Larkspur Court Retail', ((public.app_today() - 730)::timestamp + interval '12 hours') AT TIME ZONE 'America/Chicago')::text,
    public.research_bid_counts('Aster Ridge Clinic', ((public.app_today() - 731)::timestamp + interval '12 hours') AT TIME ZONE 'America/Chicago')::text,
    public.research_bid_counts('Dated tomorrow', ((public.app_today() + 1)::timestamp + interval '12 hours') AT TIME ZONE 'America/Chicago')::text),
  'true false false true true true false false');
SELECT ps.same('a bid counts under a company''s name, never a ZZ name or a bid platform''s bucket',
  concat_ws(' ',
    COALESCE(public.research_bid_party_key('Lime Build, Inc.'), '-'),
    COALESCE(public.research_bid_party_key('ZZ Test Builders'), '-'),
    COALESCE(public.research_bid_party_key(' zz lime build'), '-'),
    COALESCE(public.research_bid_party_key('PlanHub - Subcontractor Prime Opportunity'), '-'),
    COALESCE(public.research_bid_party_key('BuildingConnected bids'), '-'),
    COALESCE(public.research_bid_party_key('The Plan Hubbard Group'), '-'),
    COALESCE(public.research_bid_party_key(NULL), '-')),
  'limebuild - - - - theplanhubbardgroup -');

-- The count: three arrived; two were skimmed, both by Eve; one stands pursued for their next jobs; the put-back counts nowhere.
SELECT ps.same('the count',
  (SELECT (f->>'arrived') || ' arrived, ' || (f->>'skimmed') || ' skimmed, ' || (f->>'kept') || ' kept, ' || (f->>'passed') || ' passed, ' || (f->>'pursuing') || ' pursuing, ' || (f->>'bid') || ' bid, by ' || (f->'by_person'->0->>'name') || ' ' || (f->'by_person'->0->>'n') || ', for ' || (f->'pursue_for'->0->>'code')
   FROM (SELECT public.permit_funnel('Skim City', CURRENT_DATE - 30) AS f) x),
  '3 arrived, 2 skimmed, 0 kept, 0 passed, 1 pursuing, 0 bid, by Eve Estimator 2, for next_jobs');
RESET ROLE;

-- A helper reads none of it and marks nothing.
SELECT ps.sign_in('00000000-0000-0000-0000-0000003020a3');
SET LOCAL ROLE authenticated;
SELECT ps.same('a helper reads no builder, no mark and no permit',
  (SELECT count(*) FROM public.builders)::text || '/' || (SELECT count(*) FROM public.builder_marks)::text || '/' || (SELECT count(*) FROM public.research_permits_v2('Skim City', CURRENT_DATE - 30, false))::text, '0/0/0');
DO $$ BEGIN
  INSERT INTO public.builder_marks (builder_key, mark, reason, marked_by) VALUES ('ridgewaybuilders', 'avoid', 'x', '00000000-0000-0000-0000-0000003020a3');
  RAISE EXCEPTION 'a helper marked a builder';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok: a helper marks no builder';
END $$;
RESET ROLE;

-- A job's first plumbing permit day (migration *_permit_first_plumbing_day). In Oak City, where the address ties, a
-- building permit was applied for twenty days ago and issued twelve days ago. Two plumbing permits landed at its
-- address since, nine days ago and three days ago, and a third is from two hundred days ago, outside the thirty days.
-- v3 keeps the newest day. v4 says the first beside it, and never reads the old one.
INSERT INTO public.permits (id, city, source, permit_number, permit_type, kind, stage, residential, work_type, address, address_key, submitted_on, issued_on, contact, builder_key) VALUES
  ('00000000-0000-0000-0000-0000003020f1', 'Oak City', 'bed', 'OC-1', 'Comm Remodel Permit', 'building', 'issued', false, 'Commercial remodel', '31 ACORN LN', '31 acorn ln', CURRENT_DATE - 20, CURRENT_DATE - 12, 'Mara Stone, Stonefield Build', 'stonefieldbuild'),
  ('00000000-0000-0000-0000-0000003020f2', 'Oak City', 'bed', 'OC-P1', 'Plumbing Permit', 'plumbing', 'issued', false, 'Plumbing', '31 ACORN LN', '31 acorn ln', NULL, CURRENT_DATE - 9, 'Finch Plumbing', 'finchplumbing'),
  ('00000000-0000-0000-0000-0000003020f3', 'Oak City', 'bed', 'OC-P2', 'Plumbing Permit', 'plumbing', 'issued', false, 'Plumbing', '31 ACORN LN', '31 acorn ln', NULL, CURRENT_DATE - 3, 'Finch Plumbing', 'finchplumbing'),
  ('00000000-0000-0000-0000-0000003020f4', 'Oak City', 'bed', 'OC-P0', 'Plumbing Permit', 'plumbing', 'issued', false, 'Plumbing', '31 ACORN LN', '31 acorn ln', NULL, CURRENT_DATE - 200, 'Finch Plumbing', 'finchplumbing'),
  -- An open job beside it: no plumbing permit, so no day of either kind.
  ('00000000-0000-0000-0000-0000003020f5', 'Oak City', 'bed', 'OC-2', 'Comm Remodel Permit', 'building', 'issued', false, 'Commercial remodel', '8 BURR CT', '8 burr ct', CURRENT_DATE - 6, CURRENT_DATE - 4, 'Mara Stone, Stonefield Build', 'stonefieldbuild');
SELECT ps.same('v4 says a job''s first plumbing day beside its newest',
  (SELECT string_agg(permit_number || ':' || COALESCE((CURRENT_DATE - plumber_permit_on)::text, 'open') || ':' || COALESCE((CURRENT_DATE - plumber_first_permit_on)::text, 'open'), ' ' ORDER BY permit_number)
   FROM public.research_permits_v4('Oak City', CURRENT_DATE - 60, false)),
  'OC-1:3:9 OC-2:open:open');
SELECT ps.same('a job with one plumbing permit reads the same day twice, on its number or at its address',
  (SELECT string_agg(permit_number || ':' || COALESCE((CURRENT_DATE - plumber_permit_on)::text, 'open') || ':' || COALESCE((CURRENT_DATE - plumber_first_permit_on)::text, 'open'), ' ' ORDER BY filed_on DESC)
   FROM public.research_permits_v4('San Antonio', CURRENT_DATE - 60, false))
  || ' ' || (SELECT permit_number || ':' || (CURRENT_DATE - plumber_permit_on)::text || ':' || (CURRENT_DATE - plumber_first_permit_on)::text FROM public.research_permits_v4('Elm City', CURRENT_DATE - 60, false)),
  'SA-APP-1:open:open SA-PMT-2:5:5 SA-PMT-9:3:3 SA-APP-2:5:5 EC-1:2:2');
SELECT ps.same('v4 is v3 with that one column and nothing else moved, and the first day is set with the newest and never later',
  (SELECT count(*)::text FROM (
     SELECT to_jsonb(v4) - 'plumber_first_permit_on' AS j FROM public.research_permits_v4('San Antonio', CURRENT_DATE - 60, false) v4
     EXCEPT
     SELECT to_jsonb(v3) FROM public.research_permits_v3('San Antonio', CURRENT_DATE - 60, false) v3) d)
  || '/' || (SELECT count(*)::text FROM public.research_permits_v4('Skim City', CURRENT_DATE - 30, false))
  || '/' || (SELECT count(*)::text FROM unnest(ARRAY['Skim City', 'San Antonio', 'Elm City', 'Oak City']) c(city), public.research_permits_v4(c.city, CURRENT_DATE - 400, true) r
             WHERE (r.plumber_permit_on IS NULL) <> (r.plumber_first_permit_on IS NULL) OR r.plumber_first_permit_on > r.plumber_permit_on),
  '0/3/0');

-- Only the building's own plumbing permit counts (migration *_permit_building_plumbing_only). The rule first, on
-- every plumbing type prod held the day it was written, and a permit with no type, which counts as it always did.
SELECT ps.same('a general plumbing permit, or a plumbing type with no qualifier, is the building''s plumbing',
  (SELECT string_agg(public.permit_is_building_plumbing(t)::text, ' ' ORDER BY ord) FROM (VALUES
     (1, 'Plumbing General Permit'), (2, 'Plumbing Permit'), (3, 'Plumbing'), (4, 'Commercial Plumbing'), (5, 'Residential - Plumbing'),
     (6, 'Plumbing Irrigation Permit'), (7, 'Plumbing Gas Permit'), (8, 'Plumbing Sewer Permit'), (9, 'Plumbing Backflow Permit'),
     (10, 'LSR Plumbing Permit'), (11, 'Plumbing Completion Permit'), (12, 'Plumbing Medical Gas Permit'), (13, 'Plumbing MRFPSS Permit'),
     (14, NULL)) v(ord, t)),
  'true true true true true false false false false false false false false true');
-- Fern City, where the address ties. Brookline has two jobs. A lawn sprinkler permit sits at the first, and a
-- plumber's permit at the second. Before the rule the sprinkler closed the first job and named the irrigator.
INSERT INTO public.permits (id, city, source, permit_number, permit_type, kind, stage, residential, work_type, address, address_key, submitted_on, issued_on, contact, builder_key) VALUES
  ('00000000-0000-0000-0000-0000003021a1', 'Fern City', 'bed', 'FC-1', 'Comm Remodel Permit', 'building', 'applied', false, 'Commercial remodel', '2 FERN WAY', '2 fern way', CURRENT_DATE - 8, NULL, 'Ada Brook, Brookline Build', 'brooklinebuild'),
  ('00000000-0000-0000-0000-0000003021a2', 'Fern City', 'bed', 'FC-I1', 'Plumbing Irrigation Permit', 'plumbing', 'issued', false, 'Plumbing Irrigation', '2 FERN WAY', '2 fern way', NULL, CURRENT_DATE - 3, 'Green Arc Irrigation', 'greenarcirrigation'),
  ('00000000-0000-0000-0000-0000003021a3', 'Fern City', 'bed', 'FC-2', 'Comm Remodel Permit', 'building', 'applied', false, 'Commercial remodel', '6 MOSS LN', '6 moss ln', CURRENT_DATE - 7, NULL, 'Ada Brook, Brookline Build', 'brooklinebuild'),
  ('00000000-0000-0000-0000-0000003021a4', 'Fern City', 'bed', 'FC-P2', 'Plumbing Permit', 'plumbing', 'issued', false, 'Plumbing', '6 MOSS LN', '6 moss ln', NULL, CURRENT_DATE - 2, 'Heron Plumbing', 'heronplumbing'),
  -- San Antonio: a sprinkler permit on the open application's own number, and another applicant's at its address.
  ('00000000-0000-0000-0000-0000003021a5', 'San Antonio', 'bed', 'SA-APP-1', 'Plumbing Irrigation Permit', 'plumbing', 'issued', false, 'Plumbing Irrigation', '800 TOWER BLVD', '800 tower blvd', NULL, CURRENT_DATE - 1, 'Nora Vance, Ridgeline Interiors', 'ridgelineinteriors'),
  ('00000000-0000-0000-0000-0000003021a6', 'San Antonio', 'bed', 'IRR-7', 'Plumbing Irrigation Permit', 'plumbing', 'issued', false, 'Plumbing Irrigation', '800 TOWER BLVD', '800 tower blvd', NULL, CURRENT_DATE - 1, 'Green Arc Irrigation', 'greenarcirrigation');
SELECT ps.same('a sprinkler permit closes no job and names no plumber, and a plumber''s permit still does, on every read',
  (SELECT string_agg(permit_number || ':' || COALESCE(plumber, 'none') || ':' || COALESCE((CURRENT_DATE - plumber_permit_on)::text, 'open') || ':' || COALESCE((CURRENT_DATE - plumber_first_permit_on)::text, 'open')
                     || ':' || builder_permits || '/' || builder_open || ':' || plumbing_nearby, ' ' ORDER BY permit_number)
   FROM public.research_permits_v4('Fern City', CURRENT_DATE - 60, false))
  || ' ' || (SELECT string_agg(key || ':' || permits || '/' || open || ':' || COALESCE(plumber, 'nobody') || 'x' || plumber_jobs, ' ' ORDER BY key) FROM public.research_builders('Fern City'))
  || ' ' || (SELECT plumber IS NULL AND plumber_permit_on IS NULL FROM public.research_permits('Fern City', CURRENT_DATE - 60, false) WHERE permit_number = 'FC-1')::text,
  'FC-1:none:open:open:2/1:0 FC-2:Heron Plumbing:2:2:2/1:0 brooklinebuild:2/1:Heron Plumbingx1 true');
SELECT ps.same('in San Antonio a sprinkler permit on the job''s own number closes nothing, and another''s at the address is not said as plumbing nearby',
  (SELECT COALESCE(plumber, 'none') || ':' || COALESCE((CURRENT_DATE - plumber_permit_on)::text, 'open') || ':' || COALESCE((CURRENT_DATE - plumber_first_permit_on)::text, 'open') || ':' || builder_open || ':' || plumbing_nearby
   FROM public.research_permits_v4('San Antonio', CURRENT_DATE - 60, false) WHERE permit_number = 'SA-APP-1'),
  'none:open:open:1:2');

-- The fences reached the two new tables, and the new reads are closed to the anon key.
SELECT ps.same('both tables carry the read-only fence',
  (SELECT count(DISTINCT tablename)::text FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('builders', 'builder_marks') AND permissive = 'RESTRICTIVE'), '2');
SELECT ps.same('anon runs none of the new functions',
  (SELECT count(*)::text FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN ('research_permits_v2', 'research_builders', 'permit_funnel', 'permit_set_builder_keys', 'permit_skim_wait', 'permit_address_plumbing_counts', 'permit_is_building_plumbing', 'research_permits_v3', 'research_permits_v4', 'research_bid_counts', 'research_bid_party_key') AND has_function_privilege('anon', p.oid, 'EXECUTE')), '0');

DO $$ BEGIN RAISE NOTICE 'permit_skim PASSED'; END $$;
ROLLBACK;
