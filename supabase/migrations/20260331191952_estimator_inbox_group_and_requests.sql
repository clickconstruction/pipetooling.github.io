-- Estimator Inbox: parallel to Task Dispatch — dev-managed group (assistants + estimators), requests, notes, dismissals.

CREATE TABLE public.estimator_group_members (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE
);

COMMENT ON TABLE public.estimator_group_members IS 'Assistants and estimators who receive Estimator Inbox push notifications and see the inbox on Dashboard. Dev manages membership in Settings.';

CREATE OR REPLACE FUNCTION public.estimator_group_members_enforce_roles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = NEW.user_id AND u.role::text IN ('assistant', 'estimator')
  ) THEN
    RAISE EXCEPTION 'Estimator inbox group may only include users with role assistant or estimator';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER estimator_group_members_enforce_roles
  BEFORE INSERT OR UPDATE ON public.estimator_group_members
  FOR EACH ROW
  EXECUTE FUNCTION public.estimator_group_members_enforce_roles();

CREATE OR REPLACE FUNCTION public.is_estimator_group_member()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.estimator_group_members e
    WHERE e.user_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION public.is_estimator_group_member() IS 'True if current user is in the Estimator Inbox group.';

ALTER TABLE public.estimator_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estimator_group_members_select_dev_or_self"
  ON public.estimator_group_members FOR SELECT
  TO authenticated
  USING (public.is_dev() OR user_id = auth.uid());

CREATE POLICY "estimator_group_members_insert_dev"
  ON public.estimator_group_members FOR INSERT
  TO authenticated
  WITH CHECK (public.is_dev());

CREATE POLICY "estimator_group_members_delete_dev"
  ON public.estimator_group_members FOR DELETE
  TO authenticated
  USING (public.is_dev());

CREATE TABLE public.estimator_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) >= 1 AND char_length(title) <= 2000),
  links text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  closed_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  closed_note text,
  job_ledger_id uuid REFERENCES public.jobs_ledger(id) ON DELETE SET NULL,
  bid_id uuid REFERENCES public.bids(id) ON DELETE SET NULL,
  reference_summary text,
  location_lat double precision,
  location_lng double precision,
  CONSTRAINT estimator_requests_job_or_bid_not_both_chk
    CHECK (NOT (job_ledger_id IS NOT NULL AND bid_id IS NOT NULL))
);

COMMENT ON TABLE public.estimator_requests IS 'Estimator Inbox messages to the estimator group. Any authenticated user may create (app restricts senders); dev and estimator group members see inbox and may mark closed.';
COMMENT ON COLUMN public.estimator_requests.links IS 'URLs for placeholders [1], [2], ... in title; same pattern as checklist_items.links.';
COMMENT ON COLUMN public.estimator_requests.closed_note IS 'Note entered by the user who closed the request. Required when closing (enforced in app).';
COMMENT ON COLUMN public.estimator_requests.job_ledger_id IS 'Optional jobs_ledger row; mutually exclusive with bid_id.';
COMMENT ON COLUMN public.estimator_requests.bid_id IS 'Optional bids row; mutually exclusive with job_ledger_id.';
COMMENT ON COLUMN public.estimator_requests.reference_summary IS 'Denormalized J…/B… line at send time for inbox and push.';
COMMENT ON COLUMN public.estimator_requests.location_lat IS 'Latitude at send time (optional).';
COMMENT ON COLUMN public.estimator_requests.location_lng IS 'Longitude at send time (optional).';

CREATE OR REPLACE FUNCTION public.estimator_requests_guard_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.from_user_id IS DISTINCT FROM NEW.from_user_id
     OR OLD.title IS DISTINCT FROM NEW.title
     OR OLD.links IS DISTINCT FROM NEW.links
     OR OLD.created_at IS DISTINCT FROM NEW.created_at
     OR OLD.job_ledger_id IS DISTINCT FROM NEW.job_ledger_id
     OR OLD.bid_id IS DISTINCT FROM NEW.bid_id
     OR OLD.reference_summary IS DISTINCT FROM NEW.reference_summary
     OR OLD.location_lat IS DISTINCT FROM NEW.location_lat
     OR OLD.location_lng IS DISTINCT FROM NEW.location_lng
  THEN
    IF NOT public.is_dev() THEN
      RAISE EXCEPTION 'Cannot modify estimator request content';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER estimator_requests_guard_update
  BEFORE UPDATE ON public.estimator_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.estimator_requests_guard_update();

ALTER TABLE public.estimator_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estimator_requests_select"
  ON public.estimator_requests FOR SELECT
  TO authenticated
  USING (
    from_user_id = auth.uid()
    OR public.is_dev()
    OR public.is_estimator_group_member()
  );

CREATE POLICY "estimator_requests_insert"
  ON public.estimator_requests FOR INSERT
  TO authenticated
  WITH CHECK (from_user_id = auth.uid());

CREATE POLICY "estimator_requests_update_group_or_dev"
  ON public.estimator_requests FOR UPDATE
  TO authenticated
  USING (public.is_dev() OR public.is_estimator_group_member())
  WITH CHECK (public.is_dev() OR public.is_estimator_group_member());

-- Thread notes
CREATE TABLE public.estimator_request_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.estimator_requests(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) >= 1 AND char_length(body) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.estimator_request_notes IS 'Chronological notes on estimator_requests; INSERT restricted to dev and estimator group members; SELECT aligned with estimator_requests visibility.';

CREATE INDEX idx_estimator_request_notes_request_created
  ON public.estimator_request_notes (request_id, created_at);

ALTER TABLE public.estimator_request_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estimator_request_notes_select"
  ON public.estimator_request_notes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.estimator_requests r
      WHERE r.id = estimator_request_notes.request_id
        AND (
          r.from_user_id = auth.uid()
          OR public.is_dev()
          OR public.is_estimator_group_member()
        )
    )
  );

CREATE POLICY "estimator_request_notes_insert"
  ON public.estimator_request_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    author_user_id = auth.uid()
    AND (public.is_dev() OR public.is_estimator_group_member())
    AND EXISTS (
      SELECT 1 FROM public.estimator_requests r
      WHERE r.id = estimator_request_notes.request_id
        AND (
          r.from_user_id = auth.uid()
          OR public.is_dev()
          OR public.is_estimator_group_member()
        )
    )
  );

-- Per-user dismissals of closed requests
CREATE TABLE public.estimator_request_dismissals (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES public.estimator_requests(id) ON DELETE CASCADE,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, request_id)
);

COMMENT ON TABLE public.estimator_request_dismissals IS 'Per-user dismissals of closed estimator requests.';

ALTER TABLE public.estimator_request_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estimator_request_dismissals_select_own"
  ON public.estimator_request_dismissals FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "estimator_request_dismissals_insert_own"
  ON public.estimator_request_dismissals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- RPC: note stats for inbox cards
CREATE OR REPLACE FUNCTION public.estimator_inbox_note_stats(p_request_ids uuid[])
RETURNS TABLE (request_id uuid, note_count bigint, last_note_at timestamptz)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT n.request_id,
         count(*)::bigint AS note_count,
         max(n.created_at) AS last_note_at
  FROM public.estimator_request_notes n
  WHERE n.request_id = ANY(p_request_ids)
  GROUP BY n.request_id
$$;

COMMENT ON FUNCTION public.estimator_inbox_note_stats(uuid[]) IS 'Aggregates thread notes for dashboard estimator inbox cards; empty input returns no rows.';

GRANT EXECUTE ON FUNCTION public.estimator_inbox_note_stats(uuid[]) TO authenticated;
