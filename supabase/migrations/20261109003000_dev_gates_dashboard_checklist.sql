SET lock_timeout = '3s';

-- Punch list #188 (the dev gates), PR 5, v2.6758: the Dashboard, Checklist, Roadmap card, Reply book and recurring
-- report doors, rows 33 to 37, 47 and 64 to 66 of the audit table, every recommendation taken as written by the owner
-- on 2026-11-08. The database side of the doors that read or write rows only a dev could:
--   row 34  Help feedback inbox — help_feedback read whole and closed by the owner too (is_master_or_dev()).
--   row 36  Email schedule → Send to another user — schedule_day_email_requests inserted for any live recipient by
--           the office (is_office_staff()), beside the dev's policy and everyone's own-row insert.
--   row 47  Recurring email reports for any leader — recurring_job_report_schedules inserted and deleted on any scope
--           by the owner, and its recipients inserted and updated (PR 1 gave him the schedule update and recipient
--           delete).
--   row 64  Reply book: change or delete anyone's reply — bid_reply_book_entries update and delete, the owner too.
--   row 66  Task cost lens — checklist_item_costs, the owner beside the dev and the controller.
-- Rows 33 (rejected sessions, the pay approved owner's clock_sessions read), 35 (the forward buttons) and 37 (the
-- roadmap card) read what their audiences read already: client lines alone. Additive and idempotent: no table is
-- created, so no fence call is owed.

-- 1) Help feedback (row 34): the owner reads every row and closes one, beside a sender's own-row read.
DROP POLICY IF EXISTS help_feedback_select_master_or_dev ON public.help_feedback;
CREATE POLICY help_feedback_select_master_or_dev ON public.help_feedback FOR SELECT TO authenticated USING (public.is_master_or_dev());
DROP POLICY IF EXISTS help_feedback_update_master_or_dev ON public.help_feedback;
CREATE POLICY help_feedback_update_master_or_dev ON public.help_feedback FOR UPDATE TO authenticated USING (public.is_master_or_dev()) WITH CHECK (public.is_master_or_dev());

-- 2) The day's schedule email for someone else (row 36): the office, to any live recipient.
DROP POLICY IF EXISTS schedule_day_email_requests_insert_office_any_recipient ON public.schedule_day_email_requests;
CREATE POLICY schedule_day_email_requests_insert_office_any_recipient
  ON public.schedule_day_email_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_office_staff()
    AND EXISTS (SELECT 1 FROM public.users r WHERE r.id = schedule_day_email_requests.recipient_user_id AND r.archived_at IS NULL)
  );

-- 3) Recurring reports on any leader's scope (row 47): the owner schedules, stops and addresses them.
DROP POLICY IF EXISTS master_or_dev_insert_recurring_job_report_schedules ON public.recurring_job_report_schedules;
CREATE POLICY master_or_dev_insert_recurring_job_report_schedules
  ON public.recurring_job_report_schedules FOR INSERT TO authenticated WITH CHECK (public.is_master_or_dev());
DROP POLICY IF EXISTS master_or_dev_delete_recurring_job_report_schedules ON public.recurring_job_report_schedules;
CREATE POLICY master_or_dev_delete_recurring_job_report_schedules
  ON public.recurring_job_report_schedules FOR DELETE TO authenticated USING (public.is_master_or_dev());
DROP POLICY IF EXISTS master_or_dev_insert_recurring_job_report_recipients ON public.recurring_job_report_schedule_recipients;
CREATE POLICY master_or_dev_insert_recurring_job_report_recipients
  ON public.recurring_job_report_schedule_recipients FOR INSERT TO authenticated WITH CHECK (public.is_master_or_dev());
DROP POLICY IF EXISTS master_or_dev_update_recurring_job_report_recipients ON public.recurring_job_report_schedule_recipients;
CREATE POLICY master_or_dev_update_recurring_job_report_recipients
  ON public.recurring_job_report_schedule_recipients FOR UPDATE TO authenticated USING (public.is_master_or_dev()) WITH CHECK (public.is_master_or_dev());

-- 4) The Reply book (row 64): the author's two policies restated from 20260928144511 with the owner beside the dev.
DROP POLICY IF EXISTS bid_reply_book_entries_update_own_or_dev ON public.bid_reply_book_entries;
CREATE POLICY bid_reply_book_entries_update_own_or_dev
  ON public.bid_reply_book_entries FOR UPDATE TO authenticated
  USING (public.is_master_or_dev() OR (created_by = auth.uid() AND public.can_open_bid_reply_book()))
  WITH CHECK (public.is_master_or_dev() OR (created_by = auth.uid() AND public.can_open_bid_reply_book()));
DROP POLICY IF EXISTS bid_reply_book_entries_delete_own_or_dev ON public.bid_reply_book_entries;
CREATE POLICY bid_reply_book_entries_delete_own_or_dev
  ON public.bid_reply_book_entries FOR DELETE TO authenticated
  USING (public.is_master_or_dev() OR (created_by = auth.uid() AND public.can_open_bid_reply_book()));

-- 5) The task cost lens (row 66): restated from 20260824235336 with the owner beside the dev and the controller.
DROP POLICY IF EXISTS checklist_item_costs_dev_all ON public.checklist_item_costs;
CREATE POLICY checklist_item_costs_dev_all ON public.checklist_item_costs
  FOR ALL
  USING (public.is_dev() OR public.is_controller() OR public.is_master_or_dev())
  WITH CHECK (public.is_dev() OR public.is_controller() OR public.is_master_or_dev());
