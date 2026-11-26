SET lock_timeout = '3s';

-- A wage changed on a screen leaves a line on the pay log (punch list #389, the walk of 2026-11-25; the person's yes
-- of 2026-11-26, "All picks stand": a database trigger, its push asked separately).
--
-- The pay log is pay_admin_events (20260918100000). One function writes a set_pay_config line, set_pay_config, with the
-- reason it is given, and the only callers of that function are the dev seat's pay verbs. Every screen that saves a wage
-- writes people_pay_config directly, with a plain upsert: Bring back, the hire and end windows, the desk's Pay section
-- and People → Pay's cells. So a wage the office changes on a screen left a pay row and no line, and the one-dollar
-- wage saved on a ZZ Test sub on 2026-11-25 at 23:04 UTC has none. set_working_hours (20261123075925, 20261125225108)
-- writes its own line when it moves the seven numbers.
--
--   people_pay_config_log_change()        AFTER INSERT OR UPDATE, one row: when a pay column changed (the wage, the
--                                         office wage, Salaried, record-hours-but-salary, show-in-hours, the seven
--                                         numbers of the salaried week), one pay_admin_events line of action
--                                         set_pay_config, with the changed columns, the row before and after and
--                                         by: 'screen', whoever wrote it. The reason reads that no reason was asked,
--                                         since the screens ask for none. A new row with a wage or Salaried on is a
--                                         line too, with no before.
--   people_pay_config_log_change          the trigger: a CONSTRAINT trigger, DEFERRABLE INITIALLY DEFERRED, so it
--                                         fires at the end of the transaction. set_pay_config and set_working_hours
--                                         write their own line after their UPDATE; at the end of their transaction
--                                         the trigger finds that line (the same person, written at now(), this
--                                         transaction's time) and writes none, so a change through a door still
--                                         leaves exactly one line. A screen's write has no such line, so it gets one.
--
-- Who reads: pay_admin_events keeps its policies (has_payroll_access). The trigger is SECURITY DEFINER, so a screen's
-- write by a seat the log's insert policy does not cover still lands its line. No table is created, so no fence is
-- owed. No row is backfilled: the one-dollar wage of 2026-11-25 stays without a line. Idempotent.

CREATE OR REPLACE FUNCTION public.people_pay_config_log_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before jsonb;
  v_after jsonb;
  v_changes jsonb := '{}'::jsonb;
  v_key text;
BEGIN
  v_after := to_jsonb(NEW) - 'person_id';
  IF TG_OP = 'INSERT' THEN
    -- A new pay row: a line when it carries pay, so a wage typed on a hire or a return is on the log.
    IF NEW.hourly_wage IS NULL AND NEW.office_hourly_wage IS NULL AND NOT COALESCE(NEW.is_salary, false) THEN RETURN NULL; END IF;
    v_before := NULL;
    FOREACH v_key IN ARRAY ARRAY['hourly_wage', 'office_hourly_wage', 'is_salary', 'record_hours_but_salary', 'show_in_hours', 'salaried_week_hours'] LOOP
      IF v_after -> v_key IS NOT NULL AND v_after -> v_key <> 'null'::jsonb THEN v_changes := v_changes || jsonb_build_object(v_key, v_after -> v_key); END IF;
    END LOOP;
  ELSE
    v_before := to_jsonb(OLD) - 'person_id';
    FOREACH v_key IN ARRAY ARRAY['hourly_wage', 'office_hourly_wage', 'is_salary', 'record_hours_but_salary', 'show_in_hours', 'salaried_week_hours'] LOOP
      IF v_before -> v_key IS DISTINCT FROM v_after -> v_key THEN v_changes := v_changes || jsonb_build_object(v_key, v_after -> v_key); END IF;
    END LOOP;
    IF v_changes = '{}'::jsonb THEN RETURN NULL; END IF;
  END IF;
  -- A door that wrote its own line in this transaction (set_pay_config, set_working_hours) needs no second one.
  IF EXISTS (
    SELECT 1 FROM public.pay_admin_events e
    WHERE e.person_name = NEW.person_name AND e.action = 'set_pay_config' AND e.created_at = now()
  ) THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.pay_admin_events (person_name, action, payload, reason, actor)
  VALUES (
    NEW.person_name,
    'set_pay_config',
    jsonb_build_object('changes', v_changes, 'before', v_before, 'after', v_after, 'by', 'screen'),
    'Changed on a screen. No reason was asked.',
    auth.uid()
  );
  RETURN NULL;
END;
$$;
COMMENT ON FUNCTION public.people_pay_config_log_change() IS
  'Punch list #389: one pay_admin_events line for a pay row a screen wrote (the wage, the office wage, Salaried, record-hours-but-salary, show-in-hours, the salaried week), by: screen, with the row before and after. Deferred to the end of the transaction, so a door that logged its own line (set_pay_config, set_working_hours) gets no second one.';
REVOKE EXECUTE ON FUNCTION public.people_pay_config_log_change() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS people_pay_config_log_change ON public.people_pay_config;
CREATE CONSTRAINT TRIGGER people_pay_config_log_change
  AFTER INSERT OR UPDATE ON public.people_pay_config
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.people_pay_config_log_change();
