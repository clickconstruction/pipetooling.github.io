SET lock_timeout = '3s';

-- Punch list #223 PR 3 (v2.6222): an invitation to bid is a bid lead. The reader keeps what it read from an
-- invitation on the line (`messages.invitation`), the New lane asks *Bid it?* of such a line, and the sort card's
-- three presses write through two functions here: **Start a bid** makes the bid on the GC with the project's name, the
-- platform's link and the due date, ties the thread to it and says so; **Not for us** keeps the reason on the thread
-- and closes the row; **Keep it** leaves the bid for later. Calls 4 and 6 of the card are taken as it recommends: no
-- bid is made for Not for us, and the rule's estimator holds a Bid it? row (gmail-sync writes that).

-- ---------- the facts on the line ----------

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS invitation jsonb;

COMMENT ON COLUMN public.messages.invitation IS
  'Punch list #223 PR 3 (v2.6222): what the reader read from an invitation to bid (src/lib/emailIn/invitation.ts: kind, project, due, portal, cue), null on every other line. The sort card''s answer lands in the same object under `answer` (what: bid | not_for_us | kept, by, at, reason, bid_id); a line with an answer, or tied to a bid, is no longer asked about.';

-- email_write_line carries the facts: the reader passes `invitation` in p_row, and jsonb_populate_record reads it.
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
  v_rfc text;
BEGIN
  IF coalesce(btrim(p_gmail_id), '') = '' THEN
    RAISE EXCEPTION 'An email needs its Gmail id.';
  END IF;
  r := jsonb_populate_record(NULL::public.messages, p_row);
  v_rfc := nullif(btrim(coalesce(r.rfc_message_id, '')), '');
  -- With no target, the insert stands back on either key: the Gmail id or the Message-ID.
  INSERT INTO public.messages AS m (
    contact_id, channel_id, bid_id, project_id, jobs_ledger_id, channel, direction, who_user_id, who_text, at,
    subject, body, gmail_id, gmail_thread_id, mailbox, rfc_message_id, invitation)
  VALUES (
    r.contact_id, r.channel_id, r.bid_id, r.project_id, r.jobs_ledger_id, 'email', r.direction, r.who_user_id,
    coalesce(r.who_text, ''), coalesce(r.at, clock_timestamp()), r.subject, coalesce(r.body, ''), p_gmail_id,
    r.gmail_thread_id, coalesce(r.mailbox, 'bids'), v_rfc, r.invitation)
  ON CONFLICT DO NOTHING
  RETURNING m.id INTO v_id;
  IF v_id IS NULL THEN
    RETURN QUERY
      SELECT false, m.id FROM public.messages m
      WHERE m.gmail_id = p_gmail_id OR (v_rfc IS NOT NULL AND m.rfc_message_id = v_rfc)
      ORDER BY (m.gmail_id = p_gmail_id) DESC
      LIMIT 1;
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

-- ---------- Start a bid ----------

-- The bid the New Bid form makes, from an invitation's line: the project's name (the card's field, which starts with
-- what the reader read), the GC as its customer (named on the thread by the card before this runs), Plumbing as its
-- service type, the rule's estimator (Who gets a new message's trade seat, which is the estimator's) else the presser
-- as its estimator, the sender as the GC contact, the platform's page in itb_links, and the due day and time on the
-- bid's own GC row (bid_gcs, customer_id null), from which recompute_bid_due sets bids.bid_due_date and _time. The
-- line is tied to the bid and the thread carries the line *Started bid b512 · Oak Hill Clinic*.
CREATE OR REPLACE FUNCTION public.start_bid_from_message(
  p_message_id uuid,
  p_customer_id uuid,
  p_project_name text,
  p_due_date date DEFAULT NULL,
  p_due_time time DEFAULT NULL,
  p_links jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := public.follow_up_press('start a bid');
  v_msg public.messages%ROWTYPE;
  v_project text := left(btrim(coalesce(p_project_name, '')), 120);
  v_customer_name text;
  v_service_type uuid;
  v_estimator uuid;
  v_seat text;
  v_sender_name text;
  v_sender_email text;
  v_links jsonb := '[]'::jsonb;
  v_bid uuid;
  v_number text;
BEGIN
  SELECT * INTO v_msg FROM public.messages WHERE id = p_message_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No line with that id.';
  END IF;
  IF v_msg.direction <> 'in' OR v_msg.channel <> 'email' THEN
    RAISE EXCEPTION 'Only an email that came in starts a bid.' USING ERRCODE = 'P0001';
  END IF;
  IF v_msg.bid_id IS NOT NULL THEN
    RAISE EXCEPTION 'That line is on a bid already.' USING ERRCODE = 'P0001';
  END IF;
  IF v_project = '' THEN
    RAISE EXCEPTION 'The bid needs a name.' USING ERRCODE = 'P0001';
  END IF;
  SELECT name INTO v_customer_name FROM public.customers WHERE id = p_customer_id;
  IF v_customer_name IS NULL THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No customer with that id. Name the sender first.';
  END IF;
  -- Plumbing is the trade the robots and the bids inbox are about; a bid with no service type is left for the form.
  SELECT id INTO v_service_type FROM public.service_types WHERE name ~* 'plumb' ORDER BY sequence_order, name LIMIT 1;
  -- The rule's estimator: the trade seat, which is the estimator's; else whoever pressed.
  SELECT value_text INTO v_seat FROM public.app_settings WHERE key = 'messages_assign_rule_v1';
  BEGIN
    v_estimator := nullif(btrim(coalesce(v_seat::jsonb->>'trade', '')), '')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_estimator := NULL;
  END;
  IF v_estimator IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_estimator AND archived_at IS NULL) THEN
    v_estimator := NULL;
  END IF;
  v_estimator := coalesce(v_estimator, v_me);
  -- The sender, for the bid's GC contact: the contact's name and the address the line came from.
  SELECT nullif(btrim(c.name), ''), lower(btrim(ch.value)) INTO v_sender_name, v_sender_email
    FROM public.contacts c
    LEFT JOIN public.contact_channels ch ON ch.id = v_msg.channel_id
    WHERE c.id = v_msg.contact_id;
  IF v_sender_email IS NULL THEN
    SELECT lower(btrim(ch.value)) INTO v_sender_email FROM public.contact_channels ch WHERE ch.contact_id = v_msg.contact_id AND ch.kind = 'email' ORDER BY ch.created_at LIMIT 1;
  END IF;
  -- The links as the form keeps them: strings, trimmed, blanks dropped, at most eight.
  SELECT coalesce(jsonb_agg(l), '[]'::jsonb) INTO v_links
    FROM (SELECT btrim(x) AS l FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(coalesce(p_links, '[]'::jsonb)) = 'array' THEN p_links ELSE '[]'::jsonb END) x WHERE btrim(x) <> '' LIMIT 8) s;

  INSERT INTO public.bids (project_name, customer_id, service_type_id, estimator_id, created_by, itb_links, gc_contact_name, gc_contact_email, notes)
  VALUES (v_project, p_customer_id, v_service_type, v_estimator, v_me, v_links, v_sender_name, v_sender_email,
    'From an invitation to bids@' || CASE WHEN v_msg.subject IS NOT NULL THEN ': ' || left(v_msg.subject, 200) ELSE '' END)
  RETURNING id, bid_number INTO v_bid, v_number;

  -- The bid's own GC row carries the due and the links; recompute_bid_due sets the bid's columns from it.
  INSERT INTO public.bid_gcs (bid_id, customer_id, due_date, due_time, itb_links, submitted_to_name, submitted_to_email, created_by)
  VALUES (v_bid, NULL, p_due_date, p_due_time, v_links, v_sender_name, v_sender_email, v_me);

  UPDATE public.messages SET
    bid_id = v_bid, project_id = NULL, jobs_ledger_id = NULL, tied_by = v_me,
    invitation = coalesce(invitation, '{}'::jsonb) || jsonb_build_object('answer', jsonb_build_object('what', 'bid', 'bid_id', v_bid, 'by', v_me, 'at', clock_timestamp()))
  WHERE id = p_message_id;
  INSERT INTO public.contact_jobs (contact_id, bid_id) VALUES (v_msg.contact_id, v_bid) ON CONFLICT DO NOTHING;
  PERFORM public.follow_up_event(v_msg.contact_id, format('Started bid b%s · %s', v_number, v_project));
  RETURN jsonb_build_object('bid_id', v_bid, 'bid_number', v_number, 'customer', v_customer_name);
