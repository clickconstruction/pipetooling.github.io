-- Messages, cut 4's follow-ups (migration *_flow_save_remind_price): Settings → Flows' Save in one call. Rosa saves a
-- rename, a new step and a removed one; History and Removed keep who; a step the Save left alone keeps its updated_at.
-- Maria's Save from the flow as it was before Rosa's is refused (savedMeanwhile), a Save that fails part way changes
-- nothing, and a step comes back from Removed. A superintendent, a training account, a twin and someone signed out are
-- refused, as are a flow that is not there and one with no steps. Then the money team prices an office draft change
-- order and sends it; a price after it went, and one from the office, are refused in words. Last, Remind now lets the
-- step's standing hold on its job go, and a hold on another job stays. The fixture is made as postgres; the presses run
-- as each user through RLS; everything rolls back. Raises on the first failed assertion; ends with "flow_save PASSED". See
-- scripts/pgtest-flow-save.sh. Never against prod.
\set ON_ERROR_STOP 1
\set rosa '00000000-0000-0000-0000-00000000b5d1'
\set maria '00000000-0000-0000-0000-00000000b5d2'
\set wendi '00000000-0000-0000-0000-00000000b5d3'
\set training '00000000-0000-0000-0000-00000000b5d4'
\set twin '00000000-0000-0000-0000-00000000b5d5'
\set dev '00000000-0000-0000-0000-00000000b5d6'
\set co '00000000-0000-0000-0000-00000000b5e1'
\set unk '00000000-0000-0000-0000-00000000b5f1'
\set job '00000000-0000-0000-0000-00000000b5a1'
BEGIN;

