SET lock_timeout = '3s';

-- v2.1633: user-set "date sent" on Sub Labor payments/backcharges.
-- Nullable; display falls back to created_at for legacy rows.
ALTER TABLE public.people_labor_job_payments
  ADD COLUMN IF NOT EXISTS payment_date date;
