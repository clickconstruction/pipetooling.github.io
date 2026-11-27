SET lock_timeout = '3s';

-- Text again (punch list #299, v2.8697). The office's Needs you row for a charge texted twice with no receipt gets one
-- more press: a third text, sent by a person. Taunya's answer of 2026-11-25: yes, build it. This file is what that
-- press needs in the database, and it sends nothing: the text goes from the receipt-request function, on the press.
--
--   1. receipt_requests.again_at, again_by and again_count: when the office last pressed Text again, who pressed, and
--      how many times. The function claims the press here before its text goes, by the count, so two presses at once
--      send one text. The sweep reads none of the three.
--   2. receipt_links.made_for takes 'again': the link a Text again hands out, with made_by the person who pressed.
--   3. receipt_requests_to_chase() hands back again_at and again_count, and a charge texted again rests off the list
--      for twelve hours, as it rests after the reminder. Its row type grows, so the function is dropped and made
--      again in this one file; the grants and the comment are written again with it.
--
-- No table is made, so no fence is added. Additive and idempotent. An older client reads the two new columns as
-- nothing and shows no press, so this is harmless on either side of the Pages deploy.

-- 1. The office's press, on the request.
ALTER TABLE public.receipt_requests
  ADD COLUMN IF NOT EXISTS again_at timestamptz,
  ADD COLUMN IF NOT EXISTS again_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS again_count integer NOT NULL DEFAULT 0 CHECK (again_count >= 0);
COMMENT ON COLUMN public.receipt_requests.again_at IS 'When the office last pressed Text again on the request''s Needs you row (punch list #299). The row rests off the office''s list for twelve hours after it.';
COMMENT ON COLUMN public.receipt_requests.again_by IS 'Who last pressed Text again.';
COMMENT ON COLUMN public.receipt_requests.again_count IS 'How many texts the office has sent by Text again, beside the first text and the reminder. The receipt-request function stops at its cap.';

-- 2. The link's fourth word. The check was written inline (20261113061500), so it is found by what it says and written
--    again under its own name.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.receipt_links'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ~ '\(made_for = ANY'
  LOOP
    EXECUTE format('ALTER TABLE public.receipt_links DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.receipt_links
  ADD CONSTRAINT receipt_links_made_for_check CHECK (made_for IN ('office', 'text', 'reminder', 'again'));
COMMENT ON COLUMN public.receipt_links.made_for IS 'What the code was handed to: office (Copy the receipt link), text (the text when the charge posts), reminder (the next evening''s text), again (the office''s Text again, made_by the person who pressed).';

-- 3. What the office works, with the press's own two facts.
DROP FUNCTION IF EXISTS public.receipt_requests_to_chase();
CREATE FUNCTION public.receipt_requests_to_chase()
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
  closes_at timestamptz,
  again_at timestamptz,
  again_count integer
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
    r.closes_at,
    r.again_at,
    r.again_count
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
      OR (
        r.texted_at IS NOT NULL AND r.reminded_at IS NOT NULL
        AND r.reminded_at <= now() - interval '12 hours'
        AND (r.again_at IS NULL OR r.again_at <= now() - interval '12 hours')
      )
    )
  ORDER BY t.posted_at DESC NULLS LAST, r.id
  LIMIT 300
$$;
REVOKE ALL ON FUNCTION public.receipt_requests_to_chase() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.receipt_requests_to_chase() TO authenticated, service_role;
COMMENT ON FUNCTION public.receipt_requests_to_chase() IS
  'Receipt texts (punch list #299): the open receipt requests the text cannot finish by itself, for the office''s Needs you rows. Why is no_cell, no_person, archived, opted_out, failed (the text was turned away three times) or no_answer (texted and reminded, no receipt twelve hours on, and twelve hours on from the office''s last Text again). again_at and again_count are the office''s Text again presses. Empty for anyone who is not the office.';
