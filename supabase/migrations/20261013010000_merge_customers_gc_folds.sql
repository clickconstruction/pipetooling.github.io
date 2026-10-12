SET lock_timeout = '3s';

-- Merging a customer keeps their GC call log and their part on every GC project (v2.5310, 2026-10-13).
--
-- merge_customers() folds the victim's rows into the survivor and then deletes the victim. It knew bids, jobs,
-- estimates, projects, the old call log (customer_contacts) and the people at the customer; it did not know two GC
-- tables that came after it (found 2026-10-12 by the Messages build):
--
--   * gc_customer_contacts (20261010150000) goes with its customer ON DELETE CASCADE, so merging a duplicate dropped
--     the victim's GC call log on the floor;
--   * gc_projects (20261006233000) names a customer as the architect (architect_customer_id) and as the property owner
--     (property_owner_customer_id), both ON DELETE SET NULL, so a project built for or drawn by the duplicate lost
--     that link.
--
-- Three UPDATEs before the delete, beside the folds it already does. The function is otherwise
-- 20260817221950_merge_customers_accepted_estimates.sql word for word. SECURITY DEFINER as before, so the call log's
-- append-only grants (no UPDATE for authenticated) do not stop the fold: the office merges through the function, never
-- by hand. CREATE OR REPLACE; no table changed.
--
-- Ordering note for the Messages spine (PR #5431, migration 20261012010000): it also replaces this function, adding the
-- contacts fold before the delete. Whichever of the two lands second carries the other's step.

CREATE OR REPLACE FUNCTION "public"."merge_customers"("p_survivor" "uuid", "p_victim" "uuid", "p_field_choices" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_survivor public.customers%ROWTYPE;
  v_victim public.customers%ROWTYPE;
  v_src_name text;
  v_src_address text;
  v_src_contact jsonb;
  v_src_type text;
  v_src_date_met date;
  v_src_master uuid;
  v_src_google_drive_link text;
  v_src_job_pictures_link text;
  v_survivor_stripe boolean;
  v_victim_stripe boolean;
  v_choice text;
  v_victim_thread uuid;
  v_survivor_thread uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_survivor IS NULL OR p_victim IS NULL OR p_survivor = p_victim THEN
    RAISE EXCEPTION 'Invalid customer pair';
  END IF;

  SELECT * INTO v_survivor FROM public.customers WHERE id = p_survivor FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Survivor customer not found';
  END IF;
  SELECT * INTO v_victim FROM public.customers WHERE id = p_victim FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Victim customer not found';
  END IF;

  PERFORM public.assert_caller_can_merge_customer_pair(v_survivor.master_user_id, v_victim.master_user_id);

  v_survivor_stripe := v_survivor.stripe_customer_id IS NOT NULL AND trim(v_survivor.stripe_customer_id) <> '';
  v_victim_stripe := v_victim.stripe_customer_id IS NOT NULL AND trim(v_victim.stripe_customer_id) <> '';
  IF v_survivor_stripe AND v_victim_stripe
     AND trim(v_survivor.stripe_customer_id) IS DISTINCT FROM trim(v_victim.stripe_customer_id) THEN
    RAISE EXCEPTION 'Both customers have different Stripe customer ids; resolve in Stripe before merging';
  END IF;

  v_choice := lower(coalesce(p_field_choices->>'name', 'survivor'));
  IF v_choice = 'victim' THEN v_src_name := v_victim.name; ELSE v_src_name := v_survivor.name; END IF;

  v_choice := lower(coalesce(p_field_choices->>'address', 'survivor'));
  IF v_choice = 'victim' THEN v_src_address := v_victim.address; ELSE v_src_address := v_survivor.address; END IF;

  v_choice := lower(coalesce(p_field_choices->>'contact_info', 'survivor'));
  IF v_choice = 'victim' THEN
    v_src_contact := to_jsonb(v_victim.contact_info);
  ELSE
    v_src_contact := to_jsonb(v_survivor.contact_info);
  END IF;

  v_choice := lower(coalesce(p_field_choices->>'customer_type', 'survivor'));
  IF v_choice = 'victim' THEN v_src_type := v_victim.customer_type; ELSE v_src_type := v_survivor.customer_type; END IF;

  v_choice := lower(coalesce(p_field_choices->>'date_met', 'survivor'));
  IF v_choice = 'victim' THEN v_src_date_met := v_victim.date_met; ELSE v_src_date_met := v_survivor.date_met; END IF;

  v_choice := lower(coalesce(p_field_choices->>'master_user_id', 'survivor'));
  IF v_choice = 'victim' THEN v_src_master := v_victim.master_user_id; ELSE v_src_master := v_survivor.master_user_id; END IF;

  v_choice := lower(coalesce(p_field_choices->>'google_drive_link', 'survivor'));
  IF v_choice = 'victim' THEN v_src_google_drive_link := v_victim.google_drive_link; ELSE v_src_google_drive_link := v_survivor.google_drive_link; END IF;

  v_choice := lower(coalesce(p_field_choices->>'job_pictures_link', 'survivor'));
  IF v_choice = 'victim' THEN v_src_job_pictures_link := v_victim.job_pictures_link; ELSE v_src_job_pictures_link := v_survivor.job_pictures_link; END IF;

  -- Transaction-local flag: lets estimates_protect_after_accept allow the
  -- customer_id re-link below for accepted estimates. Dies with the tx.
  PERFORM set_config('app.merging_customers', '1', true);

  UPDATE public.bids SET customer_id = p_survivor WHERE customer_id = p_victim;
  UPDATE public.jobs_ledger SET customer_id = p_survivor WHERE customer_id = p_victim;
  UPDATE public.estimates SET customer_id = p_survivor WHERE customer_id = p_victim;
  UPDATE public.projects SET customer_id = p_survivor WHERE customer_id = p_victim;
  UPDATE public.customer_contacts SET customer_id = p_survivor WHERE customer_id = p_victim;
  UPDATE public.customer_contact_persons SET customer_id = p_survivor WHERE customer_id = p_victim;

  -- GC mode (v2.5310): the victim's GC call log goes with them by cascade, and a GC project that named them as its
  -- architect or its property owner would lose that link. Move all three onto the survivor first.
  UPDATE public.gc_customer_contacts SET customer_id = p_survivor WHERE customer_id = p_victim;
  UPDATE public.gc_projects SET architect_customer_id = p_survivor WHERE architect_customer_id = p_victim;
  UPDATE public.gc_projects SET property_owner_customer_id = p_survivor WHERE property_owner_customer_id = p_victim;

  -- Messages (20261012010000): the contacts on the victim's row, and their threads, go to the survivor. Carried here
  -- because this rewrite lands after the spine's (the header's rule: whichever lands second carries the other's step).
  FOR v_victim_thread IN SELECT id FROM public.contacts WHERE customer_id = p_victim LOOP
    SELECT s.id INTO v_survivor_thread
    FROM public.contacts s JOIN public.contacts v ON v.id = v_victim_thread
    WHERE s.customer_id = p_survivor AND lower(btrim(coalesce(s.name, ''))) = lower(btrim(coalesce(v.name, '')));
    IF v_survivor_thread IS NULL THEN
      UPDATE public.contacts SET customer_id = p_survivor WHERE id = v_victim_thread;
    ELSE
      PERFORM public.contacts_fold(v_victim_thread, v_survivor_thread);
    END IF;
  END LOOP;

  UPDATE public.customers
  SET
    name = v_src_name,
    address = v_src_address,
    contact_info = v_src_contact,
    customer_type = v_src_type,
    date_met = v_src_date_met,
    master_user_id = v_src_master,
    google_drive_link = v_src_google_drive_link,
    job_pictures_link = v_src_job_pictures_link,
    stripe_customer_id = CASE
      WHEN v_survivor_stripe THEN v_survivor.stripe_customer_id
      WHEN v_victim_stripe AND NOT v_survivor_stripe THEN v_victim.stripe_customer_id
      ELSE v_survivor.stripe_customer_id
    END,
    updated_at = now()
  WHERE id = p_survivor;

  DELETE FROM public.customers WHERE id = p_victim;

  RETURN jsonb_build_object(
    'survivor_id', p_survivor,
    'removed_id', p_victim
  );
END;
$$;
