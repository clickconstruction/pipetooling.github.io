SET lock_timeout = '3s';

-- Messages, cut 4's follow-ups (the lead's answers to helper 5's wave 2 prep, 2026-10-12), after the flows'
-- 20261012120000:
--
--   * flow_save: Settings → Flows' Save, all of it or none. The editor (src/lib/flows/editor.ts saveDraft) hands the
--     flow's rows, its History lines, the steps it removed and the ones it put back; one call writes them in one
--     transaction, so a Save never stops halfway. A Save made from a flow someone else saved since is refused in words.
--   * nudge_record_sent, re-created: Remind now also lets the step's standing hold go, as the kernel's nudgeNow does
--     (src/lib/flows/nudges.ts), since nudgeDue reads a hold before a press. Helper 4's function, their checks kept.
--   * gc_price_change_order: the money team prices a draft change order. An office draft from a customer's message
--     comes in at 0 (gc_draft_change_order_from_message), and gc_send_change_order refuses one with no price and no
--     days; a draft's price was set at the draft until now. Refused once it went, in words.

-- ---------- 1. Save a flow, all of it or none ----------

-- p_steps: the flow's rows as the editor writes them (flowRows), every step of it; a step left out is deleted.
-- p_history: History's lines, { step_key, what, before, after }. p_removed: the steps this Save removes, { step_key,
-- lane, step }. p_put_back: the step keys this Save puts back from Removed. p_based_on: the newest History line the
-- screen read (null for none); a newer one means someone saved since, and the Save is refused. The two are compared
-- to the millisecond, as a browser keeps a time. Returns the newest History line's time after the Save, for the next.
CREATE OR REPLACE FUNCTION public.flow_save(
  p_kind text, p_steps jsonb, p_history jsonb, p_removed jsonb, p_put_back text[], p_based_on timestamptz DEFAULT NULL)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_flow uuid;
  v_name text := public.flows_my_name();
  v_newest timestamptz;
  s jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'signIn' USING ERRCODE = 'P0001', DETAIL = 'Sign in to save a flow.';
  END IF;
  -- The tables' read-only blocks and the twin fence refuse the writes too; this says it in words first.
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'trainingAccount' USING ERRCODE = '42501', DETAIL = 'A training account cannot save a flow.';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'digitalTwin' USING ERRCODE = '42501', DETAIL = 'A digital twin cannot save a flow.';
  END IF;
  IF NOT public.gc_office_team() THEN
    RAISE EXCEPTION 'notAllowed' USING ERRCODE = '42501', DETAIL = 'Only the office saves a flow.';
  END IF;
  SELECT f.id INTO v_flow FROM public.flows f WHERE f.kind = p_kind;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'flowUnknown' USING ERRCODE = 'P0001', DETAIL = 'That flow is not there.';
  END IF;
  IF p_steps IS NULL OR jsonb_typeof(p_steps) <> 'array' OR jsonb_array_length(p_steps) = 0 THEN
    RAISE EXCEPTION 'noSteps' USING ERRCODE = 'P0001', DETAIL = 'A flow keeps one step at least.';
  END IF;

  -- One Save of a flow at a time; a second waits, then finds the first in History.
  PERFORM pg_advisory_xact_lock(hashtext('flow_save'), hashtext(v_flow::text));
  SELECT max(h.created_at) INTO v_newest FROM public.flow_step_history h WHERE h.flow_id = v_flow;
  IF date_trunc('milliseconds', v_newest) IS DISTINCT FROM date_trunc('milliseconds', p_based_on) THEN
    RAISE EXCEPTION 'savedMeanwhile' USING ERRCODE = 'P0001',
      DETAIL = 'Someone saved this flow while you edited it. Put it back to see theirs, then make your change again.';
  END IF;

  DELETE FROM public.flow_steps fs
  WHERE fs.flow_id = v_flow
    AND fs.step_key NOT IN (SELECT x ->> 'step_key' FROM jsonb_array_elements(p_steps) x WHERE x ->> 'step_key' IS NOT NULL);

  FOR s IN SELECT x FROM jsonb_array_elements(p_steps) x LOOP
    INSERT INTO public.flow_steps AS fs (
      flow_id, step_key, lane, position, name, name_es, phase, who, seat_user_id, facts, join_word, papers, loop_words,
      loop_ends, fork, aside, skip_one_job, later_en, later_es, nudge_days, nudge_how, nudge_send, nudge_day_fact, usual,
      owed_words)
    VALUES (
      v_flow, s ->> 'step_key', s ->> 'lane', (s ->> 'position')::integer, s ->> 'name', coalesce(s ->> 'name_es', ''),
      s ->> 'phase', s ->> 'who', nullif(s ->> 'seat_user_id', '')::uuid,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(s -> 'facts', '[]'::jsonb))), coalesce(s ->> 'join_word', 'and'),
      ARRAY(SELECT jsonb_array_elements_text(coalesce(s -> 'papers', '[]'::jsonb))), s ->> 'loop_words', s ->> 'loop_ends',
      coalesce((s ->> 'fork')::boolean, false), coalesce((s ->> 'aside')::boolean, false),
      coalesce((s ->> 'skip_one_job')::boolean, false), s ->> 'later_en', s ->> 'later_es', (s ->> 'nudge_days')::integer,
      s ->> 'nudge_how', s ->> 'nudge_send', s ->> 'nudge_day_fact', coalesce((s ->> 'usual')::integer, 0), s ->> 'owed_words')
    ON CONFLICT (flow_id, step_key) DO UPDATE SET
      lane = EXCLUDED.lane, position = EXCLUDED.position, name = EXCLUDED.name, name_es = EXCLUDED.name_es,
      phase = EXCLUDED.phase, who = EXCLUDED.who, seat_user_id = EXCLUDED.seat_user_id, facts = EXCLUDED.facts,
      join_word = EXCLUDED.join_word, papers = EXCLUDED.papers, loop_words = EXCLUDED.loop_words,
      loop_ends = EXCLUDED.loop_ends, fork = EXCLUDED.fork, aside = EXCLUDED.aside, skip_one_job = EXCLUDED.skip_one_job,
      later_en = EXCLUDED.later_en, later_es = EXCLUDED.later_es, nudge_days = EXCLUDED.nudge_days,
      nudge_how = EXCLUDED.nudge_how, nudge_send = EXCLUDED.nudge_send, nudge_day_fact = EXCLUDED.nudge_day_fact,
      usual = EXCLUDED.usual, owed_words = EXCLUDED.owed_words
    -- A step the Save left as it was keeps its updated_at.
    WHERE (fs.lane, fs.position, fs.name, fs.name_es, fs.phase, fs.who, fs.seat_user_id, fs.facts, fs.join_word,
           fs.papers, fs.loop_words, fs.loop_ends, fs.fork, fs.aside, fs.skip_one_job, fs.later_en, fs.later_es,
           fs.nudge_days, fs.nudge_how, fs.nudge_send, fs.nudge_day_fact, fs.usual, fs.owed_words)
      IS DISTINCT FROM
          (EXCLUDED.lane, EXCLUDED.position, EXCLUDED.name, EXCLUDED.name_es, EXCLUDED.phase, EXCLUDED.who,
           EXCLUDED.seat_user_id, EXCLUDED.facts, EXCLUDED.join_word, EXCLUDED.papers, EXCLUDED.loop_words,
           EXCLUDED.loop_ends, EXCLUDED.fork, EXCLUDED.aside, EXCLUDED.skip_one_job, EXCLUDED.later_en, EXCLUDED.later_es,
           EXCLUDED.nudge_days, EXCLUDED.nudge_how, EXCLUDED.nudge_send, EXCLUDED.nudge_day_fact, EXCLUDED.usual,
           EXCLUDED.owed_words);
  END LOOP;

  INSERT INTO public.flow_step_history (flow_id, step_key, what, before, after, by_name)
  SELECT v_flow, nullif(h ->> 'step_key', ''), h ->> 'what', nullif(h -> 'before', 'null'::jsonb), nullif(h -> 'after', 'null'::jsonb), v_name
  FROM jsonb_array_elements(coalesce(p_history, '[]'::jsonb)) WITH ORDINALITY AS t(h, n)
  ORDER BY t.n;

  INSERT INTO public.flow_removed_steps (flow_id, step_key, lane, step, removed_by_name)
  SELECT v_flow, r ->> 'step_key', r ->> 'lane', r -> 'step', v_name
  FROM jsonb_array_elements(coalesce(p_removed, '[]'::jsonb)) r;

  UPDATE public.flow_removed_steps rs SET put_back_at = clock_timestamp()
  WHERE rs.flow_id = v_flow AND rs.step_key = ANY (coalesce(p_put_back, '{}'::text[])) AND rs.put_back_at IS NULL;

  SELECT max(h.created_at) INTO v_newest FROM public.flow_step_history h WHERE h.flow_id = v_flow;
  RETURN v_newest;
