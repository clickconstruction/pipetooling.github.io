SET lock_timeout = '3s';

-- The office's receipt items (punch list #299, the step after PR 2, v2.7148). PR 2 (20261113140000) texts a card's
-- holder and writes on the request why a text could not go. This file is what the office needs to work those requests
-- from Needs you: one read, and one mark. It sends nothing and texts nobody.
--
--   1. receipt_requests.office_done_at and office_done_by: the office's Got it. A request marked done leaves the
--      office's list and nothing else changes: its link still opens, a receipt that comes later still lands, and the
--      sweep reads neither column.
--   2. receipt_requests_to_chase(): the open requests the text cannot finish by itself, with the charge's store, amount
--      and day, for the office alone. Four kinds from PR 2's reasons (no cell, a card tied to no one or to a person
--      who has left, a STOP), one for a text that was turned away three times, and one for a charge texted and reminded
--      with no receipt twelve hours after the reminder. Never a request that is answered, closed, past its day or
--      marked done, never a charge the bank took back, never a charge that has its ticket.
--   3. receipt_requests_set_done(ids, done): the office marks requests done, or takes the mark back (Undo).
--
-- The office (is_office_staff: dev, owner, assistant, controller) reads every request already, by the table's own
-- policy. The read is a function because the charge's store and amount live on mercury_transactions, which an
-- assistant does not read; it hands back what a receipt link's own page shows and no more. No table is made, so no
-- fence is added. Additive and idempotent.

-- 1. The office's Got it.
ALTER TABLE public.receipt_requests
  ADD COLUMN IF NOT EXISTS office_done_at timestamptz,
  ADD COLUMN IF NOT EXISTS office_done_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.receipt_requests.office_done_at IS 'When the office pressed Got it on the request''s Needs you row. It leaves the office''s list; the link, the ticket and the sweep do not read it.';
COMMENT ON COLUMN public.receipt_requests.office_done_by IS 'Who pressed Got it.';

-- 2. What the office works.
CREATE OR REPLACE FUNCTION public.receipt_requests_to_chase()
RETURNS TABLE (
  request_id uuid,
  mercury_transaction_id uuid,
  why text,
  holder_user_id uuid,
  holder_name text,
  store text,
  amount numeric,
  posted_at timestamptz,
  texted_at timestamptz,
  reminded_at timestamptz,
  closes_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id,
    r.mercury_transaction_id,
    CASE
      WHEN r.no_text_why IS NOT NULL THEN r.no_text_why
      WHEN r.texted_at IS NULL THEN 'failed'
      ELSE 'no_answer'
    END,
    r.holder_user_id,
    r.holder_name,
    t.counterparty_name,
    abs(t.amount),
    t.posted_at,
    r.texted_at,
    r.reminded_at,
    r.closes_at
  FROM public.receipt_requests r
  JOIN public.mercury_transactions t ON t.id = r.mercury_transaction_id
  WHERE public.is_office_staff()
    AND NOT public.caller_is_archived()
    AND r.answered_at IS NULL AND r.closed_at IS NULL AND r.office_done_at IS NULL
    AND r.closes_at > now()
    AND lower(COALESCE(t.status, '')) NOT IN ('failed', 'cancelled', 'canceled', 'reversed')
    AND NOT EXISTS (SELECT 1 FROM public.counter_tickets k WHERE k.mercury_transaction_id = t.id AND k.removed_at IS NULL)
    AND (
      r.no_text_why IS NOT NULL
      OR (r.texted_at IS NULL AND r.text_tries >= 3)
      OR (r.texted_at IS NOT NULL AND r.reminded_at IS NOT NULL AND r.reminded_at <= now() - interval '12 hours')
    )
  ORDER BY t.posted_at DESC NULLS LAST, r.id
  LIMIT 300
$$;
REVOKE ALL ON FUNCTION public.receipt_requests_to_chase() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.receipt_requests_to_chase() TO authenticated, service_role;
COMMENT ON FUNCTION public.receipt_requests_to_chase() IS
  'Receipt texts (punch list #299): the open receipt requests the text cannot finish by itself, for the office''s Needs you rows. Why is no_cell, no_person, archived, opted_out, failed (the text was turned away three times) or no_answer (texted and reminded, no receipt twelve hours on). Empty for anyone who is not the office.';

-- 3. Got it, and its Undo.
CREATE OR REPLACE FUNCTION public.receipt_requests_set_done(p_request_ids uuid[], p_done boolean DEFAULT true)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_office_staff() OR public.caller_is_archived() THEN
    RAISE EXCEPTION 'Only the office marks a receipt request done.' USING ERRCODE = '42501';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account changes nothing.' USING ERRCODE = '42501';
  END IF;
  IF p_request_ids IS NULL OR cardinality(p_request_ids) = 0 THEN
    RETURN 0;
  END IF;
  IF cardinality(p_request_ids) > 200 THEN
    RAISE EXCEPTION 'At most 200 requests at once.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.receipt_requests r
  SET office_done_at = CASE WHEN COALESCE(p_done, true) THEN now() ELSE NULL END,
      office_done_by = CASE WHEN COALESCE(p_done, true) THEN auth.uid() ELSE NULL END,
      updated_at = now()
  WHERE r.id = ANY (p_request_ids)
    AND (r.office_done_at IS NULL) = COALESCE(p_done, true);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END
$$;
REVOKE ALL ON FUNCTION public.receipt_requests_set_done(uuid[], boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.receipt_requests_set_done(uuid[], boolean) TO authenticated, service_role;
COMMENT ON FUNCTION public.receipt_requests_set_done(uuid[], boolean) IS
  'Receipt texts (punch list #299): the office''s Got it on a receipt request''s Needs you row, or its Undo with p_done = false. Office only; a training account and an archived one are refused. Returns how many rows changed.';
