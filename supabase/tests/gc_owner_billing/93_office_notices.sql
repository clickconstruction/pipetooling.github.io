-- The office's notices (GC mode, Owner Billing's O10a): gc_office_notices, the record written before each send, and
-- get_gc_office_notices_due(p_today, p_since), what is due on a day. Bill day is due on the 23rd and 24th to the
-- project manager on the money team, else the company's owner; the architect's reminder from the third day after a
-- pay application went uncertified, the project manager's from the fifth; each once, and only for a pay application
-- sent since the switch's day. The fixture is made as postgres with its days fixed in October 2026, and the payload is
-- read for a named day, so the bed never depends on the day it runs. The money team reads the record through RLS;
-- the switch is flipped as the owner and a dev. Everything runs inside one transaction that rolls back. Raises on the
-- first failed assertion; ends with "gc_owner_billing_office_notices PASSED". See scripts/pgtest-gc-owner-billing.sh.
-- Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000b0a01', 'pm@notices.test'),
  ('00000000-0000-0000-0000-0000000b0a02', 'estimator@notices.test'),
  ('00000000-0000-0000-0000-0000000b0a03', 'owner@notices.test'),
  ('00000000-0000-0000-0000-0000000b0a04', 'dev@notices.test'),
  ('00000000-0000-0000-0000-0000000b0a05', 'trainee@notices.test'),
  ('00000000-0000-0000-0000-0000000b0a06', 'sample@notices.test');
INSERT INTO public.users (id, email, name, role) VALUES
  ('00000000-0000-0000-0000-0000000b0a01', 'pm@notices.test', 'Pat Controller', 'controller'),
  ('00000000-0000-0000-0000-0000000b0a02', 'estimator@notices.test', 'Eve Estimator', 'estimator'),
  ('00000000-0000-0000-0000-0000000b0a03', 'owner@notices.test', 'Owen Owner', 'master_technician'),
  ('00000000-0000-0000-0000-0000000b0a04', 'dev@notices.test', 'Dee Dev', 'dev'),
  ('00000000-0000-0000-0000-0000000b0a05', 'trainee@notices.test', 'Tia Trainee', 'master_technician'),
  ('00000000-0000-0000-0000-0000000b0a06', 'sample@notices.test', 'Sam Sample', 'controller')
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
UPDATE public.users SET read_only = true WHERE id = '00000000-0000-0000-0000-0000000b0a05';
UPDATE public.users SET is_sample = true WHERE id = '00000000-0000-0000-0000-0000000b0a06';
INSERT INTO public.app_settings (key, value_text) VALUES ('company_owner_user_id', '00000000-0000-0000-0000-0000000b0a03')
  ON CONFLICT (key) DO UPDATE SET value_text = EXCLUDED.value_text;
-- On since Oct 10.
UPDATE public.app_settings SET value_text = '2026-10-10' WHERE key = 'gc_office_notices_on_v1';

-- The customer and the architect; eight GC jobs, each with what makes it hear or not on bill day:
--   A Oak Ridge Clinic: building, signed, its project manager the controller, an architect, trades owing waivers.
--   B Elm Street Office: building, signed, its project manager an estimator, no architect.
--   C Pine Hollow School: still bidding.        D Cedar Point Bank: buying out.
--   E Birch Lane Clinic: building, no signed contract.
--   F Maple Court Offices: building, signed, this bill day's pay application sent.
--   G Walnut Ridge Hall: building, signed, its final pay application sent.
--   H Aspen Grove Lofts: building, signed, its project manager a sample account.
INSERT INTO public.customers (id, name, master_user_id, billing_email) VALUES
  ('00000000-0000-0000-0000-0000000b0c01', 'Notices Test Owner', '00000000-0000-0000-0000-0000000b0a03', 'owner-co@notices.test'),
  ('00000000-0000-0000-0000-0000000b0c02', 'Hart Architects', '00000000-0000-0000-0000-0000000b0a03', 'hart@notices.test');
