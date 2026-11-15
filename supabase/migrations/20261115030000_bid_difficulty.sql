SET lock_timeout = '3s';

-- GC difficulty rating, PR 4 (punch list #357, v2.7301): the lines a bid was priced with.
--
-- When the Workbench first costs a bid to a rated GC, it turns the rating into cost lines by the published price
-- list (src/lib/bids/difficultyLines.ts) and writes them as direct-cost rows on the bid's estimate (rows of
-- cost_estimate_other_rows, so the solver, the margin, the history and the budgets count them with no change). This
-- table pins what was written: the rating, the criteria version and the price version the lines came from, the
-- picks and the lines as written, the rows' ids, and the lines a person took off with their reason. A later rating
-- or price version never moves a priced bid; the Workbench says "rated higher since this was priced" and a press
-- reads the new rating in, which rewrites the rows and this row.
--
--   1. bid_difficulty — one row per bid.
--   2. bids.priced_difficulty_usd — the stamp at send keeps the difficulty cost apart.
--   3. stamp_bid_priced_margin gains p_difficulty_usd (default 0, so the client before this deploy still stamps).

-- 1. The pin.
CREATE TABLE IF NOT EXISTS public.bid_difficulty (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id uuid NOT NULL UNIQUE REFERENCES public.bids(id) ON DELETE CASCADE,
  cost_estimate_id uuid REFERENCES public.cost_estimates(id) ON DELETE SET NULL,
  rating_id uuid REFERENCES public.gc_difficulty_ratings(id) ON DELETE SET NULL,
  criteria_version_id uuid REFERENCES public.difficulty_criteria_versions(id) ON DELETE SET NULL,
  price_version_id uuid REFERENCES public.difficulty_price_versions(id) ON DELETE SET NULL,
  picks jsonb NOT NULL DEFAULT '{}'::jsonb,
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  row_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  removed jsonb NOT NULL DEFAULT '[]'::jsonb,
  points integer NOT NULL DEFAULT 0,
  total_usd numeric NOT NULL DEFAULT 0,
  field_hours numeric NOT NULL DEFAULT 0,
  labor_rate numeric NOT NULL DEFAULT 0,
  own_cost_usd numeric NOT NULL DEFAULT 0,
  carried_usd numeric NOT NULL DEFAULT 0,
  priced_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  priced_by_name text NOT NULL DEFAULT '',
  priced_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bid_difficulty_picks_shape CHECK (jsonb_typeof(picks) = 'object'),
  CONSTRAINT bid_difficulty_lines_shape CHECK (jsonb_typeof(lines) = 'array'),
  CONSTRAINT bid_difficulty_removed_shape CHECK (jsonb_typeof(removed) = 'array')
);

COMMENT ON TABLE public.bid_difficulty IS
  'GC difficulty rating (punch list #357): the cost lines a bid was priced with, pinned. lines is [{key, name, points, hours, rate, amount, sentence, words}] as written; row_ids are the cost_estimate_other_rows the lines live in; removed is [{key, name, amount, reason, by, by_name, at}] for lines a person took off this bid. The rating, the criteria version and the price version are the ones the lines came from; a newer one never moves them until the Workbench reads it in.';
COMMENT ON COLUMN public.bid_difficulty.carried_usd IS 'What the paying line carried: the bid''s price when it had one, else its own cost.';
COMMENT ON COLUMN public.bid_difficulty.own_cost_usd IS 'The bid''s own cost before difficulty, which the cap is a percent of.';

CREATE INDEX IF NOT EXISTS bid_difficulty_cost_estimate_idx ON public.bid_difficulty (cost_estimate_id);
CREATE INDEX IF NOT EXISTS bid_difficulty_rating_idx ON public.bid_difficulty (rating_id);

CREATE OR REPLACE FUNCTION public.bid_difficulty_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'INSERT' OR NEW.lines IS DISTINCT FROM OLD.lines THEN
    NEW.priced_at := now();
    IF v_uid IS NOT NULL THEN
      NEW.priced_by := v_uid;
      NEW.priced_by_name := COALESCE((SELECT u.name FROM public.users u WHERE u.id = v_uid), '');
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

REVOKE ALL ON FUNCTION public.bid_difficulty_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS bid_difficulty_guard ON public.bid_difficulty;
CREATE TRIGGER bid_difficulty_guard
  BEFORE INSERT OR UPDATE ON public.bid_difficulty
  FOR EACH ROW EXECUTE FUNCTION public.bid_difficulty_guard();

ALTER TABLE public.bid_difficulty ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bid_difficulty_select_signed_in ON public.bid_difficulty;
CREATE POLICY bid_difficulty_select_signed_in
  ON public.bid_difficulty FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS bid_difficulty_write_pricing ON public.bid_difficulty;
CREATE POLICY bid_difficulty_write_pricing
  ON public.bid_difficulty FOR ALL TO authenticated
  USING (public.is_bid_pricing_user())
  WITH CHECK (public.is_bid_pricing_user());

REVOKE ALL ON public.bid_difficulty FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bid_difficulty TO authenticated;

-- 2. The stamp keeps the difficulty cost apart.
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS priced_difficulty_usd numeric;
COMMENT ON COLUMN public.bids.priced_difficulty_usd IS
  'v2.7301 · of priced_cost_usd, the part that is the GC difficulty lines (bid_difficulty), so Bid vs actual can hold the hours against the clock. Written only by stamp_bid_priced_margin.';

-- 3. The stamp takes it. The six-argument shape goes, so a call with six named arguments is not ambiguous; the
-- seventh defaults, so the client of the deploy before this one stamps as before.
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
         priced_difficulty_usd = v_difficulty,
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

  SELECT b.bid_date_sent INTO v_sent FROM public.bids b WHERE b.id = p_bid_id;
  IF FOUND AND v_sent IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'sent');
  END IF;
  RETURN jsonb_build_object('ok', false, 'reason', 'refused');
END;
$$;

COMMENT ON FUNCTION public.stamp_bid_priced_margin(uuid, uuid, numeric, numeric, numeric, boolean, numeric) IS
  'v2.5043 · stamps the margin a bid is priced at (the Pricing workbench strip''s numbers) with its inputs, who and when; v2.7301 · p_difficulty_usd is the part of the cost that is the GC difficulty lines. Writes nothing on a sent bid ({ok:false, reason:''sent''}), a zero revenue (''no_revenue'') or a bid the caller cannot update (''refused''). SECURITY INVOKER.';

REVOKE EXECUTE ON FUNCTION public.stamp_bid_priced_margin(uuid, uuid, numeric, numeric, numeric, boolean, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stamp_bid_priced_margin(uuid, uuid, numeric, numeric, numeric, boolean, numeric) TO authenticated;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
