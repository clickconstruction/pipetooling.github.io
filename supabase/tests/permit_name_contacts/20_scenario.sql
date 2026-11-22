-- Permits, the phone on a permit and the names that share one with a customer (migration *_permit_contact_phone).
-- The probe: the migration's second run filled the Austin rows 10_before.sql wrote, from the right party of each
-- record; the two rules answer their lists as their twins in permitLookup.ts do; the read pairs a customer with a
-- name by a phone on a permit, by a looked-up website against an email's domain, and by a phone on the contacts
-- spine; a phone under four names, a lookup that found nothing and a looked-up phone said wrong tie nobody; a helper
-- reads no pair and anon runs none of it. Fixtures are written as postgres; everything here rolls back. Raises on the
-- first failed assertion; ends with "permit_name_contacts PASSED". See scripts/pgtest-permit-name-contacts.sh.
-- Never against prod. Every name and number is made up.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA nc;
GRANT USAGE ON SCHEMA nc TO authenticated, anon, service_role;
CREATE FUNCTION nc.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION nc.sign_in(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA nc TO authenticated, anon, service_role;

-- 1. The rows already held were filled by the migration's own statement, each from the party its contact names.
SELECT nc.same('the phone is the contractor''s beside a contractor, the applicant''s beside an applicant, and never a number that is no phone',
  (SELECT string_agg(permit_number || '=' || COALESCE(contact_phone, 'none'), ' ' ORDER BY id) FROM public.permits WHERE source = 'bed' AND id::text LIKE '00000000-0000-0000-0000-0000009422b%'),
  'AU-1=5125550101 AU-2=5125550202 AU-3=none AU-4=none SA-1=none AU-6=5125550505 AU-7=5125550505 AU-8=5125550505 AU-9=5125550505 AU-10=none');

-- 2. The two rules, on the lists permitLookup.test.ts asks phoneDigitsOf and contactDomainOf.
SELECT nc.same('a phone is ten digits, its extension and its leading 1 dropped',
  (SELECT string_agg(COALESCE(public.permit_phone_digits(v), 'null'), ' ' ORDER BY ord) FROM (VALUES
     (1, '(512) 555-0101'), (2, '1-512-555-0101'), (3, '512.555.0101 ext. 7'), (4, '512'), (5, '512555010155'), (6, '0000000000'), (7, NULL), (8, '+1 512 555 0101 x22')) t(ord, v)),
  '5125550101 5125550101 5125550101 null null null null 5125550101');
SELECT nc.same('a domain is a company''s own, off an email or a website',
  (SELECT string_agg(COALESCE(public.permit_contact_domain(v), 'null'), ' ' ORDER BY ord) FROM (VALUES
     (1, 'https://www.RidgewayBuilders.com/contact'), (2, 'office@mail.ridgewaybuilders.com'), (3, 'Dana <dana@gmail.com>'), (4, 'http://ridgeway.com:8080/x'), (5, 'ridgeway'),
     (6, NULL), (7, 'facebook.com/ridgeway'), (8, 'tallpine.wixsite.com/home'), (9, 'Dana <dana@tallpine.dev>'), (10, 'www.oakmill.co')) t(ord, v)),
  'ridgewaybuilders.com ridgewaybuilders.com null ridgeway.com null null null null tallpine.dev oakmill.co');

-- 3. Our side. A master holds the customers.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000009422a1', 'mo@contacts.test'),
  ('00000000-0000-0000-0000-0000009422a2', 'hal@contacts.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at) VALUES
  ('00000000-0000-0000-0000-0000009422a1', 'mo@contacts.test', 'Mo Master', 'master_technician', false, false, NULL),
  ('00000000-0000-0000-0000-0000009422a2', 'hal@contacts.test', 'Hal Helper', 'helpers', false, false, NULL)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;
INSERT INTO public.customers (id, name, master_user_id, contact_info, billing_email) VALUES
  -- The same phone as Ridgeway's permits, typed another way. A gmail address ties nobody.
  ('00000000-0000-0000-0000-0000009422c1', 'Ridgeway Bldrs', '00000000-0000-0000-0000-0000009422a1', '{"phone": "512-555-0101", "email": "pay@gmail.com"}', NULL),
  -- An email on the domain of the website a lookup found for Tall Pine.
  ('00000000-0000-0000-0000-0000009422c2', 'Tall Pine', '00000000-0000-0000-0000-0000009422a1', '{}', 'ap@tallpine.dev'),
  -- Its one phone is on the contacts spine, on a person of it.
  ('00000000-0000-0000-0000-0000009422c3', 'Whitlock', '00000000-0000-0000-0000-0000009422a1', NULL, NULL),
  -- The phone under four names.
  ('00000000-0000-0000-0000-0000009422c4', 'Runner One', '00000000-0000-0000-0000-0000009422a1', '{"phone": "5125550505"}', NULL),
  -- Harbor's record holds this phone, but San Antonio's row keeps none and its lookup found nothing.
  ('00000000-0000-0000-0000-0000009422c5', 'Harbor', '00000000-0000-0000-0000-0000009422a1', '{"phone": "2105550404"}', NULL),
  -- A looked-up phone two names carry: one of the lookups was said wrong.
  ('00000000-0000-0000-0000-0000009422c6', 'Wrong Number LLC', '00000000-0000-0000-0000-0000009422a1', '{"phone": "5125550707"}', NULL);
INSERT INTO public.customer_contact_persons (id, customer_id, name) VALUES
  ('00000000-0000-0000-0000-0000009422d3', '00000000-0000-0000-0000-0000009422c3', 'Dana');
-- The person's contact on the spine, made here unless the schema already made it, and a phone on it.
DO $$
DECLARE c uuid;
BEGIN
  SELECT id INTO c FROM public.contacts WHERE customer_contact_person_id = '00000000-0000-0000-0000-0000009422d3';
  IF c IS NULL THEN
    INSERT INTO public.contacts (kind, customer_contact_person_id) VALUES ('customer', '00000000-0000-0000-0000-0000009422d3') RETURNING id INTO c;
  END IF;
  INSERT INTO public.contact_channels (contact_id, kind, value) VALUES (c, 'phone', '+1 (512) 555-0202');
END $$;
INSERT INTO public.permit_lookups (kind, lookup_key, query, found, facts) VALUES
  ('company', 'tallpinedevelopment', 'Tall Pine Development Austin TX', true, '{"phone": "(512) 555-0606", "website": "https://www.tallpine.dev/"}'),
  ('company', 'harborfitouts', 'Harbor Fitouts San Antonio TX', false, '{"phone": "2105550404"}');
INSERT INTO public.builder_lookups (id, builder_key, fact, value, source_url, looked_up_on) VALUES
  ('00000000-0000-0000-0000-0000009422f1', 'slatebuild', 'phone', '512-555-0707', 'https://slatebuild.example/contact', CURRENT_DATE),
  ('00000000-0000-0000-0000-0000009422f2', 'zeroco', 'phone', '512-555-0707', 'https://zeroco.example/contact', CURRENT_DATE);
INSERT INTO public.builder_lookup_checks (lookup_id, verdict, said_at) VALUES
  ('00000000-0000-0000-0000-0000009422f1', 'checked', now() - interval '2 hours'),
  ('00000000-0000-0000-0000-0000009422f1', 'wrong', now() - interval '1 hour');

-- 4. The read, over the bed's own customers.
SELECT nc.same('a customer and a name are paired by a phone on a permit, a looked-up website and a phone on the spine, and by nothing a service or a wrong lookup holds',
  (SELECT COALESCE(string_agg(right(customer_id::text, 2) || ':' || builder_key || ':' || reason || ':' || value || ':' || heard_from, ' ' ORDER BY customer_id, builder_key, reason), 'none')
   FROM public.permit_name_contact_matches() WHERE customer_id::text LIKE '00000000-0000-0000-0000-0000009422c%'),
  'c1:ridgewaybuilders:phone:5125550101:permit c2:tallpinedevelopment:domain:tallpine.dev:lookup c3:danawhitlock:phone:5125550202:permit c6:zeroco:phone:5125550707:lookup');
SELECT nc.same('asked for one customer, the read answers for that one',
  (SELECT COALESCE(string_agg(right(customer_id::text, 2) || ':' || builder_key || ':' || reason, ' ' ORDER BY builder_key, reason), 'none')
   FROM public.permit_name_contact_matches(ARRAY['00000000-0000-0000-0000-0000009422c2']::uuid[])),
  'c2:tallpinedevelopment:domain');
SELECT nc.same('a name''s phones are read by its key through an index of their own',
  (SELECT count(*)::text FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'permits_contact_phone_idx'), '1');

-- 5. The caller's own rules stand: a helper sees no permit and no customer, so no pair.
SELECT nc.sign_in('00000000-0000-0000-0000-0000009422a2');
SET LOCAL ROLE authenticated;
SELECT nc.same('a helper reads no pair', (SELECT count(*)::text FROM public.permit_name_contact_matches()), '0');
RESET ROLE;
SELECT nc.same('anon runs none of the three',
  (SELECT count(*)::text FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN ('permit_phone_digits', 'permit_contact_domain', 'permit_name_contact_matches') AND has_function_privilege('anon', p.oid, 'EXECUTE')), '0');

DO $$ BEGIN RAISE NOTICE 'permit_name_contacts PASSED'; END $$;
ROLLBACK;
