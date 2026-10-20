SET lock_timeout = '3s';

-- Messages, residential R6 (two boxes, two numbers, one inbox: to-dos/gc-mode/messages/RESIDENTIAL_BUILD_PLAN.md → R6 on
-- branch spike/gc-mode; the kernel is src/lib/messages/boxes.ts, v2.5418). The office answers the plumbing company's
-- customers from the team box and the GC side's trades from bids@, each with its own number, and reads both in one
-- inbox. This is the SQL. Nothing reads a second mailbox or texts from a second number until R6's reader PR and
-- quo-webhook's PR are deployed and the boxes are filled in Settings.
--
--   * messages gains mailbox: the box a call, a voicemail, a missed call, a text or an email came in on or went out
--     from, team or bids. Null on a note, an event or a portal line, and where the box is not known: boxes.ts then
--     reads the number or the address it came to, and else the contact's kind. Lines that came through a box today
--     are backfilled: an email the bids@ reader took (gmail_id) is bids, a call or a text on the company number
--     (quo_id) is team. Nobody signed in writes it.
--   * quo_write_line and email_write_line, recreated from their newest definitions (20261012170000_quo_messages.sql,
--     20261013080000_messages_email_in.sql), carry mailbox from the row. While the functions do not send it yet, a Quo
--     line is team (today's one number is the company number) and an email is bids (today's one reader is bids@).
--   * contact_channels gains opted_out_by_box: a STOP per box, {"team": <when>, "bids": null}, since a carrier scopes a
--     STOP to the pair of numbers and one opted_out_at cannot say which of ours it stopped. A box with a stamp is
--     stopped; null is a START to that box; no entry reads the older opted_out_at, which stops every box. Only on a
--     phone, and only the service role writes it, as opted_out_at.
--   * contacts_fold keeps a STOP to either box when two contacts with the same number fold
--     (contact_channels_keep_stops).
--   * app_settings messages_boxes_v1: {"team": {address, phone, numberId}, "bids": {...}}, every field empty to start,
--     so no address is written in the repo and team@ or office@ is the owner's answer typed into Settings. The
--     functions fall back to today's secrets while a field is empty. Only the owner or a dev changes it.
--   * gmail_sync_state: one row per box, keyed by mailbox. Today's row is bids. Its old key, id, stays true on the bids
--     row alone, so the deployed gmail-sync (.eq('id', true)) finds its row until R6's reader PR reads by mailbox; a
--     later migration drops it. No team row here: the reader writes it on its first run.

-- ---------- the box a line came through ----------

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS mailbox text;

COMMENT ON COLUMN public.messages.mailbox IS
  'Messages (R6): the box a call, voicemail, missed call, text or email came in on or went out from: team (the company''s own customers'' box and number) or bids (bids@ and its number). Null on a note, an event or a portal line, and where not known.';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_mailbox_known' AND conrelid = 'public.messages'::regclass) THEN
    ALTER TABLE public.messages ADD CONSTRAINT messages_mailbox_known
      CHECK (mailbox IS NULL OR (mailbox IN ('team', 'bids') AND channel IN ('call', 'voicemail', 'missed', 'text', 'email'))) NOT VALID;
  END IF;
END $$;

-- The lines that came through a box before there were two. An event the webhook keys beside its line carries a quo_id
-- too, and stays null with the other team lines.
UPDATE public.messages
SET mailbox = CASE WHEN gmail_id IS NOT NULL THEN 'bids' ELSE 'team' END
WHERE mailbox IS NULL
  AND (gmail_id IS NOT NULL OR quo_id IS NOT NULL)
  AND channel IN ('call', 'voicemail', 'missed', 'text', 'email');

ALTER TABLE public.messages VALIDATE CONSTRAINT messages_mailbox_known;

-- ---------- the writers carry it ----------

