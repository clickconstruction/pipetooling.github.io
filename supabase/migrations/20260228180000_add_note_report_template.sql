-- Add "Note" report template for quick free-form reports (used by JobReportsModal "Add additional report")
DO $$
DECLARE
  t_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.report_templates WHERE name = 'Note') THEN
    INSERT INTO public.report_templates (name, sequence_order) VALUES ('Note', 2)
    RETURNING id INTO t_id;
    INSERT INTO public.report_template_fields (template_id, label, sequence_order) VALUES
      (t_id, 'Note', 0);
  END IF;
END $$;
