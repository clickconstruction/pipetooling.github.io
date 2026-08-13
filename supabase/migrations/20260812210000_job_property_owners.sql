SET lock_timeout = '3s';

-- Property owner per job (v2.1609): the supply-house share flow requires real
-- owner info (name/company + MAILING ADDRESS — lien-notice material), which is
-- usually NOT the GC on GC-routed jobs. The office types it once; this table
-- remembers it per job so resends and other desks prefill. Upserted by the
-- share modal on send; office roles read/write.

CREATE TABLE IF NOT EXISTS public.job_property_owners (
  job_id uuid PRIMARY KEY REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  owner_mode text NOT NULL DEFAULT 'homeowner' CHECK (owner_mode IN ('homeowner', 'building_owner')),
  owner_name text NOT NULL DEFAULT '',
  company_name text NOT NULL DEFAULT '',
  mailing_address text NOT NULL DEFAULT '',
  owner_email text NOT NULL DEFAULT '',
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.job_property_owners ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT * FROM (VALUES
      ('job_property_owners_select_office', 'SELECT'),
      ('job_property_owners_insert_office', 'INSERT'),
      ('job_property_owners_update_office', 'UPDATE'),
      ('job_property_owners_delete_office', 'DELETE')
    ) AS p(name, cmd)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'job_property_owners' AND policyname = pol.name
    ) THEN
      IF pol.cmd = 'INSERT' THEN
        EXECUTE format(
          'CREATE POLICY %I ON public.job_property_owners FOR INSERT WITH CHECK (EXISTS (
             SELECT 1 FROM public.users u
             WHERE u.id = (SELECT auth.uid())
               AND u.role = ANY (ARRAY[''dev''::public.user_role, ''master_technician''::public.user_role, ''assistant''::public.user_role, ''controller''::public.user_role])
           ))', pol.name);
      ELSE
        EXECUTE format(
          'CREATE POLICY %I ON public.job_property_owners FOR %s USING (EXISTS (
             SELECT 1 FROM public.users u
             WHERE u.id = (SELECT auth.uid())
               AND u.role = ANY (ARRAY[''dev''::public.user_role, ''master_technician''::public.user_role, ''assistant''::public.user_role, ''controller''::public.user_role])
           ))', pol.name, pol.cmd);
      END IF;
    END IF;
  END LOOP;
END $$;

-- New table: (re)attach the training-mode read-only guards (both required).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
