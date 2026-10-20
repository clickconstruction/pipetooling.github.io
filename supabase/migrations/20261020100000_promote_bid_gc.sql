SET lock_timeout = '3s';

-- v2.5682 — promote_bid_gc (punch list #134, Wendi's report): hand a bid to another GC
-- without re-badging history. Four stores key "the bid's own GC" as customer_id NULL
-- (bid_versions, bid_gcs, bid_proposal_rooms; whole-bid notes stay whole-bid by owner
-- decision), so a bare bids.customer_id swap re-attributes the departing GC's sent
-- letters, dues and rooms to the new GC. This RPC does the swap atomically instead:
-- history moves to the departing GC's explicit key, the estimate stays with the bid,
-- and the stepping-up GC's explicit rows become the bid's own (NULL-keyed) rows.
--
-- SECURITY INVOKER: every statement runs under the caller's RLS — the read-only
-- (training) write fence refuses the bids UPDATE, which raises and rolls back the call.

CREATE OR REPLACE FUNCTION public.promote_bid_gc(
  p_bid_id uuid,
  p_new_gc_id uuid,
  p_old_gc_stays boolean DEFAULT false
) RETURNS void
  LANGUAGE plpgsql
  SET search_path = public
  AS $$
DECLARE
  v_old uuid;
  v_old_name text;
  v_new_name text;
  v_updated int;
  v_old_has_versions boolean;
BEGIN
  IF p_bid_id IS NULL OR p_new_gc_id IS NULL THEN
    RAISE EXCEPTION 'promote_bid_gc: bid and GC are required';
  END IF;

  SELECT customer_id INTO v_old FROM public.bids WHERE id = p_bid_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'promote_bid_gc: bid not found';
  END IF;
  IF v_old IS NOT DISTINCT FROM p_new_gc_id THEN
    RAISE EXCEPTION 'promote_bid_gc: already the bid''s GC';
  END IF;

  -- The handoff itself, first: a write fence (read-only user, twin) yields zero
  -- rows here and the whole call rolls back untouched.
  UPDATE public.bids
     SET customer_id = p_new_gc_id,
         gc_builder_id = NULL
   WHERE id = p_bid_id;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'promote_bid_gc: bid update refused';
  END IF;

  -- 1. Sent letters stay with the GC they went to: own-GC versions WITH a send
  --    re-key to the departing GC. Unsent drafts are the project's estimate and
  --    stay with the bid.
  IF v_old IS NOT NULL THEN
    UPDATE public.bid_versions v
       SET customer_id = v_old
     WHERE v.bid_id = p_bid_id
       AND v.customer_id IS NULL
       AND EXISTS (SELECT 1 FROM public.bid_version_sends s WHERE s.bid_version_id = v.id);
  END IF;

  -- 2. The stepping-up GC's packet becomes the bid's own (the primary's packet
  --    is the NULL-keyed one everywhere).
  UPDATE public.bid_versions
     SET customer_id = NULL
   WHERE bid_id = p_bid_id AND customer_id = p_new_gc_id;

  SELECT EXISTS (
    SELECT 1 FROM public.bid_versions WHERE bid_id = p_bid_id AND customer_id = v_old
  ) INTO v_old_has_versions;

  -- 3. Per-GC state (bid_gcs: due / submitted-to / ITB). The NULL row is the
  --    departing GC's relationship state. Unique: (bid_id, COALESCE(customer_id, zero)).
  IF v_old IS NOT NULL THEN
    -- When the departing GC somehow already has an explicit row, the NULL row
    -- (the live primary state) wins wholesale; else the NULL row just re-keys.
    UPDATE public.bid_gcs tgt
       SET due_date = src.due_date, due_time = src.due_time,
           submitted_to_name = src.submitted_to_name,
           submitted_to_phone = src.submitted_to_phone,
           submitted_to_email = src.submitted_to_email,
           itb_links = src.itb_links,
           updated_at = now()
      FROM public.bid_gcs src
     WHERE tgt.bid_id = p_bid_id AND tgt.customer_id = v_old
       AND src.bid_id = p_bid_id AND src.customer_id IS NULL;
    DELETE FROM public.bid_gcs d
     WHERE d.bid_id = p_bid_id AND d.customer_id IS NULL
       AND EXISTS (SELECT 1 FROM public.bid_gcs e WHERE e.bid_id = p_bid_id AND e.customer_id = v_old);
    UPDATE public.bid_gcs
       SET customer_id = v_old, updated_at = now()
     WHERE bid_id = p_bid_id AND customer_id IS NULL;
  ELSE
    -- Legacy builder bid: the NULL row has no customer to move to — drop it so
    -- the new GC doesn't inherit the builder's dates.
    DELETE FROM public.bid_gcs WHERE bid_id = p_bid_id AND customer_id IS NULL;
  END IF;

  UPDATE public.bid_gcs
     SET customer_id = NULL, updated_at = now()
   WHERE bid_id = p_bid_id AND customer_id = p_new_gc_id;

  -- Fully off the bid (and no packet keeping it visible): its due must stop
  -- steering the bid's derived due.
  IF NOT p_old_gc_stays AND v_old IS NOT NULL AND NOT v_old_has_versions THEN
    DELETE FROM public.bid_gcs WHERE bid_id = p_bid_id AND customer_id = v_old;
  END IF;

  -- 4. Bid rooms (GC-facing letter links; partial unique: one OPEN room per GC
  --    key per bid). Closed rooms are history and re-key freely; the open own-GC
  --    room follows the departing GC when its open slot is free, else it closes
  --    (never inherited by the new GC). Then the new GC's rooms become the bid's.
  IF v_old IS NOT NULL THEN
    UPDATE public.bid_proposal_rooms
       SET customer_id = v_old
     WHERE bid_id = p_bid_id AND customer_id IS NULL AND closed_at IS NOT NULL;
    UPDATE public.bid_proposal_rooms r
       SET customer_id = v_old
     WHERE r.bid_id = p_bid_id AND r.customer_id IS NULL AND r.closed_at IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.bid_proposal_rooms e
          WHERE e.bid_id = p_bid_id AND e.customer_id = v_old AND e.closed_at IS NULL);
  END IF;
  UPDATE public.bid_proposal_rooms
     SET closed_at = now()
   WHERE bid_id = p_bid_id AND customer_id IS NULL AND closed_at IS NULL;
  UPDATE public.bid_proposal_rooms
     SET customer_id = NULL
   WHERE bid_id = p_bid_id AND customer_id = p_new_gc_id;

  -- 5. Recipients: the new primary is implied, never listed; the departing GC is
  --    listed when it stays (or when its packet keeps it on the bid's pages).
  DELETE FROM public.bid_gc_recipients WHERE bid_id = p_bid_id AND customer_id = p_new_gc_id;
  IF v_old IS NOT NULL THEN
    IF p_old_gc_stays OR v_old_has_versions THEN
      INSERT INTO public.bid_gc_recipients (bid_id, customer_id, source, added_by)
      VALUES (p_bid_id, v_old,
              CASE WHEN v_old_has_versions THEN 'version' ELSE 'manual' END,
              auth.uid())
      ON CONFLICT (bid_id, customer_id) DO NOTHING;
    ELSE
      DELETE FROM public.bid_gc_recipients WHERE bid_id = p_bid_id AND customer_id = v_old;
    END IF;
  END IF;

  -- 6. The story, in the bid's notes: method-less whole-bid entry, so last-contact
  --    does not move (the contacts rule — only method entries count).
  SELECT name INTO v_old_name FROM public.customers WHERE id = v_old;
  SELECT name INTO v_new_name FROM public.customers WHERE id = p_new_gc_id;
  INSERT INTO public.bids_submission_entries (bid_id, notes, occurred_at, created_by)
  VALUES (
    p_bid_id,
    CASE
      WHEN v_old_name IS NOT NULL AND (p_old_gc_stays OR v_old_has_versions)
        THEN v_old_name || ' handed the bid to ' || COALESCE(v_new_name, 'another GC') || ' — they stay on the bid as an alternate.'
      WHEN v_old_name IS NOT NULL
        THEN v_old_name || ' came off the bid — ' || COALESCE(v_new_name, 'another GC') || ' is the bid''s GC now.'
      ELSE COALESCE(v_new_name, 'A GC') || ' is the bid''s GC now.'
    END,
    now(), auth.uid());

  -- 7. Derived due: the bid_gcs statements above fire the sync trigger, but a
  --    call that touched no bid_gcs rows still deserves a consistent read-back.
  PERFORM public.recompute_bid_due(p_bid_id);
END;
$$;

COMMENT ON FUNCTION public.promote_bid_gc(uuid, uuid, boolean) IS
  'Hands a bid to another GC: re-keys the departing GC''s sent versions, per-GC state and rooms to its explicit key, makes the stepping-up GC''s rows the bid''s own (NULL-keyed), fixes recipients, writes a method-less audit note. p_old_gc_stays keeps the departing GC as a same-letter alternate.';

REVOKE ALL ON FUNCTION public.promote_bid_gc(uuid, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.promote_bid_gc(uuid, uuid, boolean) TO authenticated, service_role;
