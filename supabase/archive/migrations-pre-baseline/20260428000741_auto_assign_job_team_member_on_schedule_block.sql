-- When a dispatch schedule block is created, ensure the assignee is on jobs_ledger_team_members.
-- Idempotent ON CONFLICT: shared_block_group legs reuse (job_id, assignee_user_id).
-- SECURITY DEFINER so inserts succeed regardless of INSERT policy gaps for the schedule-creating principal.

CREATE OR REPLACE FUNCTION public.ensure_job_team_member_from_schedule_block()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.job_id IS NULL OR NEW.assignee_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.jobs_ledger_team_members (job_id, user_id)
  VALUES (NEW.job_id, NEW.assignee_user_id)
  ON CONFLICT (job_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.ensure_job_team_member_from_schedule_block() IS
  'AFTER INSERT on job_schedule_blocks: add assignee to jobs ledger team (additive; complements UI Add to job). Bypasses roster INSERT RLS.';

REVOKE ALL ON FUNCTION public.ensure_job_team_member_from_schedule_block() FROM PUBLIC;

DROP TRIGGER IF EXISTS job_schedule_blocks_ensure_job_team_member_tr
  ON public.job_schedule_blocks;

CREATE TRIGGER job_schedule_blocks_ensure_job_team_member_tr
  AFTER INSERT ON public.job_schedule_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_job_team_member_from_schedule_block();

-- Backfill roster from existing schedule rows (same rule: distinct job_id + assignee).
INSERT INTO public.jobs_ledger_team_members (job_id, user_id)
SELECT DISTINCT jb.job_id, jb.assignee_user_id
FROM public.job_schedule_blocks jb
ON CONFLICT (job_id, user_id) DO NOTHING;
