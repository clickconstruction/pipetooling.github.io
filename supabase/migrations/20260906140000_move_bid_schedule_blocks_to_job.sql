SET lock_timeout = '3s';

-- Tier 5 X10 (J15-F10), T5-04: the mirror of the v2.1624 job→bid move. When a won bid becomes a
-- job, the visits scheduled against the bid can follow it. Offered (never automatic) from the
-- Won-moment door once a job opened from the bid exists.
--
-- Authorization mirrors the job_schedule_blocks write policies (can_edit_schedule_dispatch()),
-- plus one invariant: the job must have been opened from this bid (jobs_ledger.bid_id).
CREATE OR REPLACE FUNCTION public.move_bid_schedule_blocks_to_job(p_bid_id uuid, p_job_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_n integer;
BEGIN
  IF NOT public.can_edit_schedule_dispatch() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.jobs_ledger WHERE id = p_job_id AND bid_id = p_bid_id) THEN
    RAISE EXCEPTION 'That job was not opened from this bid' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.job_schedule_blocks
     SET job_id = p_job_id, bid_id = NULL, updated_at = now()
   WHERE bid_id = p_bid_id AND job_id IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $fn$;

GRANT EXECUTE ON FUNCTION public.move_bid_schedule_blocks_to_job(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.move_bid_schedule_blocks_to_job(uuid, uuid) IS
  'Re-anchor every bid-anchored schedule block of p_bid_id onto p_job_id (a job opened from that bid). Mirror of the job→bid move inside migrate_job_ledger_costs_to_bid_and_delete. Returns the moved count. can_edit_schedule_dispatch() only. Tier 5 X10 / v2.2947.';
