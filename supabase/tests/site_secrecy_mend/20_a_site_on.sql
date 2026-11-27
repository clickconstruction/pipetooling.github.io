-- The mend, step 20: the ground is back, as prod will hold it, and a site is turned on. Dana is the office and Marcus
-- the jobs' master. Hector helps on the ranch's two jobs and has signed nothing. This step is KEPT: step 30 applies
-- the mend over it. Every person, job and development is made up. See scripts/pgtest-site-secrecy-mend.sh.
\set ON_ERROR_STOP 1
BEGIN;
CREATE SCHEMA ssm;
CREATE FUNCTION ssm.id(p text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-0000-0000-0000004395' || p)::uuid $$;
CREATE FUNCTION ssm.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION ssm.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- What one user is told about one job, as one line: closed to me | shut to me | in the shut set | in the closed set.
CREATE FUNCTION ssm.told(p_job uuid) RETURNS text LANGUAGE sql AS $$
  SELECT CASE WHEN public.job_closed_to_me(p_job) THEN 't' ELSE 'f' END
    || CASE WHEN public.job_shut_to_me(p_job) THEN 't' ELSE 'f' END
    || CASE WHEN p_job = ANY (public.jobs_shut_to_me()) THEN 't' ELSE 'f' END
    || CASE WHEN p_job = ANY (public.jobs_closed_to_me()) THEN 't' ELSE 'f' END
$$;
-- What the mend must give back: what Hector was told and how many of the ranch's rows he read, before the site went on.
CREATE TABLE ssm.before (told_barn text, told_house text, rows_read integer);
GRANT USAGE ON SCHEMA ssm TO authenticated, anon, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ssm TO authenticated, anon, service_role;

INSERT INTO auth.users (id, email) VALUES
  (ssm.id('01'), 'dana@secrecymend.test'), (ssm.id('02'), 'marcus@secrecymend.test'), (ssm.id('04'), 'hector@secrecymend.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, is_sample, archived_at, login_attached_at) VALUES
  (ssm.id('01'), 'dana@secrecymend.test', 'Dana Office Ssm', 'assistant', false, false, false, NULL, now()),
  (ssm.id('02'), 'marcus@secrecymend.test', 'Marcus Master Ssm', 'master_technician', false, false, false, NULL, now()),
  (ssm.id('04'), 'hector@secrecymend.test', 'Hector Helper Ssm', 'helpers', false, false, false, NULL, now())
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only,
    is_digital_twin = EXCLUDED.is_digital_twin, is_sample = EXCLUDED.is_sample, archived_at = EXCLUDED.archived_at,
    login_attached_at = EXCLUDED.login_attached_at;
INSERT INTO public.people (id, master_user_id, kind, name, account_user_id) VALUES
  (ssm.id('21'), ssm.id('02'), 'assistant', 'Dana Office Ssm', ssm.id('01')),
  (ssm.id('22'), ssm.id('02'), 'master_technician', 'Marcus Master Ssm', ssm.id('02')),
  (ssm.id('24'), ssm.id('02'), 'helper', 'Hector Helper Ssm', ssm.id('04'));
INSERT INTO public.developments (id, name, master_user_id) VALUES (ssm.id('d1'), 'ZZ Test Mend Ranch', ssm.id('02'));
INSERT INTO public.service_types (id, name) VALUES (ssm.id('f9'), 'Site Secrecy Mend Bed Work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, hcp_number, job_address, development_id) VALUES
  (ssm.id('41'), ssm.id('02'), ssm.id('f9'), 'ZZ Test Mend Barn', 'M101', '118 Old Quarry Trl, Sampleton, TX', ssm.id('d1')),
  (ssm.id('42'), ssm.id('02'), ssm.id('f9'), 'ZZ Test Mend House', 'M102', '120 Old Quarry Trl, Sampleton, TX', ssm.id('d1'));
INSERT INTO public.jobs_ledger_team_members (job_id, user_id) VALUES (ssm.id('41'), ssm.id('04')), (ssm.id('42'), ssm.id('04')) ON CONFLICT DO NOTHING;
INSERT INTO public.contract_templates (id, name) VALUES (ssm.id('60'), 'Site secrecy mend bed packet');
INSERT INTO public.contract_template_documents (id, template_id, document_name, book_body_html, book_body_format) VALUES
  (ssm.id('61'), ssm.id('60'), 'Mend bed secrecy paper', '<p>Say nothing of this place.</p>', 'html');

-- Before the site goes on: what Hector is told, and what he reads through the row policies.
SELECT ssm.as_user(ssm.id('04'));
INSERT INTO ssm.before (told_barn, told_house) VALUES (ssm.told(ssm.id('41')), ssm.told(ssm.id('42')));
GRANT SELECT ON ssm.before TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('ssm.rows_read', (SELECT count(*)::text FROM public.jobs_ledger j WHERE j.id IN (ssm.id('41'), ssm.id('42'))), true);
RESET ROLE;
UPDATE ssm.before SET rows_read = current_setting('ssm.rows_read')::integer;
SELECT ssm.same('before the site goes on Hector owes nothing on either job', (SELECT told_barn || ' ' || told_house FROM ssm.before), 'ffff ffff');
DO $$ BEGIN RAISE NOTICE 'ok: before the site goes on Hector reads % of the ranch''s two rows', (SELECT rows_read FROM ssm.before); END $$;

-- Dana turns the ranch on.
SELECT ssm.as_user(ssm.id('01'));
SET LOCAL ROLE authenticated;
SELECT public.site_secrecy_turn_on(ssm.id('d1'), NULL, ssm.id('61'));
RESET ROLE;
SELECT ssm.same('with the ground back, the office turns the ranch on and both jobs carry the paper',
  (SELECT count(*)::text FROM public.job_required_papers r JOIN public.site_secrecy s ON s.id = r.site_secrecy_id
   WHERE s.development_id = ssm.id('d1') AND s.turned_off_at IS NULL AND r.removed_at IS NULL), '2');
SELECT ssm.as_user(ssm.id('04'));
SELECT ssm.same('Hector, who has not signed, is shut out of both', ssm.told(ssm.id('41')) || ' ' || ssm.told(ssm.id('42')), 'tttt tttt');
SET LOCAL ROLE authenticated;
SELECT set_config('ssm.rows_read', (SELECT count(*)::text FROM public.jobs_ledger j WHERE j.id IN (ssm.id('41'), ssm.id('42'))), true);
RESET ROLE;
SELECT ssm.same('and reads neither row', current_setting('ssm.rows_read'), '0');
DO $$ BEGIN RAISE NOTICE 'step 20 PASSED'; END $$;
COMMIT;