END;
$$;

REVOKE ALL ON FUNCTION public.start_bid_from_message(uuid, uuid, text, date, time, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_bid_from_message(uuid, uuid, text, date, time, jsonb) TO authenticated;
COMMENT ON FUNCTION public.start_bid_from_message(uuid, uuid, text, date, time, jsonb) IS
  'Punch list #223 PR 3 (v2.6222): Start a bid on the Bid it? card. follow_up_press; the line must be an email in with no bid; makes the bid on the customer with the name, the links and the due (bid_gcs, customer_id null), ties the line, writes the event line. Answers {bid_id, bid_number, customer}.';

-- ---------- Not for us, and Keep it ----------

-- Not for us writes the reason on the thread, *Not for us: too far*, marks the line answered and closes the row: the
-- thread goes done, the sender stays who they are, and their next invitation shows again. Keep it marks the line
-- answered and nothing else: the row then asks what it would have asked without the invitation.
CREATE OR REPLACE FUNCTION public.answer_invitation(p_message_id uuid, p_answer text, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid;
  v_msg public.messages%ROWTYPE;
  v_reason text := left(nullif(btrim(coalesce(p_reason, '')), ''), 300);
BEGIN
  IF p_answer NOT IN ('not_for_us', 'kept') THEN
    RAISE EXCEPTION 'An invitation is answered not_for_us or kept.' USING ERRCODE = 'P0001';
  END IF;
  v_me := public.follow_up_press(CASE WHEN p_answer = 'not_for_us' THEN 'say a bid is not for us' ELSE 'keep an invitation for later' END);
  SELECT * INTO v_msg FROM public.messages WHERE id = p_message_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'notFound' USING ERRCODE = 'P0001', DETAIL = 'No line with that id.';
  END IF;
  IF v_msg.direction <> 'in' OR v_msg.channel <> 'email' THEN
    RAISE EXCEPTION 'Only an email that came in is an invitation.' USING ERRCODE = 'P0001';
  END IF;
  IF p_answer = 'not_for_us' AND v_reason IS NULL THEN
    RAISE EXCEPTION 'Say why it is not for us, in a few words.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.messages SET
    invitation = coalesce(invitation, '{}'::jsonb) || jsonb_build_object('answer', jsonb_build_object('what', p_answer, 'by', v_me, 'at', clock_timestamp(), 'reason', v_reason))
  WHERE id = p_message_id;
  IF p_answer = 'not_for_us' THEN
    PERFORM public.follow_up_event(v_msg.contact_id, 'Not for us: ' || v_reason);
    UPDATE public.contacts SET state = 'done', snoozed_until = NULL WHERE id = v_msg.contact_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.answer_invitation(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.answer_invitation(uuid, text, text) TO authenticated;
COMMENT ON FUNCTION public.answer_invitation(uuid, text, text) IS
  'Punch list #223 PR 3 (v2.6222): Not for us (a reason required: the event line and the thread done) or Keep it (the line marked answered) on the Bid it? card. follow_up_press.';
