-- Dispatch Mode becomes a per-user server setting (was per-device localStorage):
-- follows the user across browsers/computers. Self-updatable via the existing
-- "Users can update own profile" policy. Idempotent + additive.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS dispatch_mode_enabled boolean NOT NULL DEFAULT false;
