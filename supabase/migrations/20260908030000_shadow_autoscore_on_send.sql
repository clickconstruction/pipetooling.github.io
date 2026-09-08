SET lock_timeout = '3s';

-- v2.3126 — shadow scorecards land the moment the human bid is sent.
--
-- A locked shadow (twin_shadow_runs.status = 'locked') used to stay sealed
-- until the NEXT twin agent happened to call the `score_shadows` verb in
-- twin-mcp — hours or days after the estimator hit Send. This moves the same
-- scoring logic into the database: an AFTER UPDATE trigger on bids fires when
-- bid_date_sent + bid_value are both present and scores that bid's shadow in
-- the same transaction. `score_shadows` stays as the manual / idempotent door
-- (it only ever scores status = 'locked' rows, so both paths are safe to run
-- any number of times). Additive, idempotent.

-- toLocaleString() twins: "123,456" / "123,456.5" / "-3.2" — thousands
-- separators, trailing zeros dropped only when there is a decimal part.
CREATE OR REPLACE FUNCTION public.shadow_fmt_money(v numeric)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE WHEN strpos(t, '.') > 0 THEN rtrim(rtrim(t, '0'), '.') ELSE t END
    FROM (SELECT to_char(round(v, 3), 'FM999,999,999,999,999,990.999') AS t) x;
$$;

CREATE OR REPLACE FUNCTION public.shadow_fmt_pct(v numeric)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE WHEN strpos(t, '.') > 0 THEN rtrim(rtrim(t, '0'), '.') ELSE t END
    FROM (SELECT to_char(round(v, 1), 'FM999999999990.9') AS t) x;
$$;

CREATE OR REPLACE FUNCTION public.score_locked_shadows(p_reference_bid_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_ref_value numeric;
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
           b.estimator_id, b.bid_date_sent_attested_by, b.created_by
      FROM public.twin_shadow_runs s
      JOIN public.bids b ON b.id = s.reference_bid_id
     WHERE s.status = 'locked'
       AND (p_reference_bid_id IS NULL OR s.reference_bid_id = p_reference_bid_id)
       AND b.bid_date_sent IS NOT NULL
       AND b.bid_value IS NOT NULL
       AND b.bid_value > 0
     ORDER BY s.locked_at NULLS LAST, s.created_at
  LOOP
    v_ref_value := r.bid_value;
    -- Mirrors twin-mcp score_shadows: round((locked - human) / human * 100, 1).
    v_delta := round(((r.locked_total - v_ref_value) / v_ref_value) * 100, 1);

    -- WHOSE number was this? Assigned estimator, else the sender who attested
    -- the send, else the creator (v2.3080 teacher attribution).
    v_teacher_id := COALESCE(r.estimator_id, r.bid_date_sent_attested_by, r.created_by);
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

    -- Same wording and number style as the twin-mcp scorecard note
    -- (toLocaleString: thousands separators, no trailing zeros).
    v_line := '[shadow SCORECARD] Twin locked $' || public.shadow_fmt_money(r.locked_total)
      || ' (blind, pre-send) vs human $' || public.shadow_fmt_money(v_ref_value)
      || v_teacher_label
      || ' = ' || CASE WHEN v_delta > 0 THEN '+' ELSE '' END || public.shadow_fmt_pct(v_delta) || '%'
      || ' — axis ' || COALESCE(r.axis, 'unclassified')
      || ', reference b' || COALESCE(r.bid_number, '?') || ' (' || COALESCE(r.project_name, '') || ').';

    -- Both ledgers: the shadow bid and the reference bid. Authored as the twin
    -- seat that locked the number, not the human whose Send fired the trigger.
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
  'v2.3126 — scores every LOCKED twin_shadow_runs row whose reference bid now has bid_date_sent + bid_value (or only the given reference''s): delta_pct = round((locked - human) / human * 100, 1), teacher = estimator → attested sender → creator, status → scored, and the [shadow SCORECARD] note on both ledgers. Same logic as twin-mcp score_shadows, which stays the manual/idempotent door. Why: the scorecard used to wait for the next agent run to call score_shadows; the bids_score_shadow_on_send_trg trigger calls this on Send so the grade lands immediately. Returns the count scored.';
COMMENT ON FUNCTION public.shadow_fmt_money(numeric) IS 'v2.3126 — JS toLocaleString() twin for the scorecard note: thousands separators, no trailing zeros.';
COMMENT ON FUNCTION public.shadow_fmt_pct(numeric) IS 'v2.3126 — one-decimal percent as JS prints it ("5", "-3.2") for the scorecard note.';

REVOKE ALL ON FUNCTION public.score_locked_shadows(uuid) FROM public;
REVOKE ALL ON FUNCTION public.score_locked_shadows(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.score_locked_shadows(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.score_locked_shadows(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.shadow_fmt_money(numeric) FROM public;
REVOKE ALL ON FUNCTION public.shadow_fmt_money(numeric) FROM anon;
REVOKE ALL ON FUNCTION public.shadow_fmt_money(numeric) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.shadow_fmt_money(numeric) TO service_role;
REVOKE ALL ON FUNCTION public.shadow_fmt_pct(numeric) FROM public;
REVOKE ALL ON FUNCTION public.shadow_fmt_pct(numeric) FROM anon;
REVOKE ALL ON FUNCTION public.shadow_fmt_pct(numeric) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.shadow_fmt_pct(numeric) TO service_role;

-- The trigger: scoring can NEVER break a bid update. Any failure inside the
-- scorer is caught and logged as a WARNING; the Send still goes through and
-- score_shadows picks the run up later.
CREATE OR REPLACE FUNCTION public.bids_score_shadow_on_send()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM public.score_locked_shadows(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'bids_score_shadow_on_send: shadow scoring failed for bid % (%): %', NEW.id, SQLSTATE, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.bids_score_shadow_on_send() IS
  'v2.3126 — AFTER UPDATE OF bid_date_sent, bid_value ON bids: scores the locked shadow of this bid the moment it is sent with a value. Failures are swallowed into a WARNING so the bid update always succeeds.';

REVOKE ALL ON FUNCTION public.bids_score_shadow_on_send() FROM public;
REVOKE ALL ON FUNCTION public.bids_score_shadow_on_send() FROM anon;
REVOKE ALL ON FUNCTION public.bids_score_shadow_on_send() FROM authenticated;

DROP TRIGGER IF EXISTS bids_score_shadow_on_send_trg ON public.bids;
CREATE TRIGGER bids_score_shadow_on_send_trg
  AFTER UPDATE OF bid_date_sent, bid_value ON public.bids
  FOR EACH ROW
  WHEN (NEW.bid_date_sent IS NOT NULL AND NEW.bid_value IS NOT NULL)
  EXECUTE FUNCTION public.bids_score_shadow_on_send();
