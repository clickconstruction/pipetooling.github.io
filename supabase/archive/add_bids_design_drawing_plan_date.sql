-- Add Design Drawing Plan Date to bids (date only, no time)

ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS design_drawing_plan_date DATE;

COMMENT ON COLUMN public.bids.design_drawing_plan_date IS 'Design drawing plan date (date only).';
