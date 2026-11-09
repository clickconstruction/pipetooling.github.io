SET lock_timeout = '3s';

-- The Development page's pay-speed read, by the site's payers (punch list #280 PR 2, v2.6739). The
-- Money look's expected day read every billed customer's pace through get_billed_customer_pay_speeds()
-- and kept the few payers the site's jobs bill: on the real site 87,600 bytes on every open for one or
-- two entries. This function runs the same read on the server and hands back the same shape cut to the
-- payers asked for: their own medians, their types and their receipts, with the company and segment
-- medians and the quality counts whole, since the borrowed pace (payPace.ts) reads those for a payer
-- with too few payments of its own. The gate is the parent's: NULL for a caller it answers NULL to.
-- SECURITY INVOKER over the definer parent, so nothing here widens who reads. The Pipeline and the
-- Collect desk keep the whole-list read.
CREATE OR REPLACE FUNCTION public.get_customer_pay_speeds(p_customer_ids uuid[])
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
WITH whole AS (
  SELECT public.get_billed_customer_pay_speeds() AS j
),
ids AS (
  SELECT DISTINCT x::text AS id FROM unnest(COALESCE(p_customer_ids, '{}'::uuid[])) AS x
)
SELECT CASE WHEN (SELECT j FROM whole) IS NULL THEN NULL ELSE
  jsonb_build_object(
    'company', (SELECT j -> 'company' FROM whole),
    'segments', (SELECT j -> 'segments' FROM whole),
    'quality', (SELECT j -> 'quality' FROM whole),
    'customers', COALESCE((SELECT jsonb_object_agg(i.id, w.j -> 'customers' -> i.id) FROM ids i, whole w WHERE w.j -> 'customers' ? i.id), '{}'::jsonb),
    'customerTypes', COALESCE((SELECT jsonb_object_agg(i.id, w.j -> 'customerTypes' -> i.id) FROM ids i, whole w WHERE w.j -> 'customerTypes' ? i.id), '{}'::jsonb),
    'receipts', COALESCE((SELECT jsonb_object_agg(i.id, w.j -> 'receipts' -> i.id) FROM ids i, whole w WHERE w.j -> 'receipts' ? i.id), '{}'::jsonb)
  )
END;
$$;

COMMENT ON FUNCTION public.get_customer_pay_speeds(uuid[]) IS
  'get_billed_customer_pay_speeds() cut to the payers asked for: their medians, types and receipts, with the company and segment medians and the quality counts whole (the borrowed pace needs them). The Development page''s Money look reads its site''s payers through it. NULL where the parent answers NULL.';

REVOKE EXECUTE ON FUNCTION public.get_customer_pay_speeds(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_customer_pay_speeds(uuid[]) TO authenticated, service_role;