END;
$$;

COMMENT ON FUNCTION public.flow_save(text, jsonb, jsonb, jsonb, text[], timestamptz) IS
  'Messages (cut 4): Settings → Flows'' Save in one transaction: the flow''s steps as the editor writes them (a step left out is deleted, one left as it was keeps its updated_at), its History lines, the steps it removed and the ones it put back. Refused in words for someone signed out, a training account, a twin, anyone off the office team, a flow that is not there, no steps, and a Save from a flow someone saved since (savedMeanwhile). SECURITY INVOKER: the flows tables'' grants and policies decide. Returns the newest History line''s time.';

REVOKE ALL ON FUNCTION public.flow_save(text, jsonb, jsonb, jsonb, text[], timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.flow_save(text, jsonb, jsonb, jsonb, text[], timestamptz) TO authenticated;

-- ---------- 2. Remind now lets a standing hold go ----------

-- As 20261012120000 wrote it, with one step before the row goes in: the step's standing hold on the same job is let
-- go (its trigger stamps who), since the reminder went.
CREATE OR REPLACE FUNCTION public.nudge_record_sent(p_contact uuid, p_step text, p_job_kind text, p_job_id uuid, p_round text, p_how text, p_message uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_bid uuid := CASE WHEN p_job_kind = 'bid' THEN p_job_id END;
  v_project uuid := CASE WHEN p_job_kind = 'project' THEN p_job_id END;
  v_pipeline uuid := CASE WHEN p_job_kind = 'pipeline' THEN p_job_id END;
  v_id uuid;
BEGIN
  IF p_how IS NULL OR p_how NOT IN ('text', 'call', 'email') THEN
    RAISE EXCEPTION 'howUnknown' USING ERRCODE = 'P0001', DETAIL = 'A reminder goes as a text, a call or an email.';
  END IF;
  PERFORM public.contact_job_check(p_job_kind, p_job_id);
  PERFORM public.flow_step_check(p_contact, p_step);
  UPDATE public.nudge_holds SET released_at = clock_timestamp()
  WHERE contact_id = p_contact AND step_key = p_step AND released_at IS NULL
    AND bid_id IS NOT DISTINCT FROM v_bid AND project_id IS NOT DISTINCT FROM v_project
    AND jobs_ledger_id IS NOT DISTINCT FROM v_pipeline;
  INSERT INTO public.nudge_sent (contact_id, step_key, bid_id, project_id, jobs_ledger_id, round_key, how, sent_by, message_id)
  VALUES (p_contact, p_step,
    v_bid, v_project, v_pipeline,
    nullif(btrim(coalesce(p_round, '')), ''), p_how, 'person', p_message)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.nudge_record_sent(uuid, text, text, uuid, text, text, uuid) IS
  'Messages (cut 4): Remind now, what a person sent for a step, so the app never sends a second reminder on top of it. Lets the step''s standing hold on the same job go first (20261013020000), since nudgeDue reads a hold before a press. SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.nudge_record_sent(uuid, text, text, uuid, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nudge_record_sent(uuid, text, text, uuid, text, text, uuid) TO authenticated, service_role;

-- ---------- 3. The money team prices a draft change order ----------

CREATE OR REPLACE FUNCTION public.gc_price_change_order(p_id uuid, p_cost numeric, p_price numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v record;
  v_cost numeric := round(p_cost);
  v_price numeric := round(p_price);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to price a change order.' USING ERRCODE = 'P0001';
  END IF;
  -- The table's read-only blocks and the twin fence refuse the write too; this says it in words first.
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot price a change order.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot price a change order.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.gc_money_team() THEN
    RAISE EXCEPTION 'Only the money team prices a change order.' USING ERRCODE = '42501';
  END IF;
  SELECT c.number, c.status INTO v FROM public.gc_change_orders c WHERE c.id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That change order is not there.' USING ERRCODE = 'P0001';
  END IF;
  IF v.status <> 'draft' THEN
    RAISE EXCEPTION 'Change order % went to the customer, so its price stays as it went. Draft a new one.', v.number USING ERRCODE = 'P0001';
  END IF;
  -- gc_draft_change_order's own words.
  IF v_cost IS NULL OR v_cost = 0 THEN
    RAISE EXCEPTION 'Type what it costs us. A credit is a cost below zero.' USING ERRCODE = 'P0001';
  END IF;
  IF v_price IS NULL THEN
    RAISE EXCEPTION 'Type what it adds to their price.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.gc_change_orders SET cost = v_cost, price = v_price WHERE id = p_id;
END;
$$;

COMMENT ON FUNCTION public.gc_price_change_order(uuid, numeric, numeric) IS
  'GC mode (Messages cut 4b): the money team prices a draft change order: what it costs us and what it adds to their price, in whole dollars. An office draft from a customer''s message comes in at 0. Refused in words once it went, and for anyone off the money team. SECURITY INVOKER: the money team''s policy decides.';

REVOKE ALL ON FUNCTION public.gc_price_change_order(uuid, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_price_change_order(uuid, numeric, numeric) TO authenticated;
