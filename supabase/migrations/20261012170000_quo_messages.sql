SET lock_timeout = '3s';

-- Messages, cut 5, the Quo link (to-dos/gc-mode/messages/BUILD_PLAN.md and BUILD_HELPERS.md on branch spike/gc-mode; the
-- kernels are src/lib/quo/events.ts, send.ts and webhook.ts, v2.5261, v2.5266 and v2.5268): calls and texts from the
-- company number land in a person's thread. The spine (20261012010000_messages_spine.sql) made the messages table; this
-- adds what a call or a text from Quo carries, and the webhook's memory of the deliveries it took.
--
--   * messages gains quo_id: the message's id, or the call's for every event of the call, or on a group text from
--     Quo's app the id and the number. Unique, so the webhook writes a line with one upsert however many times Quo sends
--     the event, and our own send and Quo's delivery event end on the same row. recording_url, transcript, summary and
--     duration_seconds belong to a call, a voicemail or a missed call. delivery is how a text of ours ended
--     (delivered, undelivered, failed). quo_rev counts the webhook's writes to a line.
--   * quo_write_line is the webhook's one write: the line the kernels merged, written only when the row is as the
--     webhook read it (its quo_rev), else nothing, and the webhook reads it again and merges again. Two of Quo's events
--     for one call can arrive at once; this way neither writes over what the other added.
--   * quo_webhook_ids: the webhook-id of each delivery the quo-webhook function took in the last 28 hours (Quo retries
--     a failed one for about 27 and a half). quo_webhook_claim takes one, false when it was taken already;
--     quo_webhook_release gives one back after a failure so Quo's retry is taken; quo_webhook_ids_forget drops the ones
--     past 28 hours.
--   * Only the service role writes any of it: the webhook. The office reads the new columns as it reads messages (the
--     spine's policy and its SELECT grant). quo_webhook_ids holds nothing for anyone signed in.

-- ---------- what a call or a text from Quo carries ----------

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS quo_id text,
  ADD COLUMN IF NOT EXISTS recording_url text,
  ADD COLUMN IF NOT EXISTS transcript text,
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS duration_seconds integer,
  ADD COLUMN IF NOT EXISTS delivery text,
  ADD COLUMN IF NOT EXISTS quo_rev integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.messages.quo_id IS
  'Messages (cut 5): Quo''s id for this line. A message''s id, or a call''s for every event of the call; a group text from Quo''s app is the id and the number. Unique: the webhook upserts by it.';
COMMENT ON COLUMN public.messages.recording_url IS 'Messages (cut 5): where Quo keeps the call''s or the voicemail''s recording.';
COMMENT ON COLUMN public.messages.transcript IS 'Messages (cut 5): the call''s transcript, one turn a line, or the voicemail''s words.';
COMMENT ON COLUMN public.messages.summary IS 'Messages (cut 5): Quo''s summary of the call, its next steps after it.';
COMMENT ON COLUMN public.messages.duration_seconds IS 'Messages (cut 5): a call''s length, or a voicemail''s own, in seconds.';
COMMENT ON COLUMN public.messages.delivery IS
  'Messages (cut 5): how a text of ours ended, as Quo reported it: delivered, undelivered or failed. Delivered wins once a carrier said so.';
COMMENT ON COLUMN public.messages.quo_rev IS
  'Messages (cut 5): how many times quo_write_line wrote this line. The webhook writes only over the revision it read.';

-- A plain unique index, not a partial one: an upsert's ON CONFLICT (quo_id) needs it whole, and the lines with no Quo
-- id (notes, events, email) are nulls, which never collide.
CREATE UNIQUE INDEX IF NOT EXISTS messages_quo_id_key ON public.messages (quo_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_delivery_known' AND conrelid = 'public.messages'::regclass) THEN
    ALTER TABLE public.messages ADD CONSTRAINT messages_delivery_known
      CHECK (delivery IN ('delivered', 'undelivered', 'failed')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_delivery_on_texts' AND conrelid = 'public.messages'::regclass) THEN
    ALTER TABLE public.messages ADD CONSTRAINT messages_delivery_on_texts
      CHECK (delivery IS NULL OR (channel = 'text' AND direction = 'out')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_call_columns_on_calls' AND conrelid = 'public.messages'::regclass) THEN
    ALTER TABLE public.messages ADD CONSTRAINT messages_call_columns_on_calls
      CHECK (num_nonnulls(recording_url, transcript, summary, duration_seconds) = 0 OR channel IN ('call', 'voicemail', 'missed')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_duration_known' AND conrelid = 'public.messages'::regclass) THEN
    ALTER TABLE public.messages ADD CONSTRAINT messages_duration_known
      CHECK (duration_seconds >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_quo_id_usable' AND conrelid = 'public.messages'::regclass) THEN
    ALTER TABLE public.messages ADD CONSTRAINT messages_quo_id_usable
      CHECK (quo_id IS NULL OR btrim(quo_id) <> '') NOT VALID;
  END IF;
END $$;
ALTER TABLE public.messages VALIDATE CONSTRAINT messages_delivery_known;
ALTER TABLE public.messages VALIDATE CONSTRAINT messages_delivery_on_texts;
ALTER TABLE public.messages VALIDATE CONSTRAINT messages_call_columns_on_calls;
ALTER TABLE public.messages VALIDATE CONSTRAINT messages_duration_known;
ALTER TABLE public.messages VALIDATE CONSTRAINT messages_quo_id_usable;

-- ---------- the webhook's one write ----------

-- Writes the line the kernels merged (p_row: messages columns by name, as jsonb) under p_quo_id. p_rev is the quo_rev
-- the webhook read, or null when it found no line. Written only when the row is still as read: no row for a null
-- p_rev, the same quo_rev otherwise. Else nothing changes and written is false: the webhook reads the line again,
-- merges again, and writes again.
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
        optout_line, quo_id, recording_url, transcript, summary, duration_seconds, delivery, quo_rev)
      VALUES (
        r.contact_id, r.channel_id, r.bid_id, r.project_id, r.jobs_ledger_id, r.channel, r.direction, r.who_user_id,
        coalesce(r.who_text, ''), coalesce(r.at, clock_timestamp()), coalesce(r.body, ''), r.optout_line, p_quo_id,
        r.recording_url, r.transcript, r.summary, r.duration_seconds, r.delivery, 1)
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
        duration_seconds = r.duration_seconds, delivery = r.delivery, quo_rev = m.quo_rev + 1
      WHERE m.quo_id = p_quo_id AND m.quo_rev = p_rev
      RETURNING true, m.id, m.quo_rev;
  END IF;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::integer;
  END IF;
END
$$;

-- ---------- the deliveries the webhook took ----------

CREATE TABLE IF NOT EXISTS public.quo_webhook_ids (
  -- The delivery's webhook-id header: the same on every retry of it, unlike the event's own id.
  id text PRIMARY KEY
    CONSTRAINT quo_webhook_ids_usable CHECK (btrim(id) <> ''),
  seen_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

COMMENT ON TABLE public.quo_webhook_ids IS
  'Messages (cut 5): the webhook-id of each Quo delivery the quo-webhook function took in the last 28 hours, so one Quo sends again is taken once. The service role''s only: quo_webhook_claim, quo_webhook_release, quo_webhook_ids_forget.';

CREATE INDEX IF NOT EXISTS quo_webhook_ids_seen ON public.quo_webhook_ids (seen_at);

-- RLS with no policy: nobody signed in reads or writes it. The service role passes RLS.
ALTER TABLE public.quo_webhook_ids ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.quo_webhook_ids FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.quo_webhook_ids TO service_role;

-- Drops the ids taken longer ago than p_keep (28 hours, as webhook.ts's QUO_SEEN_KEEP_HOURS) and says how many went.
CREATE OR REPLACE FUNCTION public.quo_webhook_ids_forget(p_keep interval DEFAULT interval '28 hours')
RETURNS integer
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH gone AS (
    DELETE FROM public.quo_webhook_ids WHERE seen_at < clock_timestamp() - p_keep RETURNING 1
  )
  SELECT count(*)::integer FROM gone
$$;

-- Takes a delivery: true when it is new, false when it was taken in the last 28 hours. An id older than that is taken
-- again, as webhook.ts's seenBefore says. The insert is the lock, so two copies arriving at once are taken once.
CREATE OR REPLACE FUNCTION public.quo_webhook_claim(p_id text)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_rows integer;
BEGIN
  IF coalesce(btrim(p_id), '') = '' THEN
    RAISE EXCEPTION 'A Quo delivery needs its webhook-id.';
  END IF;
  DELETE FROM public.quo_webhook_ids WHERE id = p_id AND seen_at < clock_timestamp() - interval '28 hours';
  INSERT INTO public.quo_webhook_ids (id) VALUES (p_id) ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows = 1;
END
$$;

-- Gives a delivery back after a failure, before the webhook answers 500, so Quo's retry is taken as new.
CREATE OR REPLACE FUNCTION public.quo_webhook_release(p_id text)
RETURNS boolean
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH gone AS (DELETE FROM public.quo_webhook_ids WHERE id = p_id RETURNING 1)
  SELECT count(*) = 1 FROM gone
$$;

REVOKE EXECUTE ON FUNCTION public.quo_write_line(text, integer, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.quo_write_line(text, integer, jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION public.quo_webhook_ids_forget(interval) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.quo_webhook_ids_forget(interval) TO service_role;
REVOKE EXECUTE ON FUNCTION public.quo_webhook_claim(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.quo_webhook_claim(text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.quo_webhook_release(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.quo_webhook_release(text) TO service_role;

-- The house fences on the new table: training mode and digital twins write nothing.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
