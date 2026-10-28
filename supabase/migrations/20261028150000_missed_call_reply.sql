SET lock_timeout = '3s';

-- Punch list #195 PR 1 (v2.6012): a missed call gets a text back from the app. When nobody picks up a call to one of
-- our numbers, quo-webhook texts the caller back from that number with the office's words (src/lib/quo/missedReply.ts),
-- through every gate the app's texts already have. The text is the app's own line, so it must neither clear Needs a
-- reply nor start Waiting on them: the row still waits on the office.
--
--   * messages.auto: true on a line the app sent on its own with nobody pressing Send. messages_move_state skips such a
--     line, and a later one never hides a line of theirs: the conversation stays open and whoever has it keeps it.
--   * quo_write_line writes and keeps the column, so the webhook's merge of Quo's delivery event keeps the mark.
--   * app_settings messages_missed_call_reply_v1: the card's switch (off as it ships) and the three lines, in office
--     hours, after hours and with a voicemail, as JSON. The owner or a dev updates it (is_master_or_dev()), everyone
--     signed in reads it, and the webhook reads it as the service role.
--   * missed_call_replies: one row per call, keyed by the call's Quo id, so a call that sends three events is answered
--     once and Quo's retry answers nothing twice. The row keeps the contact, the number, the line it wrote, the outcome
--     and the reason when nothing went; the office reads it on the card (PR 2), the functions alone write it.
--
-- Idempotent: the column, the row, the table and the index are made only when missing, the functions and the policies
-- are replaced. The messages column takes a default, which Postgres writes without touching the rows.

-- 1. The app's own line.
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS auto boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.messages.auto IS
  'True on a line the app sent on its own, nobody pressing Send (v2.6012, the text back after a missed call). messages_move_state skips it, so it neither closes the conversation nor hides their line; Follow up and the thread read it as nobody''s move.';

-- 2. The trigger skips it. The body is cut 2's (20261012160000_messages_follow_up.sql) with the one clause: an auto
-- line moves nothing, and an auto line after theirs does not stop theirs from opening the conversation.
CREATE OR REPLACE FUNCTION public.messages_move_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.auto THEN
    RETURN NULL;
  END IF;
  IF NEW.direction = 'in' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.contact_id = NEW.contact_id AND m.id <> NEW.id AND ((m.direction = 'out' AND NOT m.auto) OR m.channel = 'note') AND m.at > NEW.at)
    THEN
      UPDATE public.contacts SET state = 'waiting', snoozed_until = NULL
      WHERE id = NEW.contact_id AND (state <> 'waiting' OR snoozed_until IS NOT NULL);
    END IF;
  ELSIF NEW.direction = 'out' OR NEW.channel = 'note' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.contact_id = NEW.contact_id AND m.id <> NEW.id AND m.direction = 'in' AND m.at > NEW.at)
    THEN
      UPDATE public.contacts SET state = 'done', snoozed_until = NULL, has_user_id = NULL, has_since = NULL, has_how = NULL
      WHERE id = NEW.contact_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

-- 3. The webhook's one write carries the mark (R6's body, 20261014003000_messages_two_boxes.sql, plus auto). An insert
-- with no word on it is a person's or Quo's line; an update with none keeps what the line has.
CREATE OR REPLACE FUNCTION public.quo_write_line(p_quo_id text, p_rev integer, p_row jsonb)
RETURNS TABLE (written boolean, id uuid, rev integer)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  r public.messages;
BEGIN
  IF coalesce(btrim(p_quo_id), '') = '' THEN
    RAISE EXCEPTION 'A line from Quo needs its Quo id.';
  END IF;
  r := jsonb_populate_record(NULL::public.messages, p_row);
  IF p_rev IS NULL THEN
    RETURN QUERY
      INSERT INTO public.messages AS m (
        contact_id, channel_id, bid_id, project_id, jobs_ledger_id, channel, direction, who_user_id, who_text, at, body,
        optout_line, quo_id, recording_url, transcript, summary, duration_seconds, delivery, quo_rev, mailbox, auto)
      VALUES (
        r.contact_id, r.channel_id, r.bid_id, r.project_id, r.jobs_ledger_id, r.channel, r.direction, r.who_user_id,
        coalesce(r.who_text, ''), coalesce(r.at, clock_timestamp()), coalesce(r.body, ''), r.optout_line, p_quo_id,
        r.recording_url, r.transcript, r.summary, r.duration_seconds, r.delivery, 1,
        CASE WHEN r.channel IN ('call', 'voicemail', 'missed', 'text', 'email') THEN coalesce(r.mailbox, 'team') END,
        coalesce(r.auto, false))
      ON CONFLICT (quo_id) DO NOTHING
      RETURNING true, m.id, m.quo_rev;
  ELSE
    RETURN QUERY
      UPDATE public.messages AS m SET
        contact_id = r.contact_id, channel_id = r.channel_id,
        bid_id = r.bid_id, project_id = r.project_id, jobs_ledger_id = r.jobs_ledger_id,
        channel = r.channel, direction = r.direction, who_user_id = r.who_user_id, who_text = coalesce(r.who_text, ''),
        at = coalesce(r.at, m.at), body = coalesce(r.body, ''), optout_line = r.optout_line,
        recording_url = r.recording_url, transcript = r.transcript, summary = r.summary,
        duration_seconds = r.duration_seconds, delivery = r.delivery, quo_rev = m.quo_rev + 1,
        mailbox = CASE WHEN r.channel IN ('call', 'voicemail', 'missed', 'text', 'email') THEN coalesce(r.mailbox, m.mailbox, 'team') END,
        auto = coalesce(r.auto, m.auto)
      WHERE m.quo_id = p_quo_id AND m.quo_rev = p_rev
      RETURNING true, m.id, m.quo_rev;
  END IF;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::integer;
  END IF;
