-- Messages, cut 4b (migration *_change_orders_from_messages): Rosa, in the office, drafts a change order from Priya's
-- text asking for a sink in exam 3, and Maria, on the money team, prices it and sends it to sign. The office drafts
-- through gc_draft_change_order_from_message and reads the order through gc_change_orders_office, never the table; the
-- draft is numbered after the job's own, keeps the message and who signs, and a message starts one change order; a
-- message that is not a customer's, has no job, or is on a job still bidding or lost is refused in words, as are a
-- superintendent, a training account and a digital twin; only the money team sends, an unpriced draft has nothing to
-- sign, and each send keeps a row the money team reads and nobody changes. The fixture and the messages are made as
-- postgres, standing in for the seed and the service role; the presses run as each user through RLS; everything rolls
-- back. Raises on the first failed assertion; ends with "gc_change_orders_from_messages PASSED". See
-- scripts/pgtest-gc-change-orders-from-messages.sh. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Rosa in the office (an assistant), Maria on the money team (the controller), a superintendent outside the office, an
-- assistant in training mode, a digital twin, and a dev who keeps the customer.
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-00000000c0d1', 'rosa@cofm.test'),
  ('00000000-0000-0000-0000-00000000c0d2', 'maria@cofm.test'),
  ('00000000-0000-0000-0000-00000000c0d3', 'super@cofm.test'),
  ('00000000-0000-0000-0000-00000000c0d4', 'training@cofm.test'),
  ('00000000-0000-0000-0000-00000000c0d5', 'twin@cofm.test'),
  ('00000000-0000-0000-0000-00000000c0d6', 'dev@cofm.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin) VALUES
  ('00000000-0000-0000-0000-00000000c0d1', 'rosa@cofm.test', 'Rosa', 'assistant', false, false),
  ('00000000-0000-0000-0000-00000000c0d2', 'maria@cofm.test', 'Maria', 'controller', false, false),
  ('00000000-0000-0000-0000-00000000c0d3', 'super@cofm.test', 'Wendi', 'superintendent', false, false),
  ('00000000-0000-0000-0000-00000000c0d4', 'training@cofm.test', 'Training', 'assistant', true, false),
  ('00000000-0000-0000-0000-00000000c0d5', 'twin@cofm.test', 'Twin', 'assistant', false, true),
  ('00000000-0000-0000-0000-00000000c0d6', 'dev@cofm.test', 'Dev', 'dev', false, false)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, is_digital_twin = EXCLUDED.is_digital_twin;

-- Helotes Dental Office, a job we won with change order 1 signed; a job still bidding and one lost, for the same
-- customer; a trade partner on the job.
INSERT INTO public.customers (id, name, master_user_id) VALUES
  ('00000000-0000-0000-0000-00000000c0c1', 'Helotes Dental Office', '00000000-0000-0000-0000-00000000c0d6');
INSERT INTO public.projects (id, name, customer_id) VALUES
  ('00000000-0000-0000-0000-00000000c0a1', 'Helotes Dental Office', '00000000-0000-0000-0000-00000000c0c1'),
  ('00000000-0000-0000-0000-00000000c0a2', 'Helotes Annex', '00000000-0000-0000-0000-00000000c0c1'),
  ('00000000-0000-0000-0000-00000000c0a3', 'Helotes Parking', '00000000-0000-0000-0000-00000000c0c1');
INSERT INTO public.gc_projects (project_id, stage, lost_on) VALUES
  ('00000000-0000-0000-0000-00000000c0a1', 'buyout', NULL),
  ('00000000-0000-0000-0000-00000000c0a2', 'bidding', NULL),
  ('00000000-0000-0000-0000-00000000c0a3', 'bidding', public.app_today() - 3);
INSERT INTO public.gc_trade_packages (id, project_id, trade, position) VALUES
  ('00000000-0000-0000-0000-00000000c0b1', '00000000-0000-0000-0000-00000000c0a1', 'Plumbing', 0);
INSERT INTO public.gc_change_orders (project_id, number, description, reason, cost, price, status, sent_on, answered_on, answered_how, days) VALUES
  ('00000000-0000-0000-0000-00000000c0a1', 1, 'Exam 2 cabinets', 'owner', 5200, 6300, 'signed', public.app_today() - 6, public.app_today() - 4, 'office', 0);
INSERT INTO public.gc_companies (id, name, contact_name, phone, email) VALUES
  ('00000000-0000-0000-0000-00000000c0e9', 'Cofm Plumbing', 'Greg Paulk', '(210) 555-0113', 'greg@cofm.example');

-- Priya, the customer's contact, and Greg, the trade partner's; their messages, as cut 5's sync will make them.
INSERT INTO public.contacts (id, kind, customer_id, name) VALUES
  ('00000000-0000-0000-0000-00000000c0e1', 'customer', '00000000-0000-0000-0000-00000000c0c1', 'Dr. Priya Raman');
INSERT INTO public.contacts (id, kind, gc_company_id) VALUES
  ('00000000-0000-0000-0000-00000000c0e2', 'trade', '00000000-0000-0000-0000-00000000c0e9');
INSERT INTO public.messages (id, contact_id, project_id, channel, direction, body) VALUES
  ('00000000-0000-0000-0000-00000000c0f1', '00000000-0000-0000-0000-00000000c0e1', '00000000-0000-0000-0000-00000000c0a1', 'text', 'in',
   'Can we add a sink in exam 3? Same as the one in exam 2.'),
  ('00000000-0000-0000-0000-00000000c0f2', '00000000-0000-0000-0000-00000000c0e1', NULL, 'text', 'in', 'And the lights in the lot?'),
  ('00000000-0000-0000-0000-00000000c0f3', '00000000-0000-0000-0000-00000000c0e1', '00000000-0000-0000-0000-00000000c0a2', 'text', 'in', 'A sink in the annex too?'),
  ('00000000-0000-0000-0000-00000000c0f4', '00000000-0000-0000-0000-00000000c0e2', '00000000-0000-0000-0000-00000000c0a1', 'text', 'in', 'Want me to price the sink?'),
  ('00000000-0000-0000-0000-00000000c0f5', '00000000-0000-0000-0000-00000000c0e1', '00000000-0000-0000-0000-00000000c0a3', 'text', 'in', 'Lights in the lot?'),
  ('00000000-0000-0000-0000-00000000c0f6', '00000000-0000-0000-0000-00000000c0e1', '00000000-0000-0000-0000-00000000c0a1', 'email', 'in', 'One more outlet in exam 1.');

-- The change order's file, as Maria's upload leaves it.
INSERT INTO storage.objects (bucket_id, name) VALUES
  ('gc-change-orders', '00000000-0000-0000-0000-00000000c0a1/change-order-2.pdf');

CREATE SCHEMA cfm;
CREATE FUNCTION cfm.same(label text, got text, want text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF got IS DISTINCT FROM want THEN RAISE EXCEPTION E'% differs.\n--- got ---\n%\n--- want ---\n%', label, got, want; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;
-- A statement refused, its words holding `want`; its writes go with the refusal (a subtransaction).
CREATE FUNCTION cfm.refused(label text, stmt text, want text) RETURNS void LANGUAGE plpgsql AS $$
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
CREATE FUNCTION cfm.as_user(p_user uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
END $$;
GRANT USAGE ON SCHEMA cfm TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA cfm TO anon, authenticated;

-- 1 · Rosa drafts change order 2 from Priya's text, and reads it through the office's view only.
SET LOCAL ROLE authenticated;
SELECT cfm.as_user('00000000-0000-0000-0000-00000000c0d1');
SELECT cfm.same('Rosa drafts change order 2 from Priya''s text',
  (SELECT change_order_number::text FROM public.gc_draft_change_order_from_message('00000000-0000-0000-0000-00000000c0f1',
    '{"description": "A sink in exam 3, as in exam 2", "reason": "owner"}'::jsonb)), '2');
SELECT cfm.same('Rosa reads no change order from the table, which stays the money team''s',
  (SELECT count(*)::text FROM public.gc_change_orders), '0');
SELECT cfm.same('the office''s view keeps the text it came from and Priya as the signer, so the text''s chip reads it',
  (SELECT number || ':' || status || ':' || schedule_words || ':' || (signer_contact_id = '00000000-0000-0000-0000-00000000c0e1')
   FROM public.gc_change_orders_office WHERE source_message_id = '00000000-0000-0000-0000-00000000c0f1'), '2:draft:none:true');
SELECT cfm.same('and never a money column', (SELECT count(*)::text FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'gc_change_orders_office' AND column_name IN ('cost', 'price', 'pct_done')), '0');

-- 2 · What the office's draft refuses, in words.
SELECT cfm.refused('a second change order from the same text',
  $q$SELECT * FROM public.gc_draft_change_order_from_message('00000000-0000-0000-0000-00000000c0f1', '{"description": "Again"}'::jsonb)$q$,
  'This message became change order 2 already.');
SELECT cfm.refused('a text with no job',
  $q$SELECT * FROM public.gc_draft_change_order_from_message('00000000-0000-0000-0000-00000000c0f2', '{"description": "Lights"}'::jsonb)$q$,
  'Tie the message to a job first. A change order belongs to one job.');
SELECT cfm.refused('a job still bidding',
  $q$SELECT * FROM public.gc_draft_change_order_from_message('00000000-0000-0000-0000-00000000c0f3', '{"description": "A sink"}'::jsonb)$q$,
  'A change order needs a job we won. Helotes Annex is still bidding.');
SELECT cfm.refused('a job we lost',
  $q$SELECT * FROM public.gc_draft_change_order_from_message('00000000-0000-0000-0000-00000000c0f5', '{"description": "Lights"}'::jsonb)$q$,
  'A change order needs a job we won. Helotes Parking was lost.');
SELECT cfm.refused('a trade partner''s text',
  $q$SELECT * FROM public.gc_draft_change_order_from_message('00000000-0000-0000-0000-00000000c0f4', '{"description": "A sink"}'::jsonb)$q$,
  'A change order goes to a customer. This message is with a trade partner.');
SELECT cfm.refused('nothing said of what changes',
  $q$SELECT * FROM public.gc_draft_change_order_from_message('00000000-0000-0000-0000-00000000c0f6', '{"description": "  "}'::jsonb)$q$,
  'Say what is changing.');
SELECT cfm.refused('a trade from another job',
  $q$SELECT * FROM public.gc_draft_change_order_from_message('00000000-0000-0000-0000-00000000c0f6',
    '{"description": "An outlet", "packageId": "00000000-0000-0000-0000-00000000c0b9"}'::jsonb)$q$,
  'That trade is not on this project.');
SELECT cfm.refused('a message that is not there',
  $q$SELECT * FROM public.gc_draft_change_order_from_message('00000000-0000-0000-0000-00000000c0ff', '{"description": "A sink"}'::jsonb)$q$,
  'That message is not there.');

-- 3 · Rosa does not send it, and writes no send.
SELECT cfm.refused('Rosa does not send a change order',
  $q$SELECT public.gc_send_change_order_to_sign((SELECT id FROM public.gc_change_orders_office WHERE number = 2), public.app_today() + 7, '',
    '00000000-0000-0000-0000-00000000c0a1/change-order-2.pdf', 'Change order 2.pdf', repeat('a', 64))$q$,
  'Only the money team sends a change order to sign.');
SELECT cfm.refused('Rosa writes no send',
  $q$INSERT INTO public.gc_change_order_sends (change_order_id, project_id, sign_by, file_path, file_name, file_sha256)
     VALUES ((SELECT id FROM public.gc_change_orders_office WHERE number = 2), '00000000-0000-0000-0000-00000000c0a1', public.app_today() + 7,
             '00000000-0000-0000-0000-00000000c0a1/change-order-2.pdf', 'Change order 2.pdf', repeat('a', 64))$q$,
  'row-level security');

-- 4 · Outside the office, in training, or a twin: no draft.
SELECT cfm.as_user('00000000-0000-0000-0000-00000000c0d3');
SELECT cfm.refused('a superintendent drafts no change order',
  $q$SELECT * FROM public.gc_draft_change_order_from_message('00000000-0000-0000-0000-00000000c0f6', '{"description": "An outlet"}'::jsonb)$q$,
  'Only the office drafts a change order from a message.');
SELECT cfm.as_user('00000000-0000-0000-0000-00000000c0d4');
SELECT cfm.refused('a training account drafts no change order',
  $q$SELECT * FROM public.gc_draft_change_order_from_message('00000000-0000-0000-0000-00000000c0f6', '{"description": "An outlet"}'::jsonb)$q$,
  'A training account cannot draft a change order.');
SELECT cfm.as_user('00000000-0000-0000-0000-00000000c0d5');
SELECT cfm.refused('a digital twin drafts no change order',
  $q$SELECT * FROM public.gc_draft_change_order_from_message('00000000-0000-0000-0000-00000000c0f6', '{"description": "An outlet"}'::jsonb)$q$,
  'A digital twin cannot draft a change order.');

-- 5 · Maria finds it unpriced, prices it, and sends it to sign.
SELECT cfm.as_user('00000000-0000-0000-0000-00000000c0d2');
SELECT cfm.same('Maria reads the draft, unpriced, signed by Priya, from the text',
  (SELECT cost || ':' || price || ':' || (signer_contact_id = '00000000-0000-0000-0000-00000000c0e1') || ':' || (source_message_id = '00000000-0000-0000-0000-00000000c0f1')
   FROM public.gc_change_orders WHERE project_id = '00000000-0000-0000-0000-00000000c0a1' AND number = 2), '0:0:true:true');
SELECT cfm.refused('an unpriced draft has nothing to sign',
  $q$SELECT public.gc_send_change_order_to_sign((SELECT id FROM public.gc_change_orders WHERE project_id = '00000000-0000-0000-0000-00000000c0a1' AND number = 2),
    public.app_today() + 7, '', '00000000-0000-0000-0000-00000000c0a1/change-order-2.pdf', 'Change order 2.pdf', repeat('a', 64))$q$,
  'adds no price and no days, so there is nothing to sign');
UPDATE public.gc_change_orders SET cost = 1800, price = 2150, package_id = '00000000-0000-0000-0000-00000000c0b1'
WHERE project_id = '00000000-0000-0000-0000-00000000c0a1' AND number = 2;
SELECT cfm.refused('a file not uploaded',
  $q$SELECT public.gc_send_change_order_to_sign((SELECT id FROM public.gc_change_orders WHERE project_id = '00000000-0000-0000-0000-00000000c0a1' AND number = 2),
    public.app_today() + 7, '', '00000000-0000-0000-0000-00000000c0a1/missing.pdf', 'Change order 2.pdf', repeat('a', 64))$q$,
  'Upload the change order file first.');
SELECT cfm.refused('another job''s file',
  $q$SELECT public.gc_send_change_order_to_sign((SELECT id FROM public.gc_change_orders WHERE project_id = '00000000-0000-0000-0000-00000000c0a1' AND number = 2),
    public.app_today() + 7, '', '00000000-0000-0000-0000-00000000c0a2/change-order-2.pdf', 'Change order 2.pdf', repeat('a', 64))$q$,
  'That file is not this project''s.');
SELECT cfm.refused('a sign-by day gone by',
  $q$SELECT public.gc_send_change_order_to_sign((SELECT id FROM public.gc_change_orders WHERE project_id = '00000000-0000-0000-0000-00000000c0a1' AND number = 2),
    public.app_today() - 1, '', '00000000-0000-0000-0000-00000000c0a1/change-order-2.pdf', 'Change order 2.pdf', repeat('a', 64))$q$,
  'Pick a sign-by day from today on.');
SELECT cfm.same('Maria sends it to sign',
  (SELECT (public.gc_send_change_order_to_sign((SELECT id FROM public.gc_change_orders WHERE project_id = '00000000-0000-0000-0000-00000000c0a1' AND number = 2),
    public.app_today() + 7, 'The sink in exam 3, as you asked.', '00000000-0000-0000-0000-00000000c0a1/change-order-2.pdf', 'Change order 2.pdf', repeat('a', 64)) IS NOT NULL)::text),
  'true');
SELECT cfm.same('change order 2 went today',
  (SELECT status || ':' || (sent_on = public.app_today()) FROM public.gc_change_orders WHERE project_id = '00000000-0000-0000-0000-00000000c0a1' AND number = 2), 'sent:true');
SELECT cfm.same('its first send, to the job''s customer, with the line',
  (SELECT first || ':' || (customer_id = '00000000-0000-0000-0000-00000000c0c1') || ':' || note || ':' || (sent_by = '00000000-0000-0000-0000-00000000c0d2')
   FROM public.gc_change_order_sends), 'true:true:The sink in exam 3, as you asked.:true');
-- The send and the read of the sends are two statements: a read in the send's own statement keeps that statement's
-- snapshot, taken before the function wrote.
SELECT cfm.same('Maria reminds them',
  (SELECT (public.gc_send_change_order_to_sign((SELECT id FROM public.gc_change_orders WHERE project_id = '00000000-0000-0000-0000-00000000c0a1' AND number = 2),
    public.app_today() + 5, '', '00000000-0000-0000-0000-00000000c0a1/change-order-2.pdf', 'Change order 2.pdf', repeat('a', 64)) IS NOT NULL)::text),
  'true');
SELECT cfm.same('a reminder is a second send, not the first',
  (SELECT string_agg(first::text, ',' ORDER BY created_at) FROM public.gc_change_order_sends), 'true,false');
SELECT cfm.refused('nobody changes a send', $q$UPDATE public.gc_change_order_sends SET note = 'changed'$q$, 'permission denied');
SELECT cfm.refused('nobody deletes a send', $q$DELETE FROM public.gc_change_order_sends$q$, 'permission denied');

-- 6 · Rosa reads it went, and reads no send.
SELECT cfm.as_user('00000000-0000-0000-0000-00000000c0d1');
SELECT cfm.same('Rosa reads change order 2 sent, through the view',
  (SELECT number || ':' || status FROM public.gc_change_orders_office WHERE source_message_id = '00000000-0000-0000-0000-00000000c0f1'), '2:sent');
SELECT cfm.same('and no send, which is the money team''s', (SELECT count(*)::text FROM public.gc_change_order_sends), '0');
RESET ROLE;

DO $$ BEGIN RAISE NOTICE 'gc_change_orders_from_messages PASSED'; END $$;
ROLLBACK;
