-- How often a person opened their portal since a line we sent carried a link to it (Messages, cut 7f follow-up,
-- migration *_portal_opens_since): a trade partner's portal opens are gc_trade_portal views by its company, a customer's
-- are portal views by the customer, page only. The office reads the outside opens from a time on, how many and the last;
-- a teammate's look and a paper's own row are never counted; anyone outside the office, and any other surface, reads
-- none. The views are written as postgres, standing in for the service role; reads run as each user; everything rolls
-- back. Raises on the first failed assertion; ends with "portal_opens_since PASSED". See
-- scripts/pgtest-portal-opens-since.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- The office (an assistant) and a superintendent outside it.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000ad2', 'assistant@opens.test'),
  ('00000000-0000-0000-0000-000000000ad3', 'super@opens.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-000000000ad2', 'assistant@opens.test', 'Rosa', 'assistant', false, false),
  ('00000000-0000-0000-0000-000000000ad3', 'super@opens.test', 'Opens Super', 'superintendent', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

CREATE SCHEMA pos;
CREATE FUNCTION pos.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION pos.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
-- One read as words: "opens last", the last as month-day hour:minute in UTC, or "-" with none.
CREATE FUNCTION pos.read(p_surface text, p_entity uuid, p_since timestamptz) RETURNS text LANGUAGE sql AS $$
  SELECT opens::text || ' ' || coalesce(to_char(last_opened_at AT TIME ZONE 'UTC', 'MM-DD HH24:MI'), '-')
  FROM public.portal_opens_since(p_surface, p_entity, p_since)
$$;
GRANT USAGE ON SCHEMA pos TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pos TO anon, authenticated, service_role;

-- Hillside's portal (a trade partner, by its company) and the Ramans' (a customer, by the customer): opens before the
-- line went on Oct 9 at 21:42, opens after, a teammate's look, and a customer's paper opened on its own.
INSERT INTO public.public_page_views (surface, entity_id, via, viewer, occurred_at) VALUES
  ('gc_trade_portal', '00000000-0000-0000-0000-000000000ab1', 'token', 'outside', TIMESTAMPTZ '2026-10-08 15:00:00+00'),
  ('gc_trade_portal', '00000000-0000-0000-0000-000000000ab1', 'token', 'outside', TIMESTAMPTZ '2026-10-10 14:05:00+00'),
  ('gc_trade_portal', '00000000-0000-0000-0000-000000000ab1', 'token', 'outside', TIMESTAMPTZ '2026-10-12 19:10:00+00'),
  ('gc_trade_portal', '00000000-0000-0000-0000-000000000ab1', 'token', 'staff', TIMESTAMPTZ '2026-10-12 19:30:00+00'),
  ('portal', '00000000-0000-0000-0000-000000000ac1', 'token', 'outside', TIMESTAMPTZ '2026-10-11 16:00:00+00');
INSERT INTO public.public_page_views (surface, entity_id, via, viewer, occurred_at, paper_kind, paper_id) VALUES
  ('portal_paper', '00000000-0000-0000-0000-000000000ac1', 'token', 'outside', TIMESTAMPTZ '2026-10-11 16:05:00+00', 'contract', '00000000-0000-0000-0000-000000000ae1');

-- 1 · The office reads a portal's outside opens from the line on: how many, and the last.
SELECT pos.as_user('00000000-0000-0000-0000-000000000ad2');
SET LOCAL ROLE authenticated;
SELECT pos.same('a trade partner’s portal, twice since the line, a teammate’s look not counted',
  pos.read('gc_trade_portal', '00000000-0000-0000-0000-000000000ab1', TIMESTAMPTZ '2026-10-09 21:42:00+00'), '2 10-12 19:10');
SELECT pos.same('a customer’s portal, its page once since, never a paper’s own row',
  pos.read('portal', '00000000-0000-0000-0000-000000000ac1', TIMESTAMPTZ '2026-10-09 21:42:00+00'), '1 10-11 16:00');
SELECT pos.same('nothing since a later time',
  pos.read('gc_trade_portal', '00000000-0000-0000-0000-000000000ab1', TIMESTAMPTZ '2026-10-13 00:00:00+00'), '0 -');
SELECT pos.same('no other surface, nor a paper’s rows on their own',
  pos.read('drive_link', '00000000-0000-0000-0000-000000000ab1', TIMESTAMPTZ '2026-01-01 00:00:00+00') || ' / '
    || pos.read('portal_paper', '00000000-0000-0000-0000-000000000ac1', TIMESTAMPTZ '2026-01-01 00:00:00+00'), '0 - / 0 -');
RESET ROLE;

-- 2 · Anyone outside the office reads none.
SELECT pos.as_user('00000000-0000-0000-0000-000000000ad3');
SET LOCAL ROLE authenticated;
SELECT pos.same('a superintendent reads no opens',
  pos.read('gc_trade_portal', '00000000-0000-0000-0000-000000000ab1', TIMESTAMPTZ '2026-10-09 21:42:00+00'), '0 -');
RESET ROLE;

-- 3 · As shipped: anon cannot run it, the office can, and it reads as its definer.
SELECT pos.same('who runs it', (
  SELECT has_function_privilege('anon', 'public.portal_opens_since(text, uuid, timestamptz)', 'EXECUTE')::text || '/'
    || has_function_privilege('authenticated', 'public.portal_opens_since(text, uuid, timestamptz)', 'EXECUTE')::text || '/'
    || (SELECT prosecdef::text FROM pg_proc WHERE oid = 'public.portal_opens_since(text, uuid, timestamptz)'::regprocedure)),
  'false/true/true');

DO $$ BEGIN RAISE NOTICE 'portal_opens_since PASSED'; END $$;
ROLLBACK;
