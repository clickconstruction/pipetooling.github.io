SET lock_timeout = '3s';

-- Submittals stage 6b: the robot's task queue. The office asks from the Submittals tab
-- (read the schedule off the plans · split a house's PDF by tag · read a reviewer's
-- redlines); a twin claims queued → working (next_submittal_task), writes its result
-- (put_submittal_result) and flips ready (finish_submittal_task); a person confirms every
-- row on the tab. blocked = it could not read the input. The robot never sends and never
-- decides. Shape follows bid_price_matrix_requests (20260911023538).

CREATE TABLE IF NOT EXISTS public.bid_submittal_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  submittal_id uuid REFERENCES public.bid_submittals(id) ON DELETE CASCADE,
  kind text NOT NULL,
  -- read_schedule: {} · file_cut_sheets: { file_index, path, name, pages } · read_redlines: { file_index, path, name, person_name }
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- read_schedule: { rows: [{ tag, fixture, manufacturer, model, description, confidence }] }
  -- file_cut_sheets: { guesses: [{ page, tag, confidence }], skipped: [page] }
  -- read_redlines: { annotations: [{ page, tag, text, proposed, confidence }] }
  result jsonb,
  status text NOT NULL DEFAULT 'queued',
  requested_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  claimed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  claimed_at timestamptz,
  heartbeat_at timestamptz,
  finished_at timestamptz,
  -- The office confirmed (or discarded) the result: the task is done.
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bid_submittal_tasks_kind_check CHECK (kind IN ('read_schedule', 'file_cut_sheets', 'read_redlines')),
  CONSTRAINT bid_submittal_tasks_status_check CHECK (status IN ('queued', 'working', 'ready', 'blocked', 'cancelled', 'done'))
);
CREATE INDEX IF NOT EXISTS bid_submittal_tasks_bid_idx ON public.bid_submittal_tasks (bid_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS bid_submittal_tasks_queue_idx ON public.bid_submittal_tasks (status, requested_at) WHERE status IN ('queued', 'working');
COMMENT ON TABLE public.bid_submittal_tasks IS
  'Submittals 6b — the office''s asks of the submittal robot (read_schedule · file_cut_sheets · read_redlines). A twin claims queued → working, writes result, flips ready; the office confirms on the Submittals tab (done) or the robot flips blocked. Never sends, never decides.';

ALTER TABLE public.bid_submittal_tasks ENABLE ROW LEVEL SECURITY;

-- The office (pricing sharers on bids they can price) queues, reads, cancels and marks reviewed;
-- the twin writes through twin-mcp with the service role.
DROP POLICY IF EXISTS "Pricing sharers can read bid_submittal_tasks" ON public.bid_submittal_tasks;
CREATE POLICY "Pricing sharers can read bid_submittal_tasks" ON public.bid_submittal_tasks FOR SELECT
  USING (public.is_pricing_sharer() AND public.can_access_bid_for_pricing(bid_id));
DROP POLICY IF EXISTS "Pricing sharers can queue bid_submittal_tasks" ON public.bid_submittal_tasks;
CREATE POLICY "Pricing sharers can queue bid_submittal_tasks" ON public.bid_submittal_tasks FOR INSERT
  WITH CHECK (public.is_pricing_sharer() AND public.can_access_bid_for_pricing(bid_id));
DROP POLICY IF EXISTS "Pricing sharers can update bid_submittal_tasks" ON public.bid_submittal_tasks;
CREATE POLICY "Pricing sharers can update bid_submittal_tasks" ON public.bid_submittal_tasks FOR UPDATE
  USING (public.is_pricing_sharer() AND public.can_access_bid_for_pricing(bid_id))
  WITH CHECK (public.is_pricing_sharer() AND public.can_access_bid_for_pricing(bid_id));

-- House rules: read-only training mode + the twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
