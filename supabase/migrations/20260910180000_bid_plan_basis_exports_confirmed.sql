SET lock_timeout = '3s';

-- Bid basis (v2.3226): CountTooling can now report that the browser's save picker
-- CONFIRMED the file name (the person chose it in the dialog) instead of the
-- intended name a plain download may still rename. Record the difference.
ALTER TABLE public.bid_plan_basis_exports
  DROP CONSTRAINT IF EXISTS bid_plan_basis_exports_save_method_check;
ALTER TABLE public.bid_plan_basis_exports
  ADD CONSTRAINT bid_plan_basis_exports_save_method_check
  CHECK (save_method IN ('reported', 'confirmed', 'manual'));

COMMENT ON COLUMN public.bid_plan_basis_exports.save_method IS
  'reported = CountTooling posted the manifest with the intended download name; confirmed = the browser save picker confirmed the exact name; manual = Mark as attached by hand.';
