-- Presses nothing takes back (punch list #443, row 11): a developer deletes a turned-off portal link of a test
-- customer through delete_test_portal_link (migration *_portal_link_delete_test), and nobody deletes one any other
-- way. Rosa the assistant is refused at the door. Devon the dev is refused a live link, a real customer's turned-off
-- link, a link a GC's proposal names and a link that is not there, and deletes the ZZ Test customer's turned-off link,
-- which is gone while the others stand. A direct DELETE on the table reaches nothing for anyone. Fixtures made as
-- postgres; everything runs inside one transaction that rolls back. Raises on the first failed assertion; ends with
-- "portal_link_delete PASSED". See scripts/pgtest-portal-link-delete.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

CREATE SCHEMA pld;
CREATE FUNCTION pld.id(p text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$ SELECT ('00000000-0000-0000-0000-0000004431' || p)::uuid $$;
CREATE FUNCTION pld.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
CREATE FUNCTION pld.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
END $$;
-- The door's answer in a few words: ok, or the refusal's words.
CREATE FUNCTION pld.try(p_link uuid) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.delete_test_portal_link(p_link);
  RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLERRM;
END $$;
-- A statement refused with words that hold `want`.
CREATE FUNCTION pld.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF position(want IN SQLERRM) = 0 THEN RAISE EXCEPTION '% was refused for another reason: %', label, SQLERRM; END IF;
    RAISE NOTICE 'ok: %', label;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
-- A direct DELETE tried as the signed-in person: how many rows it reached, or the refusal's words. The table has no
-- delete policy of its own, so the schema's default grant reaches no row for anyone.
CREATE FUNCTION pld.try_direct(p_link uuid) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  DELETE FROM public.customer_portal_links WHERE id = p_link;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n::text || ' row';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLERRM;
END $$;
-- What stands, past RLS: the links by their last two hex digits, in order.
CREATE FUNCTION pld.links() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT string_agg(right(id::text, 2), ' ' ORDER BY id) FROM public.customer_portal_links WHERE customer_id IN (pld.id('91'), pld.id('92'))
$$;
GRANT USAGE ON SCHEMA pld TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pld TO authenticated, service_role;

-- Who: Devon the dev, Rosa the assistant.
INSERT INTO auth.users (id, email) VALUES (pld.id('a1'), 'devon@linkdelete.test'), (pld.id('a2'), 'rosa@linkdelete.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  (pld.id('a1'), 'devon@linkdelete.test', 'Devon Dev Pld', 'dev', false, false),
  (pld.id('a2'), 'rosa@linkdelete.test', 'Rosa Office Pld', 'assistant', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;
-- Two customers: a ZZ Test one and a real-named one (a made-up name).
INSERT INTO public.customers (id, name, master_user_id) VALUES
  (pld.id('91'), 'ZZ Test Link Customer', pld.id('a1')),
  (pld.id('92'), 'Harbor Row Plumbing', pld.id('a1'));
-- Links. e1 the ZZ customer's turned-off link; e2 its live link; e3 its turned-off link a GC proposal names; e4 the
-- real customer's turned-off link.
INSERT INTO public.customer_portal_links (id, customer_id, audience, token_hash, created_at, revoked_at) VALUES
  (pld.id('e1'), pld.id('91'), 'all', 'hash-e1', now() - interval '3 days', now() - interval '2 days'),
  (pld.id('e2'), pld.id('91'), 'all', 'hash-e2', now() - interval '1 day', NULL),
  (pld.id('e3'), pld.id('91'), 'gc', 'hash-e3', now() - interval '5 days', now() - interval '4 days'),
  (pld.id('e4'), pld.id('92'), 'all', 'hash-e4', now() - interval '3 days', now() - interval '2 days');
-- A job of the ZZ customer with a paper, and a GC proposal on it that names link e3.
INSERT INTO public.service_types (id, name) VALUES (pld.id('f9'), 'Link delete bed work');
INSERT INTO public.jobs_ledger (id, master_user_id, service_type_id, job_name, hcp_number, gc_customer_id) VALUES
  (pld.id('d1'), pld.id('a1'), pld.id('f9'), 'ZZ Test link delete job', 'J4431', pld.id('91'));
INSERT INTO public.job_required_papers (id, job_id, paper_name) VALUES (pld.id('c1'), pld.id('d1'), 'Link delete bed paper (test)');
INSERT INTO public.job_paper_proposals (id, required_paper_id, job_id, customer_id, portal_link_id, from_settings, settings, proposed_by_name, notice_read)
  VALUES (pld.id('b1'), pld.id('c1'), pld.id('d1'), pld.id('91'), pld.id('e3'), '{"photos":"standard"}'::jsonb, '{"photos":"strict"}'::jsonb, 'Greta Gc', true);
SELECT pld.same('four links stand', pld.links(), 'e1 e2 e3 e4');

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Rosa the assistant is refused at the door, and cannot delete a row herself.
SELECT pld.as_user(pld.id('a2'));
SET LOCAL ROLE authenticated;
SELECT pld.same('an assistant is refused at the door', pld.try(pld.id('e1')), 'Only a developer can delete a portal link.');
SELECT pld.same('an assistant''s direct delete reaches no row', pld.try_direct(pld.id('e1')), '0 row');
SELECT pld.same('nothing changed', pld.links(), 'e1 e2 e3 e4');
RESET ROLE;

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Devon the dev: each refusal with its words, then the one delete.
SELECT pld.as_user(pld.id('a1'));
SET LOCAL ROLE authenticated;
SELECT pld.same('a live link is refused', pld.try(pld.id('e2')), 'Turn this link off first. A live link is never deleted.');
SELECT pld.same('a real customer''s turned-off link is refused', pld.try(pld.id('e4')), 'Only a test customer''s link can be deleted. The customer''s name must start with ZZ.');
SELECT pld.same('a link a GC proposal names is refused, with the count', pld.try(pld.id('e3')), '1 GC proposal names this link. It stays.');
SELECT pld.same('a link that is not there is refused', pld.try(pld.id('e9')), 'This link is not there any more.');
SELECT pld.same('nothing changed yet', pld.links(), 'e1 e2 e3 e4');
SELECT pld.same('a dev''s direct delete reaches no row either', pld.try_direct(pld.id('e1')), '0 row');
SELECT pld.same('the ZZ customer''s turned-off link goes', pld.try(pld.id('e1')), 'ok');
SELECT pld.same('it is gone and the others stand', pld.links(), 'e2 e3 e4');
SELECT pld.same('a second delete of the same link is refused', pld.try(pld.id('e1')), 'This link is not there any more.');
SELECT pld.same('the proposal still names its link', (SELECT right(portal_link_id::text, 2) FROM public.job_paper_proposals WHERE id = pld.id('b1')), 'e3');
RESET ROLE;

-- ---------------------------------------------------------------------------------------------------------------
-- 3. Signed out, nobody calls it: the function is revoked from anon, so the call is refused at the door.
SELECT set_config('request.jwt.claims', '', true);
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claim.role', '', true);
SET LOCAL ROLE anon;
SELECT pld.refused('signed out, the door refuses', format($q$SELECT public.delete_test_portal_link(%L)$q$, pld.id('e3')), 'permission denied');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'portal_link_delete PASSED'; END $$;
ROLLBACK;
