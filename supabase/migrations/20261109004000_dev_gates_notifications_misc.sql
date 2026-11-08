SET lock_timeout = '3s';

-- Punch list #188 (the dev gates), PR 7, v2.6760: the billing notification windows and the office's small doors, rows
-- 41 to 43, 46 and 48 to 50 of the audit table, every recommendation taken as written by the owner on 2026-11-08.
-- The database side of the doors that write rows only a dev could:
--   rows 41, 42  Who gets the billing emails and the estimate-accepted email — six app_settings keys, the controller
--                with a dev (the owner holds the same keys since 20261109000500 for Emails & reports).
--   row 43       GC Review → Standing copies — the office removes an unsent standing (repeat_weekly) request anyone
--                wrote; the insert policy admits the office's own rows already.
--   row 50       Dispatch settings → Travel hints — travel_hints_config_v1 and the note requirements key the same
--                Save writes, the office.
-- Rows 46 (the Stripe Dashboard links), 48 (projections, whose table admits the office already) and 49 (the paid-in-
-- full email, whose edge function gains the office) are client and function lines alone. Additive and idempotent: no
-- table is created, so no fence call is owed.

-- 1) The recipient lists (rows 41, 42): the windows upsert.
DROP POLICY IF EXISTS controller_or_dev_insert_notification_recipients ON public.app_settings;
CREATE POLICY controller_or_dev_insert_notification_recipients ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (
    key = ANY (ARRAY['paid_job_email_recipients_v1', 'payment_made_email_recipients_v1', 'ready_to_bill_notify_recipients_v1', 'ready_to_bill_notify_recipients_v2', 'ready_to_bill_notify_channels_v1', 'signed_agreements_notify_recipients_v1'])
    AND (public.is_dev() OR public.is_controller())
  );
DROP POLICY IF EXISTS controller_or_dev_update_notification_recipients ON public.app_settings;
CREATE POLICY controller_or_dev_update_notification_recipients ON public.app_settings FOR UPDATE TO authenticated
  USING (
    key = ANY (ARRAY['paid_job_email_recipients_v1', 'payment_made_email_recipients_v1', 'ready_to_bill_notify_recipients_v1', 'ready_to_bill_notify_recipients_v2', 'ready_to_bill_notify_channels_v1', 'signed_agreements_notify_recipients_v1'])
    AND (public.is_dev() OR public.is_controller())
  )
  WITH CHECK (
    key = ANY (ARRAY['paid_job_email_recipients_v1', 'payment_made_email_recipients_v1', 'ready_to_bill_notify_recipients_v1', 'ready_to_bill_notify_recipients_v2', 'ready_to_bill_notify_channels_v1', 'signed_agreements_notify_recipients_v1'])
    AND (public.is_dev() OR public.is_controller())
  );

-- 2) Standing copies (row 43): the office takes a standing send off, whoever set it, while it has not gone.
DROP POLICY IF EXISTS office_delete_unsent_standing_gc_statement_requests ON public.gc_statement_email_requests;
CREATE POLICY office_delete_unsent_standing_gc_statement_requests ON public.gc_statement_email_requests
  FOR DELETE TO authenticated
  USING (public.is_office_staff() AND repeat_weekly AND sent_at IS NULL);

-- 3) Dispatch settings (row 50): the travel hints and the note requirements the same Save writes.
DROP POLICY IF EXISTS office_insert_dispatch_settings_keys ON public.app_settings;
CREATE POLICY office_insert_dispatch_settings_keys ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (key IN ('travel_hints_config_v1', 'dispatch_note_requirement_config_v1') AND public.is_office_staff());
DROP POLICY IF EXISTS office_update_dispatch_settings_keys ON public.app_settings;
CREATE POLICY office_update_dispatch_settings_keys ON public.app_settings FOR UPDATE TO authenticated
  USING (key IN ('travel_hints_config_v1', 'dispatch_note_requirement_config_v1') AND public.is_office_staff())
  WITH CHECK (key IN ('travel_hints_config_v1', 'dispatch_note_requirement_config_v1') AND public.is_office_staff());
