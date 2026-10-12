SET lock_timeout = '3s';

-- Messages, cut 2: Follow up, whose move, and what we owe (to-dos/gc-mode/messages/BUILD_PLAN.md and BUILD_HELPERS.md's
-- cluster 2, on branch spike/gc-mode; the kernels are src/lib/followUp/queue.ts, src/lib/messages/owed.ts and
-- src/lib/messages/promises.ts, v2.5251). On the spine (20261012010000_messages_spine.sql).
--
--   * contacts gains the conversation's state (waiting, which the screens call Open; snoozed, with its day; done) and
--     who has it (has_user_id, has_since, has_how: took it, by the rule, handed).
--   * messages gains a note's day in words (back_words) beside back_on, and back_done_at (Done with it). A message
--     moves the state as it lands (messages_move_state): theirs opens it, ours or a team note closes it and puts it
--     back for whoever answers first, an event moves nothing. A line older than the other side's newest moves nothing.
--   * contact_owed: what we owe a person, its day as a date or as words, who marked it, and how it got done (a team
--     note, the message that got it done, or a fold). One open row per contact.
--   * message_promises: what a line was read as. A heard day (offered, written as one of eight kinds, or just talk)
--     or a plans question (offered, asked, answered).
--   * message_highlights: words of a message someone highlighted.
--   * app_settings messages_assign_rule_v1: the seats Who gets a new message reads.
--   * The presses: take_it, hand_to, set_state, mark_owed, owed_done (a note required), write_down, read_question,
--     add_note (a team note with its day, in one statement), set_back_day, back_done, highlight, unhighlight.
--     follow_up_count is the badge: each person once.
--   * SECURITY INVOKER, as the spine's are, so the policies and the house fences refuse what they refuse. Each says it
--     in words first: no sign-in, a training account, a digital twin, anyone off the office team.
--   * contacts_fold_follow_up: the spine's contacts_fold runs every contacts_fold_% function, so what we owe and the
--     state move with the thread when Who is this? or a customer merge folds a contact.

-- ---------- the conversation's state, and who has it ----------

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'done',
  ADD COLUMN IF NOT EXISTS snoozed_until date,
  ADD COLUMN IF NOT EXISTS has_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS has_since timestamptz,
  ADD COLUMN IF NOT EXISTS has_how text;

ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_state_known;
ALTER TABLE public.contacts ADD CONSTRAINT contacts_state_known CHECK (state IN ('waiting', 'snoozed', 'done'));
-- A snooze has its day; nothing else has one. A snooze whose day has come is open again: follow_up_count and the
-- kernel's stateToday read it so, and the stored state stays until something moves it.
ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_snooze_has_a_day;
ALTER TABLE public.contacts ADD CONSTRAINT contacts_snooze_has_a_day CHECK ((state = 'snoozed') = (snoozed_until IS NOT NULL));
ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_has_how_known;
ALTER TABLE public.contacts ADD CONSTRAINT contacts_has_how_known CHECK (has_how IN ('took', 'rule', 'handed'));
-- Whoever has it has a since and a how. A user deleted later leaves them, which is allowed.
ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_has_said;
ALTER TABLE public.contacts ADD CONSTRAINT contacts_has_said CHECK (has_user_id IS NULL OR (has_since IS NOT NULL AND has_how IS NOT NULL));

CREATE INDEX IF NOT EXISTS contacts_open ON public.contacts (state) WHERE state <> 'done';

COMMENT ON COLUMN public.contacts.state IS
  'Messages (cut 2): the conversation in Follow up. waiting (Open: they wait on us), snoozed (until snoozed_until, then open again), done. The app sets it as messages land (messages_move_state); set_state is the thread''s overrides.';
COMMENT ON COLUMN public.contacts.has_how IS
  'Messages (cut 2): how has_user_id came to have it: took (took it), rule (Who gets a new message), handed (someone handed it on).';

-- ---------- a note's day, in words, and Done with it ----------

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS back_words text,
  ADD COLUMN IF NOT EXISTS back_done_at timestamptz;

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_back_words_said;
ALTER TABLE public.messages ADD CONSTRAINT messages_back_words_said CHECK (back_words IS NULL OR length(btrim(back_words)) BETWEEN 1 AND 80);
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_back_words_on_notes;
ALTER TABLE public.messages ADD CONSTRAINT messages_back_words_on_notes CHECK ((back_words IS NULL AND back_done_at IS NULL) OR channel = 'note');
-- A day is a date or the words typed, never both (the lead, 2026-10-12: a day is never refused).
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_one_back_day;
ALTER TABLE public.messages ADD CONSTRAINT messages_one_back_day CHECK (back_on IS NULL OR back_words IS NULL);
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_back_done_has_a_day;
ALTER TABLE public.messages ADD CONSTRAINT messages_back_done_has_a_day CHECK (back_done_at IS NULL OR back_on IS NOT NULL OR back_words IS NOT NULL);

CREATE INDEX IF NOT EXISTS messages_back_days ON public.messages (contact_id, at DESC)
  WHERE channel = 'note' AND (back_on IS NOT NULL OR back_words IS NOT NULL);

COMMENT ON COLUMN public.messages.back_words IS
  'Messages (cut 2): a note''s day to come back as the words typed, when they did not read as a date. Such a note has no morning to come back on.';
COMMENT ON COLUMN public.messages.back_done_at IS
  'Messages (cut 2): when Done with it cleared the note''s day. The note stays in the thread.';

-- ---------- what we owe ----------

