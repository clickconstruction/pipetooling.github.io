-- Optional order portal / website URL per supply house (shown near supply house dropdowns in UI).
ALTER TABLE public.supply_houses ADD COLUMN IF NOT EXISTS website_url TEXT;
COMMENT ON COLUMN public.supply_houses.website_url IS 'Optional URL for ordering or supplier portal; opened from Materials/Bids when a supply house is selected.';
