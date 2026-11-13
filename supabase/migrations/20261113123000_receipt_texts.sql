SET lock_timeout = '3s';

-- The text about a card charge (punch list #299, PR 2 of three, v2.7126). PR 1 (20261113061500) made the request and
-- the link and sent nothing. This file is what the text itself needs in the database, and it sends nothing either: the
-- switch ships off, and the sweep it schedules is not called while the switch is off.
--
--   1. receipt_requests.text_tries and text_fail_why: a text Quo turned away is tried again on a later sweep, three
--      times in all, and the office's line then says it did not go and why. An index for the reminder's read.
--   2. app_settings receipt_texts_v1, JSON in value_text: {"on":false} as it ships. Switched on it reads
--      {"on":true,"since":"<when>","only":["<user id>", …]}. `since` is the floor under the backlog: a charge that
--      posted before the switch went on is never texted. `only` is a trial, the people whose charges text; empty means
--      everyone with a card. Only the owner or a dev changes it (is_master_or_dev()), keyed to this row alone, the rule
--      Send texts follows (20261014160000).
--   3. receipt_texts_due(): whether the sweep has anything to do, read by the cron before it calls the function. False
--      while either switch is off (this one, or Send texts), so an idle or switched-off app makes no call at all.
--   4. The cron: receipt-request every five minutes, only when receipt_texts_due(). The card drew a step in the bank's
--      webhook and a cron every fifteen minutes; a cron every five reaches a posted charge at most five minutes later
--      than the webhook would, on a charge that posts a median eight hours after the swipe, and leaves the bank's
--      webhook as it is.
--
-- No table is made, so no fence is added. Additive and idempotent. A teammate needs no new contact row: quo_place_number
-- has put a roster number on its own team contact since 20261015020000, which is the contact the text goes to.

-- 1. A text that did not go.
ALTER TABLE public.receipt_requests
  ADD COLUMN IF NOT EXISTS text_tries integer NOT NULL DEFAULT 0 CHECK (text_tries >= 0),
  ADD COLUMN IF NOT EXISTS text_fail_why text CHECK (text_fail_why IS NULL OR char_length(text_fail_why) <= 300);
COMMENT ON COLUMN public.receipt_requests.text_tries IS 'How many times the first text was tried and turned away. At three the sweep stops trying and the Team queue''s line says the text did not go.';
COMMENT ON COLUMN public.receipt_requests.text_fail_why IS 'Why the last try of the first text did not go, in the sender''s own words.';
CREATE INDEX IF NOT EXISTS receipt_requests_remind_idx ON public.receipt_requests (texted_at)
  WHERE texted_at IS NOT NULL AND reminded_at IS NULL AND answered_at IS NULL AND closed_at IS NULL;

-- 2. The switch, off as it ships.
INSERT INTO public.app_settings (key, value_text)
VALUES ('receipt_texts_v1', '{"on":false}')
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS master_or_dev_update_receipt_texts ON public.app_settings;
CREATE POLICY master_or_dev_update_receipt_texts ON public.app_settings
  FOR UPDATE TO authenticated
  USING (key = 'receipt_texts_v1' AND public.is_master_or_dev())
  WITH CHECK (key = 'receipt_texts_v1' AND public.is_master_or_dev());

-- 3. Whether the sweep has anything to do. A setting that does not read is off: a doubt never sends a text.
CREATE OR REPLACE FUNCTION public.receipt_texts_due()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_setting jsonb;
  v_since timestamptz;
  v_floor timestamptz;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.app_settings s WHERE s.key = 'messages_texts_on_v1' AND s.value_text = 'true') THEN
    RETURN false;
  END IF;
  BEGIN
    SELECT s.value_text::jsonb INTO v_setting FROM public.app_settings s WHERE s.key = 'receipt_texts_v1';
    IF v_setting IS NULL OR (v_setting ->> 'on') IS DISTINCT FROM 'true' THEN
      RETURN false;
    END IF;
    v_since := (v_setting ->> 'since')::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;
  IF v_since IS NULL THEN
    RETURN false;
  END IF;
  v_floor := greatest(v_since, now() - interval '48 hours');

  RETURN
    -- A card purchase that posted since the floor with no request and no ticket.
    EXISTS (
      SELECT 1 FROM public.mercury_transactions t
      WHERE t.posted_at >= v_floor
        AND t.kind IN ('debitCardTransaction', 'creditCardTransaction')
        AND t.amount < 0
        AND t.duplicate_of_transaction_id IS NULL
        AND lower(t.status) NOT IN ('failed', 'cancelled', 'canceled', 'reversed')
        AND NOT EXISTS (SELECT 1 FROM public.receipt_requests r WHERE r.mercury_transaction_id = t.id)
        AND NOT EXISTS (SELECT 1 FROM public.counter_tickets k WHERE k.mercury_transaction_id = t.id AND k.removed_at IS NULL)
    )
    -- A request that waits for its first text.
    OR EXISTS (
      SELECT 1 FROM public.receipt_requests r
      JOIN public.mercury_transactions t ON t.id = r.mercury_transaction_id
      WHERE t.posted_at >= v_floor
        AND r.texted_at IS NULL AND r.no_text_why IS NULL AND r.answered_at IS NULL AND r.closed_at IS NULL
        AND r.text_tries < 3
    )
    -- A reminder in its window: six to nine in the evening, at least twelve hours after the text.
    OR (
      extract(hour FROM now() AT TIME ZONE 'America/Chicago') BETWEEN 18 AND 20
      AND EXISTS (
        SELECT 1 FROM public.receipt_requests r
        WHERE r.texted_at IS NOT NULL AND r.texted_at <= now() - interval '12 hours'
          AND r.reminded_at IS NULL AND r.answered_at IS NULL AND r.closed_at IS NULL AND r.no_text_why IS NULL
          AND r.closes_at > now()
      )
    )
    -- An open request whose charge the bank failed or took back.
    OR EXISTS (
      SELECT 1 FROM public.receipt_requests r
      JOIN public.mercury_transactions t ON t.id = r.mercury_transaction_id
      WHERE r.answered_at IS NULL AND r.closed_at IS NULL AND r.closes_at > now()
        AND lower(t.status) IN ('failed', 'cancelled', 'canceled', 'reversed')
    );
END
$$;
REVOKE ALL ON FUNCTION public.receipt_texts_due() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.receipt_texts_due() TO service_role;
COMMENT ON FUNCTION public.receipt_texts_due() IS
  'Receipt texts (punch list #299): whether the receipt-request sweep has anything to do. False while Send texts or the receipt texts switch (app_settings receipt_texts_v1) is off, or its value does not read. The cron reads it before it calls the function.';

-- 4. The cron: unscheduled first, so a second run leaves one row.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'receipt-request';

SELECT cron.schedule(
  'receipt-request',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/receipt-request',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id
  WHERE public.receipt_texts_due();
  $$
);
