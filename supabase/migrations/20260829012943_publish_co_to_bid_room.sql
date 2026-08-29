SET lock_timeout = '3s';

-- Bid Room fix #2 from the live E2E (v2.2476): "Publish to bid room" on a CO draft tried a
-- client-side draft→sent UPDATE, which estimates_update_draft's WITH CHECK (status must stay
-- 'draft') rightly refuses — 'sent' is a privileged transition everywhere else too. The house
-- pattern for staff-initiated privileged estimate writes is a SECURITY DEFINER RPC
-- (apply_estimate_to_job precedent). Also widens the room-events CHECK for the
-- document_published telemetry the door logs.

ALTER TABLE public.bid_proposal_room_events DROP CONSTRAINT IF EXISTS bid_proposal_room_events_event_type_check;
ALTER TABLE public.bid_proposal_room_events
  ADD CONSTRAINT bid_proposal_room_events_event_type_check
  CHECK (event_type = ANY (ARRAY['room_view'::text, 'option_viewed'::text, 'link_sent'::text, 'signed'::text, 'declined'::text, 'document_published'::text]));

CREATE OR REPLACE FUNCTION public.publish_co_to_bid_room(p_estimate_id uuid, p_room_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role public.user_role;
  v_est record;
  v_room record;
BEGIN
  SELECT role INTO v_role FROM public.users WHERE id = auth.uid();
  IF v_role IS NULL OR v_role NOT IN ('dev', 'master_technician', 'assistant', 'controller', 'estimator') THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT id, status, doc_kind, bid_id, title, total_cents INTO v_est FROM public.estimates WHERE id = p_estimate_id;
  IF v_est.id IS NULL THEN RAISE EXCEPTION 'Change order not found'; END IF;
  IF v_est.doc_kind IS DISTINCT FROM 'change_order' THEN RAISE EXCEPTION 'Only change orders publish to a room'; END IF;
  IF v_est.status <> 'draft' THEN RAISE EXCEPTION 'Only a draft can be published'; END IF;
  IF v_est.bid_id IS NULL THEN RAISE EXCEPTION 'This change order is not linked to a bid'; END IF;

  SELECT id, bid_id, closed_at INTO v_room FROM public.bid_proposal_rooms WHERE id = p_room_id;
  IF v_room.id IS NULL OR v_room.bid_id IS DISTINCT FROM v_est.bid_id THEN RAISE EXCEPTION 'Room does not belong to this bid'; END IF;
  IF v_room.closed_at IS NOT NULL THEN RAISE EXCEPTION 'Room is closed'; END IF;

  UPDATE public.estimates
     SET status = 'sent', sent_at = now(), bid_room_id = p_room_id
   WHERE id = p_estimate_id AND status = 'draft';

  INSERT INTO public.bid_proposal_room_events (room_id, event_type, metadata)
  VALUES (p_room_id, 'document_published',
          jsonb_build_object('document_id', v_est.id, 'title', v_est.title, 'total_cents', v_est.total_cents));
END;
$$;

REVOKE ALL ON FUNCTION public.publish_co_to_bid_room(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.publish_co_to_bid_room(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.publish_co_to_bid_room(uuid, uuid) TO authenticated;
COMMENT ON FUNCTION public.publish_co_to_bid_room(uuid, uuid) IS
  'Bid Room (v2.2476): staff-initiated draft→sent for a bid-linked CO into its room. Role-checked inside; the read_only statement trigger covers training mode.';