CREATE TABLE IF NOT EXISTS public.contact_owed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- A thread is never deleted from under what we owe: a contact folds, and what it is owed moves with it.
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE RESTRICT,
  what text NOT NULL
    CONSTRAINT contact_owed_what_said CHECK (length(btrim(what)) BETWEEN 1 AND 200),
  -- The day: a date when the words read as one, else the words as typed, else no day.
  by_day date,
  by_words text
    CONSTRAINT contact_owed_by_words_said CHECK (by_words IS NULL OR length(btrim(by_words)) BETWEEN 1 AND 80),
  marked_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  marked_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  -- Done: by a team note (owed_done), by the message that got it done (the send window, cut 3), or closed by a fold
  -- when the person it folded into was owed something newer.
  done_at timestamptz,
  done_how text
    CONSTRAINT contact_owed_done_how_known CHECK (done_how IN ('note', 'message', 'folded')),
  done_note_message_id uuid REFERENCES public.messages(id) ON DELETE RESTRICT,
  CONSTRAINT contact_owed_one_day CHECK (by_day IS NULL OR by_words IS NULL),
  CONSTRAINT contact_owed_done_said CHECK ((done_at IS NULL) = (done_how IS NULL)),
  CONSTRAINT contact_owed_done_by_a_line CHECK (coalesce(done_how, '') NOT IN ('note', 'message') OR done_note_message_id IS NOT NULL),
  CONSTRAINT contact_owed_line_when_done CHECK (done_note_message_id IS NULL OR coalesce(done_how, '') IN ('note', 'message'))
);

COMMENT ON TABLE public.contact_owed IS
  'Messages (cut 2): what we owe a person (contact_id): what, the day as a date (by_day) or as words (by_words), who marked it and when, and how it got done (done_how: a team note, the message that got it done, or a fold; done_note_message_id names the line). One open row per contact. The office team''s; written through mark_owed and owed_done.';

CREATE UNIQUE INDEX IF NOT EXISTS contact_owed_one_open ON public.contact_owed (contact_id) WHERE done_at IS NULL;
CREATE INDEX IF NOT EXISTS contact_owed_by_contact ON public.contact_owed (contact_id, marked_at DESC);

-- A line marks it done only when it is that person's team note, or a message we sent them. The CHECKs cannot look at
-- another table; this can, for a write by hand as much as a press.
CREATE OR REPLACE FUNCTION public.contact_owed_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(NEW.done_how, '') NOT IN ('note', 'message') THEN
    RETURN NEW;
  END IF;
  -- A row that only moves (a fold) keeps the line it was done by.
  IF TG_OP = 'UPDATE' THEN
    IF NEW.done_how IS NOT DISTINCT FROM OLD.done_how AND NEW.done_note_message_id IS NOT DISTINCT FROM OLD.done_note_message_id THEN
      RETURN NEW;
    END IF;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = NEW.done_note_message_id AND m.contact_id = NEW.contact_id
      AND CASE NEW.done_how WHEN 'note' THEN m.channel = 'note' ELSE m.direction = 'out' END)
  THEN
    RAISE EXCEPTION 'Only their team note, or a message we sent them, marks what we owe done.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contact_owed_guard ON public.contact_owed;
CREATE TRIGGER contact_owed_guard BEFORE INSERT OR UPDATE ON public.contact_owed
  FOR EACH ROW EXECUTE FUNCTION public.contact_owed_guard();

-- ---------- what a line was read as ----------

CREATE TABLE IF NOT EXISTS public.message_promises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  -- A heard day's kind once someone says it (null while it is offered, and when it was just talk), or 'question'.
  kind text
    CONSTRAINT message_promises_kind_known CHECK (kind IN ('quote', 'start', 'papers', 'payment', 'decision', 'access', 'answer', 'cert', 'question')),
  -- A heard day: offered, written, or no (just talk). A plans question: offered, asked (sent to the architect),
  -- answered (we answered it ourselves).
  state text NOT NULL DEFAULT 'offered'
    CONSTRAINT message_promises_state_known CHECK (state IN ('offered', 'written', 'no', 'asked', 'answered')),
  -- The day heard: a date, or the words heard when they were not one. A question has none.
  day date,
  day_words text
    CONSTRAINT message_promises_day_words_said CHECK (day_words IS NULL OR length(btrim(day_words)) BETWEEN 1 AND 80),
  -- A start or delivery, and insurance or a W-9, are one choice each and two of the Board's kinds: the one written.
  writes text
    CONSTRAINT message_promises_writes_known CHECK (writes IN ('start', 'delivery', 'insurance', 'w9')),
  offered_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  decided_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  CONSTRAINT message_promises_question CHECK (
    coalesce(kind, '') <> 'question'
    OR (state IN ('offered', 'asked', 'answered') AND day IS NULL AND day_words IS NULL AND writes IS NULL)),
  CONSTRAINT message_promises_promise CHECK (
    coalesce(kind, '') = 'question'
    OR (state IN ('offered', 'written', 'no') AND (day IS NULL) <> (day_words IS NULL)
        AND (state <> 'written' OR kind IS NOT NULL) AND (state <> 'no' OR kind IS NULL))),
  CONSTRAINT message_promises_writes_one_of_two CHECK (
    writes IS NULL
    OR (state = 'written'
        AND ((coalesce(kind, '') = 'start' AND writes IN ('start', 'delivery'))
          OR (coalesce(kind, '') = 'papers' AND writes IN ('insurance', 'w9'))))),
  CONSTRAINT message_promises_double_says_which CHECK (
    state <> 'written' OR coalesce(kind, '') NOT IN ('start', 'papers') OR writes IS NOT NULL),
  CONSTRAINT message_promises_decided_said CHECK ((state = 'offered') = (decided_at IS NULL))
);

