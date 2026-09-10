SET lock_timeout = '3s';

-- v2.3234 — Record your best effort, then open the robot's envelope.
--
-- The envelope (v2.3222) opens at send: the human number goes on record and the
-- robot's sealed number becomes safe to show. That is the moment the robot can
-- only teach. Earlier — after pricing, on the Cover Letter — the robot can still
-- change the bid. So the estimator records the number they would send right now
-- as their BEST EFFORT; that record is the blind human number the shadow scores
-- against, the envelope opens against it, and the sent value that follows is a
-- second number whose gap from the first is the robot's measured influence.
--
-- Two rules make it safe:
--   1. The robots never read it. A twin account reads `bids` like staff, so the
--      number lives here, in a table the twin fence closes; the scorer reads it
--      as SECURITY DEFINER. `bids.bid_value` stays NULL until send, as today.
--   2. First record wins. Staff can insert, never update or delete — a number
--      re-recorded after the reveal would be the anchoring the seal exists to
--      prevent. The bid's value can still change; that change is on the ledger.
--
-- Scoring: score_locked_shadows prefers the best effort when one exists and
-- falls back to the sent value (today's rule). Two new triggers fire it — when
-- a best effort is recorded, and when a run locks (the robot may lock after the
-- human recorded; still blind, still scored at once, so the envelope waits).

-- ---------------------------------------------------------------------------
-- 1. The table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bid_best_efforts (
  bid_id uuid PRIMARY KEY REFERENCES public.bids(id) ON DELETE CASCADE,
  value numeric NOT NULL CHECK (value > 0),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  note text
);

COMMENT ON TABLE public.bid_best_efforts IS
  'v2.3234 — the number an estimator would send right now, recorded from the Cover Letter after pricing and before the robot''s envelope opens. One row per bid, insert-only (first record wins). Twins can never read it: the shadow scorer reads it as definer. The blind human reference for shadow scoring when it exists; bids.bid_value at send otherwise.';

ALTER TABLE public.bid_best_efforts ENABLE ROW LEVEL SECURITY;

-- Staff who work robot audits read and record; nobody updates or deletes through the API.
DROP POLICY IF EXISTS bid_best_efforts_select ON public.bid_best_efforts;
CREATE POLICY bid_best_efforts_select ON public.bid_best_efforts FOR SELECT
  USING (EXISTS ( SELECT 1 FROM public.users
    WHERE users.id = ( SELECT auth.uid() ) AND users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role])));

DROP POLICY IF EXISTS bid_best_efforts_insert ON public.bid_best_efforts;
CREATE POLICY bid_best_efforts_insert ON public.bid_best_efforts FOR INSERT
  WITH CHECK (
    recorded_by = ( SELECT auth.uid() )
    AND EXISTS ( SELECT 1 FROM public.users
      WHERE users.id = ( SELECT auth.uid() ) AND users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role])));

-- The twin fence, explicit: a digital twin never selects, inserts, updates or deletes here.
DROP POLICY IF EXISTS bid_best_efforts_twin_fence ON public.bid_best_efforts;
CREATE POLICY bid_best_efforts_twin_fence ON public.bid_best_efforts AS RESTRICTIVE FOR ALL
  USING (NOT public.is_digital_twin())
  WITH CHECK (NOT public.is_digital_twin());

-- ---------------------------------------------------------------------------
-- 2. What the run scored against
-- ---------------------------------------------------------------------------
ALTER TABLE public.twin_shadow_runs
  ADD COLUMN IF NOT EXISTS reference_kind text
  CHECK (reference_kind IS NULL OR reference_kind IN ('best_effort', 'sent'));

COMMENT ON COLUMN public.twin_shadow_runs.reference_kind IS
  'v2.3234 — which human number reference_value is: ''best_effort'' (recorded before the reveal, blind vs blind) or ''sent'' (bids.bid_value at send, the pre-v2.3234 rule). NULL until scored.';

