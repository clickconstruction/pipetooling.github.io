SET lock_timeout = '3s';

-- Bills sent (punch list #327, PR 3): whether each send arrived. The page at /bills-sent draws one line each time a
-- bill leaves, from sent_documents. Whether the email arrived lives on email_send_log, which a dev and the owner read
-- whole and the assistant and the controller read only for RFQ and GC statement rows. So the office could not see that
-- a bill bounced. sent_copy_stamps (20261014140000) answers "opened" and "paid" for the Messages thread and nothing of
-- delivered or bounced. One read for the list, for the copies the caller can already read:
--
-- bill_send_marks(p_ids): for each sent copy among p_ids,
--   * last_event and last_event_at: the log's last word on the email (sent, delivered, delivery_delayed, bounced,
--     complained, opened, clicked), by the copy's resend_email_id, unique on the log. Resend's webhook keeps only the
--     last event, so "opened" means it was delivered and then opened. Null when the copy was not an email, or its log
--     row is not written yet: not known, never "did not arrive".
--   * email_type: the log's type, so a statement that went on the schedule (gc_statement_scheduled) reads as the app's.
--   * paid_on and paid_how: for a copy of a jobs_ledger_invoices row whose status is paid, the newest payment's day (its
--     paid_on, else the day it was entered, in Chicago) and its payment_type. Null otherwise.
-- The caller must read sent_documents (is_office_staff(), its SELECT policy). Anyone else reads no rows. A copy with
-- nothing to say still comes back, with nulls.
--
-- No table, so no house calls. See docs/migrations/20261112210000_bill_send_marks.md.

CREATE OR REPLACE FUNCTION public.bill_send_marks(p_ids uuid[])
RETURNS TABLE (
  id uuid,
  last_event text,
  last_event_at timestamptz,
  email_type text,
  paid_on date,
  paid_how text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sd.id,
    l.last_event,
    l.last_event_at,
    l.email_type,
    p.paid_on,
    p.paid_how
  FROM public.sent_documents sd
  LEFT JOIN public.email_send_log l
    ON sd.resend_email_id IS NOT NULL AND l.resend_email_id = sd.resend_email_id
  LEFT JOIN public.jobs_ledger_invoices inv
    ON sd.source_table = 'jobs_ledger_invoices' AND inv.id = sd.source_id AND inv.status = 'paid'
  LEFT JOIN LATERAL (
    SELECT
      coalesce(pay.paid_on, (pay.created_at AT TIME ZONE 'America/Chicago')::date) AS paid_on,
      pay.payment_type AS paid_how
    FROM public.jobs_ledger_payments pay
    WHERE pay.invoice_id = inv.id
    ORDER BY coalesce(pay.paid_on, (pay.created_at AT TIME ZONE 'America/Chicago')::date) DESC, pay.created_at DESC NULLS LAST
    LIMIT 1
  ) p ON inv.id IS NOT NULL
  WHERE (SELECT public.is_office_staff())
    AND sd.id = ANY (p_ids);
$$;
COMMENT ON FUNCTION public.bill_send_marks(uuid[]) IS
  'Bills sent (punch list #327, PR 3): for sent copies the caller can read, the last delivery event of each email from email_send_log (last_event, last_event_at, email_type) and, for a paid jobs_ledger_invoices copy, its newest payment''s day and payment type. Gated by is_office_staff(), the SELECT policy of sent_documents.';

REVOKE ALL ON FUNCTION public.bill_send_marks(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bill_send_marks(uuid[]) TO authenticated, service_role;