-- Writes the line the kernels merged (p_row: messages columns by name, as jsonb) under p_quo_id. p_rev is the quo_rev
-- the webhook read, or null when it found no line. Written only when the row is still as read: no row for a null
-- p_rev, the same quo_rev otherwise. Else nothing changes and written is false: the webhook reads the line again,
-- merges again, and writes again. R6: the line's mailbox from the row, else the one it has, else team, today's one
-- number.
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
        optout_line, quo_id, recording_url, transcript, summary, duration_seconds, delivery, quo_rev, mailbox)
      VALUES (
        r.contact_id, r.channel_id, r.bid_id, r.project_id, r.jobs_ledger_id, r.channel, r.direction, r.who_user_id,
        coalesce(r.who_text, ''), coalesce(r.at, clock_timestamp()), coalesce(r.body, ''), r.optout_line, p_quo_id,
        r.recording_url, r.transcript, r.summary, r.duration_seconds, r.delivery, 1,
        CASE WHEN r.channel IN ('call', 'voicemail', 'missed', 'text', 'email') THEN coalesce(r.mailbox, 'team') END)
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
        mailbox = CASE WHEN r.channel IN ('call', 'voicemail', 'missed', 'text', 'email') THEN coalesce(r.mailbox, m.mailbox, 'team') END
      WHERE m.quo_id = p_quo_id AND m.quo_rev = p_rev
      RETURNING true, m.id, m.quo_rev;
  END IF;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::integer;
  END IF;
END
$$;

-- The line by its Gmail id (p_row: messages columns by name, as jsonb; its channel is always email), each file and link
-- in order (p_files: a jsonb array of message_attachments columns by name), and, on a forwarded copy, the forwarder's
-- note as a team note on the same contact (p_note: who_user_id or who_text, at and body, or null). All or nothing,
-- once: a Gmail id already written writes nothing, and the answer is the line it has, with written false. R6: the
-- line's mailbox from the row, else bids, today's one reader.
CREATE OR REPLACE FUNCTION public.email_write_line(p_gmail_id text, p_row jsonb, p_files jsonb DEFAULT '[]'::jsonb, p_note jsonb DEFAULT NULL)
RETURNS TABLE (written boolean, id uuid)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  r public.messages;
  n public.messages;
  v_id uuid;
BEGIN
  IF coalesce(btrim(p_gmail_id), '') = '' THEN
    RAISE EXCEPTION 'An email needs its Gmail id.';
  END IF;
  r := jsonb_populate_record(NULL::public.messages, p_row);
  INSERT INTO public.messages AS m (
    contact_id, channel_id, bid_id, project_id, jobs_ledger_id, channel, direction, who_user_id, who_text, at,
    subject, body, gmail_id, gmail_thread_id, mailbox)
  VALUES (
    r.contact_id, r.channel_id, r.bid_id, r.project_id, r.jobs_ledger_id, 'email', r.direction, r.who_user_id,
    coalesce(r.who_text, ''), coalesce(r.at, clock_timestamp()), r.subject, coalesce(r.body, ''), p_gmail_id,
    r.gmail_thread_id, coalesce(r.mailbox, 'bids'))
  ON CONFLICT (gmail_id) DO NOTHING
  RETURNING m.id INTO v_id;
  IF v_id IS NULL THEN
    RETURN QUERY SELECT false, m.id FROM public.messages m WHERE m.gmail_id = p_gmail_id;
    RETURN;
  END IF;
  INSERT INTO public.message_attachments (
    message_id, sort_order, kind, name, mime, size_bytes, bucket_path, left_in_gmail, gmail_attachment_id, url, host, paper)
  SELECT v_id, (f.ord - 1)::integer, a.kind, a.name, a.mime, a.size_bytes, a.bucket_path, a.left_in_gmail,
    a.gmail_attachment_id, a.url, a.host, a.paper
  FROM jsonb_array_elements(coalesce(p_files, '[]'::jsonb)) WITH ORDINALITY AS f(value, ord)
  CROSS JOIN LATERAL jsonb_populate_record(NULL::public.message_attachments, f.value) AS a;
  IF p_note IS NOT NULL THEN
    n := jsonb_populate_record(NULL::public.messages, p_note);
    INSERT INTO public.messages (contact_id, channel, direction, who_user_id, who_text, at, body)
    VALUES (r.contact_id, 'note', 'team', n.who_user_id, coalesce(n.who_text, ''), coalesce(n.at, r.at, clock_timestamp()), coalesce(n.body, ''));
  END IF;
  RETURN QUERY SELECT true, v_id;
