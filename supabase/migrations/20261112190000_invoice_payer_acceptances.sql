SET lock_timeout = '3s';

-- Pay calendar (punch list #323, PR 4): the day a payer accepted a bill.
--
-- A calendar-paying contract counts from the day an acceptable application is received, not
-- from the day we sent it. The app has only the day a bill went in. Most of the time the two
-- are the same month and nothing changes. When a pay application is sent back and accepted a
-- month later, the due day moves a whole month, and the app would read it a month early with
-- full confidence. This table holds the one correction: the day the payer accepted the bill,
-- set by the office on the bills where it matters. No row means the bill counts from the day
-- it went in, as before.
--
-- Read by RLS through can_read_payment_promises(); written only by
-- set_invoice_payer_accepted_on behind can_write_payment_promises(), the two gates the Pay
-- calendar itself and a promised pay date use.

CREATE TABLE IF NOT EXISTS public.invoice_payer_acceptances (
  invoice_id uuid PRIMARY KEY REFERENCES public.jobs_ledger_invoices(id) ON DELETE CASCADE,
  accepted_on date NOT NULL,
  marked_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  marked_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.invoice_payer_acceptances IS
  'Pay calendar (punch list #323): the day a payer accepted a bill, when that is not the day it went in. A payer''s pay calendar counts its cutoff from this day. Read by RLS (can_read_payment_promises()); written only by set_invoice_payer_accepted_on.';

ALTER TABLE public.invoice_payer_acceptances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invoice_payer_acceptances_select_billed_money ON public.invoice_payer_acceptances;
CREATE POLICY invoice_payer_acceptances_select_billed_money ON public.invoice_payer_acceptances
  FOR SELECT TO authenticated
  USING (public.can_read_payment_promises());

REVOKE ALL ON TABLE public.invoice_payer_acceptances FROM anon, authenticated;
GRANT SELECT ON TABLE public.invoice_payer_acceptances TO authenticated;
GRANT ALL ON TABLE public.invoice_payer_acceptances TO service_role;

-- Set, replace or clear (NULL day) the day a payer accepted one bill. Returns {acceptedOn} or {cleared: true}.
CREATE OR REPLACE FUNCTION public.set_invoice_payer_accepted_on(p_invoice_id uuid, p_accepted_on date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT COALESCE(public.can_write_payment_promises(), false) THEN
    RAISE EXCEPTION 'Not allowed to set the day a bill was accepted';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.jobs_ledger_invoices i WHERE i.id = p_invoice_id) THEN
    RAISE EXCEPTION 'Bill not found';
  END IF;

  IF p_accepted_on IS NULL THEN
    DELETE FROM public.invoice_payer_acceptances WHERE invoice_id = p_invoice_id;
    RETURN jsonb_build_object('cleared', true);
  END IF;

  INSERT INTO public.invoice_payer_acceptances (invoice_id, accepted_on, marked_by, marked_at)
  VALUES (p_invoice_id, p_accepted_on, auth.uid(), now())
  ON CONFLICT (invoice_id)
  DO UPDATE SET accepted_on = EXCLUDED.accepted_on,
                marked_by = EXCLUDED.marked_by,
                marked_at = now();
  RETURN jsonb_build_object('acceptedOn', to_char(p_accepted_on, 'YYYY-MM-DD'));
END;
$$;

COMMENT ON FUNCTION public.set_invoice_payer_accepted_on(uuid, date) IS
  'Set, replace or clear (NULL day) the day a payer accepted one bill; stamps who marked it. Gated on can_write_payment_promises() (punch list #323).';

REVOKE EXECUTE ON FUNCTION public.set_invoice_payer_accepted_on(uuid, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_invoice_payer_accepted_on(uuid, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_invoice_payer_accepted_on(uuid, date) TO authenticated;

-- The four fences every CREATE TABLE migration closes with (CLAUDE.md → DB migrations).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
