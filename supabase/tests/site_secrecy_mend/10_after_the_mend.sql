-- The mend for the site secrecy ground (punch list #439, piece 4a), step 10: a schema that took the ground and then
-- the mend, in order. The nine functions of the gate are byte for byte what prod ran on 2026-11-27 before the ground
-- (md5 of prosrc, read on prod then), the lock's own question is untouched, and the two trigger functions do nothing.
-- See scripts/pgtest-site-secrecy-mend.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;
CREATE SCHEMA ssm;
CREATE FUNCTION ssm.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;

SELECT ssm.same('after the ground and the mend, the nine functions of the gate are the ones prod ran before',
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
SELECT ssm.same('jobs_shut_to_me was never restated',
  (SELECT md5(prosrc) FROM pg_proc WHERE proname = 'jobs_shut_to_me' AND pronamespace = 'public'::regnamespace), '5d4a0c3cf4f9c736d2df398b2e0a17d6');
SELECT ssm.same('the two trigger functions call nothing',
  (SELECT string_agg(proname || ' ' || (position('site_secrecy_sync' IN prosrc) > 0)::text, ', ' ORDER BY proname)
   FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname IN ('site_secrecy_on_job_change', 'site_secrecy_on_answer_change')),
  'site_secrecy_on_answer_change false, site_secrecy_on_job_change false');
SELECT ssm.same('the triggers stay on their tables',
  (SELECT string_agg(tgname, ', ' ORDER BY tgname) FROM pg_trigger WHERE tgname IN ('site_secrecy_job_sync', 'site_secrecy_answer_sync') AND NOT tgisinternal),
  'site_secrecy_answer_sync, site_secrecy_job_sync');
SELECT ssm.same('the table and the column stay', concat_ws(' ', to_regclass('public.site_secrecy') IS NOT NULL,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'job_required_papers' AND column_name = 'site_secrecy_id')), 't t');
DO $$ BEGIN RAISE NOTICE 'step 10 PASSED'; END $$;
ROLLBACK;
