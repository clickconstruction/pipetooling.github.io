SET lock_timeout = '3s';

-- Account Man on jobs (v2.1465): a designated team member who handles the
-- customer relationship, with a communication level. UI: Edit Job section
-- (picker restricted to the job's team) + Pipeline/Detail displays; the
-- 'only' level renders the loud red "only the Account Man speaks to this
-- customer" treatment. Client swap ships in the follow-up PR.
--
-- Invariant: the Account Man must be on the job's team. The form enforces it
-- at pick time; the trigger below keeps it true when membership changes from
-- any other surface (People flows, schedule tools) by clearing the Account
-- Man whenever that user leaves the team.

ALTER TABLE public.jobs_ledger
  ADD COLUMN IF NOT EXISTS account_manager_user_id uuid REFERENCES public.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS account_manager_relationship text;

COMMENT ON COLUMN public.jobs_ledger.account_manager_user_id IS
  'Account Man (v2.1465): team member who owns the customer relationship. Must be on jobs_ledger_team_members — cleared by trigger when they leave the team.';
COMMENT ON COLUMN public.jobs_ledger.account_manager_relationship IS
  'Communication level for the Account Man: primary | preferred | only (v2.1465). ''only'' renders the red only-communicator treatment across job surfaces.';

DO $$
BEGIN
  ALTER TABLE public.jobs_ledger
    ADD CONSTRAINT jobs_ledger_account_manager_relationship_check
    CHECK (account_manager_relationship IN ('primary', 'preferred', 'only'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.clear_job_account_manager_on_team_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.jobs_ledger
  SET account_manager_user_id = NULL,
      account_manager_relationship = NULL
  WHERE id = OLD.job_id
    AND account_manager_user_id = OLD.user_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS clear_job_account_manager_on_team_removal ON public.jobs_ledger_team_members;
CREATE TRIGGER clear_job_account_manager_on_team_removal
  AFTER DELETE ON public.jobs_ledger_team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_job_account_manager_on_team_removal();