INSERT INTO public.projects (id, name, customer_id) VALUES
  ('00000000-0000-0000-0000-0000000b0b01', 'Oak Ridge Clinic', '00000000-0000-0000-0000-0000000b0c01'),
  ('00000000-0000-0000-0000-0000000b0b02', 'Elm Street Office', '00000000-0000-0000-0000-0000000b0c01'),
  ('00000000-0000-0000-0000-0000000b0b03', 'Pine Hollow School', '00000000-0000-0000-0000-0000000b0c01'),
  ('00000000-0000-0000-0000-0000000b0b04', 'Cedar Point Bank', '00000000-0000-0000-0000-0000000b0c01'),
  ('00000000-0000-0000-0000-0000000b0b05', 'Birch Lane Clinic', '00000000-0000-0000-0000-0000000b0c01'),
  ('00000000-0000-0000-0000-0000000b0b06', 'Maple Court Offices', '00000000-0000-0000-0000-0000000b0c01'),
  ('00000000-0000-0000-0000-0000000b0b07', 'Walnut Ridge Hall', '00000000-0000-0000-0000-0000000b0c01'),
  ('00000000-0000-0000-0000-0000000b0b08', 'Aspen Grove Lofts', '00000000-0000-0000-0000-0000000b0c01');
INSERT INTO public.gc_projects (project_id, stage, started_on, owner_contract_signed_on, project_manager_user_id, architect_customer_id) VALUES
  ('00000000-0000-0000-0000-0000000b0b01', 'building', '2026-09-01', '2026-08-20', '00000000-0000-0000-0000-0000000b0a01', '00000000-0000-0000-0000-0000000b0c02'),
  ('00000000-0000-0000-0000-0000000b0b02', 'building', '2026-09-01', '2026-08-20', '00000000-0000-0000-0000-0000000b0a02', NULL),
  ('00000000-0000-0000-0000-0000000b0b03', 'bidding', NULL, NULL, '00000000-0000-0000-0000-0000000b0a01', NULL),
  ('00000000-0000-0000-0000-0000000b0b04', 'buyout', NULL, '2026-09-20', '00000000-0000-0000-0000-0000000b0a01', NULL),
  ('00000000-0000-0000-0000-0000000b0b05', 'building', '2026-09-01', NULL, '00000000-0000-0000-0000-0000000b0a01', NULL),
  ('00000000-0000-0000-0000-0000000b0b06', 'building', '2026-09-01', '2026-08-20', '00000000-0000-0000-0000-0000000b0a01', '00000000-0000-0000-0000-0000000b0c02'),
  ('00000000-0000-0000-0000-0000000b0b07', 'building', '2026-09-01', '2026-08-20', '00000000-0000-0000-0000-0000000b0a01', NULL),
  ('00000000-0000-0000-0000-0000000b0b08', 'building', '2026-09-01', '2026-08-20', '00000000-0000-0000-0000-0000000b0a06', NULL);
-- The pay applications: A's first went Oct 5, before the switch's day; its second Oct 15. B's Oct 18. F's to this bill
-- day went Oct 22. G's final went Oct 1, certified.
INSERT INTO public.gc_owner_pay_apps (id, project_id, number, final, period_to, sent_on, retainage_pct, retainage, work_to_date, due, certified, certified_on) VALUES
  ('00000000-0000-0000-0000-0000000b0d01', '00000000-0000-0000-0000-0000000b0b01', 1, false, '2026-09-25', '2026-10-05', 10, 1000, 10000, 9000, NULL, NULL),
  ('00000000-0000-0000-0000-0000000b0d02', '00000000-0000-0000-0000-0000000b0b01', 2, false, '2026-09-25', '2026-10-15', 10, 2000, 20000, 9000, NULL, NULL),
  ('00000000-0000-0000-0000-0000000b0d03', '00000000-0000-0000-0000-0000000b0b02', 1, false, '2026-09-25', '2026-10-18', 10, 500, 5000, 4500, NULL, NULL),
  ('00000000-0000-0000-0000-0000000b0d04', '00000000-0000-0000-0000-0000000b0b06', 1, false, '2026-10-25', '2026-10-22', 10, 800, 8000, 7200, NULL, NULL),
  ('00000000-0000-0000-0000-0000000b0d05', '00000000-0000-0000-0000-0000000b0b07', 1, true, '2026-09-25', '2026-10-01', 10, 0, 6000, 6000, 6000, '2026-10-03');
