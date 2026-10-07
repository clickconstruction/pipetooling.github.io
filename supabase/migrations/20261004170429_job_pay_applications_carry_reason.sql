SET lock_timeout = '3s';

-- A later application says why it stays as it went out (v2.4494).
-- Nothing locks a saved pay application, so an earlier one can change after a later one was
-- sent. The window flags the later one: its previous work and previous certificates no longer
-- match the application before it. The office either takes the new amounts or keeps it as it
-- went out and says why. This is where the why is written down.
ALTER TABLE public.job_pay_applications
  ADD COLUMN IF NOT EXISTS carry_reason text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.job_pay_applications.carry_reason IS
  'Why this application keeps previous amounts that no longer match the application before it (v2.4494). Empty when it matches or no reason was given. The mismatch itself is worked out by the client from the two rows.';