COMMENT ON TABLE public.message_promises IS
  'Messages (cut 2): what a line (message_id) was read as. A heard day (day or day_words): offered, then written as one of eight kinds by who they are (quote, start, papers; payment, decision, access; answer, cert; writes names the one of two a double kind wrote), or no (just talk). A plans question (kind question): offered, asked or answered. Offered rows arrive with the readers (cuts 5 and 6); the office team decides them through write_down and read_question.';

CREATE UNIQUE INDEX IF NOT EXISTS message_promises_one_day ON public.message_promises (message_id) WHERE coalesce(kind, '') <> 'question';
CREATE UNIQUE INDEX IF NOT EXISTS message_promises_one_question ON public.message_promises (message_id) WHERE kind = 'question';
CREATE INDEX IF NOT EXISTS message_promises_offered ON public.message_promises (message_id) WHERE state = 'offered';

-- ---------- highlights ----------

CREATE TABLE IF NOT EXISTS public.message_highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  text text NOT NULL
    CONSTRAINT message_highlights_text_said CHECK (length(btrim(text)) BETWEEN 1 AND 2000),
  highlighted_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  highlighted_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

COMMENT ON TABLE public.message_highlights IS
  'Messages (cut 2): words of a message (message_id) someone highlighted, who and when. The same words on one message once. The office team''s; written through highlight and unhighlight.';

-- By the words' digest: a btree entry cannot hold every highlight's full words.
CREATE UNIQUE INDEX IF NOT EXISTS message_highlights_once ON public.message_highlights (message_id, md5(text));

-- ---------- the office team's ----------

ALTER TABLE public.contact_owed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_promises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_highlights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contact_owed_team ON public.contact_owed;
CREATE POLICY contact_owed_team ON public.contact_owed FOR ALL TO authenticated
  USING ((SELECT public.gc_office_team())) WITH CHECK ((SELECT public.gc_office_team()));
DROP POLICY IF EXISTS message_promises_team ON public.message_promises;
CREATE POLICY message_promises_team ON public.message_promises FOR ALL TO authenticated
  USING ((SELECT public.gc_office_team())) WITH CHECK ((SELECT public.gc_office_team()));
DROP POLICY IF EXISTS message_highlights_team ON public.message_highlights;
CREATE POLICY message_highlights_team ON public.message_highlights FOR ALL TO authenticated
  USING ((SELECT public.gc_office_team())) WITH CHECK ((SELECT public.gc_office_team()));

-- A team note or an event, written as yourself, is the one line a person signed in writes: a call, a text or an email
-- still arrives only from the service role (cuts 5 and 6). One policy for the whole table, written word for word in cut
-- 4's migration too (20261012120000_messages_flows.sql), so whichever runs last leaves the same one: restrictive
-- policies AND together, and two different ones refused this file's event lines (the lead, 2026-10-12).
DROP POLICY IF EXISTS messages_client_writes_own_team_notes ON public.messages;
DROP POLICY IF EXISTS messages_team_lines_by_hand ON public.messages;
DROP POLICY IF EXISTS messages_client_writes_own_team_lines ON public.messages;
CREATE POLICY messages_client_writes_own_team_lines ON public.messages AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (channel IN ('note', 'event') AND direction = 'team' AND who_user_id = (SELECT auth.uid()));

REVOKE ALL ON TABLE public.contact_owed, public.message_promises, public.message_highlights FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.contact_owed, public.message_promises, public.message_highlights FROM authenticated;
GRANT SELECT ON TABLE public.contact_owed, public.message_promises, public.message_highlights TO authenticated;
-- Only what the presses below change.
GRANT UPDATE (state, snoozed_until, has_user_id, has_since, has_how) ON TABLE public.contacts TO authenticated;
GRANT INSERT (contact_id, bid_id, project_id, jobs_ledger_id, channel, direction, who_user_id, who_text, body, back_on, back_by, back_words)
  ON TABLE public.messages TO authenticated;
GRANT UPDATE (back_on, back_by, back_words, back_done_at) ON TABLE public.messages TO authenticated;
GRANT INSERT (contact_id, what, by_day, by_words, marked_by) ON TABLE public.contact_owed TO authenticated;
GRANT UPDATE (contact_id, what, by_day, by_words, done_at, done_how, done_note_message_id) ON TABLE public.contact_owed TO authenticated;
GRANT UPDATE (kind, state, writes, decided_by, decided_at) ON TABLE public.message_promises TO authenticated;
GRANT INSERT (message_id, text, highlighted_by) ON TABLE public.message_highlights TO authenticated;
GRANT DELETE ON TABLE public.message_highlights TO authenticated;

-- ---------- a message moves the state ----------

-- Theirs opens the conversation (a snooze ends). Ours, or a team note, closes it and puts it back for whoever answers
-- first: whoever writes the note has looked at it (the owner, 2026-10-11). An event moves nothing. A line older than
-- the other side's newest (a backfilled email) moves nothing either. The database's own: it runs for every writer.
CREATE OR REPLACE FUNCTION public.messages_move_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.direction = 'in' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.contact_id = NEW.contact_id AND m.id <> NEW.id AND (m.direction = 'out' OR m.channel = 'note') AND m.at > NEW.at)
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

