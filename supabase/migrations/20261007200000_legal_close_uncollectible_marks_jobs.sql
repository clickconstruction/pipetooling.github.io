SET lock_timeout = '3s';

-- Punch list #94, PR 5 (v2.4794): closing a matter as uncollectible on the Legal desk marks its linked
-- Collections jobs Uncollectible (the columns of 20261007170000). legal_close_matter re-created with the
-- block after the matter update; the rest verbatim from 20261006150000.

CREATE OR REPLACE FUNCTION public.legal_close_matter(p_matter_id uuid, p_stage text, p_note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_reason text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.legal_office_can_read() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;
  IF p_stage NOT IN ('written_down', 'settled', 'uncollectible', 'dismissed') THEN RETURN jsonb_build_object('error', 'Close as written down, settled, uncollectible or dismissed'); END IF;
  UPDATE public.legal_matters
    SET stage = p_stage, closed_at = now(), closed_reason = COALESCE(NULLIF(TRIM(p_note), ''), ''), updated_at = now()
  WHERE id = p_matter_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Matter not found'); END IF;
  IF p_stage = 'uncollectible' THEN
    -- Punch list #94 (v2.4794): the firm's end marks every linked Collections job Uncollectible, so
    -- the Pipeline band, the totals and the Lien desk agree with the matter. Same columns and event
    -- as set_job_uncollectible (20261007170000); a job already marked, paid or out of Collections is left alone.
    v_reason := COALESCE(NULLIF(TRIM(p_note), ''), 'Closed as uncollectible on the Legal desk');
    WITH marked AS (
      UPDATE public.jobs_ledger jl
      SET uncollectible_at = now(), uncollectible_by = auth.uid(), uncollectible_reason = v_reason, updated_at = now()
      FROM public.legal_matter_jobs lmj
      WHERE lmj.matter_id = p_matter_id AND lmj.job_id = jl.id
        AND jl.status = 'billed' AND jl.collections_at IS NOT NULL AND jl.uncollectible_at IS NULL
      RETURNING jl.id, GREATEST(0, COALESCE(jl.revenue, 0) - COALESCE(jl.payments_made, 0)) AS open_balance
    )
    INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    SELECT id, 'uncollectible_change', now(), auth.uid(), 'Marked Uncollectible — ' || v_reason,
           jsonb_build_object('flagged', true, 'reason', v_reason, 'open_balance', open_balance, 'matter_id', p_matter_id), true
    FROM marked;
  END IF;
  INSERT INTO public.legal_matter_entries (matter_id, kind, body, created_by)
  VALUES (p_matter_id, 'step', CASE p_stage WHEN 'written_down' THEN 'Written down' WHEN 'uncollectible' THEN 'Closed as uncollectible' WHEN 'dismissed' THEN 'Closed as dismissed' ELSE 'Settled' END
    || CASE WHEN COALESCE(NULLIF(TRIM(p_note), ''), '') <> '' THEN ' — ' || TRIM(p_note) ELSE '' END, auth.uid());
  RETURN jsonb_build_object('ok', true);
END;
$$;
