SET lock_timeout = '3s';

-- Messages, residential R8 · 8, PR 2 (to-dos/gc-mode/messages/RESIDENTIAL_BUILD_PLAN.md → R8 on branch spike/gc-mode):
-- the office puts a customer's message on their estimate as a line. The kernel is src/lib/estimates/lineFromMessage.ts
-- (v2.5403), the link is messages.estimate_id (20261014002000_messages_estimate_id.sql), and the model is cut 4b's
-- gc_draft_change_order_from_message (20261012180000).
--
--   * draft_estimate_line_from_message is a definer, since messages grants no column for the link. It saves the line
--     on the job's open draft, or starts one, and stamps the message, in one call. It gives the office no new right over
--     estimates: all five office roles are already inside estimates_insert and estimates_update_draft.
--   * The job's open estimate is the newest draft estimate that a message tied to the same Pipeline job points at.
--     estimates.job_ledger_id cannot say it: it is unique, the link to the job an estimate created, and a draft for a
--     job that already exists never carries it.
--   * A new draft takes job_ledger_id only while no estimate holds that job, so a signed one never makes a second job
--     through autoCreateJobGuard. When the job's link is taken the draft goes without it; the guard rule for that case
--     is its own follow-up.
--   * The client sends the line and whether it takes the place of the draft's blank last line, both from the kernel,
--     with the draft's updated_at as it read it. An unchanged updated_at means the lines the kernel judged are the
--     lines here, so the blank-line rule keeps one home in the kernel. The total is the sum of the lines, as the page's
--     own save keeps it on an estimate without options; a draft with options is refused.
--   * No new table, so no fence calls. The definer refuses training mode and a digital twin itself, as cut 4b's does.

