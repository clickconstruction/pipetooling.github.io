-- Firms and their coverage, PR 4 (v2.6233, punch list #222, migration *_legal_hand_off_counties): Snell hands Bell and
-- Travis to Alamo, which becomes first call there; a county Snell no longer covers is refused; Hays goes to a new
-- firm typed in the sheet; retiring Snell with the hand-off waits while an account is still with it, then retires it
-- once the account closes; retire as its own step is refused while the firm covers a county and when it is the only
-- firm that stands; the receiver missing, a county list left empty, a hand-off to the giver itself, an assistant and
-- a training account are refused. Everything rolls back. Raises on the first failed assertion; ends with
-- "legal_firm_coverage hand off PASSED". See scripts/pgtest-legal-firm-coverage.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000222d1', 'dev@lfc.test'),
  ('00000000-0000-0000-0000-0000000222d2', 'training-dev@lfc.test'),
  ('00000000-0000-0000-0000-0000000222a1', 'assistant@lfc.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-0000000222d1', 'dev@lfc.test', 'Bed Dev', 'dev', false, false),
  ('00000000-0000-0000-0000-0000000222d2', 'training-dev@lfc.test', 'Training Dev', 'dev', true, false),
  ('00000000-0000-0000-0000-0000000222a1', 'assistant@lfc.test', 'Wendi', 'assistant', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;
INSERT INTO public.legal_firms (id, name, active) VALUES
  ('00000000-0000-0000-0000-0000000222f1', 'ZZ Snell', true),
  ('00000000-0000-0000-0000-0000000222f2', 'ZZ Alamo', true);
-- Snell is first call in Travis, Bell and Hays and also covers Comal, where Alamo is first call.
INSERT INTO public.legal_firm_counties (firm_id, county, first_call) VALUES
  ('00000000-0000-0000-0000-0000000222f1', 'Travis', true),
  ('00000000-0000-0000-0000-0000000222f1', 'Bell', true),
  ('00000000-0000-0000-0000-0000000222f1', 'Hays', true),
  ('00000000-0000-0000-0000-0000000222f2', 'Comal', true),
  ('00000000-0000-0000-0000-0000000222f1', 'Comal', false);
-- One account is with Snell.
INSERT INTO public.legal_matters (id, payer_key, payer_name, firm_id, stage) VALUES
  ('00000000-0000-0000-0000-0000000222e1', 'c:zz-learning', 'ZZ The Learning Experience', '00000000-0000-0000-0000-0000000222f1', 'referred');

CREATE SCHEMA lfh;
CREATE FUNCTION lfh.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION lfh.has(label text, got text, part text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS NULL OR position(part IN got) = 0 THEN RAISE EXCEPTION E'% lacks "%".\n--- got ---\n%', label, part, got; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION lfh.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- The live map in one line, the star on the first call; only firms that stand.
CREATE FUNCTION lfh.live() RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COALESCE(string_agg(c.county || ':' || f.name || CASE WHEN c.first_call THEN '*' ELSE '' END, ' ' ORDER BY c.county, f.name), '')
    FROM public.legal_firm_counties c JOIN public.legal_firms f ON f.id = c.firm_id WHERE c.until IS NULL AND f.active $$;
CREATE FUNCTION lfh.firms() RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT string_agg(name || CASE WHEN active THEN '' ELSE ' (retired)' END, ', ' ORDER BY name) FROM public.legal_firms WHERE name LIKE 'ZZ %' $$;
CREATE FUNCTION lfh.firm_id(p_name text) RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$ SELECT id FROM public.legal_firms WHERE name = p_name $$;
CREATE FUNCTION lfh.hand(p_from uuid, p_counties text[], p_to uuid, p_new jsonb, p_retire boolean) RETURNS text LANGUAGE sql AS $$
  SELECT public.legal_hand_off_counties(p_from, p_counties, p_to, p_new, p_retire)::text $$;
CREATE FUNCTION lfh.retire(p_firm uuid) RETURNS text LANGUAGE sql AS $$ SELECT public.legal_retire_firm(p_firm)::text $$;
GRANT USAGE ON SCHEMA lfh TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA lfh TO anon, authenticated, service_role;

SET LOCAL ROLE authenticated;
SELECT lfh.as_user('00000000-0000-0000-0000-0000000222d1');

SELECT lfh.has('Snell hands Bell and Travis to Alamo',
  lfh.hand('00000000-0000-0000-0000-0000000222f1', ARRAY['Travis', 'Bell'], '00000000-0000-0000-0000-0000000222f2', NULL, false), '"ok": true');
SELECT lfh.same('Alamo is first call in Bell and Travis; Snell keeps Hays and Comal',
  lfh.live(), 'Bell:ZZ Alamo* Comal:ZZ Alamo* Comal:ZZ Snell Hays:ZZ Snell* Travis:ZZ Alamo*');

SELECT lfh.has('a county Snell no longer covers is refused',
  lfh.hand('00000000-0000-0000-0000-0000000222f1', ARRAY['Bell'], '00000000-0000-0000-0000-0000000222f2', NULL, false), 'no longer covers Bell');
SELECT lfh.same('the refusal changed nothing', lfh.live(), 'Bell:ZZ Alamo* Comal:ZZ Alamo* Comal:ZZ Snell Hays:ZZ Snell* Travis:ZZ Alamo*');

SELECT lfh.has('Hays goes to a new firm typed in the sheet',
  lfh.hand('00000000-0000-0000-0000-0000000222f1', ARRAY['Hays'], NULL, '{"name": "ZZ Hill Country", "handling_name": "M. Reyes", "contingency_pct": 30, "filing_cost": 300}', false), '"ok": true');
SELECT lfh.same('the new firm stands and is first call in Hays',
  lfh.live(), 'Bell:ZZ Alamo* Comal:ZZ Alamo* Comal:ZZ Snell Hays:ZZ Hill Country* Travis:ZZ Alamo*');

SELECT lfh.has('retiring Snell with its last county waits while an account is still with it',
  lfh.hand('00000000-0000-0000-0000-0000000222f1', ARRAY['Comal'], '00000000-0000-0000-0000-0000000222f2', NULL, true), '1 account is still with ZZ Snell');
SELECT lfh.same('that refusal changed nothing either', lfh.live(), 'Bell:ZZ Alamo* Comal:ZZ Alamo* Comal:ZZ Snell Hays:ZZ Hill Country* Travis:ZZ Alamo*');
RESET ROLE;
UPDATE public.legal_matters SET closed_at = now() WHERE id = '00000000-0000-0000-0000-0000000222e1';
SET LOCAL ROLE authenticated;
SELECT lfh.as_user('00000000-0000-0000-0000-0000000222d1');
SELECT lfh.has('with the account closed, Snell hands off Comal and is retired in the same call',
  lfh.hand('00000000-0000-0000-0000-0000000222f1', ARRAY['Comal'], '00000000-0000-0000-0000-0000000222f2', NULL, true), '"retired": true');
SELECT lfh.same('Snell is retired', lfh.firms(), 'ZZ Alamo, ZZ Hill Country, ZZ Snell (retired)');
SELECT lfh.same('Comal is Alamo''s alone', lfh.live(), 'Bell:ZZ Alamo* Comal:ZZ Alamo* Hays:ZZ Hill Country* Travis:ZZ Alamo*');

SELECT lfh.has('retire as its own step is refused while the firm covers a county',
  lfh.retire(lfh.firm_id('ZZ Hill Country')), 'still covers 1 county');
SELECT lfh.has('Hill Country hands Hays to Alamo',
  lfh.hand(lfh.firm_id('ZZ Hill Country'), ARRAY['Hays'], '00000000-0000-0000-0000-0000000222f2', NULL, false), '"ok": true');
SELECT lfh.has('then retires on its own', lfh.retire(lfh.firm_id('ZZ Hill Country')), '"ok": true');
SELECT lfh.same('only Alamo stands', lfh.firms(), 'ZZ Alamo, ZZ Hill Country (retired), ZZ Snell (retired)');

SELECT lfh.has('the receiver missing is refused',
  lfh.hand('00000000-0000-0000-0000-0000000222f2', ARRAY['Bell'], NULL, NULL, false), 'Pick the firm that takes them');
SELECT lfh.has('an empty county list is refused',
  lfh.hand('00000000-0000-0000-0000-0000000222f2', ARRAY[]::text[], '00000000-0000-0000-0000-0000000222f2', NULL, false), 'Pick the counties that move');
SELECT lfh.has('a hand-off to the giver itself is refused',
  lfh.hand('00000000-0000-0000-0000-0000000222f2', ARRAY['Bell'], '00000000-0000-0000-0000-0000000222f2', NULL, false), 'Pick a different firm');
SELECT lfh.has('a new firm with no name is refused',
  lfh.hand('00000000-0000-0000-0000-0000000222f2', ARRAY['Bell'], NULL, '{"name": " "}', false), 'Give the new firm a name');

SELECT lfh.as_user('00000000-0000-0000-0000-0000000222a1');
SELECT lfh.has('an assistant is refused the hand-off',
  lfh.hand('00000000-0000-0000-0000-0000000222f2', ARRAY['Bell'], NULL, '{"name": "ZZ Other"}', false), 'Only a dev');
SELECT lfh.has('and the retire', lfh.retire('00000000-0000-0000-0000-0000000222f2'), 'Only a dev');
SELECT lfh.as_user('00000000-0000-0000-0000-0000000222d2');
SELECT lfh.has('a training account is refused',
  lfh.hand('00000000-0000-0000-0000-0000000222f2', ARRAY['Bell'], NULL, '{"name": "ZZ Other"}', false), 'training account');
SELECT lfh.same('none of them wrote', lfh.live(), 'Bell:ZZ Alamo* Comal:ZZ Alamo* Hays:ZZ Alamo* Travis:ZZ Alamo*');
RESET ROLE;

-- The only firm that stands, covering nothing, cannot be retired: the desk would have no firm.
INSERT INTO public.legal_firms (id, name, active) VALUES ('00000000-0000-0000-0000-0000000222f9', 'ZZ Lone', true);
UPDATE public.legal_firms SET active = false WHERE id = '00000000-0000-0000-0000-0000000222f2';
SET LOCAL ROLE authenticated;
SELECT lfh.as_user('00000000-0000-0000-0000-0000000222d1');
SELECT lfh.has('the only firm is not retired', lfh.retire('00000000-0000-0000-0000-0000000222f9'), 'is the only firm');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'legal_firm_coverage hand off PASSED'; END $$;
ROLLBACK;
