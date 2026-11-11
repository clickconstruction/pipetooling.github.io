-- Permits, the hint beside a name (v2.6917, punch list #302 call 4, migration *_permit_hint_both_decks):
-- research_contact_history says "on the deck" for an open lead of that name on either calling deck, Customers or
-- Jobs to GC, and still for no sub, no lead that left the queue and no name it was not asked about; the bids and
-- the wins read as before. Fixtures are written as postgres; one read runs under RLS as the office; everything
-- rolls back. Raises on the first failed assertion; ends with "permit_hint_decks PASSED". See
-- scripts/pgtest-permit-hint-decks.sh. Never against prod. Every name is made up.
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-0000009417a1', 'dee@hint.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at) VALUES
  ('00000000-0000-0000-0000-0000009417a1', 'dee@hint.test', 'Dee Dev', 'dev', false, false, NULL)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name;

INSERT INTO public.service_types (id, name) VALUES ('00000000-0000-0000-0000-0000009417b1', 'Hint Plumbing');
INSERT INTO public.customers (id, master_user_id, name) VALUES ('00000000-0000-0000-0000-0000009417c1', '00000000-0000-0000-0000-0000009417a1', 'Ridgeway Builders LLC');
INSERT INTO public.bids (id, created_by, estimator_id, service_type_id, project_name, customer_id, outcome) VALUES
  ('00000000-0000-0000-0000-0000009417d1', '00000000-0000-0000-0000-0000009417a1', '00000000-0000-0000-0000-0000009417a1', '00000000-0000-0000-0000-0000009417b1', 'Sample Plaza', '00000000-0000-0000-0000-0000009417c1', 'won'),
  ('00000000-0000-0000-0000-0000009417d2', '00000000-0000-0000-0000-0000009417a1', '00000000-0000-0000-0000-0000009417a1', '00000000-0000-0000-0000-0000009417b1', 'Sample Annex', '00000000-0000-0000-0000-0000009417c1', NULL);

INSERT INTO public.prospects (id, kind, master_user_id, created_by, company_name, prospect_fit_status) VALUES
  ('00000000-0000-0000-0000-0000009417e1', 'gc_lead',  '00000000-0000-0000-0000-0000009417a1', '00000000-0000-0000-0000-0000009417a1', 'Tall Pine Development', NULL),
  ('00000000-0000-0000-0000-0000009417e2', 'customer', '00000000-0000-0000-0000-0000009417a1', '00000000-0000-0000-0000-0000009417a1', 'Northgate Builders, Inc.', NULL),
  ('00000000-0000-0000-0000-0000009417e3', 'customer', '00000000-0000-0000-0000-0000009417a1', '00000000-0000-0000-0000-0000009417a1', 'Closed Door Contracting', 'not_a_fit'),
  ('00000000-0000-0000-0000-0000009417e4', 'sub',      '00000000-0000-0000-0000-0000009417a1', '00000000-0000-0000-0000-0000009417a1', 'Sub Only Plumbing', NULL),
  -- The same company on both decks is still one name.
  ('00000000-0000-0000-0000-0000009417e5', 'gc_lead',  '00000000-0000-0000-0000-0000009417a1', '00000000-0000-0000-0000-0000009417a1', 'Northgate Builders Inc', NULL);

CREATE SCHEMA ph;
GRANT USAGE ON SCHEMA ph TO authenticated, anon, service_role;
CREATE FUNCTION ph.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION ph.sign_in(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- One name's answer as "bids/won/on_deck".
CREATE FUNCTION ph.hint(p_key text) RETURNS text LANGUAGE sql AS $$
  SELECT bids || '/' || won || '/' || on_deck FROM public.research_contact_history(ARRAY[p_key]);
$$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ph TO authenticated, anon, service_role;

-- 1. The decks.
SELECT ph.same('a lead on Jobs to GC is on the deck, as before', ph.hint('tallpinedevelopment'), '0/0/true');
SELECT ph.same('a lead on the Customers deck is on the deck', ph.hint('northgatebuilders'), '0/0/true');
SELECT ph.same('a lead that left the queue is not', ph.hint('closeddoorcontracting'), '0/0/false');
SELECT ph.same('a sub is not', ph.hint('subonlyplumbing'), '0/0/false');
SELECT ph.same('a name nobody holds is a new name', ph.hint('nobodyatall'), '0/0/false');

-- 2. The bids read as before.
SELECT ph.same('the bids and the wins of a customer of that name', ph.hint('ridgewaybuilders'), '2/1/false');

-- 3. One row per name asked, whatever was asked twice or left blank.
SELECT ph.same('one row per distinct name',
  (SELECT string_agg(key || ':' || on_deck, ' ' ORDER BY key) FROM public.research_contact_history(ARRAY['northgatebuilders', 'northgatebuilders', '', NULL, 'tallpinedevelopment', 'ridgewaybuilders'])),
  'northgatebuilders:true ridgewaybuilders:false tallpinedevelopment:true');
SELECT ph.same('no names, no rows', (SELECT count(*)::text FROM public.research_contact_history(NULL)), '0');

-- 4. Under RLS, as the office.
SET LOCAL ROLE authenticated;
SELECT ph.sign_in('00000000-0000-0000-0000-0000009417a1');
SELECT ph.same('the office reads the same answer through its own access', ph.hint('northgatebuilders'), '0/0/true');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'permit_hint_decks PASSED'; END $$;
ROLLBACK;
