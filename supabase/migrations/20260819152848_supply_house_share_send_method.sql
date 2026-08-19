SET lock_timeout = '3s';

-- "Share with supply house" user-send paths (v2.1820): the packet can now go
-- from the office user's OWN inbox (mailto draft or copy-paste) instead of the
-- app's Resend address. Two changes to the share ledger:
--   1. send_method column — 'app' (edge-function Resend send, the default so
--      existing rows and the untouched edge function stay correct) or
--      'user_email' (the user sent it themselves and confirmed in the modal).
--   2. A client INSERT policy — the ledger was service-role-only while the
--      edge function was the only writer; user-sends are logged by the client
--      after the user confirms, so office roles may insert rows attributed to
--      themselves (sent_by = auth.uid()). SELECT/DELETE policies unchanged.

ALTER TABLE public.supply_house_job_accounts
  ADD COLUMN IF NOT EXISTS send_method text NOT NULL DEFAULT 'app';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.supply_house_job_accounts'::regclass
      AND conname = 'supply_house_job_accounts_send_method_check'
  ) THEN
    ALTER TABLE public.supply_house_job_accounts
      ADD CONSTRAINT supply_house_job_accounts_send_method_check
      CHECK (send_method IN ('app', 'user_email'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'supply_house_job_accounts' AND policyname = 'supply_house_job_accounts_insert_office_self'
  ) THEN
    CREATE POLICY supply_house_job_accounts_insert_office_self ON public.supply_house_job_accounts
      FOR INSERT WITH CHECK (
        sent_by = (SELECT auth.uid())
        AND EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = (SELECT auth.uid())
            AND u.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role])
        )
      );
  END IF;
END $$;

-- Policy changes on a guarded table: re-attach the training-mode read-only
-- guards so read_only users stay blocked from the new INSERT path.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