CREATE OR REPLACE FUNCTION public.draft_estimate_line_from_message(
  p_message_id uuid,
  p_estimate_id uuid,
  p_line jsonb,
  p_replaces_last boolean,
  p_seen_at timestamptz
)
RETURNS TABLE (drafted_estimate_id uuid, drafted_estimate_number integer, drafted_line_number integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_msg record;
  v_job record;
  v_est record;
  v_job_name text;
  v_had integer;
  v_name text;
  v_description text;
  v_quantity numeric;
  v_unit integer;
  v_line jsonb;
  v_lines jsonb;
  v_link uuid;
  v_id uuid;
  v_number integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to put a message on an estimate.' USING ERRCODE = 'P0001';
  END IF;
  -- A definer passes the tables' read-only blocks and the twin fence, so each is said here.
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot put a message on an estimate.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot put a message on an estimate.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.gc_office_team() THEN
    RAISE EXCEPTION 'Only the office puts a message on an estimate.' USING ERRCODE = '42501';
  END IF;

  -- The message, locked, so two presses on it cannot both draft it.
  SELECT m.jobs_ledger_id, m.estimate_id AS had_estimate_id, c.kind, c.name,
         coalesce(c.customer_id, p.customer_id) AS customer_id
  INTO v_msg
  FROM public.messages m
  JOIN public.contacts c ON c.id = m.contact_id
  LEFT JOIN public.customer_contact_persons p ON p.id = c.customer_contact_person_id
  WHERE m.id = p_message_id
  FOR UPDATE OF m;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That message is not there.' USING ERRCODE = 'P0001';
  END IF;
  IF v_msg.had_estimate_id IS NOT NULL THEN
    SELECT e.estimate_number INTO v_had FROM public.estimates e WHERE e.id = v_msg.had_estimate_id;
    RAISE EXCEPTION 'This message is a line on estimate % already.', v_had USING ERRCODE = 'P0001';
  END IF;
  -- The kernel's refusals, in its words (lineDraftFromMessage).
  IF v_msg.kind <> 'customer' THEN
    RAISE EXCEPTION 'A line from a message goes on a customer''s estimate. This message is with %.',
      CASE v_msg.kind
        WHEN 'trade' THEN 'a trade partner' WHEN 'arch' THEN 'an architect' WHEN 'lead' THEN 'a lead'
        WHEN 'supply_house' THEN 'a supply house' WHEN 'candidate' THEN 'a candidate' WHEN 'sub' THEN 'a sub'
        WHEN 'unknown' THEN 'a number nobody has named yet' ELSE 'someone who is not a customer' END
      USING ERRCODE = 'P0001';
  END IF;
  IF v_msg.jobs_ledger_id IS NULL THEN
    RAISE EXCEPTION 'Tie the message to a job first. An estimate belongs to one job.' USING ERRCODE = 'P0001';
  END IF;

  -- The job, held while its open estimate is found or made, so two first lines on it start one draft.
  SELECT j.id, j.job_name, j.job_address, j.status, j.customer_id
  INTO v_job
  FROM public.jobs_ledger j
  WHERE j.id = v_msg.jobs_ledger_id
  FOR NO KEY UPDATE;
  v_job_name := coalesce(nullif(btrim(v_job.job_name), ''), 'This job');
  IF v_msg.customer_id IS NULL OR v_job.customer_id IS DISTINCT FROM v_msg.customer_id THEN
    RAISE EXCEPTION 'This message is tied to a job that is not %''s. Tie it to one of their jobs first.',
      coalesce(nullif(btrim(v_msg.name), ''), 'this customer')
      USING ERRCODE = 'P0001';
  END IF;
  IF lower(btrim(v_job.status)) = 'billed' THEN
    RAISE EXCEPTION '% is billed already. Start the work as a new job.', v_job_name USING ERRCODE = 'P0001';
  END IF;
  IF lower(btrim(v_job.status)) = 'paid' THEN
    RAISE EXCEPTION '% is paid and closed. Start the work as a new job.', v_job_name USING ERRCODE = 'P0001';
  END IF;

  -- The line, in the estimate's own shape (estimateLineItemNormalize.ts). Never a credit: this is an estimate.
  IF jsonb_typeof(p_line) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Send the line as its name, what it is, how many and the price.' USING ERRCODE = 'P0001';
  END IF;
  v_name := btrim(coalesce(p_line ->> 'line_item', ''));
  v_description := btrim(coalesce(p_line ->> 'description', ''));
  IF v_name = '' AND v_description = '' THEN
    RAISE EXCEPTION 'Say what the line is for.' USING ERRCODE = 'P0001';
  END IF;
  BEGIN
    v_quantity := coalesce((p_line ->> 'quantity')::numeric, 1);
    v_unit := coalesce(round((p_line ->> 'unit_price_cents')::numeric), 0)::integer;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'How many and the price must be numbers.' USING ERRCODE = 'P0001';
  END;
  IF v_quantity <= 0 THEN
    v_quantity := 1;
  END IF;
  IF v_unit < 0 THEN
    RAISE EXCEPTION 'A line on an estimate cannot be below zero.' USING ERRCODE = 'P0001';
  END IF;
  v_line := jsonb_build_object(
    'line_item', v_name, 'description', v_description, 'quantity', v_quantity,
    'unit_price_cents', v_unit, 'amount_cents', round(v_quantity * v_unit)::integer);

  IF p_estimate_id IS NOT NULL THEN
    SELECT e.id, e.estimate_number, e.status, e.doc_kind, e.customer_id, e.updated_at, e.line_items_snapshot, e.options_snapshot
    INTO v_est
    FROM public.estimates e
    WHERE e.id = p_estimate_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'That estimate is not there. Open the message again.' USING ERRCODE = 'P0001';
    END IF;
    IF v_est.doc_kind <> 'estimate' OR v_est.status <> 'draft' THEN
      RAISE EXCEPTION 'Estimate % is not a draft any more. Open the message again.', v_est.estimate_number USING ERRCODE = 'P0001';
    END IF;
    IF v_est.customer_id IS DISTINCT FROM v_job.customer_id
      OR NOT EXISTS (SELECT 1 FROM public.messages o WHERE o.estimate_id = v_est.id AND o.jobs_ledger_id = v_job.id) THEN
      RAISE EXCEPTION 'Estimate % is not on %. Open the message again.', v_est.estimate_number, v_job_name USING ERRCODE = 'P0001';
    END IF;
    IF v_est.updated_at IS DISTINCT FROM p_seen_at THEN
      RAISE EXCEPTION 'Estimate % changed since you opened it. Open the message again.', v_est.estimate_number USING ERRCODE = 'P0001';
    END IF;
    IF jsonb_typeof(v_est.options_snapshot) = 'array' AND jsonb_array_length(v_est.options_snapshot) > 0 THEN
      RAISE EXCEPTION 'Estimate % has options. Add the line on the estimate itself.', v_est.estimate_number USING ERRCODE = 'P0001';
    END IF;
    v_lines := CASE WHEN jsonb_typeof(v_est.line_items_snapshot) = 'array' THEN v_est.line_items_snapshot ELSE '[]'::jsonb END;
    IF p_replaces_last AND jsonb_array_length(v_lines) > 0 THEN
      v_lines := v_lines - (jsonb_array_length(v_lines) - 1);
    END IF;
    v_lines := v_lines || jsonb_build_array(v_line);
    UPDATE public.estimates e SET
      line_items_snapshot = v_lines,
      total_cents = (SELECT coalesce(sum(round(coalesce((l ->> 'amount_cents')::numeric, 0))), 0)::integer FROM jsonb_array_elements(v_lines) l)
    WHERE e.id = v_est.id;
    v_id := v_est.id;
    v_number := v_est.estimate_number;
  ELSE
    -- A press on another of the job's messages may have started its draft since this one was read.
    IF EXISTS (
      SELECT 1 FROM public.estimates e JOIN public.messages o ON o.estimate_id = e.id
      WHERE o.jobs_ledger_id = v_job.id AND e.doc_kind = 'estimate' AND e.status = 'draft'
    ) THEN
      RAISE EXCEPTION 'An estimate on % is open already. Open the message again.', v_job_name USING ERRCODE = 'P0001';
    END IF;
    v_lines := jsonb_build_array(v_line);
    v_link := CASE WHEN EXISTS (SELECT 1 FROM public.estimates x WHERE x.job_ledger_id = v_job.id) THEN NULL ELSE v_job.id END;
    BEGIN
      INSERT INTO public.estimates (master_user_id, created_by, customer_id, job_ledger_id, title, for_address, line_items_snapshot, terms_snapshot, total_cents)
      VALUES (coalesce(public.company_owner_user_id(), auth.uid()), auth.uid(), v_job.customer_id, v_link, v_job_name,
              nullif(btrim(v_job.job_address), ''), v_lines, '', (v_line ->> 'amount_cents')::integer)
      RETURNING id, estimate_number INTO v_id, v_number;
    EXCEPTION WHEN unique_violation THEN
      -- Another estimate took the job's link in the meantime: this draft goes without it.
      INSERT INTO public.estimates (master_user_id, created_by, customer_id, job_ledger_id, title, for_address, line_items_snapshot, terms_snapshot, total_cents)
      VALUES (coalesce(public.company_owner_user_id(), auth.uid()), auth.uid(), v_job.customer_id, NULL, v_job_name,
              nullif(btrim(v_job.job_address), ''), v_lines, '', (v_line ->> 'amount_cents')::integer)
      RETURNING id, estimate_number INTO v_id, v_number;
    END;
  END IF;

  UPDATE public.messages m SET estimate_id = v_id WHERE m.id = p_message_id;
  RETURN QUERY SELECT v_id, v_number, jsonb_array_length(v_lines);
END;
$$;

COMMENT ON FUNCTION public.draft_estimate_line_from_message(uuid, uuid, jsonb, boolean, timestamptz) IS
  'Messages (R8 · 8): the office puts a customer''s message on their estimate as a line, on the job the message is tied to: the job''s open draft (the newest a message on that job points at) when p_estimate_id names it, read at p_seen_at, else a new draft. Stamps messages.estimate_id in the same call. A new draft takes job_ledger_id only while no estimate holds that job. Refuses, in words, a training account, a digital twin, anyone outside the office, a message on an estimate already, a contact who is not a customer, a message on no Pipeline job or on a job not theirs, a billed or paid job, a draft that changed, went, has options or is on another job, and a second new draft on a job that has one open.';

REVOKE ALL ON FUNCTION public.draft_estimate_line_from_message(uuid, uuid, jsonb, boolean, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.draft_estimate_line_from_message(uuid, uuid, jsonb, boolean, timestamptz) TO authenticated;