END
$$;

-- ---------- a STOP per box ----------

ALTER TABLE public.contact_channels
  ADD COLUMN IF NOT EXISTS opted_out_by_box jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.contact_channels.opted_out_by_box IS
  'Messages (R6): a STOP per box of ours, {"team": <when they stopped>, "bids": null}. A stamp: that box may not text this number. Null: a START to that box. No entry: opted_out_at decides, which stops every box. Only on a phone; the service role writes it.';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contact_channels_stop_by_box_known' AND conrelid = 'public.contact_channels'::regclass) THEN
    ALTER TABLE public.contact_channels ADD CONSTRAINT contact_channels_stop_by_box_known CHECK (
      jsonb_typeof(opted_out_by_box) = 'object'
      AND opted_out_by_box - 'team' - 'bids' = '{}'::jsonb
      AND coalesce(jsonb_typeof(opted_out_by_box -> 'team'), 'null') IN ('string', 'null')
      AND coalesce(jsonb_typeof(opted_out_by_box -> 'bids'), 'null') IN ('string', 'null')
      AND (kind = 'phone' OR opted_out_by_box = '{}'::jsonb)
    ) NOT VALID;
  END IF;
END $$;
ALTER TABLE public.contact_channels VALIDATE CONSTRAINT contact_channels_stop_by_box_known;

