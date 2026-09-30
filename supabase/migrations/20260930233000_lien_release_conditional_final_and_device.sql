SET lock_timeout = '3s';

-- Our lien waiver to the GC (v2.4274, PR 1): the fourth statutory form on the
-- customer side, and the device a present leader signed on.
--
-- 1) form_type admits 'conditional_final' — the § 53.284(d) form the office had
--    for subs (lienWaiverPick) but the Release of Lien window could not issue, so
--    the last bill to a GC had no conditional form to travel with it.
-- 2) signed_on_device_of: when the leader signs on the assistant's screen
--    ("He signs now"), the signer stays the leader (signer_user_id); this names
--    whose device it was. Null when he signed from his own desk.
-- Idempotent; additive.

ALTER TABLE public.job_lien_releases
  DROP CONSTRAINT IF EXISTS job_lien_releases_form_type_check;
ALTER TABLE public.job_lien_releases
  ADD CONSTRAINT job_lien_releases_form_type_check
  CHECK (form_type IN ('conditional_progress', 'unconditional_progress', 'conditional_final', 'unconditional_final'));

ALTER TABLE public.job_lien_releases
  ADD COLUMN IF NOT EXISTS signed_on_device_of uuid REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.job_lien_releases.signed_on_device_of IS
  'v2.4274: the user whose screen the signer used when signing in person ("He signs now"); null when the signer signed from their own session.';
