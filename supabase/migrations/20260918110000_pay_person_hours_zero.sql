SET lock_timeout = '3s';

-- v2.3585 — set_person_hours: "clear" sets each day in the range to 0, the Hours grid's own
-- convention, instead of deleting. people_hours has no DELETE policy for payroll users (only team
-- leads, for their members), so the v2.3584 delete silently matched nothing and reported 0 removed
-- (Mike Z's cleanup, 2026-09-18). Now: 0 → UPDATE hours = 0 on the rows in the range; > 0 → upsert
-- every date; and the function raises when rows in the range survive untouched, so a permission
-- gap is an error, never a quiet zero.

CREATE OR REPLACE FUNCTION public.set_person_hours(p_person text, p_from date, p_to date, p_hours numeric, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_before jsonb;
  v_after jsonb;
  v_person_id uuid;
  v_d date;
  v_existing int := 0;
  v_zeroed int := 0;
  v_set int := 0;
  v_left int := 0;
BEGIN
  IF NOT public.pay_rpc_allowed() THEN
    RAISE EXCEPTION 'payroll access required';
  END IF;
  IF NULLIF(btrim(COALESCE(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'a reason is required';
  END IF;
  IF NULLIF(btrim(COALESCE(p_person, '')), '') IS NULL THEN
    RAISE EXCEPTION 'person is required';
  END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from THEN
    RAISE EXCEPTION 'from and to must be dates with from <= to';
  END IF;
  IF p_hours IS NULL OR p_hours < 0 OR p_hours > 24 THEN
    RAISE EXCEPTION 'hours must be between 0 and 24';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('work_date', h.work_date, 'hours', h.hours) ORDER BY h.work_date), '[]'::jsonb), count(*)
    INTO v_before, v_existing
  FROM public.people_hours h WHERE h.person_name = p_person AND h.work_date BETWEEN p_from AND p_to;

  IF p_hours = 0 THEN
    UPDATE public.people_hours SET hours = 0, entered_by = COALESCE(auth.uid(), entered_by)
     WHERE person_name = p_person AND work_date BETWEEN p_from AND p_to AND hours <> 0;
    GET DIAGNOSTICS v_zeroed = ROW_COUNT;
    SELECT count(*) INTO v_left FROM public.people_hours h WHERE h.person_name = p_person AND h.work_date BETWEEN p_from AND p_to AND h.hours <> 0;
    IF v_left > 0 THEN
      RAISE EXCEPTION '% row(s) in the range still carry hours — no permission to change them', v_left;
    END IF;
  ELSE
    SELECT person_id INTO v_person_id FROM public.people_pay_config WHERE person_name = p_person;
    v_d := p_from;
    WHILE v_d <= p_to LOOP
      INSERT INTO public.people_hours (person_name, person_id, work_date, hours, entered_by)
      VALUES (p_person, v_person_id, v_d, p_hours, auth.uid())
      ON CONFLICT (person_name, work_date) DO UPDATE SET hours = EXCLUDED.hours, entered_by = EXCLUDED.entered_by;
      v_set := v_set + 1;
      v_d := v_d + 1;
    END LOOP;
    SELECT count(*) INTO v_left FROM public.people_hours h WHERE h.person_name = p_person AND h.work_date BETWEEN p_from AND p_to AND h.hours = p_hours;
    IF v_left < v_set THEN
      RAISE EXCEPTION 'only % of % day(s) took the new hours — no permission to change the rest', v_left, v_set;
    END IF;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('work_date', h.work_date, 'hours', h.hours) ORDER BY h.work_date), '[]'::jsonb)
    INTO v_after
  FROM public.people_hours h WHERE h.person_name = p_person AND h.work_date BETWEEN p_from AND p_to;

  INSERT INTO public.pay_admin_events (person_name, action, payload, reason, actor)
  VALUES (p_person, 'set_hours', jsonb_build_object('from', p_from, 'to', p_to, 'hours', p_hours, 'before', v_before, 'after', v_after, 'existing', v_existing, 'zeroed', v_zeroed, 'set', v_set), btrim(p_reason), auth.uid());

  RETURN jsonb_build_object('status', CASE WHEN p_hours = 0 THEN 'cleared' ELSE 'set' END, 'person', p_person, 'from', p_from, 'to', p_to, 'existing', v_existing, 'zeroed', v_zeroed, 'set', v_set, 'before', v_before, 'after', v_after);
END;
$$;
