SET lock_timeout = '3s';

-- Signable Bids, Phase 1 (v2.2468, owner-approved rev-3 plan): the BID ROOM — one durable
-- public link per GC packet serving the latest PUBLISHED letter revision. Revisions are
-- explicit staff publishes (owner decision 6); the token is a plaintext portal-style slug
-- (the portal-links precedent: durable by design, view/sign-only surface). Signing (Phase 2)
-- freezes the signed revision onto the estimate rails.

CREATE TABLE IF NOT EXISTS public.bid_proposal_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  -- Null = the bid's own GC (gcPackets semantics: a version with no customer_id belongs to the bid's GC).
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  public_token text NOT NULL UNIQUE,
  recipient_email text,
  -- The Google Docs letter riding along (owner: keep the Docs method) — shown as the room's attachment card.
  attachment_url text,
  attachment_label text,
  master_user_id uuid NOT NULL REFERENCES public.users(id),
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS bid_proposal_rooms_bid_gc_uniq
  ON public.bid_proposal_rooms (bid_id, customer_id) WHERE customer_id IS NOT NULL AND closed_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS bid_proposal_rooms_bid_own_gc_uniq
  ON public.bid_proposal_rooms (bid_id) WHERE customer_id IS NULL AND closed_at IS NULL;

CREATE TABLE IF NOT EXISTS public.bid_proposal_room_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.bid_proposal_rooms(id) ON DELETE CASCADE,
  rev_number integer NOT NULL,
  note text NOT NULL DEFAULT '',
  payload jsonb NOT NULL,
  published_by uuid REFERENCES public.users(id),
  published_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, rev_number)
);

CREATE TABLE IF NOT EXISTS public.bid_proposal_room_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.bid_proposal_rooms(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type = ANY (ARRAY['room_view'::text, 'option_viewed'::text, 'link_sent'::text, 'signed'::text, 'declined'::text])),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  client_ip text,
  user_agent text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bid_proposal_room_events_room_idx ON public.bid_proposal_room_events (room_id, occurred_at DESC);

ALTER TABLE public.bid_proposal_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bid_proposal_room_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bid_proposal_room_events ENABLE ROW LEVEL SECURITY;

-- Staff policies mirror the bids family (bid_gc_recipients pattern). The PUBLIC (GC) side never
-- touches PostgREST — the room edge functions use the service role, token-validated.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bid_proposal_rooms', 'bid_proposal_room_revisions', 'bid_proposal_room_events'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Bid pricing users can read %1$s" ON public.%1$I', t);
    EXECUTE format($f$CREATE POLICY "Bid pricing users can read %1$s" ON public.%1$I FOR SELECT
      USING (EXISTS ( SELECT 1 FROM public.users
        WHERE users.id = ( SELECT auth.uid() ) AND users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role, 'primary'::public.user_role, 'superintendent'::public.user_role])))$f$, t);
    EXECUTE format('DROP POLICY IF EXISTS "Bid pricing users can write %1$s" ON public.%1$I', t);
    EXECUTE format($f$CREATE POLICY "Bid pricing users can write %1$s" ON public.%1$I FOR ALL
      USING (EXISTS ( SELECT 1 FROM public.users
        WHERE users.id = ( SELECT auth.uid() ) AND users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role])))
      WITH CHECK (EXISTS ( SELECT 1 FROM public.users
        WHERE users.id = ( SELECT auth.uid() ) AND users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role])))$f$, t);
  END LOOP;
END $$;

-- House rules: read-only training mode + the digital-twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
