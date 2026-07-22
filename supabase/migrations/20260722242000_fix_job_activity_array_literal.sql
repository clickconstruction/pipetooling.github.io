-- P0 fix (v2.933): EVERY Edit-Job save that actually changed a watched field has
-- failed since v2.9xx's consolidated field-edit trigger (20260719120000) with
--   malformed array literal: "customer email"  (SQLSTATE 22P02)
-- because `changed := changed || 'customer email'` lets Postgres resolve `||`
-- as ARRAY-to-ARRAY concatenation for an untyped literal and try to parse the
-- label AS an array literal. (The docs recommend array_append for exactly this.)
-- Saves that changed no watched values skipped every branch, which is why the
-- trigger looked fine for three days. Body otherwise identical.

CREATE OR REPLACE FUNCTION public.jobs_ledger_fields_to_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed text[] := ARRAY[]::text[];
BEGIN
  -- Customer id and name move together on a customer change → one label.
  IF new.customer_id IS DISTINCT FROM old.customer_id
     OR new.customer_name IS DISTINCT FROM old.customer_name THEN
    changed := array_append(changed, 'customer');
  END IF;
  IF new.job_name IS DISTINCT FROM old.job_name THEN changed := array_append(changed, 'job name'); END IF;
  IF new.hcp_number IS DISTINCT FROM old.hcp_number THEN changed := array_append(changed, 'HCP #'); END IF;
  IF new.click_number IS DISTINCT FROM old.click_number THEN changed := array_append(changed, 'Click #'); END IF;
  IF new.job_address IS DISTINCT FROM old.job_address THEN changed := array_append(changed, 'address'); END IF;
  IF new.customer_email IS DISTINCT FROM old.customer_email THEN changed := array_append(changed, 'customer email'); END IF;
  IF new.customer_phone IS DISTINCT FROM old.customer_phone THEN changed := array_append(changed, 'customer phone'); END IF;
  IF new.google_drive_link IS DISTINCT FROM old.google_drive_link THEN changed := array_append(changed, 'Drive link'); END IF;
  IF new.job_pictures_link IS DISTINCT FROM old.job_pictures_link THEN changed := array_append(changed, 'pictures link'); END IF;
  IF new.job_plans_link IS DISTINCT FROM old.job_plans_link THEN changed := array_append(changed, 'plans link'); END IF;
  IF new.project_id IS DISTINCT FROM old.project_id THEN changed := array_append(changed, 'project link'); END IF;
  IF new.bid_id IS DISTINCT FROM old.bid_id THEN changed := array_append(changed, 'bid link'); END IF;
  IF new.service_type_id IS DISTINCT FROM old.service_type_id THEN changed := array_append(changed, 'service type'); END IF;
  IF new.master_user_id IS DISTINCT FROM old.master_user_id THEN changed := array_append(changed, 'owner'); END IF;

  IF array_length(changed, 1) > 0 THEN
    INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    VALUES (new.id, 'field_edited', now(), auth.uid(),
            'Job updated — changed ' || array_to_string(changed, ', '),
            jsonb_build_object('fields', changed), false);
  END IF;

  -- Revenue stays a separate financial event (dollar amount gated to financial roles).
  IF coalesce(new.revenue, 0) IS DISTINCT FROM coalesce(old.revenue, 0) THEN
    INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
    VALUES (new.id, 'field_edited', now(), auth.uid(),
            'Job total changed to $' || to_char(coalesce(new.revenue, 0), 'FM999,999,990.00'),
            jsonb_build_object('field', 'revenue', 'old', old.revenue, 'new', new.revenue), true);
  END IF;

  RETURN new;
END;
$$;
