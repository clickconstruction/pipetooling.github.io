SET lock_timeout = '3s';

-- Burn against the bid, piece 1 (v2.5043, the owner's call of 2026-10-09): the margin a bid was
-- priced at. The Pricing workbench's strip already shows it — (revenue − our cost) ÷ revenue — but
-- only while the tab is open. This keeps it on the bid with the inputs it came from, so a reader can
-- see why a stamp is partial, and freezes it once the bid is sent: the margin it went out at.
--
-- Eight nullable columns, no default: the ALTER is metadata-only. The workbench writes them through
-- `stamp_bid_priced_margin` after its own price writes land, never on a tab that is only opened.
-- They are not in `bid_changes_bid_columns()`, so a stamp writes no bid-history row.

ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS priced_margin_pct numeric,
  ADD COLUMN IF NOT EXISTS priced_revenue_usd numeric,
  ADD COLUMN IF NOT EXISTS priced_cost_usd numeric,
  ADD COLUMN IF NOT EXISTS priced_uncosted_usd numeric,
  ADD COLUMN IF NOT EXISTS priced_rate_set boolean,
  ADD COLUMN IF NOT EXISTS priced_bid_version_id uuid REFERENCES public.bid_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS priced_at timestamptz,
  ADD COLUMN IF NOT EXISTS priced_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.bids.priced_margin_pct IS
  'v2.5043 · the margin the bid was priced at, 0–100: (priced_revenue_usd − priced_cost_usd) ÷ priced_revenue_usd, the Pricing workbench strip''s Margin. Frozen once bid_date_sent is set. Written only by stamp_bid_priced_margin.';
COMMENT ON COLUMN public.bids.priced_revenue_usd IS 'v2.5043 · the strip''s revenue at the stamp: every row''s saved price × count, alternates included.';
COMMENT ON COLUMN public.bids.priced_cost_usd IS 'v2.5043 · the strip''s "our cost" at the stamp: materials + labor hours × rate + driving + travel + direct costs (no estimator time, no bid labor).';
COMMENT ON COLUMN public.bids.priced_uncosted_usd IS 'v2.5043 · revenue on priced rows with no cost, which the margin counts as profit: above 0 means the margin reads high.';
COMMENT ON COLUMN public.bids.priced_rate_set IS 'v2.5043 · whether the bid carried a labor rate at the stamp: false means labor is $0 in the cost and the margin reads high.';
COMMENT ON COLUMN public.bids.priced_bid_version_id IS 'v2.5043 · the bid version whose customer-facing price was stamped; null for a bid with no versions.';

-- The one write. SECURITY INVOKER: the bid's own row policies decide who may stamp it (whoever may
-- price it), and the read-only and digital-twin fences on `bids` apply as to any update.
CREATE OR REPLACE FUNCTION public.stamp_bid_priced_margin(
  p_bid_id uuid,
  p_bid_version_id uuid,
  p_revenue_usd numeric,
  p_cost_usd numeric,
  p_uncosted_usd numeric,
  p_rate_set boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_revenue numeric := round(coalesce(p_revenue_usd, 0), 2);
  v_cost numeric := round(greatest(0, coalesce(p_cost_usd, 0)), 2);
  v_uncosted numeric := round(greatest(0, coalesce(p_uncosted_usd, 0)), 2);
  v_margin numeric;
  v_row record;
  v_sent date;
BEGIN
  IF p_bid_id IS NULL THEN
    RAISE EXCEPTION 'Which bid?' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_revenue <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_revenue');
  END IF;
  v_margin := round((v_revenue - v_cost) / v_revenue * 100, 2);

  UPDATE public.bids b
     SET priced_margin_pct = v_margin,
         priced_revenue_usd = v_revenue,
         priced_cost_usd = v_cost,
         priced_uncosted_usd = v_uncosted,
         priced_rate_set = coalesce(p_rate_set, false),
         priced_bid_version_id = p_bid_version_id,
         priced_at = now(),
         priced_by = auth.uid()
   WHERE b.id = p_bid_id
     AND b.bid_date_sent IS NULL
  RETURNING b.priced_margin_pct, b.priced_at INTO v_row;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'margin_pct', v_row.priced_margin_pct, 'priced_at', v_row.priced_at);
  END IF;

  -- Nothing written: a sent bid keeps the margin it went out at; anything else is a bid this caller
  -- cannot update (or none at all).
  SELECT b.bid_date_sent INTO v_sent FROM public.bids b WHERE b.id = p_bid_id;
  IF FOUND AND v_sent IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sent');
  END IF;
  RETURN jsonb_build_object('ok', false, 'reason', 'refused');
END;
$$;

COMMENT ON FUNCTION public.stamp_bid_priced_margin(uuid, uuid, numeric, numeric, numeric, boolean) IS
  'v2.5043 · stamps the margin a bid is priced at (the Pricing workbench strip''s numbers) with its inputs, who and when. Writes nothing on a sent bid ({ok:false, reason:''sent''}), a zero revenue (''no_revenue'') or a bid the caller cannot update (''refused''). SECURITY INVOKER.';

REVOKE EXECUTE ON FUNCTION public.stamp_bid_priced_margin(uuid, uuid, numeric, numeric, numeric, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stamp_bid_priced_margin(uuid, uuid, numeric, numeric, numeric, boolean) TO authenticated;
