SET lock_timeout = '3s';

-- v2.2594: dev-assigned backtest axis on bids. The Queue lens's Backtest
-- candidates section groups graded historical references by the axis whose
-- Gate-B streak they would feed; today an axis exists only once a run is
-- opened (twin_run_scores / twin_shadow_runs rows), so candidates need a
-- place to carry one before any run. Nullable, free text matching the run
-- tables' axis values; rides bids' existing RLS.
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS backtest_axis text;

COMMENT ON COLUMN public.bids.backtest_axis IS
  'Dev-assigned confidence axis for backtest candidacy (v2.2594). Matches the axis strings in twin_run_scores/twin_shadow_runs; null = unclassified.';
