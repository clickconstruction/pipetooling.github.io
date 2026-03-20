-- Only dev, master_technician, and assistant can update bid_number.
-- Estimators and primaries can edit bids but not change bid_number.

CREATE OR REPLACE FUNCTION public.prevent_bid_number_update_by_estimator_primary()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
BEGIN
  IF OLD.bid_number IS DISTINCT FROM NEW.bid_number THEN
    SELECT role INTO user_role FROM users WHERE id = auth.uid();
    IF user_role IN ('estimator', 'primary') THEN
      RAISE EXCEPTION 'Only dev, master_technician, and assistant can edit bid number';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bids_prevent_estimator_primary_edit_bid_number ON public.bids;
CREATE TRIGGER bids_prevent_estimator_primary_edit_bid_number
  BEFORE UPDATE ON public.bids
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_bid_number_update_by_estimator_primary();

COMMENT ON FUNCTION public.prevent_bid_number_update_by_estimator_primary() IS 'Blocks estimator and primary from changing bid_number. Only dev, master_technician, assistant may edit.';
