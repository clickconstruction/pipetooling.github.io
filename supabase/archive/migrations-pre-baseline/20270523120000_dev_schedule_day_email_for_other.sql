-- Dev: queue schedule_day_email_requests for any non-archived user; read all rows for debugging.

CREATE POLICY "schedule_day_email_requests_insert_dev_any_recipient"
  ON public.schedule_day_email_requests FOR INSERT
  WITH CHECK (
    public.is_dev()
    AND EXISTS (
      SELECT 1 FROM public.users r
      WHERE r.id = recipient_user_id
        AND r.archived_at IS NULL
    )
  );

CREATE POLICY "schedule_day_email_requests_select_dev"
  ON public.schedule_day_email_requests FOR SELECT
  USING (public.is_dev());
