SET lock_timeout = '3s';

-- GC mode, Owner Billing's O8c (v2.5125): Pay by card's switch becomes the owner's own press (the lead's call,
-- 2026-10-09). O8b (v2.5123) read an env value, GC_CARD_BILL_ON, which only its two functions could see; the office's
-- Bill the customer and gc-customer-email's card lines need it too. So it is one app_settings row the whole app reads:
-- `gc_card_bill_on_v1` = 'false', turned on in Settings → Jobs & billing. Dev already manages every app_settings row;
-- the owner (master_technician) may flip this one through a key-scoped UPDATE policy, the
-- owner_auto_confirm_from_roll_v1 pattern (20260914270000). Everyone signed in reads app_settings, so the window sees
-- it; gc-card-bill, customer-portal and gc-customer-email read it as the service role. It replaces the env value, which
-- goes away. Stripe's test or live stays an env value (GC_CARD_BILL_STRIPE_MODE): infrastructure, not an office press.
--
-- Additive and idempotent. No table is created, so the read-only and twin fences already on app_settings stand.

INSERT INTO public.app_settings (key, value_text)
VALUES ('gc_card_bill_on_v1', 'false')
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS "master_or_dev_update_gc_card_bill_on" ON public.app_settings;
CREATE POLICY "master_or_dev_update_gc_card_bill_on"
  ON public.app_settings
  FOR UPDATE
  TO authenticated
  USING (key = 'gc_card_bill_on_v1' AND public.is_master_or_dev())
  WITH CHECK (key = 'gc_card_bill_on_v1' AND public.is_master_or_dev());
