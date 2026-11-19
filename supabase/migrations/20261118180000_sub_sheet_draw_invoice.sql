SET lock_timeout = '3s';

-- The sub sheet's tie to one bill (v2.7835, punch list #388, step 1 of 3).
--
-- WHY. A sub's sheet waits at Waiting on customer until the customer pays. A sheet is tied to a job, not to a bill,
-- so nothing says which of the job's bills that sheet waits on. Step 2 of the card lets the sub's page say the
-- customer paid. It may say so for one bill only, the one the sheet is tied to (the owner's call 2b, 2026-11-17).
-- This migration makes the tie. Nothing reads it yet outside the office's own row.
--
-- WHAT.
--   1) people_labor_jobs.draw_invoice_id: the bill the sheet rides on, a bill of the sheet's own job. Deleting the
--      bill clears the tie.
--   2) people_labor_jobs_stage_draw_tie_biu, one BEFORE trigger on the sheet's stage, tie and job link:
--        a. a sheet off Waiting on customer rides on no bill;
--        b. a tie to a bill of another job is no tie;
--        c. a sheet that arrives at Waiting on customer with no tie takes the job's one open bill, when the job has
--           exactly one. A bill is open until it is paid: ready_to_bill or billed. With none or several it takes
--           none, and the office picks.
--      The trigger rides every writer of the stage, so the office's set_sub_sheet_stage does not change.
--   3) set_sub_sheet_draw_invoice(sheet, bill): the office picks, changes or clears the tie on a sheet that is
--      waiting on the customer. The same writers as set_sub_sheet_stage.
--
-- No backfill. A sheet already waiting on the customer keeps no tie until the office picks one: the one open bill a
-- job has today may not be the bill that sheet's draw was requested on.
-- No new table, so no fence calls. Idempotent. See docs/migrations/20261118180000_sub_sheet_draw_invoice.md.

-- 1) The tie.
ALTER TABLE public.people_labor_jobs
  ADD COLUMN IF NOT EXISTS draw_invoice_id uuid REFERENCES public.jobs_ledger_invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS people_labor_jobs_draw_invoice_id_idx
  ON public.people_labor_jobs (draw_invoice_id)
  WHERE draw_invoice_id IS NOT NULL;

COMMENT ON COLUMN public.people_labor_jobs.draw_invoice_id IS
  'The bill this sheet rides on while it waits on the customer (v2.7835, punch list #388): a bill of the sheet''s own job. Set by people_labor_jobs_draw_tie() when the sheet arrives at customer_pay and the job has exactly one open bill, and by set_sub_sheet_draw_invoice when the office picks. Cleared when the sheet leaves customer_pay, when its job changes, and when the bill is deleted. NULL means no tie.';

-- 2) The trigger. SECURITY DEFINER so the count of a job's open bills is the whole count, whoever writes the sheet.
CREATE OR REPLACE FUNCTION public.people_labor_jobs_draw_tie()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_open uuid[];
BEGIN
  -- a. Off Waiting on customer, a sheet rides on no bill.
  IF NEW.stage IS DISTINCT FROM 'customer_pay' THEN
    NEW.draw_invoice_id := NULL;
    RETURN NEW;
  END IF;

  -- b. The tie is to a bill of the sheet's own job, or it is no tie.
  IF NEW.draw_invoice_id IS NOT NULL AND NOT EXISTS (
       SELECT 1
         FROM public.jobs_ledger_invoices i
        WHERE i.id = NEW.draw_invoice_id
          AND i.job_id = NEW.job_ledger_id
     ) THEN
    NEW.draw_invoice_id := NULL;
  END IF;

  -- c. Arriving with no tie: the job's one open bill is the one.
  IF NEW.draw_invoice_id IS NULL
     AND NEW.job_ledger_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.stage IS DISTINCT FROM 'customer_pay') THEN
    SELECT array_agg(i.id)
      INTO v_open
      FROM public.jobs_ledger_invoices i
     WHERE i.job_id = NEW.job_ledger_id
       AND i.status <> 'paid';
    IF coalesce(array_length(v_open, 1), 0) = 1 THEN
      NEW.draw_invoice_id := v_open[1];
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.people_labor_jobs_draw_tie() IS
  'BEFORE INSERT OR UPDATE OF stage, draw_invoice_id, job_ledger_id, job_number on people_labor_jobs (v2.7835, punch list #388): clears the tie off customer_pay, drops a tie to a bill of another job, and ties a sheet arriving at customer_pay to the job''s one open bill (status not paid) when the job has exactly one.';

-- Named to sort after people_labor_jobs_link_job_ledger_biu, so the job link is settled when this reads it.
DROP TRIGGER IF EXISTS people_labor_jobs_stage_draw_tie_biu ON public.people_labor_jobs;
CREATE TRIGGER people_labor_jobs_stage_draw_tie_biu
  BEFORE INSERT OR UPDATE OF stage, draw_invoice_id, job_ledger_id, job_number ON public.people_labor_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.people_labor_jobs_draw_tie();

-- 3) The office's pick.
CREATE OR REPLACE FUNCTION public.set_sub_sheet_draw_invoice(
  p_labor_job_id uuid,
  p_invoice_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean;
  v_stage text;
  v_job_id uuid;
BEGIN
  SELECT public.is_dev()
      OR public.is_assistant()
      OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'master_technician')
    INTO v_ok;
  IF NOT COALESCE(v_ok, false) THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  SELECT s.stage, s.job_ledger_id
    INTO v_stage, v_job_id
    FROM public.people_labor_jobs s
   WHERE s.id = p_labor_job_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Sheet not found');
  END IF;
  IF v_stage IS DISTINCT FROM 'customer_pay' THEN
    RETURN jsonb_build_object('error', 'This sheet is not waiting on the customer');
  END IF;
  IF p_invoice_id IS NOT NULL AND NOT EXISTS (
       SELECT 1
         FROM public.jobs_ledger_invoices i
        WHERE i.id = p_invoice_id
          AND i.job_id = v_job_id
     ) THEN
    RETURN jsonb_build_object('error', 'That bill is not on this sheet''s job');
  END IF;

  UPDATE public.people_labor_jobs
     SET draw_invoice_id = p_invoice_id
   WHERE id = p_labor_job_id;
  RETURN jsonb_build_object('ok', true, 'draw_invoice_id', p_invoice_id);
END;
$$;

COMMENT ON FUNCTION public.set_sub_sheet_draw_invoice(uuid, uuid) IS
  'Pick, change or clear (NULL) the bill a Sub Labor sheet rides on while it waits on the customer (v2.7835, punch list #388). Office writers, the same as set_sub_sheet_stage. Refuses a sheet off customer_pay and a bill of another job.';

REVOKE EXECUTE ON FUNCTION public.set_sub_sheet_draw_invoice(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_sub_sheet_draw_invoice(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_sub_sheet_draw_invoice(uuid, uuid) TO authenticated;
