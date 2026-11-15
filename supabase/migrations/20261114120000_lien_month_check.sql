-- The stand-in lien month, confirmed by a person (v2.7280, punch list #358; the owner's ask of 2026-11-14).
-- A job with no clock hours and no last day of work set by hand takes its lien month from its bill, and every
-- surface flags that month as a stand-in (v2.7224). The only way to clear the flag was to set the last day of
-- work, which moves every clock. These five columns record the second door: a person confirms the month is
-- right, with who said so and when. No clock moves and no paper changes; the flag turns quiet while the job
-- still has no hours and no hand day and the confirmed month is still the stand-in month.
SET lock_timeout = '3s';

ALTER TABLE public.jobs_ledger
  ADD COLUMN IF NOT EXISTS lien_month_checked_month text,
  ADD COLUMN IF NOT EXISTS lien_month_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS lien_month_checked_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lien_month_checked_by_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS lien_month_check_note text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.jobs_ledger.lien_month_checked_month IS 'The stand-in lien month a person confirmed as the month the work was done, YYYY-MM (v2.7280). Read only while the job has no approved hours and no last day set by hand and this is still its stand-in month; otherwise ignored.';
COMMENT ON COLUMN public.jobs_ledger.lien_month_checked_at IS 'When the stand-in lien month was confirmed (v2.7280).';
COMMENT ON COLUMN public.jobs_ledger.lien_month_checked_by IS 'Who confirmed the stand-in lien month (users.id, v2.7280).';
COMMENT ON COLUMN public.jobs_ledger.lien_month_checked_by_name IS 'The confirmer''s name as it was when they pressed (v2.7280), so the line reads after the account changes.';
COMMENT ON COLUMN public.jobs_ledger.lien_month_check_note IS 'Who said the stand-in month is right, and when, as the confirmer typed it (v2.7280).';