-- ---------------------------------------------------------------------------
-- 3. The scorer prefers the best effort
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.score_locked_shadows(p_reference_bid_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_ref_value numeric;
  v_kind text;
  v_delta numeric;
  v_teacher_id uuid;
  v_teacher_name text;
  v_teacher_standard boolean;
  v_teacher_label text;
  v_line text;
  v_scored integer := 0;
BEGIN
  FOR r IN
    SELECT s.id, s.shadow_bid_id, s.reference_bid_id, s.axis, s.locked_total, s.twin_user_id,
           b.bid_number, b.project_name, b.bid_value, b.bid_date_sent,
           b.estimator_id, b.bid_date_sent_attested_by, b.created_by,
           be.value AS best_effort_value, be.recorded_by AS best_effort_by
      FROM public.twin_shadow_runs s
      JOIN public.bids b ON b.id = s.reference_bid_id
      LEFT JOIN public.bid_best_efforts be ON be.bid_id = b.id
     WHERE s.status = 'locked'
       AND (p_reference_bid_id IS NULL OR s.reference_bid_id = p_reference_bid_id)
       AND (
         be.value IS NOT NULL
         OR (b.bid_date_sent IS NOT NULL AND b.bid_value IS NOT NULL AND b.bid_value > 0)
       )
     ORDER BY s.locked_at NULLS LAST, s.created_at
  LOOP
    -- The blind human number when one was recorded; the sent value otherwise.
    v_kind := CASE WHEN r.best_effort_value IS NOT NULL THEN 'best_effort' ELSE 'sent' END;
    v_ref_value := COALESCE(r.best_effort_value, r.bid_value);
    -- Mirrors twin-mcp score_shadows: round((locked - human) / human * 100, 1).
    v_delta := round(((r.locked_total - v_ref_value) / v_ref_value) * 100, 1);

    -- WHOSE number was this? Assigned estimator, else whoever recorded the best
    -- effort, else the sender who attested the send, else the creator.
    v_teacher_id := COALESCE(
      r.estimator_id,
      CASE WHEN v_kind = 'best_effort' THEN r.best_effort_by END,
      r.bid_date_sent_attested_by,
      r.created_by
    );
    v_teacher_name := NULL;
    v_teacher_standard := false;
    IF v_teacher_id IS NOT NULL THEN
      SELECT u.name, COALESCE(u.calibration_standard, false)
        INTO v_teacher_name, v_teacher_standard
        FROM public.users u
       WHERE u.id = v_teacher_id;
    END IF;

    UPDATE public.twin_shadow_runs
       SET status = 'scored',
           reference_value = v_ref_value,
           reference_kind = v_kind,
           delta_pct = v_delta,
           scored_at = now(),
           teacher_user_id = v_teacher_id,
           teacher_name = v_teacher_name
     WHERE id = r.id
       AND status = 'locked';
    IF NOT FOUND THEN
      CONTINUE; -- raced with score_shadows; that path stamped the ledger.
    END IF;

    v_teacher_label := CASE
      WHEN v_teacher_name IS NOT NULL THEN
        ' by ' || v_teacher_name || ' (' ||
        CASE WHEN v_teacher_standard THEN 'calibration standard' ELSE 'practice teacher — not a gate run' END || ')'
      ELSE ''
    END;

    v_line := '[shadow SCORECARD] Twin locked $' || public.shadow_fmt_money(r.locked_total)
      || ' (blind, pre-send) vs human '
      || CASE WHEN v_kind = 'best_effort' THEN 'best effort $' ELSE '$' END
      || public.shadow_fmt_money(v_ref_value)
      || CASE WHEN v_kind = 'best_effort' THEN ' (recorded before the reveal, unsent)' ELSE ' (sent)' END
      || v_teacher_label
      || ' = ' || CASE WHEN v_delta > 0 THEN '+' ELSE '' END || public.shadow_fmt_pct(v_delta) || '%'
      || ' — axis ' || COALESCE(r.axis, 'unclassified')
      || ', reference b' || COALESCE(r.bid_number, '?') || ' (' || COALESCE(r.project_name, '') || ').';

    INSERT INTO public.bids_submission_entries (bid_id, notes, created_by)
    VALUES (r.shadow_bid_id, v_line, r.twin_user_id);
    INSERT INTO public.bids_submission_entries (bid_id, notes, created_by)
    VALUES (r.reference_bid_id, v_line, r.twin_user_id);

    v_scored := v_scored + 1;
  END LOOP;

  RETURN v_scored;
END;
$$;

COMMENT ON FUNCTION public.score_locked_shadows(uuid) IS
  'v2.3234 — scores every LOCKED twin_shadow_runs row whose reference has a recorded best effort (bid_best_efforts — the blind human number, preferred) or, failing that, bid_date_sent + bid_value (the v2.3126 rule). Stamps reference_kind, delta_pct, teacher (estimator → best-effort recorder → attested sender → creator) and the [shadow SCORECARD] note on both ledgers. Fired by the best-effort insert, the run lock, and the send.';

-- ---------------------------------------------------------------------------
-- 4. Two more doors into the scorer (both swallow failures — a record or a lock
--    must never fail because scoring did)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bid_best_efforts_score_on_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM public.score_locked_shadows(NEW.bid_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'bid_best_efforts_score_on_record: shadow scoring failed for bid % (%): %', NEW.bid_id, SQLSTATE, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.bid_best_efforts_score_on_record() IS
  'v2.3234 — AFTER INSERT ON bid_best_efforts: scores the bid''s locked shadow against the just-recorded best effort, so the envelope can open at once.';

REVOKE ALL ON FUNCTION public.bid_best_efforts_score_on_record() FROM public;
REVOKE ALL ON FUNCTION public.bid_best_efforts_score_on_record() FROM anon;
REVOKE ALL ON FUNCTION public.bid_best_efforts_score_on_record() FROM authenticated;

DROP TRIGGER IF EXISTS bid_best_efforts_score_on_record_trg ON public.bid_best_efforts;
CREATE TRIGGER bid_best_efforts_score_on_record_trg
  AFTER INSERT ON public.bid_best_efforts
  FOR EACH ROW
  EXECUTE FUNCTION public.bid_best_efforts_score_on_record();

CREATE OR REPLACE FUNCTION public.twin_shadow_runs_score_on_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM public.score_locked_shadows(NEW.reference_bid_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'twin_shadow_runs_score_on_lock: shadow scoring failed for run % (%): %', NEW.id, SQLSTATE, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.twin_shadow_runs_score_on_lock() IS
  'v2.3234 — AFTER UPDATE OF status ON twin_shadow_runs WHEN the run just locked: if the human already recorded a best effort (or already sent with a value), score at once. The robot locked blind either way — it cannot read bid_best_efforts.';

REVOKE ALL ON FUNCTION public.twin_shadow_runs_score_on_lock() FROM public;
REVOKE ALL ON FUNCTION public.twin_shadow_runs_score_on_lock() FROM anon;
REVOKE ALL ON FUNCTION public.twin_shadow_runs_score_on_lock() FROM authenticated;

DROP TRIGGER IF EXISTS twin_shadow_runs_score_on_lock_trg ON public.twin_shadow_runs;
CREATE TRIGGER twin_shadow_runs_score_on_lock_trg
  AFTER UPDATE OF status ON public.twin_shadow_runs
  FOR EACH ROW
  WHEN (NEW.status = 'locked')
  EXECUTE FUNCTION public.twin_shadow_runs_score_on_lock();

-- ---------------------------------------------------------------------------
-- 5. list_shadow_runs says which number the run scored against
-- ---------------------------------------------------------------------------
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
  teacher_standard boolean,
  reference_kind text
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
    COALESCE(r.teacher_name, tu.name) AS teacher_name,
    tu.calibration_standard AS teacher_standard,
    CASE WHEN r.status = 'scored' THEN r.reference_kind END AS reference_kind
  FROM public.twin_shadow_runs r
  JOIN public.bids sb ON sb.id = r.shadow_bid_id
  JOIN public.bids rb ON rb.id = r.reference_bid_id
  LEFT JOIN public.users ru ON ru.id = rb.robot_requested_by
  LEFT JOIN public.users tu
    ON tu.id = COALESCE(r.teacher_user_id, rb.estimator_id, rb.bid_date_sent_attested_by, rb.created_by)
  ORDER BY r.created_at DESC;
$$;

COMMENT ON FUNCTION public.list_shadow_runs() IS
  'v2.3234 — staff read of twin_shadow_runs by bid number; money NULL until scored (the seal); teacher attribution (v2.3080); reference_kind says whether a scored run measured against the recorded best effort or the sent value.';

GRANT EXECUTE ON FUNCTION public.list_shadow_runs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_shadow_runs() TO service_role;
REVOKE EXECUTE ON FUNCTION public.list_shadow_runs() FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_shadow_runs() FROM public;

-- Training mode (users.read_only): the restrictive policy + the statement trigger.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
