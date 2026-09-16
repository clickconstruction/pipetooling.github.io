SET lock_timeout = '3s';

-- Submittals, stage 5a (to-dos/submittals/STAGES-5-6-BUILD.md): THE CONVERSATION on the
-- review room. One thread per room: a reviewer's or watcher's question, the office's
-- answer, and the system's own entries (decisions, a shared revision) so the thread is the
-- timeline and the rows are the summary. Outsiders write through submit-submittal-review
-- (service role, token-validated, 5 an hour per person); the office writes through RLS.
-- Nothing about money ever reaches a message.

CREATE TABLE IF NOT EXISTS public.bid_submittal_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.bid_submittal_rooms(id) ON DELETE CASCADE,
  -- The revision it was written against (null once that revision is gone).
  submittal_id uuid REFERENCES public.bid_submittals(id) ON DELETE SET NULL,
  -- Null for office and system entries.
  person_id uuid REFERENCES public.bid_submittal_people(id) ON DELETE SET NULL,
  author_kind text NOT NULL,
  -- The office reply's author; never shown on the room (the room shows the company).
  author_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  body text NOT NULL,
  kind text NOT NULL DEFAULT 'message',
  -- Tags the message is about, e.g. ["WC-1"]; empty when it is about the whole revision.
  tags text[] NOT NULL DEFAULT '{}'::text[],
  -- The inbox row an ask opened ({ inbox, request_id }); counts and rev_number on system entries.
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  client_ip text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bid_submittal_messages_author_check CHECK (author_kind IN ('office', 'reviewer', 'watcher', 'system', 'robot')),
  CONSTRAINT bid_submittal_messages_kind_check CHECK (kind IN ('message', 'reply', 'decision', 'shared')),
  CONSTRAINT bid_submittal_messages_body_check CHECK (char_length(body) BETWEEN 1 AND 4000)
);

CREATE INDEX IF NOT EXISTS bid_submittal_messages_room_idx ON public.bid_submittal_messages (room_id, created_at);
CREATE INDEX IF NOT EXISTS bid_submittal_messages_person_hour_idx ON public.bid_submittal_messages (person_id, created_at DESC) WHERE person_id IS NOT NULL;

COMMENT ON TABLE public.bid_submittal_messages IS
  'Submittals stage 5a (v2.3528): the conversation on a bid''s review room — asks from the room (reviewer/watcher), the office''s replies, and system entries for decisions and shared revisions; one thread per room, oldest first.';

-- The room's write-log gains the two events the thread produces (asked / reply already exists for the office).
ALTER TABLE public.bid_submittal_events DROP CONSTRAINT IF EXISTS bid_submittal_events_type_check;
ALTER TABLE public.bid_submittal_events ADD CONSTRAINT bid_submittal_events_type_check
  CHECK (event_type IN ('view', 'identified', 'decided', 'reply', 'file_dropped', 'shared', 'closed', 'asked'));

-- ---------- RLS: the pricing sharers, on rooms of bids they can price ----------

ALTER TABLE public.bid_submittal_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pricing sharers can read bid_submittal_messages" ON public.bid_submittal_messages;
CREATE POLICY "Pricing sharers can read bid_submittal_messages" ON public.bid_submittal_messages FOR SELECT
  USING (public.is_pricing_sharer() AND public.can_access_submittal_room(room_id));
-- The office writes its replies and the Share entry; asks come through the function (service role).
DROP POLICY IF EXISTS "Pricing sharers can write bid_submittal_messages" ON public.bid_submittal_messages;
CREATE POLICY "Pricing sharers can write bid_submittal_messages" ON public.bid_submittal_messages FOR INSERT
  WITH CHECK (public.is_pricing_sharer() AND public.can_access_submittal_room(room_id) AND author_kind IN ('office', 'system'));

-- House rules: read-only training mode + the twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