END
$$;

-- 4. The card's row: off as it ships, with the owner's three lines (2026-10-28). The owner or a dev changes it from
-- Settings → Phone and texts → Missed calls, keyed to this row alone, the way Send texts is (20261014160000).
INSERT INTO public.app_settings (key, value_text)
VALUES (
  'messages_missed_call_reply_v1',
  '{"on":false,"inHours":"Sorry we missed your call. This is Click Plumbing. Text us here and we answer shortly.","afterHours":"Sorry we missed your call. The office opens at 7 AM. Text us here and we answer then.","voicemail":"We got your voicemail and will call you back."}'
)
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS master_or_dev_update_messages_missed_call_reply ON public.app_settings;
CREATE POLICY master_or_dev_update_messages_missed_call_reply ON public.app_settings
  FOR UPDATE TO authenticated
  USING (key = 'messages_missed_call_reply_v1' AND public.is_master_or_dev())
  WITH CHECK (key = 'messages_missed_call_reply_v1' AND public.is_master_or_dev());

-- 5. One answer per call. The webhook claims the call before it decides (an insert that does nothing on a repeat), then
-- writes what it decided: sent, with the line and the text's row, or not sent, with the reason in a word and in words.
-- A row left at claimed is a webhook that fell over between the two, which the card says in so many words.
CREATE TABLE IF NOT EXISTS public.missed_call_replies (
  call_quo_id text PRIMARY KEY CHECK (length(call_quo_id) BETWEEN 1 AND 120),
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  channel_id uuid REFERENCES public.contact_channels(id) ON DELETE SET NULL,
  called_at timestamptz NOT NULL,
  line text CHECK (line IN ('in_hours', 'after_hours', 'voicemail')),
  outcome text NOT NULL DEFAULT 'claimed' CHECK (outcome IN ('claimed', 'sent', 'not_sent')),
  reason text CHECK (length(reason) <= 60),
  words text NOT NULL DEFAULT '' CHECK (length(words) <= 2000),
  message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);
COMMENT ON TABLE public.missed_call_replies IS
  'One row per call nobody answered (v2.6012, punch list #195): quo-webhook claims the call by its Quo id before it texts back, so three events and Quo''s retries answer once, then writes the outcome. The office reads the last ten on Settings → Phone and texts → Missed calls; the functions alone write.';
COMMENT ON COLUMN public.missed_call_replies.line IS 'Which of the three lines went, or would have: in_hours, after_hours, voicemail. Null while nothing was decided.';
COMMENT ON COLUMN public.missed_call_replies.outcome IS 'claimed (the webhook is deciding, or fell over), sent, or not_sent with its reason.';
COMMENT ON COLUMN public.missed_call_replies.reason IS 'The hold in one word when nothing went: texts-off, stopped, no-texts, not-asked, own-number, recent-text, paused, or sendText''s refusal (daily-cap, not-set-up, quo, failed).';
COMMENT ON COLUMN public.missed_call_replies.words IS 'The text that went, or why nothing did, as the card shows it.';
CREATE INDEX IF NOT EXISTS missed_call_replies_claimed_at_idx ON public.missed_call_replies (claimed_at DESC);

ALTER TABLE public.missed_call_replies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS missed_call_replies_office_select ON public.missed_call_replies;
CREATE POLICY missed_call_replies_office_select ON public.missed_call_replies
  FOR SELECT TO authenticated USING (public.gc_office_team());

-- New table: the read-only fences (training mode) and the digital-twin fence.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
