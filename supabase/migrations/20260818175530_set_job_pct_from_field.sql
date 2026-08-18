SET lock_timeout = '3s';

-- Field crews (subs/helpers) can see % done on their Dashboard My Schedule cards
-- (v2.1567) but had no way to move it: jobs_ledger UPDATE is office+primary only,
-- and the report percent field stores only into the report. This RPC is the single
-- field-side write path for jobs_ledger.pct_complete, following the update_job_status
-- precedent: SECURITY DEFINER, own authorization gate, and it records the change as
-- a jobs_ledger_thread_notes row in the exact "N% complete — <note>" body format the
-- Stages flows write (src/lib/jobs/stagesPctNote.ts) — so the My Schedule day-delta
-- layer, Stages activity, and Job Detail all pick it up with no client changes.
--
-- Authorization: the jobs_ledger_thread_notes INSERT predicate (office relations,
-- job team members) extended with schedule-block assignees (job_schedule_blocks) —
-- being dispatched onto a job means you're working it.
--
-- Read-only training mode: the read_only_block_stmt statement triggers on
-- jobs_ledger and jobs_ledger_thread_notes fire inside SECURITY DEFINER too (v2.704),
-- so read_only users are still blocked.

CREATE OR REPLACE FUNCTION "public"."set_job_pct_from_field"("p_job_id" "uuid", "p_pct" integer, "p_note" "text" DEFAULT NULL) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_prev INTEGER;
  v_can BOOLEAN := false;
  v_body TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  IF p_pct IS NULL OR p_pct < 0 OR p_pct > 100 THEN
    RETURN jsonb_build_object('error', 'Percent must be between 0 and 100');
  END IF;

  SELECT jl.pct_complete INTO v_prev FROM public.jobs_ledger jl WHERE jl.id = p_job_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Job not found');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.jobs_ledger j
    WHERE j.id = p_job_id
      AND (
        j.master_user_id = auth.uid()
        OR public.is_dev()
        OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'primary')
        OR EXISTS (SELECT 1 FROM public.master_assistants ma WHERE ma.master_id = auth.uid() AND ma.assistant_id = j.master_user_id)
        OR EXISTS (SELECT 1 FROM public.master_assistants ma WHERE ma.master_id = j.master_user_id AND ma.assistant_id = auth.uid())
        OR public.assistants_share_master(auth.uid(), j.master_user_id)
        OR EXISTS (SELECT 1 FROM public.jobs_ledger_team_members jtm WHERE jtm.job_id = j.id AND jtm.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.job_schedule_blocks jsb WHERE jsb.job_id = j.id AND jsb.assignee_user_id = auth.uid())
      )
  ) INTO v_can;

  IF NOT v_can THEN
    RETURN jsonb_build_object('error', 'Not authorized to update this job''s percent complete');
  END IF;

  -- Body format must start "N% complete" — parsePctCompleteNoteBody and the
  -- My Schedule baseline reconstruction key on that prefix.
  v_body := p_pct::text || '% complete'
    || CASE WHEN COALESCE(btrim(p_note), '') <> '' THEN ' — ' || btrim(p_note) ELSE '' END;
  v_body := left(v_body, 2000);

  INSERT INTO public.jobs_ledger_thread_notes (job_id, author_user_id, body)
  VALUES (p_job_id, auth.uid(), v_body);

  UPDATE public.jobs_ledger SET pct_complete = p_pct WHERE id = p_job_id;

  RETURN jsonb_build_object('ok', true, 'previous', v_prev, 'pct', p_pct);
END;
$$;

COMMENT ON FUNCTION "public"."set_job_pct_from_field"("p_job_id" "uuid", "p_pct" integer, "p_note" "text") IS 'Field-side % complete update (Dashboard My Schedule modal): validates 0-100, gates on office relations / job team membership / schedule-block assignment, then atomically posts the "N% complete - <note>" thread note (author = caller) and writes jobs_ledger.pct_complete. Returns {ok, previous, pct} or {error}.';

GRANT ALL ON FUNCTION "public"."set_job_pct_from_field"("p_job_id" "uuid", "p_pct" integer, "p_note" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_job_pct_from_field"("p_job_id" "uuid", "p_pct" integer, "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_job_pct_from_field"("p_job_id" "uuid", "p_pct" integer, "p_note" "text") TO "service_role";
