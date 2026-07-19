-- Consolidate Edit-Job field changes into ONE activity-feed event per save.
--
-- Before: jobs_ledger_fields_to_activity() emitted one "field_edited" event per
-- changed field, and only watched 4 columns (customer_id, customer_name,
-- job_address, revenue). So most Edit-Job-modal changes (job name, HCP #, Click #,
-- phone, email, the three link fields, project/bid links, service type, owner)
-- produced nothing in the Job activity / notes feed.
--
-- After: one consolidated operational event, "Job updated — changed A, B, C",
-- covering every user-edited jobs_ledger field. Attribution is unchanged
-- (auth.uid(), resolved to a name by list_job_activity_events). Revenue keeps its
-- OWN financial-gated event so the dollar amount is never exposed to non-financial
-- roles (a consolidated operational event is financial=false / broadly visible).
--
-- Excluded on purpose: payments_made (payments have their own activity events —
-- avoids duplicates) and last_bill_date (billing sets it programmatically — noisy).
--
-- DB-only: the trigger fires on any jobs_ledger UPDATE that touches a watched
-- column, so every edit path (Edit Job modal, link-to-customer, create-customer-
-- from-job) is covered with no client change. The feed's fetch / render / realtime
-- already handle 'field_edited', so nothing else needs updating.

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
    changed := changed || 'customer';
  END IF;
  IF new.job_name IS DISTINCT FROM old.job_name THEN changed := changed || 'job name'; END IF;
  IF new.hcp_number IS DISTINCT FROM old.hcp_number THEN changed := changed || 'HCP #'; END IF;
  IF new.click_number IS DISTINCT FROM old.click_number THEN changed := changed || 'Click #'; END IF;
  IF new.job_address IS DISTINCT FROM old.job_address THEN changed := changed || 'address'; END IF;
  IF new.customer_email IS DISTINCT FROM old.customer_email THEN changed := changed || 'customer email'; END IF;
  IF new.customer_phone IS DISTINCT FROM old.customer_phone THEN changed := changed || 'customer phone'; END IF;
  IF new.google_drive_link IS DISTINCT FROM old.google_drive_link THEN changed := changed || 'Drive link'; END IF;
  IF new.job_pictures_link IS DISTINCT FROM old.job_pictures_link THEN changed := changed || 'pictures link'; END IF;
  IF new.job_plans_link IS DISTINCT FROM old.job_plans_link THEN changed := changed || 'plans link'; END IF;
  IF new.project_id IS DISTINCT FROM old.project_id THEN changed := changed || 'project link'; END IF;
  IF new.bid_id IS DISTINCT FROM old.bid_id THEN changed := changed || 'bid link'; END IF;
  IF new.service_type_id IS DISTINCT FROM old.service_type_id THEN changed := changed || 'service type'; END IF;
  IF new.master_user_id IS DISTINCT FROM old.master_user_id THEN changed := changed || 'owner'; END IF;

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

DROP TRIGGER IF EXISTS jobs_ledger_fields_to_activity_upd ON public.jobs_ledger;
CREATE TRIGGER jobs_ledger_fields_to_activity_upd
  AFTER UPDATE OF customer_id, customer_name, job_name, hcp_number, click_number,
    job_address, customer_email, customer_phone, google_drive_link, job_pictures_link,
    job_plans_link, project_id, bid_id, service_type_id, master_user_id, revenue
  ON public.jobs_ledger
  FOR EACH ROW EXECUTE FUNCTION public.jobs_ledger_fields_to_activity();