-- A's trades: Ridgeway paid on draws 1 and 2 with only the conditional waivers in; Halverson's draw 1 has its
-- unconditional one, its final draw only the conditional.
INSERT INTO public.gc_companies (id, name, trades) VALUES
  ('00000000-0000-0000-0000-0000000b0e01', 'Ridgeway Concrete', ARRAY['Concrete']),
  ('00000000-0000-0000-0000-0000000b0e02', 'Halverson Steel', ARRAY['Steel']);
INSERT INTO public.gc_trade_packages (id, project_id, trade, position, ours) VALUES
  ('00000000-0000-0000-0000-0000000b0f01', '00000000-0000-0000-0000-0000000b0b01', 'Concrete', 0, false),
  ('00000000-0000-0000-0000-0000000b0f02', '00000000-0000-0000-0000-0000000b0b01', 'Steel', 1, false);
INSERT INTO public.gc_invites (id, package_id, company_id) VALUES
  ('00000000-0000-0000-0000-0000000b1001', '00000000-0000-0000-0000-0000000b0f01', '00000000-0000-0000-0000-0000000b0e01'),
  ('00000000-0000-0000-0000-0000000b1002', '00000000-0000-0000-0000-0000000b0f02', '00000000-0000-0000-0000-0000000b0e02');
UPDATE public.gc_trade_packages SET awarded_invite_id = '00000000-0000-0000-0000-0000000b1001', awarded_on = '2026-08-25' WHERE id = '00000000-0000-0000-0000-0000000b0f01';
UPDATE public.gc_trade_packages SET awarded_invite_id = '00000000-0000-0000-0000-0000000b1002', awarded_on = '2026-08-25' WHERE id = '00000000-0000-0000-0000-0000000b0f02';
INSERT INTO public.gc_sows (id, package_id, invite_id, company_id, status, price, retainage_pct, sent_on, signed_on) VALUES
  ('00000000-0000-0000-0000-0000000b1101', '00000000-0000-0000-0000-0000000b0f01', '00000000-0000-0000-0000-0000000b1001', '00000000-0000-0000-0000-0000000b0e01', 'signed', 30000, 10, '2026-08-26', '2026-08-27'),
  ('00000000-0000-0000-0000-0000000b1102', '00000000-0000-0000-0000-0000000b0f02', '00000000-0000-0000-0000-0000000b1002', '00000000-0000-0000-0000-0000000b0e02', 'signed', 10000, 10, '2026-08-26', '2026-08-27');
INSERT INTO public.gc_draws (sow_id, number, requested_on, status, gross, retainage, net, final, waiver, waiver_on, approved_on, paid_on, period_to, signed_by, signed_on) VALUES
  ('00000000-0000-0000-0000-0000000b1101', 1, '2026-09-20', 'paid', 6000, 600, 5400, false, 'conditional', NULL, '2026-09-21', '2026-09-28', '2026-09-20', 'Pat Ridgeway', '2026-09-20'),
  ('00000000-0000-0000-0000-0000000b1101', 2, '2026-10-12', 'paid', 3000, 300, 2700, false, 'conditional', NULL, '2026-10-13', '2026-10-19', '2026-10-12', 'Pat Ridgeway', '2026-10-12'),
  ('00000000-0000-0000-0000-0000000b1102', 1, '2026-09-20', 'paid', 10000, 1000, 9000, false, 'unconditional', '2026-10-01', '2026-09-21', '2026-09-28', '2026-09-20', 'Hal Verson', '2026-09-20'),
  ('00000000-0000-0000-0000-0000000b1102', 2, '2026-10-12', 'paid', 0, -1000, 1000, true, 'conditional', NULL, '2026-10-13', '2026-10-19', '2026-10-12', 'Hal Verson', '2026-10-12');

CREATE SCHEMA gon;
CREATE FUNCTION gon.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- What is due on a day: one line per notice, its kind, its job and who hears it.
CREATE FUNCTION gon.due(p_today date, p_since date DEFAULT NULL) RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT coalesce(string_agg(n->>'kind' || ' ' || (n->>'project') || ' ' || (n->>'number') || ' ' || coalesce(n->'to'->>'name', '-'), E'\n'
                             ORDER BY n->>'kind', n->>'project', n->>'number'), 'nothing')
  FROM jsonb_array_elements(public.get_gc_office_notices_due(p_today, p_since)->'notices') n $$;
