SET lock_timeout = '3s';

-- v2.5596 — Calls and the scripts: a call task Quo closes, and the script on the step (punch list #115 PR 5;
-- docs/migrations/20261016050000_call_tasks.md).
--
-- The principle's call: after a text or an email goes to a customer, the receipt suggests the call and gives the words.
-- Add to my calls makes the call a task in Follow up → We owe them: who, about what, the day, the script as filled.
-- Call dials; I called closes it with a team note; Tomorrow moves it a day; Quo's webhook closes it when a completed
-- call to that person lands in the thread. Four pieces, each idempotent:
--
--   1. call_tasks: one row per call to make — the person, the step, the job, the day, what it is about, the script, who
--      added it, and how it ended (a call Quo logged, a press with a note, or skipped). Read by the office team; written
--      by the service role (the webhook) and the functions below. One open task a person a step a job.
--   2. call_task_add / call_task_done / call_task_move: the office's presses, each a gray line in the thread.
--   3. call_tasks_close_by_call: the webhook's close, as the service role.
--   4. flow_steps.call_script, call_script_es, suggest_call: the script on the step in both languages, and whether the
--      receipt suggests the call at all; seeded on the residential customer flow's Booked, Estimate sent and Approved
--      (src/lib/flows/callScripts.ts). flow_save writes the three columns; follow_up_count counts an open call.
--
-- A table is created, so the three fence appliers run at the end.

-- ---------- 1. The table ----------

CREATE TABLE IF NOT EXISTS public.call_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- A thread is never deleted from under a call to make: a contact folds, and its calls move with it.
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE RESTRICT,
  step_key text,
  bid_id uuid REFERENCES public.bids(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.gc_projects(project_id) ON DELETE CASCADE,
  jobs_ledger_id uuid REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  due_on date NOT NULL,
  -- "about the estimate": the few words after the name on the row.
  what text NOT NULL
    CONSTRAINT call_tasks_what_said CHECK (length(btrim(what)) BETWEEN 1 AND 120),
  -- What to say, filled for this person; null when the step has none.
  script text,
  made_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  made_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  done_at timestamptz,
  -- call: Quo logged a completed call to them; called: a press with a team note; skipped: a press.
  done_how text
    CONSTRAINT call_tasks_done_how_known CHECK (done_how IN ('call', 'called', 'skipped')),
  done_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  -- The call's line, or the team note, that closed it.
  done_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  CONSTRAINT call_tasks_one_job CHECK (num_nonnulls(bid_id, project_id, jobs_ledger_id) <= 1),
  CONSTRAINT call_tasks_done_said CHECK ((done_at IS NULL) = (done_how IS NULL))
);

COMMENT ON TABLE public.call_tasks IS
  'Calls to make (v2.5596, punch list #115): a call task in Follow up''s We owe them, from the receipt''s Add to my calls or the thread''s quiet line; closed by a completed call Quo logged (call), a press with a note (called), or skipped. Open while done_at is null.';
COMMENT ON COLUMN public.call_tasks.script IS 'What to say, from the step''s call_script filled for this person; the office may read it on the row.';

