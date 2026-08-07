SET lock_timeout = '3s';

-- Job % progress -> activity ledger (v2.1451). Every jobs_ledger.pct_complete
-- change already lands in job_pct_events (v2.1441 single-writer trigger);
-- this bridges those rows into job_activity_events so progress updates show
-- on the Jobs -> Pipeline activity list (and every other feed consumer) as a
-- 'progress_updated' event — same one-writer-per-source pattern as
-- job_status_events_to_activity (20260608010000), idempotency-guarded on
-- (event_type, detail->>'source_id').
--
-- 'seed' rows are baseline anchors, not user actions — they never emit
-- activity. The previous value is derived from the prior pct event so the
-- summary reads "Progress 42% -> 55%" when history exists.

CREATE OR REPLACE FUNCTION public.job_pct_events_to_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev integer;
  v_has_prev boolean;
BEGIN
  IF NEW.source = 'seed' THEN
    RETURN NEW;
  END IF;

  SELECT e.pct, true INTO v_prev, v_has_prev
  FROM public.job_pct_events e
  WHERE e.job_id = NEW.job_id AND e.changed_at < NEW.changed_at
  ORDER BY e.changed_at DESC
  LIMIT 1;

  INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
  SELECT
    NEW.job_id,
    'progress_updated',
    coalesce(NEW.changed_at, now()),
    NEW.changed_by_user_id,
    CASE
      WHEN NEW.pct IS NULL THEN 'Progress cleared'
      WHEN coalesce(v_has_prev, false) AND v_prev IS NOT NULL THEN 'Progress ' || v_prev || '% → ' || NEW.pct || '%'
      ELSE 'Progress set to ' || NEW.pct || '%'
    END,
    jsonb_build_object('from', v_prev, 'to', NEW.pct, 'source', NEW.source, 'source_id', NEW.id::text),
    false
  WHERE NOT EXISTS (
    SELECT 1 FROM public.job_activity_events e
    WHERE e.event_type = 'progress_updated' AND e.detail ->> 'source_id' = NEW.id::text
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS job_pct_events_to_activity_ins ON public.job_pct_events;
CREATE TRIGGER job_pct_events_to_activity_ins
  AFTER INSERT ON public.job_pct_events
  FOR EACH ROW EXECUTE FUNCTION public.job_pct_events_to_activity();

-- Idempotent backfill for non-seed pct events recorded since Phase 0 shipped
-- (a day's worth at most) so the feed doesn't have a silent gap.
INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
SELECT
  p.job_id,
  'progress_updated',
  p.changed_at,
  p.changed_by_user_id,
  CASE
    WHEN p.pct IS NULL THEN 'Progress cleared'
    WHEN prev.pct IS NOT NULL THEN 'Progress ' || prev.pct || '% → ' || p.pct || '%'
    ELSE 'Progress set to ' || p.pct || '%'
  END,
  jsonb_build_object('from', prev.pct, 'to', p.pct, 'source', p.source, 'source_id', p.id::text),
  false
FROM public.job_pct_events p
LEFT JOIN LATERAL (
  SELECT e.pct FROM public.job_pct_events e
  WHERE e.job_id = p.job_id AND e.changed_at < p.changed_at
  ORDER BY e.changed_at DESC
  LIMIT 1
) prev ON true
WHERE p.source <> 'seed'
  AND NOT EXISTS (
    SELECT 1 FROM public.job_activity_events e
    WHERE e.event_type = 'progress_updated' AND e.detail ->> 'source_id' = p.id::text
  );
