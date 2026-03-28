-- Optional note when marking a pay stub physically paid
ALTER TABLE public.pay_stubs
  ADD COLUMN IF NOT EXISTS paid_note text;

COMMENT ON COLUMN public.pay_stubs.paid_note IS 'Optional note when marking physically paid.';
