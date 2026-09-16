SET lock_timeout = '3s';

-- v2.3513 — What customers see PR 9: the health row.
-- One read-only, SECURITY DEFINER count of where outside people are on their journeys and how
-- many are stuck at each step, for the office roles that see Settings → What customers see
-- (dev · master · assistant · controller). It reads public_page_views (dev-only SELECT under RLS)
-- and the per-surface stamp tables, and returns one jsonb. Nothing is written.
--
-- "Stuck" here is the plainest reading of each stamp: an agreement sent more than three days ago
-- and never opened; a bid room with no view event; a portal link nobody outside has ever opened;
-- a builder with billed work and no certified statement this month.

CREATE OR REPLACE FUNCTION public.journey_health_counts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role text;
  v_out jsonb;
BEGIN
  SELECT role INTO v_role FROM public.users WHERE id = auth.uid();
  IF v_role IS NULL OR v_role NOT IN ('dev', 'master_technician', 'assistant', 'controller') THEN
    RAISE EXCEPTION 'journey_health_counts: not allowed' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'as_of', now(),
    'agreements', jsonb_build_object(
      'signed', (SELECT count(*) FROM public.job_contracts c WHERE c.voided_at IS NULL AND c.status <> 'voided' AND (c.signed_at IS NOT NULL OR c.paper_signed_on IS NOT NULL)),
      'sent_unopened', (SELECT count(*) FROM public.job_contracts c WHERE c.voided_at IS NULL AND c.status = 'sent' AND c.first_viewed_at IS NULL AND coalesce(c.last_sent_at, c.sent_at) < now() - interval '3 days'),
      'sent_waiting', (SELECT count(*) FROM public.job_contracts c WHERE c.voided_at IS NULL AND c.status = 'sent'),
      'live_jobs_without', (
        SELECT count(*) FROM public.jobs_ledger j
        WHERE coalesce(j.status, '') NOT IN ('paid', 'archived')
          AND NOT EXISTS (SELECT 1 FROM public.job_contracts c WHERE c.job_id = j.id AND c.voided_at IS NULL AND c.status <> 'voided')
      )
    ),
    'bid_rooms', jsonb_build_object(
      'published', (SELECT count(*) FROM public.bid_proposal_rooms r WHERE r.closed_at IS NULL),
      'never_opened', (
        SELECT count(*) FROM public.bid_proposal_rooms r
        WHERE r.closed_at IS NULL
          AND EXISTS (SELECT 1 FROM public.bid_proposal_room_events e WHERE e.room_id = r.id AND e.event_type = 'link_sent')
          AND NOT EXISTS (SELECT 1 FROM public.bid_proposal_room_events e WHERE e.room_id = r.id AND e.event_type IN ('room_view', 'option_viewed', 'signed', 'declined'))
      ),
      'signed', (SELECT count(DISTINCT e.room_id) FROM public.bid_proposal_room_events e WHERE e.event_type = 'signed')
    ),
    'portals', jsonb_build_object(
      'customers_with_link', (SELECT count(DISTINCT l.customer_id) FROM public.customer_portal_links l WHERE l.revoked_at IS NULL),
      'ever_visited', (
        SELECT count(DISTINCT l.customer_id) FROM public.customer_portal_links l
        WHERE l.revoked_at IS NULL
          AND EXISTS (SELECT 1 FROM public.public_page_views v WHERE v.surface = 'portal' AND v.entity_id = l.customer_id AND coalesce(v.viewer, 'outside') = 'outside')
      )
    ),
    'sub_portals', jsonb_build_object(
      'subs_with_link', (SELECT count(DISTINCT l.person_id) FROM public.sub_portal_links l WHERE l.revoked_at IS NULL),
      'ever_visited', (
        SELECT count(DISTINCT l.person_id) FROM public.sub_portal_links l
        WHERE l.revoked_at IS NULL
          AND EXISTS (SELECT 1 FROM public.public_page_views v WHERE v.surface = 'sub_portal' AND v.entity_id = l.person_id AND coalesce(v.viewer, 'outside') = 'outside')
      )
    ),
    'statements', jsonb_build_object(
      'gcs_with_billed_work', (
        SELECT count(DISTINCT j.gc_customer_id) FROM public.jobs_ledger j
        WHERE j.gc_customer_id IS NOT NULL AND coalesce(j.status, '') IN ('billed', 'ready_to_bill', 'working')
      ),
      'certified_this_month', (
        SELECT count(DISTINCT c.gc_customer_id) FROM public.gc_review_certifications c
        WHERE c.certified_at >= date_trunc('month', now())
      ),
      'sent_this_month', (SELECT count(DISTINCT s.gc_customer_id) FROM public.gc_statement_emails s WHERE s.sent_at >= date_trunc('month', now()))
    )
  ) INTO v_out;

  RETURN v_out;
END;
$$;

REVOKE ALL ON FUNCTION public.journey_health_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.journey_health_counts() TO authenticated, service_role;

COMMENT ON FUNCTION public.journey_health_counts() IS 'v2.3513 What customers see PR 9: read-only counts of where outside people are on their journeys and how many are stuck per step; office roles only.';
