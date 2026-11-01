-- Firms and their coverage, PR 3 (v2.6227, punch list #222, migration *_legal_firm_shared_counties): two firms
-- share a county with one first call. A dev colors Comal for ZZ Snell, shares it with ZZ Alamo, hands Alamo first
-- call, and is refused a stale save; a save with one bad county writes none of its counties; a first call outside
-- the county's firms, an assistant and a training account are refused; Snell leaves Comal, the first call leaving
-- a shared county hands it to the firm that stays, a cleared county keeps its history, a retired firm's leftover
-- row closes when its county is saved, and the database itself refuses a second first call. Everything rolls back.
-- Raises on the first failed assertion; ends with "legal_firm_coverage shared counties PASSED".
-- See scripts/pgtest-legal-firm-coverage.sh. Never against prod.
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
  ('00000000-0000-0000-0000-0000000222f2', 'ZZ Alamo', true),
  ('00000000-0000-0000-0000-0000000222f3', 'ZZ Retired', false);

CREATE SCHEMA lfc;
CREATE FUNCTION lfc.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION lfc.has(label text, got text, part text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS NULL OR position(part IN got) = 0 THEN RAISE EXCEPTION E'% lacks "%".\n--- got ---\n%', label, part, got; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION lfc.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- want_state is the SQLSTATE the refusal must carry, so a refusal for another reason (the training trigger) fails.
CREATE FUNCTION lfc.refused(label text, stmt text, want_state text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_state text;
  v_msg text;
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    v_state := SQLSTATE;
    v_msg := SQLERRM;
  END;
  IF v_state IS NULL THEN RAISE EXCEPTION '% was not refused', label; END IF;
  IF v_state <> want_state THEN RAISE EXCEPTION '% was refused for another reason: % %', label, v_state, v_msg; END IF;
  RAISE NOTICE 'ok: % (refused: % %)', label, v_state, v_msg;
END $$;
-- The live map in one line: `Comal:ZZ Alamo* Comal:ZZ Snell`, the star on the first call.
CREATE FUNCTION lfc.live() RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COALESCE(string_agg(c.county || ':' || f.name || CASE WHEN c.first_call THEN '*' ELSE '' END, ' ' ORDER BY c.county, f.name), '')
    FROM public.legal_firm_counties c JOIN public.legal_firms f ON f.id = c.firm_id WHERE c.until IS NULL $$;
CREATE FUNCTION lfc.closed(p_county text) RETURNS text LANGUAGE sql SECURITY DEFINER AS $$
  SELECT count(*)::text FROM public.legal_firm_counties WHERE county = p_county AND until IS NOT NULL $$;
CREATE FUNCTION lfc.save(p jsonb) RETURNS text LANGUAGE sql AS $$ SELECT public.legal_save_county_coverage(p)::text $$;
GRANT USAGE ON SCHEMA lfc TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA lfc TO anon, authenticated, service_role;

SET LOCAL ROLE authenticated;
SELECT lfc.as_user('00000000-0000-0000-0000-0000000222d1');

SELECT lfc.has('a dev colors Comal for Snell',
  lfc.save('[{"county": "Comal", "firms": ["00000000-0000-0000-0000-0000000222f1"], "first_call": "00000000-0000-0000-0000-0000000222f1", "was": []}]'), '"ok": true');
SELECT lfc.same('Comal is Snell''s, first call', lfc.live(), 'Comal:ZZ Snell*');

SELECT lfc.has('Snell shares Comal with Alamo',
  lfc.save('[{"county": "Comal", "firms": ["00000000-0000-0000-0000-0000000222f1", "00000000-0000-0000-0000-0000000222f2"], "first_call": "00000000-0000-0000-0000-0000000222f1", "was": ["00000000-0000-0000-0000-0000000222f1"]}]'), '"ok": true');
SELECT lfc.same('both cover Comal, Snell first call', lfc.live(), 'Comal:ZZ Alamo Comal:ZZ Snell*');

SELECT lfc.has('Alamo takes first call',
  lfc.save('[{"county": "Comal", "firms": ["00000000-0000-0000-0000-0000000222f1", "00000000-0000-0000-0000-0000000222f2"], "first_call": "00000000-0000-0000-0000-0000000222f2", "was": ["00000000-0000-0000-0000-0000000222f1", "00000000-0000-0000-0000-0000000222f2"]}]'), '"ok": true');
SELECT lfc.same('Alamo first call, Snell still covers it', lfc.live(), 'Comal:ZZ Alamo* Comal:ZZ Snell');

SELECT lfc.has('a picker that read Comal before the share is stale',
  lfc.save('[{"county": "Comal", "firms": ["00000000-0000-0000-0000-0000000222f1"], "first_call": null, "was": ["00000000-0000-0000-0000-0000000222f1"]}]'), '"error": "stale"');
SELECT lfc.same('the stale save changed nothing', lfc.live(), 'Comal:ZZ Alamo* Comal:ZZ Snell');

SELECT lfc.has('one county naming a retired firm refuses the whole save',
  lfc.save('[{"county": "Hays", "firms": ["00000000-0000-0000-0000-0000000222f1"], "first_call": null, "was": []}, {"county": "Bexar", "firms": ["00000000-0000-0000-0000-0000000222f3"], "first_call": null, "was": []}]'), 'no longer stands');
SELECT lfc.same('Hays, earlier in that save, was not written', lfc.live(), 'Comal:ZZ Alamo* Comal:ZZ Snell');

SELECT lfc.has('a first call that does not cover the county is refused',
  lfc.save('[{"county": "Hays", "firms": ["00000000-0000-0000-0000-0000000222f1"], "first_call": "00000000-0000-0000-0000-0000000222f2", "was": []}]'), 'must be a firm that covers it');
SELECT lfc.has('a firm id that is not a uuid is refused',
  lfc.save('[{"county": "Hays", "firms": ["not-a-firm"], "first_call": null, "was": []}]'), 'not a firm');
SELECT lfc.has('an empty save is refused', lfc.save('[]'), 'Nothing to save');

SELECT lfc.has('Snell leaves Comal',
  lfc.save('[{"county": "Comal", "firms": ["00000000-0000-0000-0000-0000000222f2"], "first_call": null, "was": ["00000000-0000-0000-0000-0000000222f1", "00000000-0000-0000-0000-0000000222f2"]}]'), '"ok": true');
SELECT lfc.same('Alamo alone covers Comal', lfc.live(), 'Comal:ZZ Alamo*');
SELECT lfc.same('Snell''s Comal row is history, not gone', lfc.closed('Comal'), '1');

-- The first call leaving a shared county hands first call to the firm that stays.
SELECT lfc.has('Travis shared, Snell first call',
  lfc.save('[{"county": "Travis", "firms": ["00000000-0000-0000-0000-0000000222f1", "00000000-0000-0000-0000-0000000222f2"], "first_call": "00000000-0000-0000-0000-0000000222f1", "was": []}]'), '"ok": true');
SELECT lfc.has('Snell leaves Travis',
  lfc.save('[{"county": "Travis", "firms": ["00000000-0000-0000-0000-0000000222f2"], "first_call": null, "was": ["00000000-0000-0000-0000-0000000222f1", "00000000-0000-0000-0000-0000000222f2"]}]'), '"ok": true');
SELECT lfc.same('Alamo is first call in Travis now', lfc.live(), 'Comal:ZZ Alamo* Travis:ZZ Alamo*');

SELECT lfc.has('Comal clears',
  lfc.save('[{"county": "Comal", "firms": [], "first_call": null, "was": ["00000000-0000-0000-0000-0000000222f2"]}]'), '"ok": true');
SELECT lfc.same('no firm covers Comal', lfc.live(), 'Travis:ZZ Alamo*');
SELECT lfc.same('both Comal rows kept as history', lfc.closed('Comal'), '2');

SELECT lfc.as_user('00000000-0000-0000-0000-0000000222a1');
SELECT lfc.has('an assistant is refused',
  lfc.save('[{"county": "Hays", "firms": ["00000000-0000-0000-0000-0000000222f1"], "first_call": null, "was": []}]'), 'Only a dev');
SELECT lfc.as_user('00000000-0000-0000-0000-0000000222d2');
SELECT lfc.has('a training account is refused',
  lfc.save('[{"county": "Hays", "firms": ["00000000-0000-0000-0000-0000000222f1"], "first_call": null, "was": []}]'), 'training account');
SELECT lfc.same('neither wrote', lfc.live(), 'Travis:ZZ Alamo*');
-- Back to the dev before the setup writes below: the training trigger reads the request's user, not the role.
SELECT lfc.as_user('00000000-0000-0000-0000-0000000222d1');
RESET ROLE;

-- A retired firm's leftover live row closes when its county is saved; the picker never saw it.
INSERT INTO public.legal_firm_counties (firm_id, county, first_call) VALUES ('00000000-0000-0000-0000-0000000222f3', 'Bell', true);
SET LOCAL ROLE authenticated;
SELECT lfc.as_user('00000000-0000-0000-0000-0000000222d1');
SELECT lfc.has('Snell takes Bell, which only a retired firm held',
  lfc.save('[{"county": "Bell", "firms": ["00000000-0000-0000-0000-0000000222f1"], "first_call": null, "was": []}]'), '"ok": true');
SELECT lfc.same('Bell is Snell''s alone, first call', lfc.live(), 'Bell:ZZ Snell* Travis:ZZ Alamo*');
SELECT lfc.same('the retired firm''s Bell row closed', lfc.closed('Bell'), '1');
RESET ROLE;

-- The database itself holds one first call per county and one live row per firm per county.
SELECT lfc.refused('a second first call in Travis',
  $q$INSERT INTO public.legal_firm_counties (firm_id, county, first_call) VALUES ('00000000-0000-0000-0000-0000000222f1', 'Travis', true)$q$, '23505');
SELECT lfc.refused('a second live Travis row for Alamo',
  $q$INSERT INTO public.legal_firm_counties (firm_id, county, first_call) VALUES ('00000000-0000-0000-0000-0000000222f2', 'Travis', false)$q$, '23505');

DO $$ BEGIN RAISE NOTICE 'legal_firm_coverage shared counties PASSED'; END $$;
ROLLBACK;
