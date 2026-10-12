-- The lines the office types for a customer's page (Messages, cut 8a, migration *_portal_customer_lines): the daily log
-- saves This week's line with its Spanish, keeps it when a page sends none, clears the old Spanish beside a new English
-- line and refuses Spanish alone; the money team writes what a pay application covers through its own column grant and
-- nothing else of a sent bill; a change order takes its Spanish; the office names the job's superintendent; a line is
-- never only spaces and Spanish never stands without English. Presses run as each user through RLS; the fixture is made
-- as postgres; everything rolls back. Raises on the first failed assertion; ends with "portal_customer_lines PASSED".
-- See scripts/pgtest-portal-customer-lines.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- A dev, a controller (the money team), an estimator (the office, not the money team), an assistant (the office), a
-- superintendent to name, and a controller in training mode.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000008f1', 'dev@lines.test'),
  ('00000000-0000-0000-0000-0000000008f2', 'controller@lines.test'),
  ('00000000-0000-0000-0000-0000000008f3', 'estimator@lines.test'),
  ('00000000-0000-0000-0000-0000000008f4', 'assistant@lines.test'),
  ('00000000-0000-0000-0000-0000000008f5', 'super@lines.test'),
  ('00000000-0000-0000-0000-0000000008f6', 'training@lines.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000008f1', 'dev@lines.test', 'Lines Dev', 'dev', false, false),
  ('00000000-0000-0000-0000-0000000008f2', 'controller@lines.test', 'Lines Controller', 'controller', false, false),
  ('00000000-0000-0000-0000-0000000008f3', 'estimator@lines.test', 'Lines Estimator', 'estimator', false, false),
  ('00000000-0000-0000-0000-0000000008f4', 'assistant@lines.test', 'Lines Assistant', 'assistant', false, false),
  ('00000000-0000-0000-0000-0000000008f5', 'super@lines.test', 'Lines Super', 'superintendent', false, false),
  ('00000000-0000-0000-0000-0000000008f6', 'training@lines.test', 'Lines Training', 'controller', true, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

-- A customer's job being built since five days ago, with a pay application that went and a change order.
INSERT INTO public.customers (id, name, master_user_id) VALUES
  ('00000000-0000-0000-0000-0000000008e9', 'Lines Owner', '00000000-0000-0000-0000-0000000008f1');
INSERT INTO public.projects (id, name, customer_id) VALUES
  ('00000000-0000-0000-0000-0000000008e1', 'Lines Clinic', '00000000-0000-0000-0000-0000000008e9');
INSERT INTO public.gc_projects (project_id, stage, started_on) VALUES ('00000000-0000-0000-0000-0000000008e1', 'building', current_date - 5);
INSERT INTO public.gc_owner_pay_apps (id, project_id, number, period_to, sent_on, retainage_pct, retainage, work_to_date, due)
VALUES ('00000000-0000-0000-0000-0000000008e2', '00000000-0000-0000-0000-0000000008e1', 1, current_date - 2, current_date - 2, 10, 100, 1000, 900);
INSERT INTO public.gc_change_orders (id, project_id, number, description, reason, price)
VALUES ('00000000-0000-0000-0000-0000000008e3', '00000000-0000-0000-0000-0000000008e1', 1, 'A sink in exam 3', 'owner', 2150);

CREATE SCHEMA pcl;
CREATE FUNCTION pcl.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused, its words holding `want`; its writes go with the refusal (a subtransaction).
CREATE FUNCTION pcl.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
-- How many rows a statement changed.
CREATE FUNCTION pcl.changed(stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  EXECUTE stmt;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n::text;
END $$;
CREATE FUNCTION pcl.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- The day's log as the page sends it, with the extra keys given.
CREATE FUNCTION pcl.log(extra jsonb) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('projectId', '00000000-0000-0000-0000-0000000008e1', 'date', current_date::text, 'today', current_date::text, 'high', 80, 'low', 61) || extra
$$;
CREATE FUNCTION pcl.line() RETURNS text LANGUAGE sql AS $$
  SELECT concat_ws('|', done, coalesce(customer_line, '-'), coalesce(customer_line_es, '-')) FROM public.gc_daily_logs
  WHERE project_id = '00000000-0000-0000-0000-0000000008e1' AND log_date = current_date
$$;
GRANT USAGE ON SCHEMA pcl TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pcl TO anon, authenticated;

-- 1 · The daily log saves This week's line with its Spanish, in the payload it already takes.
SELECT pcl.as_user('00000000-0000-0000-0000-0000000008f1');
SET LOCAL ROLE authenticated;
SELECT public.gc_save_daily_log(pcl.log('{"done": "Poured the slab.", "customerLine": "The slab is poured.", "customerLineEs": "La losa está vaciada."}'));
SELECT pcl.same('the log keeps the customer''s line beside the superintendent''s own', pcl.line(), 'Poured the slab.|The slab is poured.|La losa está vaciada.');
-- 2 · A page that sends no line keeps it.
SELECT public.gc_save_daily_log(pcl.log('{"done": "Stripped the forms."}'));
SELECT pcl.same('a save with no line keeps the day''s line', pcl.line(), 'Stripped the forms.|The slab is poured.|La losa está vaciada.');
-- 3 · A new English line without its Spanish clears the old Spanish.
SELECT public.gc_save_daily_log(pcl.log('{"done": "Stripped the forms.", "customerLine": "The forms are off."}'));
SELECT pcl.same('a new English line clears the old Spanish', pcl.line(), 'Stripped the forms.|The forms are off.|-');
-- 4 · Spanish alone is refused in words; a line of spaces clears the line.
SELECT pcl.refused('Spanish with no English', $q$SELECT public.gc_save_daily_log(pcl.log('{"customerLine": "  ", "customerLineEs": "Solo español."}'))$q$,
  'Write the customer’s line in English before its Spanish.');
SELECT public.gc_save_daily_log(pcl.log('{"done": "Stripped the forms.", "customerLine": "   "}'));
SELECT pcl.same('a line of spaces clears it', pcl.line(), 'Stripped the forms.|-|-');
RESET ROLE;

-- 5 · The money team writes what a pay application covers, and nothing else of the sent bill.
SELECT pcl.as_user('00000000-0000-0000-0000-0000000008f2');
SET LOCAL ROLE authenticated;
SELECT pcl.same('the controller writes the line and its Spanish',
  pcl.changed($q$UPDATE public.gc_owner_pay_apps SET customer_line = 'Slab and underground plumbing', customer_line_es = 'Losa y plomería subterránea' WHERE id = '00000000-0000-0000-0000-0000000008e2'$q$), '1');
SELECT pcl.same('the line is on the pay application',
  (SELECT concat_ws('|', customer_line, customer_line_es, due) FROM public.gc_owner_pay_apps WHERE id = '00000000-0000-0000-0000-0000000008e2'),
  'Slab and underground plumbing|Losa y plomería subterránea|900');
SELECT pcl.refused('a sent bill''s amount stays as it went', $q$UPDATE public.gc_owner_pay_apps SET due = 1 WHERE id = '00000000-0000-0000-0000-0000000008e2'$q$,
  'permission denied for table gc_owner_pay_apps');
SELECT pcl.refused('Spanish never stands without English', $q$UPDATE public.gc_owner_pay_apps SET customer_line = NULL WHERE id = '00000000-0000-0000-0000-0000000008e2'$q$,
  'gc_owner_pay_apps_customer_line_said');
SELECT pcl.refused('a line is never only spaces', $q$UPDATE public.gc_owner_pay_apps SET customer_line_es = '   ' WHERE id = '00000000-0000-0000-0000-0000000008e2'$q$,
  'gc_owner_pay_apps_customer_line_said');
-- 6 · A change order takes its Spanish.
SELECT pcl.same('the controller writes a change order''s Spanish',
  pcl.changed($q$UPDATE public.gc_change_orders SET description_es = 'Un lavabo en el consultorio 3' WHERE id = '00000000-0000-0000-0000-0000000008e3'$q$), '1');
SELECT pcl.refused('a Spanish description of spaces', $q$UPDATE public.gc_change_orders SET description_es = ' ' WHERE id = '00000000-0000-0000-0000-0000000008e3'$q$,
  'gc_change_orders_description_es_said');
RESET ROLE;

-- 7 · Outside the money team, and in training mode, the bill's line is not theirs.
SELECT pcl.as_user('00000000-0000-0000-0000-0000000008f3');
SET LOCAL ROLE authenticated;
SELECT pcl.same('an estimator changes no pay application', pcl.changed($q$UPDATE public.gc_owner_pay_apps SET customer_line = 'Hi.' WHERE id = '00000000-0000-0000-0000-0000000008e2'$q$), '0');
RESET ROLE;
SELECT pcl.as_user('00000000-0000-0000-0000-0000000008f6');
SET LOCAL ROLE authenticated;
SELECT pcl.refused('a training account writes no line', $q$UPDATE public.gc_owner_pay_apps SET customer_line = 'Practice.' WHERE id = '00000000-0000-0000-0000-0000000008e2'$q$,
  'Read-only (training) mode');
RESET ROLE;

-- 8 · The office names the job's superintendent; the column lets a removed user go.
SELECT pcl.as_user('00000000-0000-0000-0000-0000000008f4');
SET LOCAL ROLE authenticated;
SELECT pcl.same('an assistant names the superintendent',
  pcl.changed($q$UPDATE public.gc_projects SET superintendent_user_id = '00000000-0000-0000-0000-0000000008f5' WHERE project_id = '00000000-0000-0000-0000-0000000008e1'$q$), '1');
RESET ROLE;
SELECT pcl.same('a removed user leaves the job''s superintendent empty',
  (SELECT confdeltype::text || '|' || confrelid::regclass::text FROM pg_constraint
   WHERE conrelid = 'public.gc_projects'::regclass AND contype = 'f'
     AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public.gc_projects'::regclass AND attname = 'superintendent_user_id')]),
  'n|users');

-- 9 · The grant, as the migration leaves it: the line's two columns join the sent bill's doors; its money does not.
SELECT pcl.same('signed in may update a pay application''s line, never its money',
  (SELECT string_agg(column_name, ',' ORDER BY column_name) FROM information_schema.column_privileges
   WHERE table_schema = 'public' AND table_name = 'gc_owner_pay_apps' AND grantee = 'authenticated' AND privilege_type = 'UPDATE'
     AND column_name IN ('customer_line', 'customer_line_es', 'due', 'work_to_date', 'retainage')),
  'customer_line,customer_line_es');

DO $$ BEGIN RAISE NOTICE 'portal_customer_lines PASSED'; END $$;
ROLLBACK;
