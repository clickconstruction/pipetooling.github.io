SET lock_timeout = '3s';

-- Team scorecard (punch list #360): the labor count is kept with the priced margin.
--
-- stamp_bid_priced_margin keeps the margin a bid is priced at, and the stamp freezes when the bid is sent. The
-- estimating score will not judge a bid whose labor was not estimated, since its kept cost then has little or no
-- labor in it. Until now that was read from the Labor tab as it stands today, so hours filled in after a bid went
-- out made the bid read as judged while its kept cost still had no labor in it. The stamp now keeps the count it
-- was made with:
--
--   1. bids.priced_labor_rows_total and bids.priced_labor_rows_with_hours: the bid's labor rows that are not a
--      sub's, and those with hours on any stage, counted the way bid_estimate_breakdown counts them, at the
--      moment of the stamp. NULL on a stamp made before this migration, which is read as before.
--   2. stamp_bid_priced_margin counts them itself and writes them with the margin. Its arguments do not change,
--      so every client stamps as it did. The body is prod's on 2026-11-15 (the same as 20261115030000) with the
--      count added and nothing taken away.
--
-- No table is created, so there are no fence calls.

-- 1. The count, kept with the stamp.
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS priced_labor_rows_total integer;
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS priced_labor_rows_with_hours integer;
COMMENT ON COLUMN public.bids.priced_labor_rows_total IS
  'v2.7370 · the bid''s labor rows that are not a sub''s, counted when the priced margin was stamped. With priced_labor_rows_with_hours it says whether labor was estimated in the kept cost. NULL on a stamp made before v2.7370. Written only by stamp_bid_priced_margin.';
COMMENT ON COLUMN public.bids.priced_labor_rows_with_hours IS
  'v2.7370 · of priced_labor_rows_total, the rows with hours on any stage when the priced margin was stamped. Written only by stamp_bid_priced_margin.';

-- 2. The stamp counts them. The six-argument shape was dropped in v2.7301; the line stays so a database that never
-- ran that migration ends the same.
DROP FUNCTION IF EXISTS public.stamp_bid_priced_margin(uuid, uuid, numeric, numeric, numeric, boolean);

CREATE OR REPLACE FUNCTION public.stamp_bid_priced_margin(
  p_bid_id uuid,
  p_bid_version_id uuid,
  p_revenue_usd numeric,
  p_cost_usd numeric,
  p_uncosted_usd numeric,
  p_rate_set boolean,
  p_difficulty_usd numeric DEFAULT 0
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
  v_difficulty numeric := round(greatest(0, coalesce(p_difficulty_usd, 0)), 2);
  v_margin numeric;
  v_row record;
  v_sent date;
  v_rows_total integer := 0;
  v_rows_with_hours integer := 0;
BEGIN
  IF p_bid_id IS NULL THEN
    RAISE EXCEPTION 'Which bid?' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_revenue <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_revenue');
  END IF;
  v_margin := round((v_revenue - v_cost) / v_revenue * 100, 2);

  -- The labor the kept cost was made with: bid_estimate_breakdown's own count (a sub's row aside, hours on any stage).
  SELECT COUNT(*) FILTER (WHERE COALESCE(r.kind, 'fixture') <> 'sub'),
         COUNT(*) FILTER (WHERE COALESCE(r.kind, 'fixture') <> 'sub' AND (r.rough_in_hrs_per_unit > 0 OR r.top_out_hrs_per_unit > 0 OR r.trim_set_hrs_per_unit > 0))
    INTO v_rows_total, v_rows_with_hours
    FROM public.cost_estimate_labor_rows r
    JOIN public.cost_estimates c ON c.id = r.cost_estimate_id
   WHERE c.bid_id = p_bid_id;

  UPDATE public.bids b
     SET priced_margin_pct = v_margin,
         priced_revenue_usd = v_revenue,
         priced_cost_usd = v_cost,
         priced_uncosted_usd = v_uncosted,
         priced_difficulty_usd = v_difficulty,
         priced_rate_set = coalesce(p_rate_set, false),
         priced_bid_version_id = p_bid_version_id,
         priced_labor_rows_total = coalesce(v_rows_total, 0),
         priced_labor_rows_with_hours = coalesce(v_rows_with_hours, 0),
         priced_at = now(),
         priced_by = auth.uid()
   WHERE b.id = p_bid_id
     AND b.bid_date_sent IS NULL
  RETURNING b.priced_margin_pct, b.priced_at INTO v_row;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'margin_pct', v_row.priced_margin_pct, 'priced_at', v_row.priced_at);
  END IF;

  SELECT b.bid_date_sent INTO v_sent FROM public.bids b WHERE b.id = p_bid_id;
  IF FOUND AND v_sent IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sent');
  END IF;
  RETURN jsonb_build_object('ok', false, 'reason', 'refused');
END;
$$;

COMMENT ON FUNCTION public.stamp_bid_priced_margin(uuid, uuid, numeric, numeric, numeric, boolean, numeric) IS
  'v2.5043 · stamps the margin a bid is priced at (the Pricing workbench strip''s numbers) with its inputs, who and when; v2.7301 · p_difficulty_usd is the part of the cost that is the GC difficulty lines; v2.7370 · it also keeps the count of the bid''s labor rows and of those with hours, so the estimating score judges a sent bid by the labor its kept cost was made with. Never writes a sent bid. SECURITY INVOKER: the bid''s own policies decide.';

REVOKE EXECUTE ON FUNCTION public.stamp_bid_priced_margin(uuid, uuid, numeric, numeric, numeric, boolean, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stamp_bid_priced_margin(uuid, uuid, numeric, numeric, numeric, boolean, numeric) TO authenticated;
