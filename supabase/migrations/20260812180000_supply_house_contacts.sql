SET lock_timeout = '3s';

-- Supply house contact shortlist (v2.1605): org-wide "send job account info to"
-- recipients for the Job Detail "Share with supply house" flow. Office roles
-- (dev / master / assistant / controller) manage the list; there is no
-- per-master tenancy — the shortlist is shared like supply houses themselves.

CREATE TABLE IF NOT EXISTS public.supply_house_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- "Ferguson — Central desk": free-form label the office recognizes.
  label text NOT NULL,
  email text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.supply_house_contacts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'supply_house_contacts' AND policyname = 'supply_house_contacts_select_office'
  ) THEN
    CREATE POLICY supply_house_contacts_select_office ON public.supply_house_contacts
      FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = (SELECT auth.uid())
          AND u.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role])
      ));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'supply_house_contacts' AND policyname = 'supply_house_contacts_insert_office'
  ) THEN
    CREATE POLICY supply_house_contacts_insert_office ON public.supply_house_contacts
      FOR INSERT WITH CHECK (EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = (SELECT auth.uid())
          AND u.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role])
      ));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'supply_house_contacts' AND policyname = 'supply_house_contacts_update_office'
  ) THEN
    CREATE POLICY supply_house_contacts_update_office ON public.supply_house_contacts
      FOR UPDATE USING (EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = (SELECT auth.uid())
          AND u.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role])
      ));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'supply_house_contacts' AND policyname = 'supply_house_contacts_delete_office'
  ) THEN
    CREATE POLICY supply_house_contacts_delete_office ON public.supply_house_contacts
      FOR DELETE USING (EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = (SELECT auth.uid())
          AND u.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role])
      ));
  END IF;
END $$;

-- New table: (re)attach the training-mode read-only guards (both required).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
