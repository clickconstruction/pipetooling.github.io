-- Create trigger function to automatically track price changes in history table

CREATE OR REPLACE FUNCTION public.track_price_history()
RETURNS TRIGGER AS $$
DECLARE
  change_percent NUMERIC(10, 2);
  old_price_val NUMERIC(10, 2);
BEGIN
  -- Determine old price based on trigger type
  IF TG_OP = 'INSERT' THEN
    old_price_val := NULL;
    change_percent := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    old_price_val := OLD.price;
    -- Calculate percentage change if old price exists and is greater than 0
    IF old_price_val IS NOT NULL AND old_price_val > 0 THEN
      change_percent := ((NEW.price - old_price_val) / old_price_val) * 100;
    ELSE
      change_percent := NULL;
    END IF;
  END IF;

  -- Insert history record
  INSERT INTO public.material_part_price_history (
    part_id,
    supply_house_id,
    old_price,
    new_price,
    price_change_percent,
    effective_date,
    changed_by
  ) VALUES (
    NEW.part_id,
    NEW.supply_house_id,
    old_price_val,
    NEW.price,
    change_percent,
    NEW.effective_date,
    auth.uid()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for INSERT (to track initial prices)
CREATE TRIGGER track_price_history_on_insert
  AFTER INSERT ON public.material_part_prices
  FOR EACH ROW
  EXECUTE FUNCTION public.track_price_history();

-- Create trigger for UPDATE (to track price changes)
CREATE TRIGGER track_price_history_on_update
  AFTER UPDATE ON public.material_part_prices
  FOR EACH ROW
  WHEN (OLD.price IS DISTINCT FROM NEW.price OR OLD.effective_date IS DISTINCT FROM NEW.effective_date)
  EXECUTE FUNCTION public.track_price_history();

-- Add comment
COMMENT ON FUNCTION public.track_price_history() IS 'Automatically tracks price changes in material_part_price_history table when prices are inserted or updated. Calculates percentage change when old price exists.';
