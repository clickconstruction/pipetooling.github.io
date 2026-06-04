-- Pricing tab "Package and send" audit table.
--
-- Pairs with the Bids → Pricing toolbar button "Package and send" (left of Export CSV)
-- which can route through either:
--   (a) "Send via my mail" — client opens mailto + copies HTML table to clipboard, then
--       calls log_bid_pricing_package_send RPC so the attempt is captured (sent_via='mailto_logged').
--   (b) "Send for me" — Edge function `send-bid-pricing-package` calls Resend and writes
--       a `sent_via='resend'` row directly with the service-role client.
--
-- RLS mirrors `bid_pricing_assignments` access (dev / master_technician / assistant /
-- estimator on bids they can already see for pricing). The Edge function uses service-role
-- and bypasses the INSERT policy; the RPC below carries the caller through it.

CREATE TABLE IF NOT EXISTS public.bid_pricing_package_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  price_book_version_id uuid NOT NULL REFERENCES public.price_book_versions(id) ON DELETE RESTRICT,
  sent_by_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  recipient_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  recipient_email text NOT NULL,
  sent_via text NOT NULL CHECK (sent_via IN ('resend', 'mailto_logged')),
  resend_id text NULL,
  plans_link text NULL,
  revenue_total_cents integer NOT NULL,
  row_count integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.bid_pricing_package_sends IS
  'Audit log of Pricing tab "Package and send" attempts (Resend or mailto). One row per attempt.';

CREATE INDEX IF NOT EXISTS bid_pricing_package_sends_bid_created_idx
  ON public.bid_pricing_package_sends (bid_id, created_at DESC);

ALTER TABLE public.bid_pricing_package_sends ENABLE ROW LEVEL SECURITY;

-- SELECT: any of the four roles who already see Pricing for that bid.
-- (subcontractor, helpers, primary, superintendent: no match → denied.)
CREATE POLICY "bpps_select"
ON public.bid_pricing_package_sends
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND public.can_access_bid_for_pricing(bid_id)
);

-- INSERT: same role gate; sent_by_user_id must match the caller (prevents impersonation
-- via the RPC). Edge function uses service-role and bypasses this policy.
CREATE POLICY "bpps_insert"
ON public.bid_pricing_package_sends
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND public.can_access_bid_for_pricing(bid_id)
  AND sent_by_user_id = auth.uid()
);

-- UPDATE: dev only (history rows are immutable in practice; future cleanup tooling).
CREATE POLICY "bpps_update"
ON public.bid_pricing_package_sends
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role = 'dev'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role = 'dev'
  )
);

-- DELETE: dev only.
CREATE POLICY "bpps_delete"
ON public.bid_pricing_package_sends
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role = 'dev'
  )
);

-- RPC for "Send via my mail" path. SECURITY INVOKER so the INSERT runs under the caller's
-- JWT and is gated by the bpps_insert policy (sent_by_user_id = auth.uid()).
CREATE OR REPLACE FUNCTION public.log_bid_pricing_package_send(
  p_bid_id uuid,
  p_price_book_version_id uuid,
  p_recipient_user_id uuid,
  p_recipient_email text,
  p_revenue_total_cents integer,
  p_row_count integer,
  p_plans_link text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.bid_pricing_package_sends (
    bid_id,
    price_book_version_id,
    sent_by_user_id,
    recipient_user_id,
    recipient_email,
    sent_via,
    resend_id,
    plans_link,
    revenue_total_cents,
    row_count
  )
  VALUES (
    p_bid_id,
    p_price_book_version_id,
    auth.uid(),
    p_recipient_user_id,
    p_recipient_email,
    'mailto_logged',
    NULL,
    p_plans_link,
    p_revenue_total_cents,
    p_row_count
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

COMMENT ON FUNCTION public.log_bid_pricing_package_send(uuid, uuid, uuid, text, integer, integer, text) IS
  'Audit insert for Bids Pricing "Send via my mail" attempts. SECURITY INVOKER — gated by bpps_insert RLS.';

GRANT EXECUTE ON FUNCTION public.log_bid_pricing_package_send(uuid, uuid, uuid, text, integer, integer, text)
  TO authenticated;
