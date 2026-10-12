-- Merging a customer keeps their GC call log and their part on every GC project (migration
-- *_merge_customers_gc_folds, v2.5310). The fixture is made as postgres; the merge runs as a dev through RLS, the way
-- the Customer Hub calls it; everything rolls back. Raises on the first failed assertion; ends with
-- "merge_customers PASSED". See scripts/pgtest-merge-customers.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- A dev, who merges, and an estimator, who logged the calls.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000ed1', 'dev@merge.test'),
  ('00000000-0000-0000-0000-000000000ed2', 'estimator@merge.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-000000000ed1', 'dev@merge.test', 'Merge Dev', 'dev', false, false),
  ('00000000-0000-0000-0000-000000000ed2', 'estimator@merge.test', 'Merge Estimator', 'estimator', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

-- The same architect typed twice (the survivor and the victim), and the owner of a building.
INSERT INTO public.customers (id, name, address, master_user_id) VALUES
  ('00000000-0000-0000-0000-000000000ec1', 'Kept Architects', '1 Kept St', '00000000-0000-0000-0000-000000000ed1'),
  ('00000000-0000-0000-0000-000000000ec2', 'Kept Architects (dup)', '2 Gone St', '00000000-0000-0000-0000-000000000ed1'),
  ('00000000-0000-0000-0000-000000000ec3', 'Merge Owner', '3 Owner Rd', '00000000-0000-0000-0000-000000000ed1');

-- Three GC projects: the clinic is the owner's job, drawn by the victim and with the victim typed as its property owner
-- too; the school is the victim's own job, drawn by the survivor already; the shop has no part for the victim.
INSERT INTO public.projects (id, name, customer_id) VALUES
  ('00000000-0000-0000-0000-000000000ea1', 'Merge Clinic', '00000000-0000-0000-0000-000000000ec3'),
  ('00000000-0000-0000-0000-000000000ea2', 'Merge School', '00000000-0000-0000-0000-000000000ec2'),
  ('00000000-0000-0000-0000-000000000ea3', 'Merge Shop', '00000000-0000-0000-0000-000000000ec3');
INSERT INTO public.gc_projects (project_id, stage, architect_customer_id, property_owner_customer_id) VALUES
  ('00000000-0000-0000-0000-000000000ea1', 'buyout', '00000000-0000-0000-0000-000000000ec2', '00000000-0000-0000-0000-000000000ec2'),
  ('00000000-0000-0000-0000-000000000ea2', 'bidding', '00000000-0000-0000-0000-000000000ec1', '00000000-0000-0000-0000-000000000ec3'),
  ('00000000-0000-0000-0000-000000000ea3', 'building', '00000000-0000-0000-0000-000000000ec3', NULL);

-- The GC call log: two lines on the victim, one of them about the clinic, and one on the survivor. The old call log
-- (customer_contacts): one line on the victim.
INSERT INTO public.gc_customer_contacts (customer_id, project_id, by_user_id, by_name, how, note) VALUES
  ('00000000-0000-0000-0000-000000000ec2', '00000000-0000-0000-0000-000000000ea1', '00000000-0000-0000-0000-000000000ed2', 'Merge Estimator', 'call', 'They will sign Monday.'),
  ('00000000-0000-0000-0000-000000000ec2', NULL, '00000000-0000-0000-0000-000000000ed2', 'Merge Estimator', 'email', 'Sent the price.'),
  ('00000000-0000-0000-0000-000000000ec1', NULL, '00000000-0000-0000-0000-000000000ed1', 'Merge Dev', 'note', 'Met at the site.');
INSERT INTO public.customer_contacts (customer_id, contact_date, details, contact_method, created_by) VALUES
  ('00000000-0000-0000-0000-000000000ec2', now(), 'Old log line.', 'phone', '00000000-0000-0000-0000-000000000ed2');

CREATE SCHEMA mc;
CREATE FUNCTION mc.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused, its words holding `want`; its writes go with the refusal (a subtransaction).
CREATE FUNCTION mc.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION mc.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
GRANT USAGE ON SCHEMA mc TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA mc TO anon, authenticated;

-- 0 · The fixture reads as laid: three call-log lines, two of them the victim's; the clinic names the victim twice.
SELECT mc.same('the victim''s call log before the merge',
  (SELECT count(*)::text FROM public.gc_customer_contacts WHERE customer_id = '00000000-0000-0000-0000-000000000ec2'), '2');
SELECT mc.same('the clinic names the victim as architect and owner',
  (SELECT concat_ws('|', architect_customer_id, property_owner_customer_id) FROM public.gc_projects WHERE project_id = '00000000-0000-0000-0000-000000000ea1'),
  '00000000-0000-0000-0000-000000000ec2|00000000-0000-0000-0000-000000000ec2');

-- 1 · Nobody signed out merges.
SELECT mc.refused('no sign-in merges nothing',
  $q$SELECT public.merge_customers('00000000-0000-0000-0000-000000000ec1', '00000000-0000-0000-0000-000000000ec2', '{}'::jsonb)$q$,
  'Not authenticated');

-- 2 · The dev merges the duplicate into the kept one, taking the duplicate's address.
SELECT mc.as_user('00000000-0000-0000-0000-000000000ed1');
SET LOCAL ROLE authenticated;
SELECT mc.same('the merge answers with the pair',
  (SELECT concat_ws('|', r->>'survivor_id', r->>'removed_id') FROM (
    SELECT public.merge_customers('00000000-0000-0000-0000-000000000ec1', '00000000-0000-0000-0000-000000000ec2', '{"address": "victim"}'::jsonb) AS r) s),
  '00000000-0000-0000-0000-000000000ec1|00000000-0000-0000-0000-000000000ec2');
RESET ROLE;

-- 3 · The duplicate is gone; the survivor carries the chosen address (the folds the function always did).
SELECT mc.same('the victim is gone and the survivor stays',
  (SELECT string_agg(id::text || ':' || address, ',' ORDER BY id) FROM public.customers WHERE id IN ('00000000-0000-0000-0000-000000000ec1', '00000000-0000-0000-0000-000000000ec2')),
  '00000000-0000-0000-0000-000000000ec1:2 Gone St');
SELECT mc.same('the school is the survivor''s job now',
  (SELECT customer_id::text FROM public.projects WHERE id = '00000000-0000-0000-0000-000000000ea2'),
  '00000000-0000-0000-0000-000000000ec1');
SELECT mc.same('the old call log line moved too',
  (SELECT string_agg(customer_id::text, ',') FROM public.customer_contacts WHERE details = 'Old log line.'),
  '00000000-0000-0000-0000-000000000ec1');

-- 4 · Every line of the GC call log reads on the survivor; the clinic call still names its job; nothing was dropped.
SELECT mc.same('the GC call log is all the survivor''s, still naming the job',
  (SELECT string_agg(concat_ws('|', customer_id, coalesce(project_id::text, ''), how, note), ',' ORDER BY note) FROM public.gc_customer_contacts),
  '00000000-0000-0000-0000-000000000ec1||note|Met at the site.,'
  '00000000-0000-0000-0000-000000000ec1||email|Sent the price.,'
  '00000000-0000-0000-0000-000000000ec1|00000000-0000-0000-0000-000000000ea1|call|They will sign Monday.');

-- 5 · The clinic names the survivor as its architect and its property owner; the school's and the shop's parts are
-- as they were.
SELECT mc.same('the projects name the survivor where they named the victim',
  (SELECT string_agg(concat_ws('|', project_id, coalesce(architect_customer_id::text, ''), coalesce(property_owner_customer_id::text, '')), ',' ORDER BY project_id) FROM public.gc_projects
    WHERE project_id IN ('00000000-0000-0000-0000-000000000ea1', '00000000-0000-0000-0000-000000000ea2', '00000000-0000-0000-0000-000000000ea3')),
  '00000000-0000-0000-0000-000000000ea1|00000000-0000-0000-0000-000000000ec1|00000000-0000-0000-0000-000000000ec1,'
  '00000000-0000-0000-0000-000000000ea2|00000000-0000-0000-0000-000000000ec1|00000000-0000-0000-0000-000000000ec3,'
  '00000000-0000-0000-0000-000000000ea3|00000000-0000-0000-0000-000000000ec3|');

DO $$ BEGIN RAISE NOTICE 'merge_customers PASSED'; END $$;
ROLLBACK;