DROP TRIGGER IF EXISTS messages_move_state ON public.messages;
CREATE TRIGGER messages_move_state AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.messages_move_state();

-- ---------- words the presses share ----------

-- Each press says why it refuses, in words, before the policies and the fences do: no sign-in, a training account, a
-- digital twin, anyone off the office team. Returns who is pressing.
CREATE OR REPLACE FUNCTION public.follow_up_press(p_doing text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to %.', p_doing USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot %.', p_doing USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot %.', p_doing USING ERRCODE = '42501';
  END IF;
  IF NOT public.gc_office_team() THEN
    RAISE EXCEPTION 'Only the office team can %.', p_doing USING ERRCODE = '42501';
  END IF;
  RETURN auth.uid();
END;
$$;

-- A user's name as the thread writes it. SECURITY DEFINER, and a name only: the users table's own policy hides some
-- teammates from some roles (an assistant does not see the owner), and a line must still name who took or was handed
-- a conversation.
CREATE OR REPLACE FUNCTION public.follow_up_user_name(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce((SELECT nullif(btrim(name), '') FROM public.users WHERE id = p_user_id), 'Someone')
$$;

-- Whether a conversation can be handed to this user: on the office team, the five roles gc_office_team() names, and not
-- archived. A superintendent cannot open Follow up, so a conversation handed to one would sit unseen (the lead,
-- 2026-10-12). SECURITY DEFINER for the same reason. src/lib/followUp/followUpSql.test.ts holds the roles to GC_OFFICE_TEAM.
CREATE OR REPLACE FUNCTION public.follow_up_user_known(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_user_id AND archived_at IS NULL AND role IN ('dev', 'master_technician', 'assistant', 'controller', 'estimator')
  )
$$;

-- A contact's name as the screens show it (src/lib/contacts/load.ts): their own name, else the record's (a trade
-- partner's contact name, else the company's), else their first number or address.
CREATE OR REPLACE FUNCTION public.contact_display_name(p_contact_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT coalesce(
    nullif(btrim(c.name), ''),
    nullif(btrim(cu.name), ''),
    nullif(btrim(cp.name), ''),
    nullif(btrim(g.contact_name), ''),
    nullif(btrim(g.name), ''),
    nullif(btrim(gp.name), ''),
    nullif(btrim(pe.name), ''),
    (SELECT ch.value FROM public.contact_channels ch WHERE ch.contact_id = c.id ORDER BY ch.created_at, ch.id LIMIT 1),
    'them')
  FROM public.contacts c
  LEFT JOIN public.customers cu ON cu.id = c.customer_id
  LEFT JOIN public.customer_contact_persons cp ON cp.id = c.customer_contact_person_id
  LEFT JOIN public.gc_companies g ON g.id = c.gc_company_id
  LEFT JOIN public.gc_company_people gp ON gp.id = c.gc_company_person_id
  LEFT JOIN public.people pe ON pe.id = c.person_id
  WHERE c.id = p_contact_id
$$;

-- A day as the app writes it: "Mon Oct 5" (dayLabel in src/lib/messages/owed.ts).
CREATE OR REPLACE FUNCTION public.follow_up_day(p_day date)
RETURNS text
LANGUAGE sql
STABLE PARALLEL SAFE
AS $$
  SELECT to_char(p_day, 'Dy Mon FMDD')
$$;

-- A gray event line on a person's thread, written as whoever pressed.
CREATE OR REPLACE FUNCTION public.follow_up_event(p_contact_id uuid, p_body text)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  INSERT INTO public.messages (contact_id, channel, direction, who_user_id, who_text, body)
  VALUES (p_contact_id, 'event', 'team', auth.uid(), public.follow_up_user_name(auth.uid()), p_body)
$$;

-- ---------- who has it ----------

-- I'll take it. The thread records it: "Robert took Greg Paulk." or "Robert took Dr. Priya Raman from Rosa." Taking
-- what is yours already changes nothing.
CREATE OR REPLACE FUNCTION public.take_it(p_contact_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  PERFORM public.hand_to(p_contact_id, public.follow_up_press('take a conversation'));
END;
$$;

-- Hands it to a teammate, takes it (yourself), or puts it back for whoever answers first (null). The thread records
-- every change in words (hasLine in src/lib/followUp/queue.ts).
CREATE OR REPLACE FUNCTION public.hand_to(p_contact_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_me uuid := public.follow_up_press('hand a conversation on');
  v_before uuid;
  v_me_name text;
  v_name text;
  v_line text;
BEGIN
  SELECT has_user_id INTO v_before FROM public.contacts WHERE id = p_contact_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That conversation is not there.' USING ERRCODE = 'P0001';
  END IF;
  IF p_user_id IS NOT NULL AND NOT public.follow_up_user_known(p_user_id) THEN
    RAISE EXCEPTION 'Pick a teammate in the office.' USING ERRCODE = 'P0001';
  END IF;
  IF v_before IS NOT DISTINCT FROM p_user_id THEN
    RETURN;
  END IF;
  UPDATE public.contacts SET
    has_user_id = p_user_id,
    has_since = CASE WHEN p_user_id IS NULL THEN NULL ELSE clock_timestamp() END,
    has_how = CASE WHEN p_user_id IS NULL THEN NULL WHEN p_user_id = v_me THEN 'took' ELSE 'handed' END
  WHERE id = p_contact_id;

  v_me_name := public.follow_up_user_name(v_me);
  v_name := public.contact_display_name(p_contact_id);
  v_line := CASE
    WHEN p_user_id IS NULL THEN format('%s put %s back for whoever answers first.', v_me_name, v_name)
    WHEN p_user_id = v_me AND v_before IS NULL THEN format('%s took %s.', v_me_name, v_name)
    WHEN p_user_id = v_me THEN format('%s took %s from %s.', v_me_name, v_name, public.follow_up_user_name(v_before))
    WHEN v_before IS NULL THEN format('%s gave %s to %s.', v_me_name, v_name, public.follow_up_user_name(p_user_id))
    ELSE format('%s handed %s to %s.', v_me_name, v_name, public.follow_up_user_name(p_user_id))
  END;
  PERFORM public.follow_up_event(p_contact_id, v_line);
END;
$$;

-- ---------- Open · Snoozed · Done, the thread's overrides ----------

-- waiting: Reopen. snoozed: Remind me Monday, to the coming Monday (a press on a Monday means the Monday after).
-- done: No reply needed, which also puts it back for whoever answers first. Returns the snooze's day.
CREATE OR REPLACE FUNCTION public.set_state(p_contact_id uuid, p_state text)
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_until date;
BEGIN
  PERFORM public.follow_up_press('reopen, snooze or close a conversation');
  IF p_state IS NULL OR p_state NOT IN ('waiting', 'snoozed', 'done') THEN
    RAISE EXCEPTION 'A conversation is Open, Snoozed or Done.' USING ERRCODE = 'P0001';
  END IF;
  PERFORM 1 FROM public.contacts WHERE id = p_contact_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That conversation is not there.' USING ERRCODE = 'P0001';
  END IF;
  v_until := CASE WHEN p_state = 'snoozed' THEN public.app_today() + (8 - extract(isodow FROM public.app_today())::int) END;
  UPDATE public.contacts SET
    state = p_state,
    snoozed_until = v_until,
    has_user_id = CASE WHEN p_state = 'done' THEN NULL ELSE has_user_id END,
    has_since = CASE WHEN p_state = 'done' THEN NULL ELSE has_since END,
    has_how = CASE WHEN p_state = 'done' THEN NULL ELSE has_how END
  WHERE id = p_contact_id;
  RETURN v_until;
END;
$$;

-- ---------- what we owe ----------

-- "by Mon Oct 5", ", after the Board meets", or nothing: the tail of every sentence about what we owe.
CREATE OR REPLACE FUNCTION public.owed_by_tail(p_day date, p_words text)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN p_day IS NOT NULL THEN ' by ' || public.follow_up_day(p_day)
    WHEN nullif(btrim(coalesce(p_words, '')), '') IS NOT NULL THEN ', ' || btrim(p_words)
    ELSE ''
  END
$$;

-- Marks what we owe a person, or changes the open one: what, and the day as a date or as words (never both; neither
-- is no day). The thread records it (owedMarkedLine, owedWhatChangedLine, owedDayChangedLine). Returns the row.
CREATE OR REPLACE FUNCTION public.mark_owed(p_contact_id uuid, p_what text, p_by_day date DEFAULT NULL, p_by_words text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_me uuid := public.follow_up_press('mark what we owe');
  v_what text := btrim(coalesce(p_what, ''));
  v_words text := nullif(btrim(coalesce(p_by_words, '')), '');
  v_open public.contact_owed%ROWTYPE;
  v_me_name text;
  v_name text;
  v_id uuid;
BEGIN
  IF v_what = '' THEN
    RAISE EXCEPTION 'Say what first. The day is optional.' USING ERRCODE = 'P0001';
  END IF;
  IF p_by_day IS NOT NULL AND v_words IS NOT NULL THEN
    RAISE EXCEPTION 'A day is a date or the words typed, not both.' USING ERRCODE = 'P0001';
  END IF;
  PERFORM 1 FROM public.contacts WHERE id = p_contact_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That conversation is not there.' USING ERRCODE = 'P0001';
  END IF;
  v_me_name := public.follow_up_user_name(v_me);
  v_name := public.contact_display_name(p_contact_id);

  SELECT * INTO v_open FROM public.contact_owed WHERE contact_id = p_contact_id AND done_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.contact_owed (contact_id, what, by_day, by_words, marked_by)
    VALUES (p_contact_id, v_what, p_by_day, v_words, v_me)
    RETURNING id INTO v_id;
    PERFORM public.follow_up_event(p_contact_id,
      format('%s marked that we owe %s %s%s.', v_me_name, v_name, v_what, public.owed_by_tail(p_by_day, v_words)));
    RETURN v_id;
  END IF;

  UPDATE public.contact_owed SET what = v_what, by_day = p_by_day, by_words = v_words WHERE id = v_open.id;
  IF v_what IS DISTINCT FROM v_open.what THEN
    PERFORM public.follow_up_event(p_contact_id,
      format('%s changed what we owe %s: %s, not %s%s.', v_me_name, v_name, v_what, v_open.what,
        CASE WHEN p_by_day IS NOT NULL THEN ', by ' || public.follow_up_day(p_by_day)
             WHEN v_words IS NOT NULL THEN ', ' || v_words ELSE '' END));
  END IF;
  IF p_by_day IS DISTINCT FROM v_open.by_day OR v_words IS DISTINCT FROM v_open.by_words THEN
    PERFORM public.follow_up_event(p_contact_id,
      format('%s set the day we owe %s %s to %s.', v_me_name, v_name, v_what,
        coalesce(public.follow_up_day(p_by_day), v_words, 'no day')));
  END IF;
  RETURN v_open.id;
END;
$$;

-- Mark it done, with a team note: the note is what marks it done, so it cannot be empty. The note goes in the thread,
-- tied to the job when one is given, and closes the row as any note does. Returns the note.
CREATE OR REPLACE FUNCTION public.owed_done(p_contact_id uuid, p_note text, p_job_kind text DEFAULT NULL, p_job_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_me uuid := public.follow_up_press('mark what we owe done');
  v_note text := btrim(coalesce(p_note, ''));
  v_open uuid;
  v_line uuid;
BEGIN
  IF v_note = '' THEN
    RAISE EXCEPTION 'Say how it got done, or press Not done yet.' USING ERRCODE = 'P0001';
  END IF;
  SELECT id INTO v_open FROM public.contact_owed WHERE contact_id = p_contact_id AND done_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nothing is owed to them now.' USING ERRCODE = 'P0001';
  END IF;
  PERFORM public.contact_job_check(p_job_kind, p_job_id);
  INSERT INTO public.messages (contact_id, channel, direction, who_user_id, who_text, body, bid_id, project_id, jobs_ledger_id)
  VALUES (
    p_contact_id, 'note', 'team', v_me, public.follow_up_user_name(v_me), v_note,
    CASE WHEN p_job_kind = 'bid' THEN p_job_id END,
    CASE WHEN p_job_kind = 'project' THEN p_job_id END,
    CASE WHEN p_job_kind = 'pipeline' THEN p_job_id END)
  RETURNING id INTO v_line;
  UPDATE public.contact_owed SET done_at = clock_timestamp(), done_how = 'note', done_note_message_id = v_line WHERE id = v_open;
  RETURN v_line;
END;
$$;

-- ---------- a heard day, and a plans question ----------

-- Says what a heard day is a promise of, by who they are (promiseChoices in src/lib/messages/promises.ts): a trade
-- partner's quote, start or papers; a customer's payment, decision or access; an architect's answer or certificate.
-- A start or delivery writes a start, and insurance or a W-9 writes insurance, unless p_writes says the other (the
-- lead, 2026-10-12). A null kind is just talk.
CREATE OR REPLACE FUNCTION public.write_down(p_message_id uuid, p_kind text, p_writes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_me uuid := public.follow_up_press('write down a promise');
  v_row public.message_promises%ROWTYPE;
  v_who text;
  v_writes text;
BEGIN
  SELECT * INTO v_row FROM public.message_promises
  WHERE message_id = p_message_id AND coalesce(kind, '') <> 'question'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No day was heard on that line.' USING ERRCODE = 'P0001';
  END IF;
  IF v_row.state <> 'offered' THEN
    RAISE EXCEPTION 'Someone has said what that day is already.' USING ERRCODE = 'P0001';
  END IF;
  IF p_kind IS NULL THEN
    UPDATE public.message_promises SET state = 'no', decided_by = v_me, decided_at = clock_timestamp() WHERE id = v_row.id;
    RETURN;
  END IF;
  SELECT c.kind INTO v_who FROM public.messages m JOIN public.contacts c ON c.id = m.contact_id WHERE m.id = p_message_id;
  IF NOT (
    (v_who = 'customer' AND p_kind IN ('payment', 'decision', 'access'))
    OR (v_who = 'arch' AND p_kind IN ('answer', 'cert'))
    OR (v_who IN ('trade', 'unknown') AND p_kind IN ('quote', 'start', 'papers')))
  THEN
    RAISE EXCEPTION 'That is not a promise % makes.',
      CASE v_who WHEN 'customer' THEN 'a customer' WHEN 'arch' THEN 'an architect' ELSE 'a trade partner' END
      USING ERRCODE = 'P0001';
  END IF;
  v_writes := CASE p_kind WHEN 'start' THEN coalesce(p_writes, 'start') WHEN 'papers' THEN coalesce(p_writes, 'insurance') ELSE p_writes END;
  IF v_writes IS NOT NULL AND NOT (
    (p_kind = 'start' AND v_writes IN ('start', 'delivery')) OR (p_kind = 'papers' AND v_writes IN ('insurance', 'w9')))
  THEN
    RAISE EXCEPTION 'A start or delivery writes a start or a delivery, and insurance or a W-9 writes one of those.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.message_promises SET kind = p_kind, state = 'written', writes = v_writes, decided_by = v_me, decided_at = clock_timestamp()
  WHERE id = v_row.id;
END;
$$;

-- A text that reads like a plans question: asked (Ask the architect, which the thread records) or answered (Answer it
-- myself: the reply box opens, and the reply closes the row as any reply does). The record is a gray event line, not a
-- team note, so the person stays waiting on the answer.
CREATE OR REPLACE FUNCTION public.read_question(p_message_id uuid, p_state text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_me uuid := public.follow_up_press('answer a plans question');
  v_row public.message_promises%ROWTYPE;
  v_line public.messages%ROWTYPE;
BEGIN
  IF p_state IS NULL OR p_state NOT IN ('asked', 'answered') THEN
    RAISE EXCEPTION 'A plans question goes to the architect, or we answer it ourselves.' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_row FROM public.message_promises WHERE message_id = p_message_id AND kind = 'question' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That line is not a plans question.' USING ERRCODE = 'P0001';
  END IF;
  IF v_row.state <> 'offered' THEN
    RAISE EXCEPTION 'That plans question is dealt with already.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.message_promises SET state = p_state, decided_by = v_me, decided_at = clock_timestamp() WHERE id = v_row.id;
  IF p_state = 'asked' THEN
    SELECT * INTO v_line FROM public.messages WHERE id = p_message_id;
    INSERT INTO public.messages (contact_id, channel, direction, who_user_id, who_text, body, bid_id, project_id, jobs_ledger_id)
    VALUES (v_line.contact_id, 'event', 'team', v_me, public.follow_up_user_name(v_me),
      format('Sent to the architect as a plan question: “%s”', v_line.body),
      v_line.bid_id, v_line.project_id, v_line.jobs_ledger_id);
  END IF;
END;
$$;

-- ---------- a note's day to come back ----------

-- Brings a team note back on a day, moves it (Another day), or clears it (both null). The day is a date or the words
-- typed: words never come back by themselves, and the note says so.
CREATE OR REPLACE FUNCTION public.set_back_day(p_note_id uuid, p_on date, p_words text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_me uuid := public.follow_up_press('bring a note back');
  v_words text := nullif(btrim(coalesce(p_words, '')), '');
BEGIN
  IF p_on IS NOT NULL AND v_words IS NOT NULL THEN
    RAISE EXCEPTION 'A day is a date or the words typed, not both.' USING ERRCODE = 'P0001';
  END IF;
  PERFORM 1 FROM public.messages WHERE id = p_note_id AND channel = 'note' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only a team note comes back on a day.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.messages SET
    back_on = p_on,
    back_words = v_words,
    back_by = CASE WHEN p_on IS NULL AND v_words IS NULL THEN NULL ELSE v_me END,
    back_done_at = NULL
  WHERE id = p_note_id;
END;
$$;

-- A team note, written as whoever presses, with its day to come back when it has one (a date or the words typed), in
-- one statement: the reply box's note (cut 3). It closes the row as any note does. Returns the note.
CREATE OR REPLACE FUNCTION public.add_note(
  p_contact_id uuid,
  p_body text,
  p_job_kind text DEFAULT NULL,
  p_job_id uuid DEFAULT NULL,
  p_back_on date DEFAULT NULL,
  p_back_words text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_me uuid := public.follow_up_press('write a team note');
  v_body text := btrim(coalesce(p_body, ''));
  v_words text := nullif(btrim(coalesce(p_back_words, '')), '');
  v_id uuid;
BEGIN
  IF v_body = '' THEN
    RAISE EXCEPTION 'Write the note first.' USING ERRCODE = 'P0001';
  END IF;
  IF p_back_on IS NOT NULL AND v_words IS NOT NULL THEN
    RAISE EXCEPTION 'A day is a date or the words typed, not both.' USING ERRCODE = 'P0001';
  END IF;
  PERFORM 1 FROM public.contacts WHERE id = p_contact_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That conversation is not there.' USING ERRCODE = 'P0001';
  END IF;
  PERFORM public.contact_job_check(p_job_kind, p_job_id);
  INSERT INTO public.messages (contact_id, channel, direction, who_user_id, who_text, body, bid_id, project_id, jobs_ledger_id, back_on, back_by, back_words)
  VALUES (
    p_contact_id, 'note', 'team', v_me, public.follow_up_user_name(v_me), v_body,
    CASE WHEN p_job_kind = 'bid' THEN p_job_id END,
    CASE WHEN p_job_kind = 'project' THEN p_job_id END,
    CASE WHEN p_job_kind = 'pipeline' THEN p_job_id END,
    p_back_on, CASE WHEN p_back_on IS NOT NULL OR v_words IS NOT NULL THEN v_me END, v_words)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Done with it: the note's day is cleared, and the note stays in the thread.
CREATE OR REPLACE FUNCTION public.back_done(p_note_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  PERFORM public.follow_up_press('clear a note''s day');
  UPDATE public.messages SET back_done_at = clock_timestamp()
  WHERE id = p_note_id AND channel = 'note' AND (back_on IS NOT NULL OR back_words IS NOT NULL) AND back_done_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That note has no day to clear.' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- ---------- highlights ----------

-- Highlights words of a message, which must be its own words. The same words twice is one highlight. Returns it.
CREATE OR REPLACE FUNCTION public.highlight(p_message_id uuid, p_text text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_me uuid := public.follow_up_press('highlight a message');
  v_text text := btrim(coalesce(p_text, ''));
  v_body text;
  v_id uuid;
BEGIN
  SELECT body INTO v_body FROM public.messages WHERE id = p_message_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That message is not there.' USING ERRCODE = 'P0001';
  END IF;
  IF v_text = '' OR position(v_text IN v_body) = 0 THEN
    RAISE EXCEPTION 'Highlight words from the message itself.' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.message_highlights (message_id, text, highlighted_by)
  VALUES (p_message_id, v_text, v_me)
  ON CONFLICT (message_id, md5(text)) DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.message_highlights WHERE message_id = p_message_id AND text = v_text;
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.unhighlight(p_highlight_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  PERFORM public.follow_up_press('remove a highlight');
  DELETE FROM public.message_highlights WHERE id = p_highlight_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That highlight is gone already.' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- ---------- the badge ----------

-- Follow up's badge: each person once across Needs you (a standing note whose day has come), Needs a reply (open, or a
-- snooze whose day has come) and We owe them (followUpQueue's count in src/lib/followUp/queue.ts). A person's standing
-- note is their newest note with a day; a newer one replaces an older. The portal's paper rows and the clause rows join
-- with their own reads. The office team's: anyone else reads 0.
CREATE OR REPLACE FUNCTION public.follow_up_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH standing AS (
    SELECT DISTINCT ON (m.contact_id) m.contact_id, m.back_on, m.back_done_at
    FROM public.messages m
    WHERE m.channel = 'note' AND (m.back_on IS NOT NULL OR m.back_words IS NOT NULL)
    ORDER BY m.contact_id, m.at DESC, m.id DESC
  )
  SELECT count(*)::integer FROM (
    SELECT s.contact_id FROM standing s WHERE s.back_on <= public.app_today() AND s.back_done_at IS NULL
    UNION
    SELECT c.id FROM public.contacts c
    WHERE c.state = 'waiting' OR (c.state = 'snoozed' AND c.snoozed_until <= public.app_today())
    UNION
    SELECT o.contact_id FROM public.contact_owed o WHERE o.done_at IS NULL
  ) people
$$;

-- ---------- Who gets a new message ----------

-- The seats the rule reads (Settings → Phone and texts, cut 5): whoever answered this person last, if they are here
-- today; else by who they are, a customer to the customer seat, a trade partner or an architect to the trade seat (an
-- architect to its own when set); a number nobody knows to nobody, so whoever answers first takes it (whoGetsIt in
-- src/lib/followUp/queue.ts). Each seat a user id, or null. The owner and dev set them.
INSERT INTO public.app_settings (key, value_text)
VALUES ('messages_assign_rule_v1', '{"customer": null, "trade": null, "arch": null}')
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS master_or_dev_update_messages_assign_rule ON public.app_settings;
CREATE POLICY master_or_dev_update_messages_assign_rule ON public.app_settings
  FOR UPDATE TO authenticated
  USING (key = 'messages_assign_rule_v1' AND public.is_master_or_dev())
  WITH CHECK (key = 'messages_assign_rule_v1' AND public.is_master_or_dev());

-- ---------- the fold keeps what we owe and the state ----------

-- The spine's contacts_fold (20261012010000) runs every contacts_fold_% function with (victim, survivor) after it moves
-- the lines, numbers and jobs and before the victim goes. What p_from is owed moves to p_into; when both are owed
-- something, the newest marked stands and the other closes as folded (openByPerson in src/lib/followUp/queue.ts). The
-- state: open when either is open, else snoozed to the sooner day when either is snoozed, else done. Who has it stays
-- p_into's, else comes from p_from. message_promises and message_highlights hang off the lines, which have moved.
CREATE OR REPLACE FUNCTION public.contacts_fold_follow_up(p_from uuid, p_into uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_from public.contact_owed%ROWTYPE;
  v_into public.contact_owed%ROWTYPE;
BEGIN
  SELECT * INTO v_from FROM public.contact_owed WHERE contact_id = p_from AND done_at IS NULL FOR UPDATE;
  SELECT * INTO v_into FROM public.contact_owed WHERE contact_id = p_into AND done_at IS NULL FOR UPDATE;
  IF v_from.id IS NOT NULL AND v_into.id IS NOT NULL THEN
    UPDATE public.contact_owed SET done_at = clock_timestamp(), done_how = 'folded'
    WHERE id = CASE WHEN v_from.marked_at > v_into.marked_at THEN v_into.id ELSE v_from.id END;
  END IF;
  UPDATE public.contact_owed SET contact_id = p_into WHERE contact_id = p_from;

  UPDATE public.contacts t SET
    state = CASE WHEN 'waiting' IN (t.state, f.state) THEN 'waiting' WHEN 'snoozed' IN (t.state, f.state) THEN 'snoozed' ELSE 'done' END,
    snoozed_until = CASE WHEN 'waiting' IN (t.state, f.state) THEN NULL ELSE least(t.snoozed_until, f.snoozed_until) END,
    has_user_id = coalesce(t.has_user_id, f.has_user_id),
    has_since = CASE WHEN t.has_user_id IS NOT NULL THEN t.has_since ELSE f.has_since END,
    has_how = CASE WHEN t.has_user_id IS NOT NULL THEN t.has_how ELSE f.has_how END
  FROM public.contacts f
  WHERE t.id = p_into AND f.id = p_from;
END;
$$;

-- ---------- who may call what ----------

REVOKE EXECUTE ON FUNCTION public.follow_up_press(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.follow_up_press(text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.follow_up_user_name(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.follow_up_user_name(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.follow_up_user_known(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.follow_up_user_known(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.contact_display_name(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contact_display_name(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.follow_up_day(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.follow_up_day(date) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.owed_by_tail(date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owed_by_tail(date, text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.follow_up_event(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.follow_up_event(uuid, text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.take_it(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.take_it(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.hand_to(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hand_to(uuid, uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.set_state(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_state(uuid, text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.mark_owed(uuid, text, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_owed(uuid, text, date, text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.owed_done(uuid, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owed_done(uuid, text, text, uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.write_down(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.write_down(uuid, text, text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.read_question(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.read_question(uuid, text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.set_back_day(uuid, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_back_day(uuid, date, text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.add_note(uuid, text, text, uuid, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_note(uuid, text, text, uuid, date, text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.back_done(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.back_done(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.highlight(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.highlight(uuid, text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.unhighlight(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unhighlight(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.follow_up_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.follow_up_count() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.contacts_fold_follow_up(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contacts_fold_follow_up(uuid, uuid) TO authenticated, service_role;
-- The triggers' are the database's own.
REVOKE EXECUTE ON FUNCTION public.messages_move_state() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.contact_owed_guard() FROM PUBLIC, anon, authenticated;

-- House rules: read-only training mode and the twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
