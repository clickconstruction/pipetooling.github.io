SET lock_timeout = '3s';

-- GC mode, Owner Billing's O5b (to-dos/gc-mode/mockups/owner-billing-o5.md → O5b, on spike/gc-mode): our ask
-- to pay a late bill. The window drafts the email (payReminderEmail); this files it with the pay-by day and
-- the office's line, and puts one touch on the Pipeline's chase list, before gc-customer-email sends it and
-- writes its email_send_log_id back. Never a promise: the day the bill was due stays. "Late" is the kernel's
-- (payReminderStep: certified, open, past its due day); the database checks only what cannot be argued with.
-- SECURITY INVOKER: the money team's policy on gc_owner_pay_reminders is its gate, and O1's read-only and twin
-- blocks hold for it. The chase touch goes through the Pipeline's own add_payment_chase_touch, which lets the
-- money team in (is_assistant() counts the controller).
CREATE OR REPLACE FUNCTION public.gc_remind_customer_to_pay(
  p_pay_app_id uuid,
  p_on date,
  p_pay_by date,
  p_note text,
  p_subject text,
  p_lines text[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_app public.gc_owner_pay_apps%ROWTYPE;
  v_status text;
  v_customer uuid;
  v_job uuid;
  v_subject text := btrim(COALESCE(p_subject, ''));
  v_lines text[];
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to remind them to pay.';
  END IF;
  SELECT * INTO v_app FROM public.gc_owner_pay_apps WHERE id = p_pay_app_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That pay application is not there.';
  END IF;
  IF v_app.certified IS NULL THEN
    RAISE EXCEPTION 'Pay application % waits on the architect. There is nothing to pay on it yet.', v_app.number;
  END IF;
  IF v_app.invoice_id IS NULL THEN
    RAISE EXCEPTION 'The architect certified nothing on pay application %, so there is no bill to pay.', v_app.number;
  END IF;
  SELECT status INTO v_status FROM public.jobs_ledger_invoices WHERE id = v_app.invoice_id;
  IF v_status = 'paid' THEN
    RAISE EXCEPTION 'Pay application % is paid in full.', v_app.number;
  END IF;
  IF p_on IS DISTINCT FROM public.app_today() THEN
    RAISE EXCEPTION 'A reminder goes today.';
  END IF;
  IF p_pay_by IS NULL OR p_pay_by < public.app_today() THEN
    RAISE EXCEPTION 'The pay-by day cannot be before today.';
  END IF;
  SELECT array_agg(btrim(l) ORDER BY n) INTO v_lines
  FROM unnest(p_lines) WITH ORDINALITY AS t(l, n)
  WHERE btrim(COALESCE(l, '')) <> '';
  IF v_subject = '' OR v_lines IS NULL THEN
    RAISE EXCEPTION 'The reminder needs its email: a subject and its lines.';
  END IF;
  SELECT p.customer_id, g.billing_job_id INTO v_customer, v_job
  FROM public.projects p JOIN public.gc_projects g ON g.project_id = p.id
  WHERE p.id = v_app.project_id;
  IF v_customer IS NULL THEN
    RAISE EXCEPTION 'This project has no customer to remind.';
  END IF;

  INSERT INTO public.gc_owner_pay_reminders (pay_app_id, sent_on, sent_by, pay_by, note, subject, lines)
  VALUES (p_pay_app_id, p_on, auth.uid(), p_pay_by, btrim(COALESCE(p_note, '')), v_subject, v_lines)
  RETURNING id INTO v_id;

  -- One touch on the chase list: the customer's, pinned to the billing job.
  PERFORM public.add_payment_chase_touch(v_customer, v_job, 'note', v_subject || ' · pay by ' || to_char(p_pay_by, 'Dy Mon FMDD'), NULL, NULL);

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.gc_remind_customer_to_pay(uuid, date, date, text, text, text[]) IS
  'GC mode (O5b): our ask to pay a certified bill that is not paid, filed with the pay-by day, the office''s line and the email as the window drafted it, with one note on the Pipeline''s chase list. Never a promise: the day it was due stays. Refuses a pay application waiting on the architect, one with no bill, one paid in full, a day other than today, a pay-by day before today and an email with no subject or lines. Returns the reminder''s id. SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.gc_remind_customer_to_pay(uuid, date, date, text, text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_remind_customer_to_pay(uuid, date, date, text, text, text[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.gc_remind_customer_to_pay(uuid, date, date, text, text, text[]) TO authenticated;
