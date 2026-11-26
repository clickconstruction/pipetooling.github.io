SET lock_timeout = '3s';

-- Presses nothing takes back (punch list #443, row 11): a developer deletes a turned-off portal link of a test customer.
--
-- Turn off, then Turn the portal off, in a customer's portal window sets revoked_at on the customer_portal_links row and
-- keeps it for the window's History. The table lets the office read, insert and update and nobody delete, so every
-- walk that turned a ZZ Test customer's portal off left a row for good: six stood on one ZZ Test customer on
-- 2026-11-25. The owner's answer of that day: build the eight take-backs that need a migration, each on its own yes.
--
-- One function, as the take-backs of this card are built: SECURITY DEFINER, a developer alone, a test row alone, and
-- a refusal in words when anything real points at the row.
--
--   customer_is_zz_test(p_customer_id)   the ZZ convention in SQL for a customer (isZzTestName on customers.name),
--                                        beside job_is_zz_test (20261120163000). Internal.
--   delete_test_portal_link(p_link_id)   refuses anyone but a dev, a link that is not there, a link still live, a
--                                        link of a customer whose name does not start with ZZ, and a link a GC's
--                                        proposal names (job_paper_proposals.portal_link_id, ON DELETE SET NULL,
--                                        would otherwise forget it without a word); then deletes the one row.
--
-- No table is created, so no fence is owed. The table's own policies are as they were, and it has no delete policy of
-- its own, so a direct DELETE reaches no row for anyone: the delete goes through this door and no other. Every
-- statement is safe to run twice.

CREATE OR REPLACE FUNCTION public.customer_is_zz_test(p_customer_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = p_customer_id
      AND btrim(coalesce(c.name, ''), E' \t\n\r') ~* '^zz'
  );
$$;

COMMENT ON FUNCTION public.customer_is_zz_test(uuid) IS
  'The ZZ convention in SQL for a customer, as isZzTestName says it: true when the customer''s name starts with ZZ. Internal: the test-row take-backs of punch list #443 ask it.';
REVOKE ALL ON FUNCTION public.customer_is_zz_test(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.delete_test_portal_link(p_link_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.customer_portal_links%ROWTYPE;
  v_proposals integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'delete_test_portal_link: not authenticated';
  END IF;
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'Only a developer can delete a portal link.' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_link FROM public.customer_portal_links WHERE id = p_link_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This link is not there any more.' USING ERRCODE = 'P0001';
  END IF;
  IF v_link.revoked_at IS NULL THEN
    RAISE EXCEPTION 'Turn this link off first. A live link is never deleted.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.customer_is_zz_test(v_link.customer_id) THEN
    RAISE EXCEPTION 'Only a test customer''s link can be deleted. The customer''s name must start with ZZ.' USING ERRCODE = 'P0001';
  END IF;
  SELECT count(*) INTO v_proposals FROM public.job_paper_proposals p WHERE p.portal_link_id = p_link_id;
  IF v_proposals > 0 THEN
    RAISE EXCEPTION '% GC proposal% name% this link. It stays.', v_proposals, CASE WHEN v_proposals = 1 THEN '' ELSE 's' END, CASE WHEN v_proposals = 1 THEN 's' ELSE '' END USING ERRCODE = 'P0001';
  END IF;
  DELETE FROM public.customer_portal_links WHERE id = p_link_id AND revoked_at IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This link is not there any more.' USING ERRCODE = 'P0001';
  END IF;
  RETURN jsonb_build_object('ok', true, 'customer_id', v_link.customer_id, 'audience', v_link.audience);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_test_portal_link(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_test_portal_link(uuid) TO authenticated;

COMMENT ON FUNCTION public.delete_test_portal_link(uuid) IS
  'Punch list #443, row 11: a developer deletes one turned-off portal link of a customer whose name starts with ZZ, when no GC proposal names it. Refuses everything else in words. The table has no delete policy of its own, so a direct delete reaches no row.';
