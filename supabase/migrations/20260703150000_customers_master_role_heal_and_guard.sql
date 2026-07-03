-- Customers mastered to non-master users: heal + guard.
--
-- JobFormModal's "Create customer from job" set master_user_id = the CREATOR (an assistant),
-- not the job's master. Since the 20260630200000 job<->customer invariant trigger, linking such
-- a customer to another master's job fails (P0001) and each retry leaves an orphan duplicate.
-- Older creations sailed through: 95 customers (and, via consistent linking, 104 jobs) ended up
-- "mastered" to assistants/primaries. The client fix resolves the job's master; this migration
-- heals the data and adds a backstop so it can't recur from any path.
--
-- 1) Repoint mis-mastered customers: the assistant's master via master_assistants, else the
--    org's single master_technician. The existing cascade triggers (20260630200000) move each
--    customer's linked jobs/projects to the same master automatically.
-- 2) Backstop trigger: customers.master_user_id must reference a dev or master_technician.
--
-- Idempotent; on a fresh environment step 1 matches nothing.

DO $$
DECLARE v_single_master uuid;
BEGIN
  IF (SELECT count(*) FROM public.users WHERE role = 'master_technician') = 1 THEN
    SELECT id INTO v_single_master FROM public.users WHERE role = 'master_technician';
  END IF;

  UPDATE public.customers c
  SET master_user_id = COALESCE(
        (SELECT ma.master_id FROM public.master_assistants ma
           JOIN public.users mu ON mu.id = ma.master_id AND mu.role = 'master_technician'
          WHERE ma.assistant_id = c.master_user_id ORDER BY ma.master_id LIMIT 1),
        v_single_master),
      updated_at = now()
  WHERE EXISTS (SELECT 1 FROM public.users u WHERE u.id = c.master_user_id
                  AND u.role NOT IN ('dev','master_technician'))
    AND COALESCE(
        (SELECT ma.master_id FROM public.master_assistants ma
           JOIN public.users mu ON mu.id = ma.master_id AND mu.role = 'master_technician'
          WHERE ma.assistant_id = c.master_user_id ORDER BY ma.master_id LIMIT 1),
        v_single_master) IS NOT NULL;
END $$;

CREATE OR REPLACE FUNCTION public.customers_master_role_check_fn()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_role text;
BEGIN
  SELECT role::text INTO v_role FROM public.users WHERE id = NEW.master_user_id;
  IF v_role IS NULL OR v_role NOT IN ('dev','master_technician') THEN
    RAISE EXCEPTION 'Customer master must be a master technician or dev (master_user_id=%, role=%)',
      NEW.master_user_id, COALESCE(v_role, 'missing') USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS customers_master_role_check ON public.customers;
CREATE TRIGGER customers_master_role_check
BEFORE INSERT OR UPDATE OF master_user_id ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.customers_master_role_check_fn();