-- Rosa in the office (an assistant), Maria on the money team (the controller, in the office too), a superintendent
-- outside the office, an assistant in training mode, a digital twin, and a dev who keeps the customer.
INSERT INTO auth.users (id, email) VALUES
  (:'rosa', 'rosa@save.test'), (:'maria', 'maria@save.test'), (:'wendi', 'super@save.test'),
  (:'training', 'training@save.test'), (:'twin', 'twin@save.test'), (:'dev', 'dev@save.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  (:'rosa', 'rosa@save.test', 'Rosa', 'assistant', false, false),
  (:'maria', 'maria@save.test', 'Maria', 'controller', false, false),
  (:'wendi', 'super@save.test', 'Wendi', 'superintendent', false, false),
  (:'training', 'training@save.test', 'Training', 'assistant', true, false),
  (:'twin', 'twin@save.test', 'Twin', 'estimator', false, true),
  (:'dev', 'dev@save.test', 'Dev', 'dev', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

-- A job we won, with change order 1 drafted by the office from a customer's message: no cost and no price yet.
INSERT INTO public.customers (id, name, master_user_id) VALUES
  ('00000000-0000-0000-0000-00000000b5c1', 'Helotes Dental Office', :'dev');
INSERT INTO public.projects (id, name, customer_id) VALUES
  ('00000000-0000-0000-0000-00000000b5a1', 'Helotes Dental Office', '00000000-0000-0000-0000-00000000b5c1');
INSERT INTO public.gc_projects (project_id, stage) VALUES ('00000000-0000-0000-0000-00000000b5a1', 'buyout');
INSERT INTO public.gc_change_orders (id, project_id, number, description, reason) VALUES
  (:'co', '00000000-0000-0000-0000-00000000b5a1', 1, 'A sink in exam 3, as in exam 2', 'owner');
-- A number nobody has named yet, on the unknown flow's one step, for Remind now.
INSERT INTO public.contacts (id, kind) VALUES (:'unk', 'unknown');

CREATE SCHEMA fsv;
CREATE FUNCTION fsv.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused, its words holding `want`; its writes go with the refusal (a subtransaction).
CREATE FUNCTION fsv.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN OTHERS THEN
    IF position(want IN SQLERRM) = 0 THEN RAISE EXCEPTION E'% was refused for another reason.\n--- got ---\n%\n--- want it to hold ---\n%', label, SQLERRM, want; END IF;
    RAISE NOTICE 'ok: % (%)', label, SQLERRM;
    RETURN;
  END;
  RAISE EXCEPTION '% was allowed', label;
END $$;
CREATE FUNCTION fsv.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
CREATE FUNCTION fsv.signed_out() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
END $$;
-- A flow's steps as the editor writes them (flowRows): every column but the row's own id, its flow and its clock.
CREATE FUNCTION fsv.rows(p_kind text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_agg(to_jsonb(s) - 'id' - 'flow_id' - 'updated_at' ORDER BY s.lane, s.position)
  FROM public.flow_steps s JOIN public.flows f ON f.id = s.flow_id WHERE f.kind = p_kind
$$;
-- One step's row of a flow, read now.
CREATE FUNCTION fsv.step(p_kind text, p_key text) RETURNS public.flow_steps LANGUAGE sql AS $$
  SELECT s.* FROM public.flow_steps s JOIN public.flows f ON f.id = s.flow_id WHERE f.kind = p_kind AND s.step_key = p_key
$$;
GRANT USAGE ON SCHEMA fsv TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA fsv TO anon, authenticated;

-- Closeout's row and Invited's clock as the seed left them, for later.
SELECT (to_jsonb(fsv.step('trade', 'closeout')) - 'id' - 'flow_id' - 'updated_at')::text AS closeout_row \gset
SELECT (fsv.step('trade', 'invited')).updated_at AS invited_at \gset

-- 1 · Rosa renames Papers in, removes Closeout and adds a step in Once, in one Save.
SET LOCAL ROLE authenticated;
SELECT fsv.as_user(:'rosa');
SELECT public.flow_save('trade',
  (SELECT jsonb_agg(CASE WHEN r ->> 'step_key' = 'papers' THEN jsonb_set(r, '{name}', '"Papers and insurance"') ELSE r END)
   FROM jsonb_array_elements(fsv.rows('trade')) r WHERE r ->> 'step_key' <> 'closeout')
    || jsonb_build_array(jsonb_build_object('step_key', 'safety_orientation', 'lane', 'once', 'position', 4, 'name', 'Safety orientation',
         'phase', 'setup', 'who', 'them', 'facts', jsonb_build_array('portal_opened'))),
  jsonb_build_array(
    jsonb_build_object('step_key', 'papers', 'what', 'Papers in renamed Papers and insurance', 'before', NULL, 'after', NULL),
    jsonb_build_object('step_key', 'closeout', 'what', '− Closeout'),
    jsonb_build_object('step_key', 'safety_orientation', 'what', '+ Safety orientation in Once')),
  jsonb_build_array(jsonb_build_object('step_key', 'closeout', 'lane', 'per_job', 'step', :'closeout_row'::jsonb)),
  '{}', NULL) AS saved_at \gset
SELECT fsv.same('the rename and the new step, in the Once lane''s order',
  (SELECT string_agg(s.step_key || ':' || s.name, ',' ORDER BY s.position)
   FROM public.flow_steps s JOIN public.flows f ON f.id = s.flow_id WHERE f.kind = 'trade' AND s.lane = 'once'),
  'invited:Invited,portal:Portal opened,papers:Papers and insurance,msa:MSA signed,safety_orientation:Safety orientation');
SELECT fsv.same('Closeout gone from the steps, and in Removed by Rosa',
  concat_ws('|', ((fsv.step('trade', 'closeout')).step_key IS NULL)::text,
    (SELECT concat_ws(',', r.lane, r.step ->> 'name', r.removed_by_name, (r.removed_by_user_id = :'rosa')::text, coalesce(r.put_back_at::text, '-'))
     FROM public.flow_removed_steps r JOIN public.flows f ON f.id = r.flow_id WHERE f.kind = 'trade' AND r.step_key = 'closeout')),
  'true|per_job,Closeout,Rosa,true,-');
SELECT fsv.same('History keeps the three lines in order, by Rosa, a null before as no before',
  (SELECT string_agg(coalesce(h.step_key, '-') || ': ' || h.what || ' · ' || h.by_name || ' · ' || (h.before IS NULL)::text, ' | ' ORDER BY h.created_at)
   FROM public.flow_step_history h JOIN public.flows f ON f.id = h.flow_id WHERE f.kind = 'trade'),
  'papers: Papers in renamed Papers and insurance · Rosa · true | closeout: − Closeout · Rosa · true | safety_orientation: + Safety orientation in Once · Rosa · true');
SELECT fsv.same('the Save returns its newest History line''s time, and Invited, left alone, keeps its clock',
  concat_ws('|',
    ((SELECT max(h.created_at) FROM public.flow_step_history h JOIN public.flows f ON f.id = h.flow_id WHERE f.kind = 'trade') = :'saved_at'::timestamptz)::text,
    ((fsv.step('trade', 'invited')).updated_at = :'invited_at'::timestamptz)::text),
  'true|true');

-- 2 · Maria saves from the flow as it was before Rosa's Save: refused, and nothing changes.
SELECT fsv.as_user(:'maria');
SELECT fsv.refused('a Save from the flow as it was before another''s',
  $q$SELECT public.flow_save('trade', fsv.rows('trade'), '[]', '[]', '{}', NULL)$q$, 'savedMeanwhile');

-- 3 · A Save that fails part way changes nothing: the rename goes with the History line too long for its column.
SELECT fsv.refused('a History line past 500 characters fails the whole Save',
  format($q$SELECT public.flow_save('trade',
    (SELECT jsonb_agg(CASE WHEN r ->> 'step_key' = 'portal' THEN jsonb_set(r, '{name}', '"Portal visited"') ELSE r END) FROM jsonb_array_elements(fsv.rows('trade')) r),
    jsonb_build_array(jsonb_build_object('step_key', 'portal', 'what', repeat('x', 501))), '[]', '{}', %L)$q$, :'saved_at'),
  'flow_step_history_what_said');
SELECT fsv.same('so Portal opened keeps its name', (fsv.step('trade', 'portal')).name, 'Portal opened');

-- 4 · Maria puts Closeout back, from Rosa's Save.
SELECT public.flow_save('trade', fsv.rows('trade') || jsonb_build_array(:'closeout_row'::jsonb),
  jsonb_build_array(jsonb_build_object('step_key', 'closeout', 'what', 'Closeout put back')), '[]', ARRAY['closeout'], :'saved_at') AS saved_again \gset
SELECT fsv.same('Closeout is back on the flow, and Removed says Maria put it back',
  concat_ws('|', (fsv.step('trade', 'closeout')).name,
    (SELECT concat_ws(',', (r.put_back_at IS NOT NULL)::text, (r.put_back_by_user_id = :'maria')::text)
     FROM public.flow_removed_steps r JOIN public.flows f ON f.id = r.flow_id WHERE f.kind = 'trade' AND r.step_key = 'closeout')),
  'Closeout|true,true');

-- 5 · Who may save, and what a Save needs.
SELECT fsv.refused('a flow that is not there', format($q$SELECT public.flow_save('vendor', fsv.rows('trade'), '[]', '[]', '{}', %L)$q$, :'saved_again'), 'flowUnknown');
SELECT fsv.refused('a flow with no steps', format($q$SELECT public.flow_save('trade', '[]', '[]', '[]', '{}', %L)$q$, :'saved_again'), 'noSteps');
SELECT fsv.as_user(:'wendi');
SELECT fsv.refused('the superintendent', format($q$SELECT public.flow_save('trade', fsv.rows('trade'), '[]', '[]', '{}', %L)$q$, :'saved_again'), 'notAllowed');
SELECT fsv.as_user(:'training');
SELECT fsv.refused('a training account', format($q$SELECT public.flow_save('trade', fsv.rows('trade'), '[]', '[]', '{}', %L)$q$, :'saved_again'), 'trainingAccount');
SELECT fsv.as_user(:'twin');
SELECT fsv.refused('a digital twin', format($q$SELECT public.flow_save('trade', fsv.rows('trade'), '[]', '[]', '{}', %L)$q$, :'saved_again'), 'digitalTwin');
SELECT fsv.signed_out();
SELECT fsv.refused('someone signed out', format($q$SELECT public.flow_save('trade', '[{}]', '[]', '[]', '{}', %L)$q$, :'saved_again'), 'signIn');

-- 6 · The money team prices the office's draft and sends it; the office does not price, and a price stays once it went.
SELECT fsv.as_user(:'rosa');
SELECT fsv.refused('the office prices no change order', format($q$SELECT public.gc_price_change_order(%L, 1200, 1500)$q$, :'co'),
  'Only the money team prices a change order.');
SELECT fsv.as_user(:'training');
SELECT fsv.refused('nor a training account', format($q$SELECT public.gc_price_change_order(%L, 1200, 1500)$q$, :'co'),
  'A training account cannot price a change order.');
SELECT fsv.as_user(:'twin');
SELECT fsv.refused('nor a twin', format($q$SELECT public.gc_price_change_order(%L, 1200, 1500)$q$, :'co'),
  'A digital twin cannot price a change order.');
SELECT fsv.as_user(:'maria');
SELECT fsv.refused('a cost of nothing', format($q$SELECT public.gc_price_change_order(%L, 0, 1500)$q$, :'co'), 'Type what it costs us.');
SELECT fsv.refused('a change order that is not there', $q$SELECT public.gc_price_change_order(gen_random_uuid(), 1200, 1500)$q$,
  'That change order is not there.');
SELECT public.gc_price_change_order(:'co', 1200.4, 1500.6);
SELECT fsv.same('Maria prices it in whole dollars, still a draft',
  (SELECT cost || ':' || price || ':' || status FROM public.gc_change_orders WHERE id = :'co'), '1200:1501:draft');
SELECT public.gc_send_change_order(:'co', public.app_today());
SELECT fsv.same('and it goes to the customer', (SELECT status FROM public.gc_change_orders WHERE id = :'co'), 'sent');
SELECT fsv.refused('its price stays once it went', format($q$SELECT public.gc_price_change_order(%L, 1300, 1600)$q$, :'co'),
  'Change order 1 went to the customer, so its price stays as it went.');

-- 7 · Remind now lets the step's standing hold on its job go, with who; a hold on another job stays.
SELECT fsv.as_user(:'rosa');
SELECT public.nudge_hold_until(:'unk', 'who', NULL, NULL, public.app_today() + 4) AS hold \gset
SELECT public.nudge_hold_until(:'unk', 'who', 'project', :'job', public.app_today() + 4) AS hold_job \gset
SELECT public.nudge_record_sent(:'unk', 'who', NULL, NULL, NULL, 'text', NULL) AS sent \gset
SELECT fsv.same('the hold on the person goes with Remind now, by Rosa; the hold on the job stays; the reminder is Rosa''s',
  concat_ws('|',
    (SELECT concat_ws(',', (h.released_at IS NOT NULL)::text, (h.released_by_user_id = :'rosa')::text) FROM public.nudge_holds h WHERE h.id = :'hold'),
    (SELECT (h.released_at IS NULL)::text FROM public.nudge_holds h WHERE h.id = :'hold_job'),
    (SELECT concat_ws(',', n.how, n.sent_by, (n.by_user_id = :'rosa')::text) FROM public.nudge_sent n WHERE n.id = :'sent')),
  'true,true|true|text,person,true');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'flow_save PASSED'; END $$;
ROLLBACK;
