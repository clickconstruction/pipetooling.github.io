SET lock_timeout = '3s';

-- Presses nothing takes back (punch list #443, row 7's walk): a ZZ test job sends no Ready to bill notice.
--
-- A void that takes a job's last billed bill moves the job from Billed back to Ready to bill
-- (syncJobToReadyToBillIfNoBilledInvoicesRemain calls update_job_status). Every move into ready_to_bill fires
-- enqueue_ready_to_bill_notification_au on jobs_ledger (20260819230000), whose function queues one
-- paid_job_email_queue row of kind ready_to_bill. The paid-job-email drain sends that row, by email and by push, to
-- the people on the office's Ready to Bill list. Nothing on that path left a test job out, so voiding a ZZ test job's
-- test bill sent real people a notice about a job that is not real. The same held for every other move of a ZZ test
-- job into Ready to bill. The owner's answer of 2026-11-27, asked whether to build this: "Yes, build it". Its cost,
-- said before the answer: no ZZ test job ever sends this notice, the times a person moves one to look at it included.
--
-- One function is restated from its newest definition (20260819230000, and no later migration), with one line added
-- before the insert: a job that job_is_zz_test (20261120163000) calls a test job queues nothing. Its header is as it
-- was: plpgsql, SECURITY DEFINER, search_path = public. That definition carries no REVOKE and no GRANT, so none is
-- written here. Its comment is restated with one sentence added.
--
-- Why the function and not the drain: the function is the one place every move into ready_to_bill passes, and a row
-- never queued is never coalesced, retried or counted. The drain is an edge function, and a rule there would wait on
-- a deploy and leave rows in the queue that are stamped and never sent.
--
-- job_is_zz_test reads jobs_ledger.job_name and jobs_ledger.customer_name by id, and nothing else. This trigger fires
-- after the update, so it reads the row as it stands then. It is revoked from PUBLIC, anon and authenticated. This
-- function runs as its owner, who owns job_is_zz_test too, and a revoke does not bind the owner.
--
-- What the push leaves on prod: one replaced function and its comment. No table, column, policy, grant, trigger or
-- row is made or changed, and no table is locked. The trigger, the queue, job_is_zz_test, the drain and the paid
-- notices are untouched: a ZZ test job that reaches Paid still queues its paid_in_full row. Rows already in the queue
-- stay as they are. Safe to run twice: CREATE OR REPLACE and COMMENT.

CREATE OR REPLACE FUNCTION public.enqueue_ready_to_bill_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- A ZZ test job sends no notice: nothing is queued, so the drain has nothing to send.
  IF public.job_is_zz_test(NEW.id) THEN RETURN NEW; END IF;
  INSERT INTO public.paid_job_email_queue (job_ledger_id, kind)
  VALUES (NEW.id, 'ready_to_bill');
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enqueue_ready_to_bill_notification() IS
  'Ready to Bill notification stream (v2.1836): every transition into status=ready_to_bill enqueues kind=ready_to_bill (send-backs from Billed included, by design). The paid-job-email edge function fans out email and/or web push per the channels setting. Since v2.8689 a ZZ test job (job_is_zz_test: its name or its stored customer name starts with ZZ) enqueues nothing.';