-- One notice of the payload, whole.
CREATE FUNCTION gon.notice(p_today date, p_kind text, p_project text) RETURNS jsonb LANGUAGE sql VOLATILE AS $$
  SELECT n FROM jsonb_array_elements(public.get_gc_office_notices_due(p_today)->'notices') n
  WHERE n->>'kind' = p_kind AND n->>'project' = p_project $$;
CREATE FUNCTION gon.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- A statement as the caller: the rows it reached, or refused.
CREATE FUNCTION gon.try(stmt text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  BEGIN
    EXECUTE stmt;
    GET DIAGNOSTICS n = ROW_COUNT;
    RETURN n::text;
  EXCEPTION WHEN OTHERS THEN
    RETURN 'refused';
  END;
END $$;
CREATE FUNCTION gon.switch() RETURNS text LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  SELECT value_text FROM public.app_settings WHERE key = 'gc_office_notices_on_v1' $$;
GRANT USAGE ON SCHEMA gon TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA gon TO authenticated, anon;

-- 0 · The migration's shape.
SELECT gon.same('the record: its two once-each indexes',
  (SELECT string_agg(indexname, ', ' ORDER BY indexname) FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'gc_office_notices' AND indexname <> 'gc_office_notices_pkey'),
  'gc_office_notices_bill_day_once, gc_office_notices_pay_app_once');
SELECT gon.same('read by the money team, written by no one signed in',
  (SELECT string_agg(policyname || ' ' || cmd || ' ' || array_to_string(roles, ','), '; ') FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'gc_office_notices' AND permissive = 'PERMISSIVE')
  || ' | ' || has_table_privilege('authenticated', 'public.gc_office_notices', 'INSERT')::text
  || ' ' || has_table_privilege('authenticated', 'public.gc_office_notices', 'UPDATE')::text,
  'gc_office_notices_money_read SELECT authenticated | false false');
SELECT gon.same('what is due is the service role''s alone',
  has_function_privilege('service_role', 'public.get_gc_office_notices_due(date, date)', 'EXECUTE')::text || ' '
    || has_function_privilege('authenticated', 'public.get_gc_office_notices_due(date, date)', 'EXECUTE')::text || ' '
    || has_function_privilege('anon', 'public.get_gc_office_notices_due(date, date)', 'EXECUTE')::text,
  'true false false');

-- 1 · Day by day, the switch on since Oct 10.
SELECT gon.same('Oct 22, three days before bill day: no bill day yet; A''s second pay application, sent Oct 15, reminds the architect and its project manager; its first, sent before the switch''s day, nothing',
  gon.due('2026-10-22'),
  'certify_late Oak Ridge Clinic 2 Pat Controller
certify_reminder Oak Ridge Clinic 2 Hart Architects');
SELECT gon.same('Oct 23: bill day for A to its project manager, for B and H to the owner; B''s pay application at 5 to the owner, with no architect to remind; never C (bidding), D (buyout), E (unsigned), F (sent) or G (final)',
  gon.due('2026-10-23'),
  'bill_day Aspen Grove Lofts 1 Owen Owner
bill_day Elm Street Office 2 Owen Owner
bill_day Oak Ridge Clinic 3 Pat Controller
certify_late Elm Street Office 1 Owen Owner
certify_late Oak Ridge Clinic 2 Pat Controller
certify_reminder Oak Ridge Clinic 2 Hart Architects');
SELECT gon.same('Oct 24, a missed 23rd: the same, once',
  gon.due('2026-10-24'), gon.due('2026-10-23'));
SELECT gon.same('Oct 25, bill day itself: no bill day notice; F''s pay application, sent Oct 22, reminds the architect on its third day',
  gon.due('2026-10-25'),
  'certify_late Elm Street Office 1 Owen Owner
certify_late Oak Ridge Clinic 2 Pat Controller
certify_reminder Maple Court Offices 1 Hart Architects
certify_reminder Oak Ridge Clinic 2 Hart Architects');
SELECT gon.same('Oct 26: next month''s bill day is far off',
  (SELECT count(*) FROM jsonb_array_elements(public.get_gc_office_notices_due('2026-10-26')->'notices') n WHERE n->>'kind' = 'bill_day')::text, '0');
SELECT gon.same('the payload says its day and the bill day',
  (SELECT x->>'today' || ' ' || (x->>'billDay') FROM (SELECT public.get_gc_office_notices_due('2026-10-23') x) s), '2026-10-23 2026-10-25');

-- 2 · What the words need.
SELECT gon.same('A''s bill day: the next number, who hears it, and the trades owing an unconditional waiver on a paid draw',
  (SELECT (n->>'billDay') || ' ' || (n->>'number') || ' ' || (n->'waiversOwed')::text || ' ' || (n->'to'->>'email') FROM (SELECT gon.notice('2026-10-23', 'bill_day', 'Oak Ridge Clinic') n) s),
  '2026-10-25 3 [{"draws": [], "final": true, "company": "Halverson Steel"}, {"draws": [1, 2], "final": false, "company": "Ridgeway Concrete"}] pm@notices.test');
SELECT gon.same('B''s bill day owes no waivers',
  (SELECT (n->'waiversOwed')::text FROM (SELECT gon.notice('2026-10-23', 'bill_day', 'Elm Street Office') n) s), '[]');
SELECT gon.same('the architect''s reminder: the pay application, its amount and day, and the project manager to reply to',
  (SELECT concat_ws(' ', n->>'number', n->>'due', n->>'sentOn', n->>'final', n->'to'->>'customerId', n->'replyTo'->>'name', n->'replyTo'->>'email') FROM (SELECT gon.notice('2026-10-23', 'certify_reminder', 'Oak Ridge Clinic') n) s),
  '2 9000 2026-10-15 false 00000000-0000-0000-0000-0000000b0c02 Pat Controller pm@notices.test');
SELECT gon.same('B''s notice at 5 names no architect and no reminder',
  (SELECT coalesce(n->>'architect', '-') || ' ' || coalesce(n->>'remindedOn', '-') FROM (SELECT gon.notice('2026-10-23', 'certify_late', 'Elm Street Office') n) s), '- -');

-- 3 · Once each: written, a notice is gone; written twice, the second is skipped; each pay application its own.
INSERT INTO public.gc_office_notices (project_id, kind, bill_day, recipient_user_id, recipient_email)
VALUES ('00000000-0000-0000-0000-0000000b0b01', 'bill_day', '2026-10-25', '00000000-0000-0000-0000-0000000b0a01', 'pm@notices.test');
INSERT INTO public.gc_office_notices (project_id, kind, pay_app_id, recipient_customer_id, recipient_email, created_at)
VALUES ('00000000-0000-0000-0000-0000000b0b01', 'certify_reminder', '00000000-0000-0000-0000-0000000b0d02', '00000000-0000-0000-0000-0000000b0c02', 'hart@notices.test', '2026-10-18 14:00:00+00');
SELECT gon.same('a second tick''s rows are skipped by the indexes',
  gon.try($q$INSERT INTO public.gc_office_notices (project_id, kind, bill_day, recipient_email) VALUES ('00000000-0000-0000-0000-0000000b0b01', 'bill_day', '2026-10-25', 'pm@notices.test') ON CONFLICT DO NOTHING$q$)
    || ' ' || gon.try($q$INSERT INTO public.gc_office_notices (project_id, kind, pay_app_id, recipient_email) VALUES ('00000000-0000-0000-0000-0000000b0b01', 'certify_reminder', '00000000-0000-0000-0000-0000000b0d02', 'hart@notices.test') ON CONFLICT DO NOTHING$q$),
  '0 0');
SELECT gon.same('A''s first pay application keeps a reminder of its own',
  gon.try($q$INSERT INTO public.gc_office_notices (project_id, kind, pay_app_id, recipient_email) VALUES ('00000000-0000-0000-0000-0000000b0b01', 'certify_reminder', '00000000-0000-0000-0000-0000000b0d01', 'hart@notices.test') ON CONFLICT DO NOTHING$q$),
  '1');
DELETE FROM public.gc_office_notices WHERE pay_app_id = '00000000-0000-0000-0000-0000000b0d01';
SELECT gon.same('Oct 23 again: A''s bill day and its architect''s reminder went, so they are gone; its notice at 5 says the day the architect was reminded',
  gon.due('2026-10-23') || E'\n' || (SELECT n->>'remindedOn' FROM (SELECT gon.notice('2026-10-23', 'certify_late', 'Oak Ridge Clinic') n) s),
  'bill_day Aspen Grove Lofts 1 Owen Owner
bill_day Elm Street Office 2 Owen Owner
certify_late Elm Street Office 1 Owen Owner
certify_late Oak Ridge Clinic 2 Pat Controller
2026-10-18');
SELECT gon.same('a notice says what it is about, and no more',
  gon.try($q$INSERT INTO public.gc_office_notices (project_id, kind, pay_app_id, bill_day, recipient_email) VALUES ('00000000-0000-0000-0000-0000000b0b01', 'certify_late', '00000000-0000-0000-0000-0000000b0d02', '2026-10-25', 'pm@notices.test')$q$)
    || ' ' || gon.try($q$INSERT INTO public.gc_office_notices (project_id, kind, recipient_email) VALUES ('00000000-0000-0000-0000-0000000b0b01', 'bill_day', 'pm@notices.test')$q$)
    || ' ' || gon.try($q$INSERT INTO public.gc_office_notices (project_id, kind, bill_day, recipient_email) VALUES ('00000000-0000-0000-0000-0000000b0b01', 'bill_day', '2026-11-25', ' ')$q$),
  'refused refused refused');

-- 4 · The on-date.
UPDATE public.app_settings SET value_text = '2026-10-16' WHERE key = 'gc_office_notices_on_v1';
SELECT gon.same('on since Oct 16: A''s pay application of Oct 15 hears nothing, B''s of Oct 18 still does',
  (SELECT string_agg(n->>'kind' || ' ' || (n->>'project'), ', ' ORDER BY n->>'kind', n->>'project') FROM jsonb_array_elements(public.get_gc_office_notices_due('2026-10-25')->'notices') n WHERE n->>'kind' <> 'bill_day'),
  'certify_late Elm Street Office, certify_reminder Maple Court Offices');
UPDATE public.app_settings SET value_text = 'false' WHERE key = 'gc_office_notices_on_v1';
SELECT gon.same('off: no pay application hears; bill day still reads, for Preview',
  gon.due('2026-10-23'), 'bill_day Aspen Grove Lofts 1 Owen Owner
bill_day Elm Street Office 2 Owen Owner');
UPDATE public.app_settings SET value_text = 'true' WHERE key = 'gc_office_notices_on_v1';
SELECT gon.same('''true'' is not a day, so off', (SELECT count(*) FROM jsonb_array_elements(public.get_gc_office_notices_due('2026-10-25')->'notices') n WHERE n->>'kind' <> 'bill_day')::text, '0');
UPDATE public.app_settings SET value_text = '2026-02-30' WHERE key = 'gc_office_notices_on_v1';
SELECT gon.same('nor a day that never was', (SELECT count(*) FROM jsonb_array_elements(public.get_gc_office_notices_due('2026-10-25')->'notices') n WHERE n->>'kind' <> 'bill_day')::text, '0');
SELECT gon.same('a since day given reads further back: A''s first pay application, Oct 5, from Oct 1',
  (SELECT string_agg(n->>'kind' || ' ' || (n->>'number'), ', ' ORDER BY n->>'kind', n->>'number') FROM jsonb_array_elements(public.get_gc_office_notices_due('2026-10-23', '2026-10-01')->'notices') n WHERE n->>'project' = 'Oak Ridge Clinic' AND n->>'kind' <> 'bill_day'),
  'certify_late 1, certify_late 2, certify_reminder 1');
UPDATE public.app_settings SET value_text = 'false' WHERE key = 'gc_office_notices_on_v1';

-- 5 · Who hears ours: without the owner set (no setting, and two leaders, so no single one stands in), a job whose
-- project manager is off the money team hears nothing.
UPDATE public.app_settings SET value_text = '' WHERE key = 'company_owner_user_id';
DELETE FROM public.app_settings WHERE key = 'job_owner_override_default';
SELECT gon.same('no owner: B''s and H''s bill day go to no one, A''s still to its project manager',
  gon.due('2026-10-24', '2026-10-10'),
  'certify_late Oak Ridge Clinic 2 Pat Controller');

-- 6 · Who reads the record: the money team; an estimator reads none; nobody signed in writes one.
SELECT gon.as_user('00000000-0000-0000-0000-0000000b0a01');
SET LOCAL ROLE authenticated;
SELECT gon.same('the controller reads the two notices', (SELECT count(*) FROM public.gc_office_notices)::text, '2');
SELECT gon.same('and writes none', gon.try($q$INSERT INTO public.gc_office_notices (project_id, kind, bill_day, recipient_email) VALUES ('00000000-0000-0000-0000-0000000b0b02', 'bill_day', '2026-10-25', 'x@notices.test')$q$)
  || ' ' || gon.try($q$DELETE FROM public.gc_office_notices$q$), 'refused refused');
SELECT gon.same('nor reads what is due', gon.try($q$SELECT public.get_gc_office_notices_due()$q$), 'refused');
RESET ROLE;
SELECT gon.as_user('00000000-0000-0000-0000-0000000b0a02');
SET LOCAL ROLE authenticated;
SELECT gon.same('an estimator reads no notice', (SELECT count(*) FROM public.gc_office_notices)::text, '0');
RESET ROLE;

-- 7 · The switch: the owner and a dev flip it to a day and back; the controller, an estimator and a trainee do not.
SELECT gon.as_user('00000000-0000-0000-0000-0000000b0a03');
SET LOCAL ROLE authenticated;
SELECT gon.same('the owner turns it on, today''s day, and off',
  gon.try($q$UPDATE public.app_settings SET value_text = '2026-10-15' WHERE key = 'gc_office_notices_on_v1'$q$) || ' ' || gon.switch() || ' '
    || gon.try($q$UPDATE public.app_settings SET value_text = 'false' WHERE key = 'gc_office_notices_on_v1'$q$) || ' ' || gon.switch(),
  '1 2026-10-15 1 false');
RESET ROLE;
SELECT gon.as_user('00000000-0000-0000-0000-0000000b0a04');
SET LOCAL ROLE authenticated;
SELECT gon.same('a dev too', gon.try($q$UPDATE public.app_settings SET value_text = '2026-10-15' WHERE key = 'gc_office_notices_on_v1'$q$)
  || ' ' || gon.try($q$UPDATE public.app_settings SET value_text = 'false' WHERE key = 'gc_office_notices_on_v1'$q$), '1 1');
RESET ROLE;
SELECT gon.as_user('00000000-0000-0000-0000-0000000b0a01');
SET LOCAL ROLE authenticated;
SELECT gon.same('the controller does not', gon.try($q$UPDATE public.app_settings SET value_text = '2026-10-15' WHERE key = 'gc_office_notices_on_v1'$q$) || ' ' || gon.switch(), '0 false');
RESET ROLE;
SELECT gon.as_user('00000000-0000-0000-0000-0000000b0a02');
SET LOCAL ROLE authenticated;
SELECT gon.same('nor an estimator', gon.try($q$UPDATE public.app_settings SET value_text = '2026-10-15' WHERE key = 'gc_office_notices_on_v1'$q$) || ' ' || gon.switch(), '0 false');
RESET ROLE;
SELECT gon.as_user('00000000-0000-0000-0000-0000000b0a05');
SET LOCAL ROLE authenticated;
SELECT gon.same('nor the owner in training mode', CASE WHEN gon.try($q$UPDATE public.app_settings SET value_text = '2026-10-15' WHERE key = 'gc_office_notices_on_v1'$q$) IN ('0', 'refused') THEN 'stopped' ELSE 'flipped' END || ' ' || gon.switch(), 'stopped false');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'gc_owner_billing_office_notices PASSED'; END $$;
ROLLBACK;
