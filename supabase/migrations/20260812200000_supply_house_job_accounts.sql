SET lock_timeout = '3s';

-- Job-account share ledger (v2.1606): one row per recipient per "Share with
-- supply house" send (v2.1605). Written ONLY by the send-supply-house-job-account
-- edge function with the service role — no client INSERT/UPDATE policies.
-- Feeds the Materials → Supply Houses "Job accounts" section and the share
-- modal's "already shared" hint.

CREATE TABLE IF NOT EXISTS public.supply_house_job_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  contact_label text NOT NULL,
  contact_email text NOT NULL,
  sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_by_name text NOT NULL DEFAULT '',
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS supply_house_job_accounts_job_idx ON public.supply_house_job_accounts (job_id);

ALTER TABLE public.supply_house_job_accounts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'supply_house_job_accounts' AND policyname = 'supply_house_job_accounts_select_office'
  ) THEN
    CREATE POLICY supply_house_job_accounts_select_office ON public.supply_house_job_accounts
      FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = (SELECT auth.uid())
          AND u.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role])
      ));
  END IF;
  -- Dev-only prune (test rows, mis-sends). Inserts stay service-role only.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'supply_house_job_accounts' AND policyname = 'supply_house_job_accounts_delete_dev'
  ) THEN
    CREATE POLICY supply_house_job_accounts_delete_dev ON public.supply_house_job_accounts
      FOR DELETE USING (public.is_dev());
  END IF;
END $$;

-- New table: (re)attach the training-mode read-only guards (both required).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
