SET lock_timeout = '3s';

-- Messages, residential R2 PR 3a (to-dos/gc-mode/messages/RESIDENTIAL_BUILD_PLAN.md → R2, on branch spike/gc-mode): the
-- door a customer's name opens their thread through. On the spine (20261012010000_messages_spine.sql).
--
--   * contact_for_customer(p_customer_id) answers the customer's own contact: the one on their customers row with no
--     name, as the spine's seed and Who is this? point it. The spine's seed made contacts only for the customers on GC
--     projects, and nobody signed in may insert a contact, so most of our own customers have none yet. When there is
--     none, the function makes it, kind customer, with the number and the address the customer's row keeps in
--     contact_info (as the seed copies them, a value that is neither left out). The people at a customer keep their own
--     contacts and are not made here.
--   * SECURITY DEFINER, since the office cannot insert a contact. So it holds the office team (gc_office_team()) in its
--     body and says each refusal in words: no sign-in, anyone off the office team, a customer not there. Finding a
--     contact is a read, which training mode and a digital twin may do. Making one is a write, which the house fences
--     would refuse them and a definer passes, so the function refuses them in words.
--   * A number a stranger already texted from stays on that stranger's contact. Who is this? folds it into the
--     customer's (name_contact folds into the contact already there), so the office decides, never the function.
--   * contacts_keep_thread_on_customer_delete: the screens delete a customer outright (Edit customer, the customer's
--     page), and contacts.customer_id is ON DELETE RESTRICT, so a customer with a contact could no longer be deleted.
--     Before the delete, the customer's contacts become numbers nobody has named that keep the name, as the spine does
--     for a roster person. The people at the customer go with it (ON DELETE CASCADE), so their contacts do the same
--     first, and the spine's trigger on customer_contact_persons then finds none to move onto a customer that is going.
--     A merge moves the contacts to the survivor before its delete, so the trigger finds none there. A function of its
--     own, so the spine's contacts_keep_thread_on_delete is not redefined here.

-- ---------- the door ----------

CREATE OR REPLACE FUNCTION public.contact_for_customer(p_customer_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact uuid;
  v_info jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to open a customer''s messages.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.gc_office_team() THEN
    RAISE EXCEPTION 'Only the office opens a customer''s messages.' USING ERRCODE = '42501';
  END IF;
  SELECT c.contact_info INTO v_info FROM public.customers c WHERE c.id = p_customer_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That customer is not there.' USING ERRCODE = 'P0001';
  END IF;

  -- Their own contact: on their row, with no name (a name says which other person on the row it is).
  SELECT x.id INTO v_contact FROM public.contacts x WHERE x.customer_id = p_customer_id AND x.name IS NULL;
  IF v_contact IS NOT NULL THEN
    RETURN v_contact;
  END IF;

  -- A definer passes the read-only blocks and the twin fence, so each is said here before the first write.
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot start a customer''s thread.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot start a customer''s thread.' USING ERRCODE = '42501';
  END IF;

  -- Two presses at once make one contact: the second meets the spine's one-contact index and reads the first's.
  INSERT INTO public.contacts (kind, customer_id)
  VALUES ('customer', p_customer_id)
  ON CONFLICT (customer_id, lower(btrim(coalesce(name, '')))) WHERE customer_id IS NOT NULL DO NOTHING
  RETURNING id INTO v_contact;
  IF v_contact IS NULL THEN
    SELECT x.id INTO v_contact FROM public.contacts x WHERE x.customer_id = p_customer_id AND x.name IS NULL;
    RETURN v_contact;
  END IF;

  INSERT INTO public.contact_channels (contact_id, kind, value)
  SELECT v_contact, v.kind, btrim(v.value)
  FROM (VALUES ('phone', v_info ->> 'phone'), ('email', v_info ->> 'email')) AS v(kind, value)
  WHERE public.contact_channel_key(v.kind, v.value) <> ''
  ON CONFLICT DO NOTHING;
  RETURN v_contact;
END;
$$;

COMMENT ON FUNCTION public.contact_for_customer(uuid) IS
  'Messages, residential R2 (v2.5437): the customer''s own contact (on their customers row, no name), made when there is none, kind customer, with contact_info''s phone and email as its channels. SECURITY DEFINER: the office team (gc_office_team()) only, said in words; a training account and a digital twin may find one and never make one.';

REVOKE ALL ON FUNCTION public.contact_for_customer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contact_for_customer(uuid) TO authenticated, service_role;

-- ---------- a customer deleted by the app's own screens ----------

CREATE OR REPLACE FUNCTION public.contacts_keep_thread_on_customer_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- The people at the customer first: they go with it by cascade, after this row is gone.
  UPDATE public.contacts x SET
    customer_contact_person_id = NULL,
    kind = 'unknown',
    name = coalesce(x.name, nullif(left(btrim(p.name), 200), ''))
  FROM public.customer_contact_persons p
  WHERE p.customer_id = OLD.id AND x.customer_contact_person_id = p.id;
  -- Then the customer's own contact and anyone else named on their row.
  UPDATE public.contacts SET
    customer_id = NULL,
    kind = 'unknown',
    name = coalesce(name, nullif(left(btrim(OLD.name), 200), ''))
  WHERE customer_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS contacts_keep_thread ON public.customers;
CREATE TRIGGER contacts_keep_thread BEFORE DELETE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.contacts_keep_thread_on_customer_delete();

-- The trigger's is the database's own.
REVOKE EXECUTE ON FUNCTION public.contacts_keep_thread_on_customer_delete() FROM PUBLIC, anon, authenticated;
