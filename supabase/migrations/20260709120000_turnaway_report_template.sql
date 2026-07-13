-- Seed the managed "Turnaway" report template.
--
-- A tech dispatched to a job where the client isn't home or the site isn't
-- ready files a Turnaway from the Job Mode card: a geotagged field report on
-- this template plus a dispatch_requests row (pending_action
-- 'trip_charge_turnaway') so the office can create a trip charge.
--
-- Idempotent: skips if a template named 'Turnaway' already exists (there is no
-- unique constraint on report_templates.name, so ON CONFLICT is unavailable).
--
-- prevent_mutate_managed_report_template_fields rejects field inserts for
-- app_managed templates, so the template is inserted unmanaged, fields added,
-- then the flag flipped (prevent_rename_managed_report_templates only blocks
-- name changes, not the app_managed update).
DO $$
DECLARE
  tid uuid;
  next_ord int;
BEGIN
  IF EXISTS (SELECT 1 FROM public.report_templates WHERE name = 'Turnaway') THEN
    RETURN;
  END IF;

  SELECT COALESCE(MAX(sequence_order), -1) + 1 INTO next_ord FROM public.report_templates;

  INSERT INTO public.report_templates (name, sequence_order, app_managed)
  VALUES ('Turnaway', next_ord, false)
  RETURNING id INTO tid;

  INSERT INTO public.report_template_fields (template_id, label, sequence_order, input_type) VALUES
    (tid, 'Reason', 0, 'long_text'),
    (tid, 'Note', 1, 'long_text');

  UPDATE public.report_templates SET app_managed = true WHERE id = tid;
END $$;
