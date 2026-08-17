SET lock_timeout = '3s';

-- Customer merge vs accepted-estimate guard (Customer Hub cleanup, 2026-08-17).
--
-- merge_customers() re-links the victim's estimates to the survivor
-- (UPDATE estimates SET customer_id ...), but estimates_protect_after_accept
-- forbids ANY customer_id change once an estimate is customer_accepted — so
-- merging a duplicate customer who holds an accepted estimate fails with
-- "estimate is accepted; only job_ledger_id and internal_notes can change"
-- (hit live merging the Michael Palmer duplicate pair).
--
-- Fix: a transaction-local flag. merge_customers sets
-- app.merging_customers = '1' (set_config ... is_local => true, so it dies
-- with the transaction), and the guard allows a customer_id change only
-- while that flag is set. The signed document's content stays immutable in
-- every other path; the merge only re-points provenance between two rows
-- that represent the same real customer.

CREATE OR REPLACE FUNCTION "public"."estimates_protect_after_accept"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF OLD.status = 'customer_accepted' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
      OR NEW.master_user_id IS DISTINCT FROM OLD.master_user_id
      OR NEW.created_by IS DISTINCT FROM OLD.created_by
      OR (
        NEW.customer_id IS DISTINCT FROM OLD.customer_id
        AND coalesce(current_setting('app.merging_customers', true), '') <> '1'
      )
      OR NEW.project_id IS DISTINCT FROM OLD.project_id
      OR NEW.title IS DISTINCT FROM OLD.title
      OR NEW.line_items_snapshot IS DISTINCT FROM OLD.line_items_snapshot
      OR NEW.terms_snapshot IS DISTINCT FROM OLD.terms_snapshot
      OR NEW.total_cents IS DISTINCT FROM OLD.total_cents
      OR NEW.valid_until IS DISTINCT FROM OLD.valid_until
      OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.sent_at IS DISTINCT FROM OLD.sent_at
      OR NEW.customer_email IS DISTINCT FROM OLD.customer_email
      OR NEW.public_token_hash IS DISTINCT FROM OLD.public_token_hash
      OR NEW.public_token_expires_at IS DISTINCT FROM OLD.public_token_expires_at
      OR NEW.acceptor_printed_name IS DISTINCT FROM OLD.acceptor_printed_name
      OR NEW.acceptor_signature_storage_path IS DISTINCT FROM OLD.acceptor_signature_storage_path
      OR NEW.acceptor_consented_at IS DISTINCT FROM OLD.acceptor_consented_at
      OR NEW.acceptor_ip IS DISTINCT FROM OLD.acceptor_ip
      OR NEW.acceptor_user_agent IS DISTINCT FROM OLD.acceptor_user_agent
      OR NEW.estimate_number IS DISTINCT FROM OLD.estimate_number
      OR NEW.customer_experience_overrides IS DISTINCT FROM OLD.customer_experience_overrides
      OR NEW.customer_experience_sent IS DISTINCT FROM OLD.customer_experience_sent
      OR NEW.customer_attachment_url IS DISTINCT FROM OLD.customer_attachment_url
      OR NEW.customer_attachment_label IS DISTINCT FROM OLD.customer_attachment_label
      OR NEW.customer_attachment_sent IS DISTINCT FROM OLD.customer_attachment_sent
      OR NEW.accept_notify_user_ids IS DISTINCT FROM OLD.accept_notify_user_ids
    THEN
      RAISE EXCEPTION 'estimate is accepted; only job_ledger_id and internal_notes can change';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

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
