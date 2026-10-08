SET lock_timeout = '3s';

-- GC mode, the real build, Owner Billing's O3: change orders to the customer on real data
-- (to-dos/gc-mode/mockups/owner-billing-o3.md on branch spike/gc-mode). O1 made gc_change_orders;
-- this adds the writes, so a change order's number, its steps and its words are checked in one
-- place, and a trigger keeps what went to the customer as it went. The prototype's rules, word for
-- word where it had them (draftChangeOrder, sendChangeOrder, ownerSignChangeOrder,
-- ownerDeclineChangeOrder, setChangeOrderPct, draftTimeExtension). SECURITY INVOKER, so RLS decides
-- who may: today dev only (O1's policies).

-- What went to the customer keeps what it said. A change order moves draft, then sent, then signed
-- or declined, never back. Once sent only its percent done changes, and once answered the answer
-- stays. A draft can be changed or deleted; one that went cannot be deleted, but a project's delete
-- still reaches it by cascade (a nested trigger, so pg_trigger_depth() is above 1).
CREATE OR REPLACE FUNCTION public.gc_change_orders_keep_what_went()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'draft' AND pg_trigger_depth() <= 1 THEN
      RAISE EXCEPTION 'Change order % went to the customer, so it stays on the record.', OLD.number;
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.project_id IS DISTINCT FROM OLD.project_id OR NEW.number IS DISTINCT FROM OLD.number THEN
    RAISE EXCEPTION 'A change order keeps its project and its number.';
  END IF;
  IF OLD.status <> 'draft' AND (
    NEW.description IS DISTINCT FROM OLD.description
    OR NEW.reason IS DISTINCT FROM OLD.reason
    OR NEW.schedule_words IS DISTINCT FROM OLD.schedule_words
    OR NEW.package_id IS DISTINCT FROM OLD.package_id
    OR NEW.cost IS DISTINCT FROM OLD.cost
    OR NEW.price IS DISTINCT FROM OLD.price
    OR NEW.days IS DISTINCT FROM OLD.days
    OR NEW.days_on_chart IS DISTINCT FROM OLD.days_on_chart
    OR NEW.plan_set_id IS DISTINCT FROM OLD.plan_set_id
    OR NEW.sent_on IS DISTINCT FROM OLD.sent_on
  ) THEN
    RAISE EXCEPTION 'Change order % went to the customer, so it keeps what it said. Draft a new one.', OLD.number;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
    (OLD.status = 'draft' AND NEW.status = 'sent')
    OR (OLD.status = 'sent' AND NEW.status IN ('signed', 'declined'))
  ) THEN
    RAISE EXCEPTION 'A change order goes from a draft, to sent, to signed or declined.';
  END IF;
  IF OLD.status IN ('signed', 'declined')
    AND (NEW.answered_on IS DISTINCT FROM OLD.answered_on OR NEW.answered_how IS DISTINCT FROM OLD.answered_how) THEN
    RAISE EXCEPTION 'The customer''s answer on change order % stays as it was recorded.', OLD.number;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gc_change_orders_keep_what_went ON public.gc_change_orders;
CREATE TRIGGER gc_change_orders_keep_what_went
  BEFORE UPDATE OR DELETE ON public.gc_change_orders
  FOR EACH ROW EXECUTE FUNCTION public.gc_change_orders_keep_what_went();

