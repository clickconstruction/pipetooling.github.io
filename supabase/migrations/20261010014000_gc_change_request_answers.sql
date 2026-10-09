SET lock_timeout = '3s';

-- GC mode, the real build, Owner Billing's O3b: the office answers a change a trade asked for from its portal. It makes
-- the ask a change order to the customer, or turns it down with why (the prototype's draftChangeOrderFromRequest and
-- turnDownChangeRequest). Plan: to-dos/gc-mode/mockups/owner-billing-o3b.md on spike/gc-mode, from the Portal's P4
-- (mockups/portal-p4.md, decision 10). The asks: 20261010006000 (gc_trade_change_requests). The change orders:
-- 20261008010000 and 20261008110000.
--   - Both presses are SECURITY INVOKER. Each refuses in words, before it reads the ask: a training account, a
--     digital twin, anyone but the money team (gc_change_orders is the money team's, and the answer is ours to give
--     even once the trade wave opens the asks to the office), then anyone but a dev while the asks' table is dev
--     only (src/lib/gc/doors.ts).
--   - An ask is answered once: a change order made of it, or turned down. Deleting that draft clears the link
--     (P4a's ON DELETE SET NULL), so the ask can be drafted again. A change order that went to the customer cannot
--     be deleted (gc_change_orders_keep_what_went), so its link stays.
--   - The change order is drafted through gc_draft_change_order on the ask's trade and reason, with the words, cost,
--     price and days the office confirmed (the client's prefill: the ask's words, its amount as our cost, its days,
--     and changeOrderPrice). The trade hears each answer from the office's screen, through gc-trade-email.

-- Make the ask a change order (draftChangeOrderFromRequest). p_draft is O3's draft shape without the trade and the
-- reason, which come from the ask: description, cost, price, days, schedule and planSetId. A draft that names another
-- trade or reason is refused. Returns the change order's id.
CREATE OR REPLACE FUNCTION public.gc_draft_change_order_from_request(p_request_id uuid, p_draft jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v public.gc_trade_change_requests%ROWTYPE;
  v_draft jsonb := coalesce(p_draft, '{}'::jsonb);
  v_number integer;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot answer a trade''s ask.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot answer a trade''s ask.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.gc_money_team() THEN
    RAISE EXCEPTION 'Only the money team answers a trade''s ask for a change.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'Only a dev answers a trade''s ask while GC mode is built.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v FROM public.gc_trade_change_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No change request with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v.change_order_id IS NOT NULL THEN
    SELECT number INTO v_number FROM public.gc_change_orders WHERE id = v.change_order_id;
    RAISE EXCEPTION 'It became change order % already.', v_number USING ERRCODE = 'P0001';
  END IF;
  IF v.turned_down_on IS NOT NULL THEN
    RAISE EXCEPTION 'It was turned down on %.', to_char(v.turned_down_on, 'Mon FMDD') USING ERRCODE = 'P0001';
  END IF;
  IF v_draft ? 'packageId' AND (v_draft ->> 'packageId') IS DISTINCT FROM v.package_id::text THEN
    RAISE EXCEPTION 'A trade''s ask stays on its own trade.' USING ERRCODE = 'P0001';
  END IF;
  IF v_draft ? 'reason' AND (v_draft ->> 'reason') IS DISTINCT FROM v.reason THEN
    RAISE EXCEPTION 'A trade''s ask keeps the reason it gave.' USING ERRCODE = 'P0001';
  END IF;

  v_id := public.gc_draft_change_order(v.project_id, jsonb_build_object(
    'description', v_draft ->> 'description',
    'reason', v.reason,
    'packageId', v.package_id,
    'cost', v_draft -> 'cost',
    'price', v_draft -> 'price',
    'days', v_draft -> 'days',
    'schedule', v_draft ->> 'schedule',
    'planSetId', v_draft ->> 'planSetId'
  ));
  UPDATE public.gc_trade_change_requests SET change_order_id = v_id WHERE id = v.id;
  RETURN v_id;
END;
$$;

-- Turn the ask down (turnDownChangeRequest), with why, in words the company reads.
CREATE OR REPLACE FUNCTION public.gc_turn_down_change_request(p_request_id uuid, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v public.gc_trade_change_requests%ROWTYPE;
  v_note text := btrim(coalesce(p_note, ''));
  v_number integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot answer a trade''s ask.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot answer a trade''s ask.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.gc_money_team() THEN
    RAISE EXCEPTION 'Only the money team answers a trade''s ask for a change.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'Only a dev answers a trade''s ask while GC mode is built.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v FROM public.gc_trade_change_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No change request with that id.' USING ERRCODE = 'P0001';
  END IF;
  IF v.change_order_id IS NOT NULL THEN
    SELECT number INTO v_number FROM public.gc_change_orders WHERE id = v.change_order_id;
    RAISE EXCEPTION 'It became change order % already.', v_number USING ERRCODE = 'P0001';
  END IF;
  IF v.turned_down_on IS NOT NULL THEN
    RAISE EXCEPTION 'It was turned down on %.', to_char(v.turned_down_on, 'Mon FMDD') USING ERRCODE = 'P0001';
  END IF;
  IF v_note = '' THEN
    RAISE EXCEPTION 'Say why, for the company.' USING ERRCODE = 'P0001';
  END IF;
  IF char_length(v_note) > 2000 THEN
    RAISE EXCEPTION 'Keep the reason under 2,000 characters.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.gc_trade_change_requests SET turned_down_on = public.app_today(), turned_down_note = v_note WHERE id = v.id;
END;
$$;

COMMENT ON FUNCTION public.gc_draft_change_order_from_request(uuid, jsonb) IS
  'GC mode (O3b): makes a trade''s ask for a change (gc_trade_change_requests) a draft change order to the customer through gc_draft_change_order, on the ask''s trade and reason with the words, cost, price and days the office confirmed, and links the ask to it. Once per ask; a deleted draft frees it. The money team only, and a dev only while the asks are. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_turn_down_change_request(uuid, text) IS
  'GC mode (O3b): turns a trade''s ask for a change down today, with why in words the company reads. Not once it became a change order or was turned down. The money team only, and a dev only while the asks are. SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.gc_draft_change_order_from_request(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_draft_change_order_from_request(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.gc_draft_change_order_from_request(uuid, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.gc_turn_down_change_request(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_turn_down_change_request(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.gc_turn_down_change_request(uuid, text) TO authenticated;
