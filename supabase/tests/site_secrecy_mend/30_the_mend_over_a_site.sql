-- The mend, step 30: the mend was applied over a site that is on, as it would be used. The site is off and its rows
-- are off their jobs. Hector is told of each job what he was told before the site went on, and reads the rows he read
-- then. The nine functions are prod's of before. Turn-on refuses with its reason. A job still saves, and the trigger
-- puts nothing on it. Ends with "site_secrecy_mend PASSED". See scripts/pgtest-site-secrecy-mend.sh.
\set ON_ERROR_STOP 1
BEGIN;
SELECT ssm.same('over a site that was on, the nine functions of the gate are the ones prod ran before',
  coalesce((
    SELECT string_agg(w.name || ' is ' || coalesce(md5(p.prosrc), 'missing') || ', prod ran ' || w.want, E'\n' ORDER BY w.name)
    FROM (VALUES
  ('job_closed_to_me', '2895270825653d0a18f07b918449c695'),
  ('jobs_closed_to_me', '3b7f0f3d0a3f95c14ef398220d567db4'),
  ('job_shut_to_user', 'e76aa921f4ba0595d55d53ee3d070dce'),
  ('job_papers_for_person', 'ef41b8f29e19971bc951b754b206aa88'),
  ('job_paper_start', 'a9e67619c1c7a3a035ecdcc4a4c0c322'),
  ('job_paper_remove', '6fe922f3c7b8f194cbd2bcf4a3b18679'),
  ('job_papers_roster_now', '37de3059e84f44d28edd9e72966d5114'),
  ('job_papers_needing_me', '5140afbc7efee7a1f3fc216f47ef3a18'),
  ('job_papers_require', '2f99efd8e048faba0fea4a2173923b75')
    ) AS w(name, want)
    LEFT JOIN pg_proc p ON p.proname = w.name AND p.pronamespace = 'public'::regnamespace
    WHERE md5(p.prosrc) IS DISTINCT FROM w.want
  ), 'all nine are prod''s'), 'all nine are prod''s');
SELECT ssm.same('no site is on', (SELECT count(*)::text FROM public.site_secrecy WHERE turned_off_at IS NULL), '0');
SELECT ssm.same('the ranch''s row is kept, turned off', (SELECT count(*)::text FROM public.site_secrecy WHERE development_id = ssm.id('d1') AND turned_off_at IS NOT NULL), '1');
SELECT ssm.same('no job carries a live row a site wrote', (SELECT count(*)::text FROM public.job_required_papers WHERE site_secrecy_id IS NOT NULL AND removed_at IS NULL), '0');
SELECT ssm.same('the two rows are kept, taken off', (SELECT count(*)::text FROM public.job_required_papers WHERE site_secrecy_id IS NOT NULL AND removed_at IS NOT NULL), '2');

SELECT ssm.as_user(ssm.id('04'));
SELECT ssm.same('Hector is told of each job what he was told before the site went on',
  ssm.told(ssm.id('41')) || ' ' || ssm.told(ssm.id('42')), (SELECT told_barn || ' ' || told_house FROM ssm.before));
SET LOCAL ROLE authenticated;
SELECT set_config('ssm.rows_read', (SELECT count(*)::text FROM public.jobs_ledger j WHERE j.id IN (ssm.id('41'), ssm.id('42'))), true);
RESET ROLE;
SELECT ssm.same('and reads the rows he read then', current_setting('ssm.rows_read'), (SELECT rows_read::text FROM ssm.before));

-- No site goes on under the gate of before.
SELECT ssm.as_user(ssm.id('01'));
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    PERFORM public.site_secrecy_turn_on(ssm.id('d1'), NULL, ssm.id('61'));
  EXCEPTION WHEN OTHERS THEN
    IF position('Secrecy on a site is switched off while it is mended.' IN SQLERRM) = 0 THEN RAISE EXCEPTION 'turn-on was refused for another reason: %', SQLERRM; END IF;
    RAISE NOTICE 'ok: turn-on refuses with its reason (%)', SQLERRM;
    RETURN;
  END;
  RAISE EXCEPTION 'turn-on was allowed after the mend';
END $$;
RESET ROLE;
SELECT ssm.same('and nothing was written by the refused press', (SELECT count(*)::text FROM public.site_secrecy WHERE turned_off_at IS NULL), '0');

-- A job still saves, a new job is still made, and the trigger puts nothing on either.
UPDATE public.jobs_ledger SET job_address = '122 Old Quarry Trl, Sampleton, TX' WHERE id = ssm.id('42');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, hcp_number, job_address, development_id) VALUES
  (ssm.id('43'), ssm.id('02'), ssm.id('f9'), 'ZZ Test Mend Shed', 'M103', '124 Old Quarry Trl, Sampleton, TX', ssm.id('d1'));
SELECT ssm.same('a job''s address changes and a job is made in the ranch, and no row is put on either',
  (SELECT count(*)::text FROM public.job_required_papers WHERE removed_at IS NULL AND job_id IN (ssm.id('42'), ssm.id('43'))), '0');


DO $$ BEGIN RAISE NOTICE 'site_secrecy_mend PASSED'; END $$;
ROLLBACK;
