SET lock_timeout = '3s';

-- Punch list #85 item 26 (v2.4632): the firm's emails are stamped per person, retried, and shown
-- when they fail; each person's "Stop these emails" link is minted once.
--
-- legal_notification_queue.sent_to — one entry per person who was to hear the event, frozen on
--   its first tick: { "<recipient id>": { at | tries, error, last, gaveUp | skipped } }. The
--   dispatcher stamps sent_now_at only once every entry is sent, given up (12 tries, an hour of
--   five-minute ticks) or skipped. Before this a bounced "New account referred" was never retried.
-- legal_firm_recipients.send_failed_since / send_error — set by a failed send (the first failure's
--   time is kept), cleared by the next one that goes through. The desk's Firm's emails and the
--   firm's Notifications page read them: "Could not reach x since date".
-- legal_firm_recipients.unsubscribe_salt — the input that makes a person's stop token; a new salt
--   (when they turn emails back on) is the only rotation, so every email's stop link keeps working.
--
-- Additive, nullable or constant-default columns: no table rewrite, no new table.

ALTER TABLE public.legal_notification_queue ADD COLUMN IF NOT EXISTS sent_to jsonb NOT NULL DEFAULT '{}'::jsonb;
COMMENT ON COLUMN public.legal_notification_queue.sent_to IS 'Per-person ledger for the "now" lane (v2.4632): {"<recipient id>": {"at": iso} | {"tries": n, "error": text, "last": iso, "gaveUp": bool} | {"skipped": text}}. Frozen on the first tick; sent_now_at is stamped once every entry is settled.';

ALTER TABLE public.legal_firm_recipients ADD COLUMN IF NOT EXISTS send_failed_since timestamptz;
ALTER TABLE public.legal_firm_recipients ADD COLUMN IF NOT EXISTS send_error text;
ALTER TABLE public.legal_firm_recipients ADD COLUMN IF NOT EXISTS unsubscribe_salt text;
COMMENT ON COLUMN public.legal_firm_recipients.send_failed_since IS 'When emails to this person began failing (v2.4632); NULL once one goes through.';
COMMENT ON COLUMN public.legal_firm_recipients.send_error IS 'The mail service''s last refusal for this person (v2.4632); NULL once one goes through.';
COMMENT ON COLUMN public.legal_firm_recipients.unsubscribe_salt IS 'Salt for the person''s stop token, an HMAC minted by legal-notify-dispatch (v2.4632); rotated only when they turn emails back on. The token itself is never stored; unsubscribe_token_hash holds its SHA-256.';
