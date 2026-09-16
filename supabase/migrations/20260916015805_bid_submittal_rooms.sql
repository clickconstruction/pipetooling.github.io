SET lock_timeout = '3s';

-- Submittals, stage 4a-i (to-dos/submittals/README.md, decisions 8–12): the REVIEW ROOM.
-- One room per bid with one durable link; the office sends it to the GC and the GC forwards
-- it. Anyone with the link can read; a person who decides or asks identifies themselves
-- (name · email · role) and becomes a row in bid_submittal_people with a personal token.
-- Nothing about money ever reaches the room — the edge functions build the payload from
-- the submittal rows alone. Outsiders never touch PostgREST: the room functions use the
-- service role, token-validated (the Bid Room precedent).

-- ---------- 1 · the room ----------

CREATE TABLE IF NOT EXISTS public.bid_submittal_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'open',
  shared_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  shared_at timestamptz,
  closed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bid_submittal_rooms_status_check CHECK (status IN ('open', 'closed')),
  CONSTRAINT bid_submittal_rooms_bid_key UNIQUE (bid_id)
);

COMMENT ON TABLE public.bid_submittal_rooms IS
  'Submittals stage 4a (v2.3485): one review room per bid — the durable link the GC forwards; shows the newest shared revision; closed when the products are approved.';

-- ---------- 2 · the people who identified themselves (or were named) ----------

CREATE TABLE IF NOT EXISTS public.bid_submittal_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.bid_submittal_rooms(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'other',
  -- Anyone who identifies may decide until the office flips them to watching (decision 12).
  may_decide boolean NOT NULL DEFAULT true,
  -- A personal link: minted when the office names someone, or when a person identifies.
  token text UNIQUE,
  how text NOT NULL DEFAULT 'identified',
  invited_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  open_count integer NOT NULL DEFAULT 0,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bid_submittal_people_role_check CHECK (role IN ('architect', 'owners_rep', 'designer', 'builder', 'other')),
  CONSTRAINT bid_submittal_people_how_check CHECK (how IN ('named', 'identified', 'forwarded'))
);

CREATE UNIQUE INDEX IF NOT EXISTS bid_submittal_people_room_email_key ON public.bid_submittal_people (room_id, lower(email));
CREATE INDEX IF NOT EXISTS bid_submittal_people_room_idx ON public.bid_submittal_people (room_id);

COMMENT ON TABLE public.bid_submittal_people IS
  'Submittals stage 4a (v2.3485): a person on a bid''s review room — named by the office or self-identified when they first decided or asked; may_decide is the office''s deciding/watching switch.';

-- ---------- 3 · events ----------

CREATE TABLE IF NOT EXISTS public.bid_submittal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.bid_submittal_rooms(id) ON DELETE CASCADE,
  person_id uuid REFERENCES public.bid_submittal_people(id) ON DELETE SET NULL,
  submittal_id uuid REFERENCES public.bid_submittals(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  client_ip text,
  user_agent text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bid_submittal_events_type_check CHECK (event_type IN ('view', 'identified', 'decided', 'reply', 'file_dropped', 'shared', 'closed'))
);

CREATE INDEX IF NOT EXISTS bid_submittal_events_room_idx ON public.bid_submittal_events (room_id, occurred_at DESC);

-- ---------- 4 · the decision remembers the person ----------

ALTER TABLE public.bid_submittal_items
  ADD COLUMN IF NOT EXISTS reviewed_by_person_id uuid REFERENCES public.bid_submittal_people(id) ON DELETE SET NULL;

-- ---------- 5 · RLS: the pricing sharers, on bids they can price ----------

ALTER TABLE public.bid_submittal_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bid_submittal_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bid_submittal_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_submittal_room(p_room_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bid_submittal_rooms r
     WHERE r.id = p_room_id
       AND public.can_access_bid_for_pricing(r.bid_id)
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_submittal_room(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_submittal_room(uuid) TO authenticated;

DROP POLICY IF EXISTS "Pricing sharers can read bid_submittal_rooms" ON public.bid_submittal_rooms;
CREATE POLICY "Pricing sharers can read bid_submittal_rooms" ON public.bid_submittal_rooms FOR SELECT
  USING (public.is_pricing_sharer() AND public.can_access_bid_for_pricing(bid_id));
DROP POLICY IF EXISTS "Pricing sharers can write bid_submittal_rooms" ON public.bid_submittal_rooms;
CREATE POLICY "Pricing sharers can write bid_submittal_rooms" ON public.bid_submittal_rooms FOR ALL
  USING (public.is_pricing_sharer() AND public.can_access_bid_for_pricing(bid_id))
  WITH CHECK (public.is_pricing_sharer() AND public.can_access_bid_for_pricing(bid_id));

DROP POLICY IF EXISTS "Pricing sharers can read bid_submittal_people" ON public.bid_submittal_people;
CREATE POLICY "Pricing sharers can read bid_submittal_people" ON public.bid_submittal_people FOR SELECT
  USING (public.is_pricing_sharer() AND public.can_access_submittal_room(room_id));
DROP POLICY IF EXISTS "Pricing sharers can write bid_submittal_people" ON public.bid_submittal_people;
CREATE POLICY "Pricing sharers can write bid_submittal_people" ON public.bid_submittal_people FOR ALL
  USING (public.is_pricing_sharer() AND public.can_access_submittal_room(room_id))
  WITH CHECK (public.is_pricing_sharer() AND public.can_access_submittal_room(room_id));

-- Events are written by the functions (service role) and by the office's Share; the office reads them for the trail.
DROP POLICY IF EXISTS "Pricing sharers can read bid_submittal_events" ON public.bid_submittal_events;
CREATE POLICY "Pricing sharers can read bid_submittal_events" ON public.bid_submittal_events FOR SELECT
  USING (public.is_pricing_sharer() AND public.can_access_submittal_room(room_id));
DROP POLICY IF EXISTS "Pricing sharers can write bid_submittal_events" ON public.bid_submittal_events;
CREATE POLICY "Pricing sharers can write bid_submittal_events" ON public.bid_submittal_events FOR INSERT
  WITH CHECK (public.is_pricing_sharer() AND public.can_access_submittal_room(room_id));

-- House rules: read-only training mode + the twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