CREATE UNIQUE INDEX IF NOT EXISTS call_tasks_one_open
  ON public.call_tasks (contact_id, coalesce(step_key, ''), coalesce(bid_id, project_id, jobs_ledger_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE done_at IS NULL;
CREATE INDEX IF NOT EXISTS call_tasks_open_by_day ON public.call_tasks (due_on) WHERE done_at IS NULL;

ALTER TABLE public.call_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS call_tasks_select ON public.call_tasks;
CREATE POLICY call_tasks_select ON public.call_tasks
  FOR SELECT TO authenticated USING (public.gc_office_team());

-- The schema's default privileges hand a new table to anon and authenticated whole; the office reads, the functions
-- and the service role write.
REVOKE ALL ON TABLE public.call_tasks FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.call_tasks FROM authenticated;
GRANT SELECT ON TABLE public.call_tasks TO authenticated;
GRANT ALL ON TABLE public.call_tasks TO service_role;

-- ---------- 2. The office's presses ----------

-- Add a call: one open task a person a step a job, so a second Add to my calls moves the day and the words instead.
CREATE OR REPLACE FUNCTION public.call_task_add(
  p_contact uuid,
  p_step text,
  p_job_kind text,
  p_job_id uuid,
  p_due date,
  p_what text,
  p_script text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := public.follow_up_press('add a call');
  v_what text := nullif(btrim(coalesce(p_what, '')), '');
  v_script text := nullif(btrim(coalesce(p_script, '')), '');
  v_step text := nullif(btrim(coalesce(p_step, '')), '');
  v_bid uuid := CASE WHEN p_job_kind = 'bid' THEN p_job_id END;
  v_project uuid := CASE WHEN p_job_kind = 'project' THEN p_job_id END;
  v_pipeline uuid := CASE WHEN p_job_kind = 'pipeline' THEN p_job_id END;
  v_open public.call_tasks%ROWTYPE;
  v_id uuid;
  v_name text;
BEGIN
  IF v_what IS NULL THEN
    RAISE EXCEPTION 'Say what the call is about.' USING ERRCODE = 'P0001';
  END IF;
  IF p_due IS NULL THEN
    RAISE EXCEPTION 'Say which day to call.' USING ERRCODE = 'P0001';
  END IF;
  PERFORM public.contact_job_check(p_job_kind, p_job_id);
  PERFORM 1 FROM public.contacts WHERE id = p_contact FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That person is not there.' USING ERRCODE = 'P0001';
  END IF;
  v_name := public.contact_display_name(p_contact);
  SELECT * INTO v_open FROM public.call_tasks t
  WHERE t.contact_id = p_contact AND t.done_at IS NULL
    AND coalesce(t.step_key, '') = coalesce(v_step, '')
    AND coalesce(t.bid_id, t.project_id, t.jobs_ledger_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = coalesce(v_bid, v_project, v_pipeline, '00000000-0000-0000-0000-000000000000'::uuid)
  FOR UPDATE;
  IF FOUND THEN
    UPDATE public.call_tasks SET due_on = p_due, what = v_what, script = coalesce(v_script, script) WHERE id = v_open.id;
    IF p_due IS DISTINCT FROM v_open.due_on THEN
      PERFORM public.follow_up_event(p_contact,
        format('%s moved the call to %s %s to %s.', public.follow_up_user_name(v_me), v_name, v_what, public.follow_up_day(p_due)));
    END IF;
    RETURN v_open.id;
  END IF;
  INSERT INTO public.call_tasks (contact_id, step_key, bid_id, project_id, jobs_ledger_id, due_on, what, script, made_by)
  VALUES (p_contact, v_step, v_bid, v_project, v_pipeline, p_due, v_what, v_script, v_me)
  RETURNING id INTO v_id;
  PERFORM public.follow_up_event(p_contact,
    format('%s added a call to %s %s for %s.', public.follow_up_user_name(v_me), v_name, v_what, public.follow_up_day(p_due)));
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.call_task_add(uuid, text, text, uuid, date, text, text) IS
  'Calls (v2.5596): Add to my calls. One open task a person a step a job; a second press moves its day and words. The office team through follow_up_press; a gray line in the thread.';

REVOKE ALL ON FUNCTION public.call_task_add(uuid, text, text, uuid, date, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.call_task_add(uuid, text, text, uuid, date, text, text) TO authenticated;

-- I called, with a team note that goes in the thread; or skipped, with a gray line.
CREATE OR REPLACE FUNCTION public.call_task_done(p_id uuid, p_how text, p_note text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := public.follow_up_press('close a call');
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v public.call_tasks%ROWTYPE;
  v_line uuid;
  v_name text;
BEGIN
  IF p_how IS NULL OR p_how NOT IN ('called', 'skipped') THEN
    RAISE EXCEPTION 'Say how: called or skipped.' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v FROM public.call_tasks WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v.done_at IS NOT NULL THEN
    RAISE EXCEPTION 'That call is not open.' USING ERRCODE = 'P0001';
  END IF;
  v_name := public.contact_display_name(v.contact_id);
  IF p_how = 'called' THEN
    INSERT INTO public.messages (contact_id, channel, direction, who_user_id, who_text, body, bid_id, project_id, jobs_ledger_id)
    VALUES (v.contact_id, 'note', 'team', v_me, public.follow_up_user_name(v_me),
      coalesce(v_note, format('Called %s %s.', v_name, v.what)), v.bid_id, v.project_id, v.jobs_ledger_id)
    RETURNING id INTO v_line;
  ELSE
    PERFORM public.follow_up_event(v.contact_id, format('%s skipped the call to %s %s.', public.follow_up_user_name(v_me), v_name, v.what));
  END IF;
  UPDATE public.call_tasks SET done_at = clock_timestamp(), done_how = p_how, done_by = v_me, done_message_id = v_line WHERE id = p_id;
  RETURN v_line;
END;
$$;

COMMENT ON FUNCTION public.call_task_done(uuid, text, text) IS
  'Calls (v2.5596): I called (a team note in the thread, the given words or "Called Dana about the estimate.") or Skip (a gray line). Refused for a call that is not open.';

REVOKE ALL ON FUNCTION public.call_task_done(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.call_task_done(uuid, text, text) TO authenticated;

-- Tomorrow, or any day from today on.
CREATE OR REPLACE FUNCTION public.call_task_move(p_id uuid, p_due date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := public.follow_up_press('move a call');
  v public.call_tasks%ROWTYPE;
BEGIN
  IF p_due IS NULL OR p_due < public.app_today() THEN
    RAISE EXCEPTION 'Pick today or a day to come.' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v FROM public.call_tasks WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v.done_at IS NOT NULL THEN
    RAISE EXCEPTION 'That call is not open.' USING ERRCODE = 'P0001';
  END IF;
  IF p_due = v.due_on THEN
    RETURN;
  END IF;
  UPDATE public.call_tasks SET due_on = p_due WHERE id = p_id;
  PERFORM public.follow_up_event(v.contact_id,
    format('%s moved the call to %s %s to %s.', public.follow_up_user_name(v_me), public.contact_display_name(v.contact_id), v.what, public.follow_up_day(p_due)));
END;
$$;

COMMENT ON FUNCTION public.call_task_move(uuid, date) IS
  'Calls (v2.5596): Tomorrow, or any day from today on, with a gray line. Refused for a day gone by or a call that is not open.';

REVOKE ALL ON FUNCTION public.call_task_move(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.call_task_move(uuid, date) TO authenticated;

-- ---------- 3. The webhook's close ----------

-- A completed call to or from the person closes every open call to them, with the call's line. The service role alone.
CREATE OR REPLACE FUNCTION public.call_tasks_close_by_call(p_contact uuid, p_message uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n integer;
BEGIN
  UPDATE public.call_tasks SET done_at = clock_timestamp(), done_how = 'call', done_message_id = p_message
  WHERE contact_id = p_contact AND done_at IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

COMMENT ON FUNCTION public.call_tasks_close_by_call(uuid, uuid) IS
  'Calls (v2.5596): quo-webhook closes every open call to a person when a completed call to or from them lands in the thread. The service role alone.';

REVOKE ALL ON FUNCTION public.call_tasks_close_by_call(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.call_tasks_close_by_call(uuid, uuid) TO service_role;

-- ---------- 4. The script on the step ----------

ALTER TABLE public.flow_steps ADD COLUMN IF NOT EXISTS call_script text;
ALTER TABLE public.flow_steps ADD COLUMN IF NOT EXISTS call_script_es text;
ALTER TABLE public.flow_steps ADD COLUMN IF NOT EXISTS suggest_call boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.flow_steps.call_script IS 'Calls (v2.5596): what to say on the call the receipt suggests after this step''s text, with the quick replies'' blanks; null uses the app''s own words.';
COMMENT ON COLUMN public.flow_steps.suggest_call IS 'Calls (v2.5596): whether the receipt suggests a call after this step''s text goes.';

-- The residential customer flow's scripts, as src/lib/flows/callScripts.ts holds them; a script the office wrote stays.
UPDATE public.flow_steps s SET
  call_script = 'Hi {first}, this is {me} with Click Plumbing. You should have a text from us with the window for {day}, {window}. Does that still work for you? {tech} will text you when on the way.',
  call_script_es = 'Hola {first}, le habla {me} de Click Plumbing. Le llegó un mensaje nuestro con la ventana del {day}, {window}. ¿Le sigue funcionando? {tech} le avisará cuando vaya en camino.'
FROM public.flows f WHERE f.id = s.flow_id AND f.kind = 'residential' AND s.step_key = 'booked' AND s.call_script IS NULL;
UPDATE public.flow_steps s SET
  call_script = 'Hi {first}, this is {me} with Click Plumbing. I just sent your estimate for {job}, {amount}. Do you have two minutes for me to walk you through it? You can approve from the link whenever you are ready.',
  call_script_es = 'Hola {first}, le habla {me} de Click Plumbing. Acabo de enviarle el presupuesto de {job}, {amount}. ¿Tiene dos minutos para que se lo explique? Puede aprobarlo desde el enlace cuando guste.'
FROM public.flows f WHERE f.id = s.flow_id AND f.kind = 'residential' AND s.step_key = 'estimate' AND s.call_script IS NULL;
UPDATE public.flow_steps s SET
  call_script = 'Hi {first}, this is {me} with Click Plumbing. Checking in on the estimate for {job}. Any questions I can answer before you decide?',
  call_script_es = 'Hola {first}, le habla {me} de Click Plumbing. Le llamo por el presupuesto de {job}. ¿Tiene alguna pregunta antes de decidir?'
FROM public.flows f WHERE f.id = s.flow_id AND f.kind = 'residential' AND s.step_key = 'approved' AND s.call_script IS NULL;

-- flow_save as 20261013020000 wrote it, with the three columns.
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
      owed_words, call_script, call_script_es, suggest_call)
    VALUES (
      v_flow, s ->> 'step_key', s ->> 'lane', (s ->> 'position')::integer, s ->> 'name', coalesce(s ->> 'name_es', ''),
      s ->> 'phase', s ->> 'who', nullif(s ->> 'seat_user_id', '')::uuid,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(s -> 'facts', '[]'::jsonb))), coalesce(s ->> 'join_word', 'and'),
      ARRAY(SELECT jsonb_array_elements_text(coalesce(s -> 'papers', '[]'::jsonb))), s ->> 'loop_words', s ->> 'loop_ends',
      coalesce((s ->> 'fork')::boolean, false), coalesce((s ->> 'aside')::boolean, false),
      coalesce((s ->> 'skip_one_job')::boolean, false), s ->> 'later_en', s ->> 'later_es', (s ->> 'nudge_days')::integer,
      s ->> 'nudge_how', s ->> 'nudge_send', s ->> 'nudge_day_fact', coalesce((s ->> 'usual')::integer, 0), s ->> 'owed_words',
      s ->> 'call_script', s ->> 'call_script_es', coalesce((s ->> 'suggest_call')::boolean, true))
    ON CONFLICT (flow_id, step_key) DO UPDATE SET
      lane = EXCLUDED.lane, position = EXCLUDED.position, name = EXCLUDED.name, name_es = EXCLUDED.name_es,
      phase = EXCLUDED.phase, who = EXCLUDED.who, seat_user_id = EXCLUDED.seat_user_id, facts = EXCLUDED.facts,
      join_word = EXCLUDED.join_word, papers = EXCLUDED.papers, loop_words = EXCLUDED.loop_words,
      loop_ends = EXCLUDED.loop_ends, fork = EXCLUDED.fork, aside = EXCLUDED.aside, skip_one_job = EXCLUDED.skip_one_job,
      later_en = EXCLUDED.later_en, later_es = EXCLUDED.later_es, nudge_days = EXCLUDED.nudge_days,
      nudge_how = EXCLUDED.nudge_how, nudge_send = EXCLUDED.nudge_send, nudge_day_fact = EXCLUDED.nudge_day_fact,
      usual = EXCLUDED.usual, owed_words = EXCLUDED.owed_words,
      call_script = EXCLUDED.call_script, call_script_es = EXCLUDED.call_script_es, suggest_call = EXCLUDED.suggest_call
    -- A step the Save left as it was keeps its updated_at.
    WHERE (fs.lane, fs.position, fs.name, fs.name_es, fs.phase, fs.who, fs.seat_user_id, fs.facts, fs.join_word,
           fs.papers, fs.loop_words, fs.loop_ends, fs.fork, fs.aside, fs.skip_one_job, fs.later_en, fs.later_es,
           fs.nudge_days, fs.nudge_how, fs.nudge_send, fs.nudge_day_fact, fs.usual, fs.owed_words,
           fs.call_script, fs.call_script_es, fs.suggest_call)
      IS DISTINCT FROM
          (EXCLUDED.lane, EXCLUDED.position, EXCLUDED.name, EXCLUDED.name_es, EXCLUDED.phase, EXCLUDED.who,
           EXCLUDED.seat_user_id, EXCLUDED.facts, EXCLUDED.join_word, EXCLUDED.papers, EXCLUDED.loop_words,
           EXCLUDED.loop_ends, EXCLUDED.fork, EXCLUDED.aside, EXCLUDED.skip_one_job, EXCLUDED.later_en, EXCLUDED.later_es,
           EXCLUDED.nudge_days, EXCLUDED.nudge_how, EXCLUDED.nudge_send, EXCLUDED.nudge_day_fact, EXCLUDED.usual,
           EXCLUDED.owed_words, EXCLUDED.call_script, EXCLUDED.call_script_es, EXCLUDED.suggest_call);
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

-- follow_up_count as 20261013180000 wrote it, with an open call counting its person.
CREATE OR REPLACE FUNCTION public.follow_up_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH standing AS (
    SELECT DISTINCT ON (m.contact_id) m.contact_id, m.back_on, m.back_done_at
    FROM public.messages m
    WHERE m.channel = 'note' AND (m.back_on IS NOT NULL OR m.back_words IS NOT NULL)
    ORDER BY m.contact_id, m.at DESC, m.id DESC
  )
  SELECT count(*)::integer FROM (
    SELECT s.contact_id FROM standing s WHERE s.back_on <= public.app_today() AND s.back_done_at IS NULL
    UNION
    SELECT c.id FROM public.contacts c
    WHERE c.state = 'waiting' OR (c.state = 'snoozed' AND c.snoozed_until <= public.app_today())
    UNION
    SELECT o.contact_id FROM public.contact_owed o WHERE o.done_at IS NULL
    UNION
    SELECT t.contact_id FROM public.call_tasks t WHERE t.done_at IS NULL
  ) people
  WHERE NOT EXISTS (
    SELECT 1 FROM public.contacts off WHERE off.id = people.contact_id AND off.kind IN ('supply_house', 'candidate'))
$$;

-- ---------- The fences, for the new table ----------

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
