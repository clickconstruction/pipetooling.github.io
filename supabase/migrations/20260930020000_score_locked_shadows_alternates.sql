-- v2.4199 — the shadow scorer's reference is the WHOLE bid (alternates round two, PR 5).
-- score_locked_shadows scored a sent reference against bids.bid_value, which since v2.4195 is
-- the BASE of a bid that offers a with-and-without alternate; the twin prices every row it
-- imports, alternates included, so its locked total is the whole and the delta read as an
-- overshoot of exactly the alternate's price. The sent reference is now bid_value plus every
-- offered alternate's stamped add-on (cover_letter_alt_texts.groups[*].amount where offered is
-- not false). The best-effort branch is untouched: the card records the whole from v2.4199 on.
-- Body otherwise verbatim from 20260910210000_bid_best_efforts.sql (the live definition).
SET lock_timeout = '3s';

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
           be.value AS best_effort_value, be.recorded_by AS best_effort_by,
           COALESCE((
             SELECT sum((g.value->>'amount')::numeric)
               FROM jsonb_each(COALESCE(b.cover_letter_alt_texts->'groups', '{}'::jsonb)) AS g
              WHERE jsonb_typeof(b.cover_letter_alt_texts->'groups') = 'object'
                AND COALESCE(g.value->>'offered', 'true') <> 'false'
                AND (g.value->>'amount') ~ '^[0-9]+(\.[0-9]+)?$'
                AND (g.value->>'amount')::numeric > 0
           ), 0) AS alt_add_ons
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
    -- The blind human number when one was recorded; the sent value otherwise —
    -- the WHOLE bid (v2.4199): the base plus every offered alternate's stamped add-on
    -- (cover_letter_alt_texts.groups[*].amount where offered is not false). Mirrors
    -- supabase/functions/_shared/referenceWhole.ts.
    v_kind := CASE WHEN r.best_effort_value IS NOT NULL THEN 'best_effort' ELSE 'sent' END;
    v_ref_value := COALESCE(r.best_effort_value, r.bid_value + r.alt_add_ons);
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
  'v2.4199 — scores every LOCKED twin_shadow_runs row whose reference has a recorded best effort (bid_best_efforts — the blind human number, preferred) or, failing that, bid_date_sent + bid_value (the v2.3126 rule) — the sent reference being the WHOLE: bid_value plus every offered alternate''s stamped add-on in cover_letter_alt_texts.groups (v2.4199). Stamps reference_kind, delta_pct, teacher (estimator → best-effort recorder → attested sender → creator) and the [shadow SCORECARD] note on both ledgers. Fired by the best-effort insert, the run lock, and the send.';
