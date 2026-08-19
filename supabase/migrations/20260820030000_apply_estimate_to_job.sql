SET lock_timeout = '3s';

-- CO money train PR 3: apply an accepted estimate/change order to an EXISTING job.
-- Sibling of create_job_from_estimate (same fixture payload shape, same access
-- gates): appends the document's line items to the job's Specific Work
-- (jobs_ledger_fixtures, sequenced after existing rows), moves jobs_ledger.revenue
-- by the SIGNED net (credit lines subtract), links estimates.job_ledger_id, and
-- best-effort posts a jobs_ledger_thread_notes row ("Change order #52 applied:
-- +$2,450.00 — …") so Stages activity and Job Detail light up through existing
-- paths. Idempotent: an already-linked estimate returns its link untouched.
--
-- Read-only training mode: the read_only_block_stmt statement triggers on
-- jobs_ledger / jobs_ledger_fixtures / estimates / jobs_ledger_thread_notes fire
-- inside SECURITY DEFINER too (v2.704), so read_only users are still blocked.

CREATE OR REPLACE FUNCTION "public"."apply_estimate_to_job"(
  "p_estimate_id" "uuid",
  "p_job_ledger_id" "uuid",
  "p_fixtures" "jsonb" DEFAULT '[]'::"jsonb"
) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  e public.estimates%ROWTYPE;
  j public.jobs_ledger%ROWTYPE;
  fixture_el jsonb;
  fname text;
  fcount numeric;
  fprice numeric(12, 2);
  fdesc text;
  fseq int;
  v_seq_base int := 0;
  v_fixture_inserts int := 0;
  v_net numeric(12, 2) := 0;
  v_row_ext numeric(12, 2);
  v_len int;
  idx int;
  v_doc_label text;
  v_amount_label text;
  v_body text;
BEGIN
  SELECT * INTO e FROM public.estimates WHERE id = p_estimate_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'estimate not found';
  END IF;

  -- Idempotent: already applied/linked → return the existing link.
  IF e.job_ledger_id IS NOT NULL THEN
    RETURN e.job_ledger_id;
  END IF;

  IF e.status IS DISTINCT FROM 'customer_accepted' THEN
    RAISE EXCEPTION 'estimate must be customer_accepted';
  END IF;

  IF NOT (
    public.user_can_access_estimate(e) OR public.superintendent_can_access_estimate(e)
  ) THEN
    RAISE EXCEPTION 'not authorized to apply this estimate';
  END IF;

  SELECT * INTO j FROM public.jobs_ledger WHERE id = p_job_ledger_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'job not found';
  END IF;

  IF j.master_user_id IS DISTINCT FROM e.master_user_id THEN
    RAISE EXCEPTION 'job belongs to a different owner than the estimate';
  END IF;

  SELECT COALESCE(MAX(f.sequence_order) + 1, 0)
  INTO v_seq_base
  FROM public.jobs_ledger_fixtures f
  WHERE f.job_id = p_job_ledger_id;

  IF p_fixtures IS NOT NULL AND jsonb_typeof(p_fixtures) = 'array' THEN
    v_len := jsonb_array_length(p_fixtures);
    idx := 0;
    WHILE idx < v_len LOOP
      BEGIN
        fixture_el := p_fixtures->idx;
        idx := idx + 1;

        fname := NULLIF(trim(COALESCE(fixture_el->>'name', '')), '');
        IF fname IS NULL THEN
          CONTINUE;
        END IF;

        fcount := NULL;
        IF fixture_el ? 'count' AND fixture_el->>'count' IS NOT NULL AND btrim(fixture_el->>'count') != '' THEN
          fcount := (fixture_el->>'count')::numeric;
        END IF;
        IF fcount IS NULL OR fcount <= 0 THEN
          fcount := 1;
        END IF;

        fprice := NULL;
        IF fixture_el ? 'line_unit_price' AND fixture_el->>'line_unit_price' IS NOT NULL AND btrim(fixture_el->>'line_unit_price') != '' THEN
          fprice := round((fixture_el->>'line_unit_price')::numeric, 2);
        END IF;

        fdesc := NULLIF(trim(COALESCE(fixture_el->>'line_description', '')), '');

        fseq := 0;
        IF fixture_el ? 'sequence_order' AND fixture_el->>'sequence_order' IS NOT NULL AND btrim(fixture_el->>'sequence_order') != '' THEN
          fseq := (fixture_el->>'sequence_order')::int;
        END IF;

        INSERT INTO public.jobs_ledger_fixtures (
          job_id,
          name,
          count,
          line_unit_price,
          line_description,
          sequence_order
        ) VALUES (
          p_job_ledger_id,
          fname,
          fcount,
          fprice,
          fdesc,
          v_seq_base + fseq
        );

        v_fixture_inserts := v_fixture_inserts + 1;
        v_row_ext := round(fcount * COALESCE(fprice, 0::numeric), 2);
        v_net := round(v_net + v_row_ext, 2);
      EXCEPTION
        WHEN OTHERS THEN
          CONTINUE;
      END;
    END LOOP;
  END IF;

  -- No usable line items → the accepted total IS the net.
  IF v_fixture_inserts = 0 THEN
    v_net := round(COALESCE(e.total_cents, 0)::numeric / 100.0, 2);
  END IF;

  UPDATE public.jobs_ledger
  SET revenue = round(COALESCE(revenue, 0::numeric) + v_net, 2)
  WHERE id = p_job_ledger_id;

  UPDATE public.estimates
  SET job_ledger_id = p_job_ledger_id
  WHERE id = p_estimate_id
    AND job_ledger_id IS NULL;

  -- Best-effort activity note; never fails the apply.
  BEGIN
    v_doc_label := CASE WHEN e.doc_kind = 'change_order' THEN 'Change order' ELSE 'Estimate' END;
    v_amount_label := CASE WHEN v_net < 0 THEN '-$' ELSE '+$' END
      || to_char(abs(v_net), 'FM999,999,990.00');
    v_body := v_doc_label || ' #' || e.estimate_number::text || ' applied: ' || v_amount_label
      || CASE
           WHEN NULLIF(trim(COALESCE(e.change_order_fields->>'description_of_change', '')), '') IS NOT NULL
             THEN ' — ' || trim(e.change_order_fields->>'description_of_change')
           WHEN NULLIF(trim(COALESCE(e.title, '')), '') IS NOT NULL
             THEN ' — ' || trim(e.title)
           ELSE ''
         END;
    v_body := left(v_body, 2000);
    INSERT INTO public.jobs_ledger_thread_notes (job_id, author_user_id, body)
    VALUES (p_job_ledger_id, auth.uid(), v_body);
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END;

  RETURN p_job_ledger_id;
END;
$$;

ALTER FUNCTION "public"."apply_estimate_to_job"("p_estimate_id" "uuid", "p_job_ledger_id" "uuid", "p_fixtures" "jsonb") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."apply_estimate_to_job"("p_estimate_id" "uuid", "p_job_ledger_id" "uuid", "p_fixtures" "jsonb") IS 'Applies a customer_accepted estimate/change order to an EXISTING job: appends p_fixtures rows to jobs_ledger_fixtures (sequenced after existing), moves jobs_ledger.revenue by the signed net (credits subtract; no rows -> estimate total), sets estimates.job_ledger_id, best-effort posts the "Change order #N applied: +$X - desc" thread note. Idempotent: already-linked estimates return their link untouched.';

GRANT ALL ON FUNCTION "public"."apply_estimate_to_job"("p_estimate_id" "uuid", "p_job_ledger_id" "uuid", "p_fixtures" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."apply_estimate_to_job"("p_estimate_id" "uuid", "p_job_ledger_id" "uuid", "p_fixtures" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_estimate_to_job"("p_estimate_id" "uuid", "p_job_ledger_id" "uuid", "p_fixtures" "jsonb") TO "service_role";
