-- Atomically move all legs of a linked schedule block group to a new work_date with per-assignee overlap checks.
CREATE OR REPLACE FUNCTION public.move_job_schedule_block_group(
  p_job_id uuid,
  p_shared_block_group_id uuid,
  p_new_work_date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  PERFORM id
  FROM public.job_schedule_blocks
  WHERE job_id = p_job_id
    AND shared_block_group_id = p_shared_block_group_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No schedule blocks found for that linked group.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.job_schedule_blocks L
    WHERE L.job_id = p_job_id
      AND L.shared_block_group_id = p_shared_block_group_id
      AND L.work_date IS DISTINCT FROM p_new_work_date
  ) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.job_schedule_blocks L
    INNER JOIN public.job_schedule_blocks O
      ON O.assignee_user_id = L.assignee_user_id
     AND O.work_date = p_new_work_date
     AND O.id NOT IN (
       SELECT id
       FROM public.job_schedule_blocks
       WHERE job_id = p_job_id
         AND shared_block_group_id = p_shared_block_group_id
     )
     AND L.time_start < O.time_end
     AND O.time_start < L.time_end
    WHERE L.job_id = p_job_id
      AND L.shared_block_group_id = p_shared_block_group_id
  ) THEN
    RAISE EXCEPTION 'That time overlaps another block for this person on this day.';
  END IF;

  UPDATE public.job_schedule_blocks
  SET work_date = p_new_work_date
  WHERE job_id = p_job_id
    AND shared_block_group_id = p_shared_block_group_id;
END;
$$;

COMMENT ON FUNCTION public.move_job_schedule_block_group(uuid, uuid, date) IS
  'Moves every leg of a linked job schedule block group to p_new_work_date; rejects if any assignee would overlap another block on that day.';

GRANT EXECUTE ON FUNCTION public.move_job_schedule_block_group(uuid, uuid, date) TO authenticated;
