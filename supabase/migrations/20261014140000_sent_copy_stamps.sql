SET lock_timeout = '3s';

-- Messages, residential R8 · 1 (the app's own emails in the thread): the small print under a sent copy's line, "from
-- office@…", "opened Oct 10, 6:12 PM", "paid Oct 11 by card" (src/lib/messages/appLines.ts, sentCopyFacts; card 1 of
-- to-dos/gc-mode/messages/customer-messages-integrations-mockups.html v0.2 on branch spike/gc-mode).
--
-- sent_documents has none of the three. The address it went from and its last event live on email_send_log, which a dev
-- reads and the office reads only for RFQ and GC statement rows. Whether the bill it carried was paid lives on
-- jobs_ledger_invoices and jobs_ledger_payments. So one read, for the copies the caller can already read:
--
-- sent_copy_stamps(p_ids): for each copy among p_ids,
--   * from_email: email_send_log.from_email, by the copy's resend_email_id (unique on the log).
--   * opened_at: the log's last_event_at while last_event is opened or clicked. Resend's webhook keeps only the last
--     event, so a later one overwrites the open. Null means not known, never unopened.
--   * paid_on and paid_how: for a copy of a jobs_ledger_invoices row whose status is paid, the newest payment's day (its
--     paid_on, else the day it was entered, in Chicago) and its payment_type as the row has it. Null otherwise.
-- The caller must read sent_documents (is_office_staff(), its SELECT policy). Anyone else reads no rows. A copy with
-- none of the three still comes back, with nulls, so the client never wonders whether it asked.
--
-- No table, so no house calls. See docs/migrations/20261014140000_sent_copy_stamps.md.

CREATE OR REPLACE FUNCTION public.sent_copy_stamps(p_ids uuid[])
RETURNS TABLE (
  id uuid,
  from_email text,
  opened_at timestamptz,
  paid_on date,
  paid_how text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sd.id,
    l.from_email,
    CASE WHEN l.last_event IN ('opened', 'clicked') THEN l.last_event_at END,
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
COMMENT ON FUNCTION public.sent_copy_stamps(uuid[]) IS
  'Messages (residential R8 · 1): the small print of sent copies for the thread, from email_send_log (from_email; opened_at while last_event is opened or clicked) and, for a paid jobs_ledger_invoices copy, its newest payment''s day and payment_type. is_office_staff() only, as sent_documents'' SELECT policy; anyone else reads no rows.';

REVOKE ALL ON FUNCTION public.sent_copy_stamps(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sent_copy_stamps(uuid[]) TO authenticated, service_role;