-- When a fold keeps one of two copies of a number, the copy kept takes the other's STOP to a box it does not stop
-- itself. A box either copy stops stays stopped, and nothing is ever started: the copy kept gains stamps, never a null.
-- A box with no entry reads opted_out_at, as boxes.ts's stoppedOn does. Only two copies of one phone number, and the
-- fold never deletes a copy whose opted_out_at the kept one lacks. A definer, since nobody signed in writes a STOP:
-- outside a trigger, a call from someone signed in who is not on the office team, or is a twin, changes nothing, as the
-- fold's own statements change nothing for them (contacts_fold_quick_replies's guard).
CREATE OR REPLACE FUNCTION public.contact_channels_keep_stops(p_keep uuid, p_gone uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_add jsonb;
BEGIN
  IF p_keep IS NULL OR p_gone IS NULL OR p_keep = p_gone THEN
    RETURN;
  END IF;
  IF auth.uid() IS NOT NULL AND pg_trigger_depth() = 0 AND (NOT public.gc_office_team() OR public.is_digital_twin()) THEN
    RETURN;
  END IF;
  SELECT jsonb_object_agg(b.box, e.gone_stop) INTO v_add
  FROM public.contact_channels k
  JOIN public.contact_channels g ON g.id = p_gone AND g.kind = k.kind AND g.key = k.key
  CROSS JOIN (VALUES ('team'), ('bids')) AS b(box)
  CROSS JOIN LATERAL (
    SELECT
      CASE WHEN k.opted_out_by_box ? b.box THEN k.opted_out_by_box -> b.box ELSE to_jsonb(k.opted_out_at) END AS keep_stop,
      CASE WHEN g.opted_out_by_box ? b.box THEN g.opted_out_by_box -> b.box ELSE to_jsonb(g.opted_out_at) END AS gone_stop
  ) e
  WHERE k.id = p_keep AND k.kind = 'phone'
    AND jsonb_typeof(e.keep_stop) IS DISTINCT FROM 'string' AND jsonb_typeof(e.gone_stop) = 'string';
  IF v_add IS NOT NULL THEN
    UPDATE public.contact_channels SET opted_out_by_box = opted_out_by_box || v_add WHERE id = p_keep;
  END IF;
END;
$$;

-- p_from's thread, numbers, addresses and jobs move onto p_into, and p_from goes. A number both have keeps the copy that
-- says STOP, else p_into's, and the copy kept takes the other's STOP to either box (contact_channels_keep_stops).
-- p_into keeps its star, else takes p_from's; its goes-by, else p_from's. Its name is never changed: the name says which
-- person on a company's row it is. Used by name_contact, merge_customers and the spine's delete trigger.
--
-- A later cut's rows on a contact (cut 2's what we owe, cut 4's notes and nudges) move through a function of its own
-- named contacts_fold_<something>(p_from uuid, p_into uuid) RETURNS void, in the public schema and owned as this one is.
-- The fold runs each of them, in name order, after its own rows and while p_from is still there to read. No cut
-- redefines this function, so the result never depends on the order the cuts merge in. R6 is the one exception, from
-- the spine's definition: a number's STOPs per box live on the copy the fold deletes, which a later hook can no longer
-- read.
CREATE OR REPLACE FUNCTION public.contacts_fold(p_from uuid, p_into uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  r record;
  v_fn name;
BEGIN
  IF p_from IS NULL OR p_into IS NULL OR p_from = p_into THEN
    RETURN;
  END IF;
  FOR r IN
    SELECT f.id AS from_id, t.id AS into_id, (f.opted_out_at IS NOT NULL AND t.opted_out_at IS NULL) AS keep_from
    FROM public.contact_channels f
    JOIN public.contact_channels t ON t.contact_id = p_into AND t.kind = f.kind AND t.key = f.key
    WHERE f.contact_id = p_from
  LOOP
    IF r.keep_from THEN
      PERFORM public.contact_channels_keep_stops(r.from_id, r.into_id);
      UPDATE public.messages SET channel_id = r.from_id WHERE channel_id = r.into_id;
      DELETE FROM public.contact_channels WHERE id = r.into_id;
    ELSE
      PERFORM public.contact_channels_keep_stops(r.into_id, r.from_id);
      UPDATE public.messages SET channel_id = r.into_id WHERE channel_id = r.from_id;
      DELETE FROM public.contact_channels WHERE id = r.from_id;
    END IF;
  END LOOP;
  UPDATE public.contact_channels SET contact_id = p_into WHERE contact_id = p_from;
  UPDATE public.messages SET contact_id = p_into WHERE contact_id = p_from;

  IF NOT EXISTS (SELECT 1 FROM public.contact_jobs WHERE contact_id = p_into AND is_default) THEN
    -- p_from's star becomes theirs, on their own copy of that job when they have one.
    UPDATE public.contact_jobs t SET is_default = true
    FROM public.contact_jobs f
    WHERE f.contact_id = p_from AND f.is_default AND t.contact_id = p_into
      AND t.bid_id IS NOT DISTINCT FROM f.bid_id AND t.project_id IS NOT DISTINCT FROM f.project_id
      AND t.jobs_ledger_id IS NOT DISTINCT FROM f.jobs_ledger_id;
  END IF;
  DELETE FROM public.contact_jobs f
  WHERE f.contact_id = p_from
    AND EXISTS (
      SELECT 1 FROM public.contact_jobs t
      WHERE t.contact_id = p_into AND t.bid_id IS NOT DISTINCT FROM f.bid_id AND t.project_id IS NOT DISTINCT FROM f.project_id
        AND t.jobs_ledger_id IS NOT DISTINCT FROM f.jobs_ledger_id);
  IF EXISTS (SELECT 1 FROM public.contact_jobs WHERE contact_id = p_into AND is_default) THEN
    UPDATE public.contact_jobs SET is_default = false WHERE contact_id = p_from AND is_default;
  END IF;
  UPDATE public.contact_jobs SET contact_id = p_into WHERE contact_id = p_from;

  UPDATE public.contacts t SET goes_by = f.goes_by
  FROM public.contacts f
  WHERE t.id = p_into AND f.id = p_from AND t.goes_by IS NULL AND f.goes_by IS NOT NULL;
  -- Every later cut's rows on a contact, by its own contacts_fold_<something>, while p_from is still there to read. Only
  -- a function of the fold's own owner, with the fold's two uuids, returning nothing, is run.
  FOR v_fn IN
    SELECT p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND starts_with(p.proname, 'contacts_fold_')
      -- Two uuids, counted without comparing arrays: an oidvector counts from 0, so it never equals an ARRAY[...].
      AND p.pronargs = 2 AND 'uuid'::regtype::oid = ALL (p.proargtypes::oid[])
      AND p.prorettype = 'void'::regtype
      AND p.proowner = (SELECT f.proowner FROM pg_proc f WHERE f.oid = 'public.contacts_fold(uuid, uuid)'::regprocedure)
    ORDER BY p.proname
  LOOP
    EXECUTE format('SELECT public.%I($1, $2)', v_fn) USING p_from, p_into;
  END LOOP;
  DELETE FROM public.contacts WHERE id = p_from;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.contact_channels_keep_stops(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contact_channels_keep_stops(uuid, uuid) TO authenticated, service_role;

-- ---------- the two boxes, in Settings ----------

-- Every field empty: the addresses are the owner's to type, never the repo's. quo-send, quo-webhook and gmail-sync fall
-- back to today's secrets while a field is empty (team: QUO_COMPANY_MAILBOX, QUO_COMPANY_PHONE, QUO_PHONE_NUMBER_ID;
-- bids: GMAIL_IMPERSONATE_USER). Every signed-in user reads app_settings already; an address, a number and Quo's id
-- for it are not secrets.
INSERT INTO public.app_settings (key, value_text)
VALUES ('messages_boxes_v1', '{"team":{"address":"","phone":"","numberId":""},"bids":{"address":"","phone":"","numberId":""}}')
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS master_or_dev_update_messages_boxes ON public.app_settings;
CREATE POLICY master_or_dev_update_messages_boxes ON public.app_settings
  FOR UPDATE TO authenticated
  USING (key = 'messages_boxes_v1' AND public.is_master_or_dev())
  WITH CHECK (key = 'messages_boxes_v1' AND public.is_master_or_dev());

-- ---------- the reader's place, one row per box ----------

ALTER TABLE public.gmail_sync_state
  ADD COLUMN IF NOT EXISTS mailbox text;

-- Today's row is the bids@ reader's.
UPDATE public.gmail_sync_state SET mailbox = 'bids' WHERE mailbox IS NULL;

ALTER TABLE public.gmail_sync_state ALTER COLUMN mailbox SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gmail_sync_state_mailbox_known' AND conrelid = 'public.gmail_sync_state'::regclass) THEN
    ALTER TABLE public.gmail_sync_state ADD CONSTRAINT gmail_sync_state_mailbox_known CHECK (mailbox IN ('team', 'bids'));
  END IF;
  -- The key moves from the one-row flag to the box.
  IF NOT EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
    WHERE i.indrelid = 'public.gmail_sync_state'::regclass AND i.indisprimary AND a.attname = 'mailbox'
  ) THEN
    ALTER TABLE public.gmail_sync_state DROP CONSTRAINT IF EXISTS gmail_sync_state_pkey;
    ALTER TABLE public.gmail_sync_state ADD CONSTRAINT gmail_sync_state_pkey PRIMARY KEY (mailbox);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gmail_sync_state_id_is_bids' AND conrelid = 'public.gmail_sync_state'::regclass) THEN
    ALTER TABLE public.gmail_sync_state ADD CONSTRAINT gmail_sync_state_id_is_bids CHECK (id IS NULL OR (id AND mailbox = 'bids'));
  END IF;
END $$;

ALTER TABLE public.gmail_sync_state DROP CONSTRAINT IF EXISTS gmail_sync_state_one_row;
ALTER TABLE public.gmail_sync_state ALTER COLUMN id DROP NOT NULL;
ALTER TABLE public.gmail_sync_state ALTER COLUMN id DROP DEFAULT;

COMMENT ON COLUMN public.gmail_sync_state.mailbox IS
  'Messages (R6): the box this reader''s row is for, team or bids. The key: one row per box.';
COMMENT ON COLUMN public.gmail_sync_state.id IS
  'Messages (cut 6): the old one-row key, true on the bids row alone so the gmail-sync deployed before R6 finds its row. Dropped once the reader reads by mailbox.';
COMMENT ON TABLE public.gmail_sync_state IS
  'Messages (cut 6, R6): the reader''s row per box (mailbox): where it reads from in Gmail''s history, its label, and its health (last_run_at, last_ok_at, last_error, last_taken). A run that fails sets last_error and leaves last_ok_at. The office team reads it; the gmail-sync function writes it.';