-- Draft one (the prototype's draftChangeOrder): the next number on the project, under a lock on its
-- row so two drafts never take one number. p_draft is the action's shape: description, reason,
-- schedule, packageId (null: our own work), cost, price, days, and planSetId (the set that started
-- it). The client sends the price it shows: what the office typed, or the cost plus the job's fee
-- (changeOrderPrice). Not on a job we are still bidding, nor one we lost.
CREATE OR REPLACE FUNCTION public.gc_draft_change_order(p_project_id uuid, p_draft jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_stage text;
  v_lost date;
  v_description text := btrim(coalesce(p_draft ->> 'description', ''));
  v_reason text := p_draft ->> 'reason';
  v_package uuid;
  v_set uuid;
  v_cost numeric;
  v_price numeric;
  v_days integer;
  v_schedule text;
  v_number integer;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to draft a change order.';
  END IF;
  SELECT stage, lost_on INTO v_stage, v_lost FROM public.gc_projects WHERE project_id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That GC project is not there.';
  END IF;
  IF v_stage = 'bidding' OR v_lost IS NOT NULL THEN
    RAISE EXCEPTION 'A change order is for a job we won. Change our number while we bid.';
  END IF;
  IF v_description = '' THEN
    RAISE EXCEPTION 'Say what is changing.';
  END IF;
  IF v_reason IS NULL OR v_reason NOT IN ('owner', 'field', 'plans') THEN
    RAISE EXCEPTION 'Pick why it changed: the customer asked, a field condition, or a plan revision.';
  END IF;
  BEGIN
    v_cost := round((p_draft ->> 'cost')::numeric);
    v_price := round((p_draft ->> 'price')::numeric);
    v_days := coalesce(round((p_draft ->> 'days')::numeric)::integer, 0);
    v_package := nullif(p_draft ->> 'packageId', '')::uuid;
    v_set := nullif(p_draft ->> 'planSetId', '')::uuid;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'The cost, the price and the days must be numbers.';
  END;
  IF v_cost IS NULL OR v_cost = 0 THEN
    RAISE EXCEPTION 'Type what it costs us. A credit is a cost below zero.';
  END IF;
  IF v_price IS NULL THEN
    RAISE EXCEPTION 'Type what it adds to their price.';
  END IF;
  IF v_days < 0 THEN
    RAISE EXCEPTION 'The days it adds cannot be below zero.';
  END IF;
  IF v_package IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.gc_trade_packages WHERE id = v_package AND project_id = p_project_id) THEN
    RAISE EXCEPTION 'That trade is not on this project.';
  END IF;
  IF v_set IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.gc_plan_sets WHERE id = v_set AND project_id = p_project_id) THEN
    RAISE EXCEPTION 'That set of plans is not this project''s.';
  END IF;
  v_schedule := btrim(coalesce(p_draft ->> 'schedule', ''));
  IF v_schedule = '' THEN
    v_schedule := CASE WHEN v_days > 0 THEN '+' || v_days || CASE WHEN v_days = 1 THEN ' day' ELSE ' days' END ELSE 'none' END;
  END IF;
  SELECT coalesce(max(number), 0) + 1 INTO v_number FROM public.gc_change_orders WHERE project_id = p_project_id;
  INSERT INTO public.gc_change_orders (project_id, number, description, reason, schedule_words, package_id, cost, price, days, plan_set_id)
  VALUES (p_project_id, v_number, v_description, v_reason, v_schedule, v_package, v_cost, v_price, v_days, v_set)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Ask for the days (the prototype's draftTimeExtension, G-141): a change order with no price whose
-- days are the ones the customer's moves put on the finish, naming those moves. The client sends
-- what timeExtensionAsk read. Each move is this job's and not undone, and none is asked for already
-- by a change order that is not declined.
CREATE OR REPLACE FUNCTION public.gc_draft_time_extension(p_project_id uuid, p_description text, p_reason text, p_days integer, p_move_ids uuid[])
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_stage text;
  v_lost date;
  v_asked integer;
  v_number integer;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to ask for the days.';
  END IF;
  SELECT stage, lost_on INTO v_stage, v_lost FROM public.gc_projects WHERE project_id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That GC project is not there.';
  END IF;
  IF v_stage = 'bidding' OR v_lost IS NOT NULL THEN
    RAISE EXCEPTION 'A time extension is for a job we won.';
  END IF;
  IF btrim(coalesce(p_description, '')) = '' THEN
    RAISE EXCEPTION 'Say why the days are asked for.';
  END IF;
  IF p_reason IS NULL OR p_reason NOT IN ('owner', 'field', 'plans') THEN
    RAISE EXCEPTION 'Pick why it changed: the customer asked, a field condition, or a plan revision.';
  END IF;
  IF p_days IS NULL OR p_days < 1 THEN
    RAISE EXCEPTION 'A time extension asks for one day or more.';
  END IF;
  IF p_move_ids IS NULL OR cardinality(p_move_ids) = 0 THEN
    RAISE EXCEPTION 'Name the moves the days come from.';
  END IF;
  IF (SELECT count(*) FROM public.gc_schedule_moves
      WHERE id = ANY (p_move_ids) AND project_id = p_project_id AND undone_on IS NULL)
     <> (SELECT count(DISTINCT m) FROM unnest(p_move_ids) AS m) THEN
    RAISE EXCEPTION 'Each move must be one of this job''s schedule moves, and not undone.';
  END IF;
  SELECT min(number) INTO v_asked FROM public.gc_change_orders
  WHERE project_id = p_project_id AND status <> 'declined' AND days_on_chart && p_move_ids;
  IF v_asked IS NOT NULL THEN
    RAISE EXCEPTION 'Change order % asks for some of these days already.', v_asked;
  END IF;
  SELECT coalesce(max(number), 0) + 1 INTO v_number FROM public.gc_change_orders WHERE project_id = p_project_id;
  INSERT INTO public.gc_change_orders (project_id, number, description, reason, schedule_words, package_id, cost, price, days, days_on_chart)
  VALUES (p_project_id, v_number, btrim(p_description), p_reason,
          '+' || p_days || CASE WHEN p_days = 1 THEN ' day' ELSE ' days' END,
          NULL, 0, 0, p_days, p_move_ids)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Send it for the customer's signature (the prototype's sendChangeOrder): a draft only, on the day
