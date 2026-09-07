SET lock_timeout = '3s';

-- Jobs → Team (v2.2981): "Looks right" — the office accepts a ran-long or clocked-not-planned
-- chip so it stops showing as an exception. One row per (kind, day, person, target); deleting
-- the row is the undo. The ran-long threshold itself is an org default (org_defaults key
-- team.board.ran_long), not a column here.
CREATE TABLE IF NOT EXISTS public.team_board_acks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('over', 'unplanned')),
  work_date date NOT NULL,
  person_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- 'job:<uuid>' | 'bid:<uuid>' — the board's target key; the two FK columns mirror it for joins.
  target_key text NOT NULL,
  job_ledger_id uuid REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  bid_id uuid REFERENCES public.bids(id) ON DELETE CASCADE,
  acked_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  acked_at timestamptz NOT NULL DEFAULT now(),
  note text
);
CREATE UNIQUE INDEX IF NOT EXISTS team_board_acks_one_per_cell
  ON public.team_board_acks (kind, work_date, person_user_id, target_key);
CREATE INDEX IF NOT EXISTS team_board_acks_work_date_idx ON public.team_board_acks (work_date);

ALTER TABLE public.team_board_acks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS team_board_acks_read ON public.team_board_acks;
CREATE POLICY team_board_acks_read ON public.team_board_acks
  FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS team_board_acks_write ON public.team_board_acks;
CREATE POLICY team_board_acks_write ON public.team_board_acks
  FOR ALL USING (public.is_master_or_dev() OR public.is_controller())
  WITH CHECK (public.is_master_or_dev() OR public.is_controller());

COMMENT ON TABLE public.team_board_acks IS
  'Jobs → Team (v2.2981): accepted ran-long / clocked-not-planned chips. One row per (kind, work_date, person, target_key); delete = undo. Read any signed-in user; write dev / master / controller.';

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
