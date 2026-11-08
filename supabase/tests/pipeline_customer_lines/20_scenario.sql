-- The Pipeline board's read of the customer's conversation (punch list #125, PR 1, migration *_pipeline_customer_lines):
-- for each job the newest three calls, texts, emails and portal lines under Job activity's rule and the sheet's — the
-- lines tied to the job, the untied lines of the customers on it since it began while it is unpaid, never a note, an
-- event or a team line, a paid job's untied lines left out, a trade's untied line left with the trade, p_per_job clamped
-- to 1..10 — the names and who of ours wrote each, and nothing for anyone outside the office. The fixture is the one
-- src/lib/jobs/pipelineCustomerLines.test.ts folds on the client (the same ids and times), so the two pick the same
-- lines. The fixture is made as postgres; the reads run as each user through RLS; everything rolls back. Raises on the
-- first failed assertion; ends with "pipeline_customer_lines PASSED". See scripts/pgtest-pipeline-customer-lines.sh.
-- Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Rosa is the office (assistant); Tanya the owner (master); Luis a tech (primary); the dev owns the rows.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000125d1', 'rosa@lines.test'),
  ('00000000-0000-0000-0000-0000000125d2', 'tanya@lines.test'),
  ('00000000-0000-0000-0000-0000000125d3', 'luis@lines.test'),
  ('00000000-0000-0000-0000-0000000125d8', 'dev@lines.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000125d1', 'rosa@lines.test', 'Rosa Office', 'assistant', false, false),
  ('00000000-0000-0000-0000-0000000125d2', 'tanya@lines.test', 'Tanya Ortiz', 'master_technician', false, false),
  ('00000000-0000-0000-0000-0000000125d3', 'luis@lines.test', 'Luis Tech', 'primary', false, false),
  ('00000000-0000-0000-0000-0000000125d8', 'dev@lines.test', 'Lines Dev', 'dev', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

-- Dana Whitfield's job 1312, begun 2026-10-01, unpaid; Kevin Alvarez's job 1298, paid; Hector Ruiz is a trade on 1312.
INSERT INTO public.customers (id, name, master_user_id, contact_info) VALUES
  ('00000000-0000-0000-0000-0000000125c1', 'Lines Dana Whitfield', '00000000-0000-0000-0000-0000000125d8', '{"phone": "(512) 555-0182"}'),
  ('00000000-0000-0000-0000-0000000125c2', 'Lines Kevin Alvarez', '00000000-0000-0000-0000-0000000125d8', '{}');
INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000000125f9', 'Lines Bed Work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, customer_id, status, created_at) VALUES
  ('00000000-0000-0000-0000-0000000125b1', '00000000-0000-0000-0000-0000000125d8', '00000000-0000-0000-0000-0000000125f9', 'Lines water heater', '00000000-0000-0000-0000-0000000125c1', 'working', '2026-10-01 12:00:00+00'),
  ('00000000-0000-0000-0000-0000000125b2', '00000000-0000-0000-0000-0000000125d8', '00000000-0000-0000-0000-0000000125f9', 'Lines sewer line', '00000000-0000-0000-0000-0000000125c2', 'paid', '2026-09-01 12:00:00+00');
INSERT INTO public.gc_companies (id, name, contact_name, phone, trades) VALUES
  ('00000000-0000-0000-0000-0000000125a1', 'Lines Trenching', 'Hector Ruiz', '(210) 555-0113', ARRAY['Sitework']);
INSERT INTO public.contacts (id, kind, customer_id, gc_company_id, name) VALUES
  ('00000000-0000-0000-0000-0000000125e1', 'customer', '00000000-0000-0000-0000-0000000125c1', NULL, NULL),
  ('00000000-0000-0000-0000-0000000125e2', 'customer', '00000000-0000-0000-0000-0000000125c2', NULL, 'Kevin Alvarez'),
  ('00000000-0000-0000-0000-0000000125e3', 'trade', NULL, '00000000-0000-0000-0000-0000000125a1', 'Hector Ruiz');
INSERT INTO public.contact_jobs (contact_id, jobs_ledger_id, is_default) VALUES
  ('00000000-0000-0000-0000-0000000125e1', '00000000-0000-0000-0000-0000000125b1', true),
  ('00000000-0000-0000-0000-0000000125e2', '00000000-0000-0000-0000-0000000125b2', true),
  ('00000000-0000-0000-0000-0000000125e3', '00000000-0000-0000-0000-0000000125b1', false);

-- The lines, by hand with fixed ids so the client's test names the same ones. On 1312: Tanya's text out (m-2), Dana's
-- text in (m-3), her untied text since the job began (m-5), her untied text before it (m-0, out), her call (m-4), a team
-- note in her thread (never), the app's event (never), Hector's untied call (stays with him) and his tied text (m-6, a
-- line tied to the job counts whoever it is with). On 1298, paid: Kevin's tied text (m-7) and his untied one (left out).
INSERT INTO public.messages (id, contact_id, jobs_ledger_id, channel, direction, who_user_id, who_text, at, body, duration_seconds, summary) VALUES
  ('00000000-0000-0000-0000-0000000125a0', '00000000-0000-0000-0000-0000000125e1', NULL, 'text', 'in', NULL, '', '2026-09-20 15:00:00+00', 'Last year''s question.', NULL, NULL),
  ('00000000-0000-0000-0000-0000000125a2', '00000000-0000-0000-0000-0000000125e1', '00000000-0000-0000-0000-0000000125b1', 'text', 'out', '00000000-0000-0000-0000-0000000125d2', '', '2026-10-06 21:40:00+00', 'Dana, the city set your inspection for Thursday 8 to 10.', NULL, NULL),
  ('00000000-0000-0000-0000-0000000125a3', '00000000-0000-0000-0000-0000000125e1', '00000000-0000-0000-0000-0000000125b1', 'text', 'in', NULL, '', '2026-10-06 23:15:00+00', 'Can you do Thursday after 10 instead?', NULL, NULL),
  ('00000000-0000-0000-0000-0000000125a4', '00000000-0000-0000-0000-0000000125e1', '00000000-0000-0000-0000-0000000125b1', 'call', 'in', NULL, 'answered on the company number', '2026-10-05 14:00:00+00', 'Call.', 192, 'Dana asked about the permit.'),
  ('00000000-0000-0000-0000-0000000125a5', '00000000-0000-0000-0000-0000000125e1', NULL, 'text', 'in', NULL, '', '2026-10-07 01:30:00+00', 'See you Thursday.', NULL, NULL),
  ('00000000-0000-0000-0000-0000000125a6', '00000000-0000-0000-0000-0000000125e3', '00000000-0000-0000-0000-0000000125b1', 'text', 'in', NULL, '', '2026-10-04 12:00:00+00', 'Trencher on site at 7.', NULL, NULL),
  ('00000000-0000-0000-0000-0000000125a7', '00000000-0000-0000-0000-0000000125e2', '00000000-0000-0000-0000-0000000125b2', 'text', 'out', '00000000-0000-0000-0000-0000000125d1', '', '2026-09-10 12:00:00+00', 'Your bill is paid, thank you.', NULL, NULL),
  ('00000000-0000-0000-0000-0000000125a8', '00000000-0000-0000-0000-0000000125e2', NULL, 'text', 'in', NULL, '', '2026-09-11 12:00:00+00', 'Thanks!', NULL, NULL),
  ('00000000-0000-0000-0000-0000000125a9', '00000000-0000-0000-0000-0000000125e3', NULL, 'call', 'in', NULL, 'answered on the company number', '2026-10-06 20:00:00+00', 'Call.', 60, 'Hector asked about Thursday.');
INSERT INTO public.messages (id, contact_id, jobs_ledger_id, channel, direction, who_user_id, who_text, at, body) VALUES
  ('00000000-0000-0000-0000-0000000125aa', '00000000-0000-0000-0000-0000000125e1', '00000000-0000-0000-0000-0000000125b1', 'note', 'team', '00000000-0000-0000-0000-0000000125d1', '', '2026-10-07 02:00:00+00', 'Texts after 5.'),
  ('00000000-0000-0000-0000-0000000125ab', '00000000-0000-0000-0000-0000000125e1', '00000000-0000-0000-0000-0000000125b1', 'event', 'team', NULL, 'the app', '2026-10-07 03:00:00+00', 'Working → Ready to Bill');

CREATE SCHEMA pcl;
CREATE FUNCTION pcl.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION pcl.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- The read for one job as a user: the lines' last two id digits newest first, with who wrote each and tied, one a word.
CREATE FUNCTION pcl.lines(p_user uuid, p_job uuid, p_per integer) RETURNS text LANGUAGE plpgsql AS $$
DECLARE out text;
BEGIN
  PERFORM pcl.as_user(p_user);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT coalesce(string_agg(right(l.id::text, 2) || ':' || l.channel || ':' || l.direction || ':' || coalesce(l.who_name, nullif(l.who_text, ''), '-') || ':' || l.tied::text, ' ' ORDER BY l.at DESC), '-')
    INTO out
    FROM public.pipeline_customer_lines(ARRAY[p_job], p_per) l;
  EXECUTE 'RESET ROLE';
  RETURN out;
END $$;
GRANT USAGE ON SCHEMA pcl TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pcl TO anon, authenticated;

-- 1 · The office reads Dana's job: her untied text since the job began (a5), her text in (a3), Tanya's text out (a2)
--     are the newest three. The call (a4) and Hector's tied text (a6) are fourth and fifth; the note, the event, her old
--     untied text and Hector's untied call never come.
SELECT pcl.same('the newest three on the open job, Job activity''s rule and the sheet''s',
  pcl.lines('00000000-0000-0000-0000-0000000125d1', '00000000-0000-0000-0000-0000000125b1', 3),
  'a5:text:in:-:false a3:text:in:-:true a2:text:out:Tanya Ortiz:true');
SELECT pcl.same('ten per job brings every line the rule allows, a trade''s tied text among them',
  pcl.lines('00000000-0000-0000-0000-0000000125d1', '00000000-0000-0000-0000-0000000125b1', 10),
  'a5:text:in:-:false a3:text:in:-:true a2:text:out:Tanya Ortiz:true a4:call:in:answered on the company number:true a6:text:in:-:true');
SELECT pcl.same('one per job is the newest alone',
  pcl.lines('00000000-0000-0000-0000-0000000125d1', '00000000-0000-0000-0000-0000000125b1', 1), 'a5:text:in:-:false');
SELECT pcl.same('a count past ten is held to ten, under one to one',
  pcl.lines('00000000-0000-0000-0000-0000000125d1', '00000000-0000-0000-0000-0000000125b1', 0), 'a5:text:in:-:false');

-- 2 · A paid job keeps its tied lines and drops the customer's untied ones.
SELECT pcl.same('a paid job: the tied line, not the untied one',
  pcl.lines('00000000-0000-0000-0000-0000000125d1', '00000000-0000-0000-0000-0000000125b2', 3), 'a7:text:out:Rosa Office:true');

-- 3 · The names: the customer's contact has no name of its own, so the customer's record names her.
SELECT pcl.same('a contact with no name reads its customer''s',
  (SELECT string_agg(DISTINCT l.contact_name, ', ' ORDER BY l.contact_name)
     FROM (SELECT pcl.as_user('00000000-0000-0000-0000-0000000125d1')) s, public.pipeline_customer_lines(ARRAY['00000000-0000-0000-0000-0000000125b1'::uuid], 10) l),
  'Hector Ruiz, Lines Dana Whitfield');

-- 4 · Two jobs in one call: each job's own lines, no cross-talk.
SELECT pcl.same('two jobs in one call, each with its own count',
  (SELECT string_agg(right(x.job_id::text, 2) || '=' || x.n::text, ' ' ORDER BY x.job_id)
     FROM (SELECT l.job_id, count(*) AS n
             FROM (SELECT pcl.as_user('00000000-0000-0000-0000-0000000125d1')) s,
                  public.pipeline_customer_lines(ARRAY['00000000-0000-0000-0000-0000000125b1'::uuid, '00000000-0000-0000-0000-0000000125b2'::uuid], 3) l
            GROUP BY l.job_id) x),
  'b1=3 b2=1');

-- 5 · A tech reads nothing: the messages policy is the office's, and SECURITY INVOKER keeps it so.
SELECT pcl.same('a tech reads no lines', pcl.lines('00000000-0000-0000-0000-0000000125d3', '00000000-0000-0000-0000-0000000125b1', 3), '-');

-- 6 · Nothing for no jobs.
SELECT pcl.same('no jobs, no rows',
  (SELECT count(*)::text FROM (SELECT pcl.as_user('00000000-0000-0000-0000-0000000125d1')) s, public.pipeline_customer_lines(NULL, 3)), '0');

SELECT 'pipeline_customer_lines PASSED' AS result;
ROLLBACK;