-- the client names (the app's day, todayYmdInAppTz). One with no price and no days has nothing to sign.
CREATE OR REPLACE FUNCTION public.gc_send_change_order(p_id uuid, p_on date)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v public.gc_change_orders%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to send a change order.';
  END IF;
  SELECT * INTO v FROM public.gc_change_orders WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That change order is not there.';
  END IF;
  IF v.status <> 'draft' THEN
    RAISE EXCEPTION 'Change order % went already.', v.number;
  END IF;
  IF p_on IS NULL THEN
    RAISE EXCEPTION 'Say the day it goes.';
  END IF;
  IF v.price = 0 AND v.days = 0 THEN
    RAISE EXCEPTION 'Change order % adds no price and no days, so there is nothing to sign.', v.number;
  END IF;
  UPDATE public.gc_change_orders SET status = 'sent', sent_on = p_on WHERE id = p_id;
END;
$$;

-- The customer's answer (the prototype's ownerSignChangeOrder and ownerDeclineChangeOrder): signed
-- or declined on a day, recorded by the office from their signed copy (decision 5) or pressed in
-- their portal (O7b, through the service role's own path). Only a change order that went, and not
-- before the day it went.
CREATE OR REPLACE FUNCTION public.gc_answer_change_order(p_id uuid, p_signed boolean, p_on date, p_how text DEFAULT 'office')
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v public.gc_change_orders%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to record the customer''s answer.';
  END IF;
  SELECT * INTO v FROM public.gc_change_orders WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That change order is not there.';
  END IF;
  IF v.status <> 'sent' THEN
    RAISE EXCEPTION 'Change order % is not waiting on the customer.', v.number;
  END IF;
  IF p_signed IS NULL OR p_on IS NULL THEN
    RAISE EXCEPTION 'Say whether they signed it, and the day.';
  END IF;
  IF p_on < v.sent_on THEN
    RAISE EXCEPTION 'They can''t answer before it went on %.', to_char(v.sent_on, 'Mon FMDD');
  END IF;
  IF p_how IS NULL OR p_how NOT IN ('office', 'portal') THEN
    RAISE EXCEPTION 'The answer is recorded by the office or pressed in their portal.';
  END IF;
  UPDATE public.gc_change_orders
  SET status = CASE WHEN p_signed THEN 'signed' ELSE 'declined' END, answered_on = p_on, answered_how = p_how
  WHERE id = p_id;
END;
$$;

COMMENT ON FUNCTION public.gc_draft_change_order(uuid, jsonb) IS
  'GC mode (O3): drafts a change order to the customer on a GC project we won, with the next number, from the prototype''s draftChangeOrder shape. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_draft_time_extension(uuid, text, text, integer, uuid[]) IS
  'GC mode (O3): drafts a time extension (G-141), a change order with no price whose days come from the named schedule moves. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_send_change_order(uuid, date) IS
  'GC mode (O3): marks a draft change order sent to the customer for signature on a day. SECURITY INVOKER.';
COMMENT ON FUNCTION public.gc_answer_change_order(uuid, boolean, date, text) IS
  'GC mode (O3): records the customer''s signature or decline on a sent change order, by the office or from their portal. SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.gc_draft_change_order(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gc_draft_time_extension(uuid, text, text, integer, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gc_send_change_order(uuid, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gc_answer_change_order(uuid, boolean, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_draft_change_order(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gc_draft_time_extension(uuid, text, text, integer, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gc_send_change_order(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gc_answer_change_order(uuid, boolean, date, text) TO authenticated;
