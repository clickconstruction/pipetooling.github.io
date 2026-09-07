SET lock_timeout = '3s';

-- v2.3080 — two lessons from the first shadow batch (LEARNING_PLAN lever 2):
--
-- (a) TEACHER ATTRIBUTION. A shadow scores against whichever estimator sends
--     the reference. b481 scored against Grace's number — practice, not the
--     calibration standard. users.calibration_standard names the estimator(s)
--     whose sent numbers ARE the standard (Wendi today); twin_shadow_runs
--     records WHOSE number each run scored against, and the gate math takes
--     only standard-teacher runs.
--
-- (b) PLANS READABLE BY ROBOTS. A live bid whose plans link the Drive service
--     account cannot read is invisible to the shadow program (b480 blocked on
--     exactly this). plan-fetch ?probe=1 records the answer on the bid so the
--     board can show it and the dispatcher can skip it.
--
-- Additive, idempotent; the only data change is the standard flag on Wendi
-- and a teacher backfill on already-scored runs.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS calibration_standard boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.users.calibration_standard IS
  'Twin program (v2.3080): this estimator''s sent numbers are the calibration standard — a shadow scored against their bid counts toward Gate B; other teachers are practice. Owner-set.';

-- Wendi (users.id cda62e3a-…) is the only calibration standard on 2026-09-07.
UPDATE public.users
   SET calibration_standard = true
 WHERE id = 'cda62e3a-5f71-421b-8f39-8d79ba372b83'
   AND NOT calibration_standard;

ALTER TABLE public.twin_shadow_runs ADD COLUMN IF NOT EXISTS teacher_user_id uuid;
ALTER TABLE public.twin_shadow_runs ADD COLUMN IF NOT EXISTS teacher_name text;
COMMENT ON COLUMN public.twin_shadow_runs.teacher_user_id IS
  'WHOSE number this shadow scored against: the reference bid''s estimator (else the sender who attested the send, else its creator). Stamped by score_shadows.';
COMMENT ON COLUMN public.twin_shadow_runs.teacher_name IS
  'Display snapshot of the teacher''s name at scoring time.';

-- Backfill already-scored runs from the reference bid.
UPDATE public.twin_shadow_runs r
   SET teacher_user_id = t.uid,
       teacher_name = u.name
  FROM (
    SELECT b.id AS bid_id,
           COALESCE(b.estimator_id, b.bid_date_sent_attested_by, b.created_by) AS uid
      FROM public.bids b
  ) t
  LEFT JOIN public.users u ON u.id = t.uid
 WHERE r.reference_bid_id = t.bid_id
   AND r.status = 'scored'
   AND r.teacher_user_id IS NULL
   AND t.uid IS NOT NULL;

ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS plans_robot_readable boolean;
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS plans_robot_probed_at timestamptz;
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS plans_robot_probe_note text;
COMMENT ON COLUMN public.bids.plans_robot_readable IS
  'Can the Drive intake service account read the file behind plans_link? NULL = never probed. Written by plan-fetch ?probe=1 (v2.3080).';
COMMENT ON COLUMN public.bids.plans_robot_probed_at IS 'When plans_robot_readable was last checked.';
COMMENT ON COLUMN public.bids.plans_robot_probe_note IS 'Plain-words reason when unreadable (not shared, folder link, not a Drive link, …).';

-- list_shadow_runs gains the teacher columns. The return type changes, so the
-- function is dropped and recreated (same transaction — no window without it).
DROP FUNCTION IF EXISTS public.list_shadow_runs();

CREATE FUNCTION public.list_shadow_runs()
RETURNS TABLE (
  id uuid,
  status text,
  axis text,
  created_at timestamptz,
  locked_at timestamptz,
  scored_at timestamptz,
  shadow_bid_number text,
  reference_bid_number text,
  project_name text,
  requested_by_name text,
  reference_sent_at timestamptz,
  locked_total numeric,
  reference_value numeric,
  delta_pct numeric,
  teacher_name text,
  teacher_standard boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id,
    r.status,
    r.axis,
    r.created_at,
    r.locked_at,
    r.scored_at,
    sb.bid_number AS shadow_bid_number,
    rb.bid_number AS reference_bid_number,
    rb.project_name,
    ru.name AS requested_by_name,
    rb.bid_date_sent::timestamptz AS reference_sent_at,
    -- The seal: money columns stay NULL until the run is scored.
    CASE WHEN r.status = 'scored' THEN r.locked_total END AS locked_total,
    CASE WHEN r.status = 'scored' THEN r.reference_value END AS reference_value,
    CASE WHEN r.status = 'scored' THEN r.delta_pct END AS delta_pct,
    -- Teacher: the stamped one once scored; before that, the reference's
    -- assigned estimator (who WILL teach it). Names are not money.
    COALESCE(r.teacher_name, tu.name) AS teacher_name,
    tu.calibration_standard AS teacher_standard
  FROM public.twin_shadow_runs r
  JOIN public.bids sb ON sb.id = r.shadow_bid_id
  JOIN public.bids rb ON rb.id = r.reference_bid_id
  LEFT JOIN public.users ru ON ru.id = rb.robot_requested_by
  LEFT JOIN public.users tu
    ON tu.id = COALESCE(r.teacher_user_id, rb.estimator_id, rb.bid_date_sent_attested_by, rb.created_by)
  ORDER BY r.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.list_shadow_runs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_shadow_runs() TO service_role;
REVOKE EXECUTE ON FUNCTION public.list_shadow_runs() FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_shadow_runs() FROM public;
