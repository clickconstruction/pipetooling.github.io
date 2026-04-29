-- Report template fields: input_type (textarea vs 0-100% slider) + job completion field
ALTER TABLE public.report_template_fields
  ADD COLUMN IF NOT EXISTS input_type text NOT NULL DEFAULT 'long_text';

ALTER TABLE public.report_template_fields
  DROP CONSTRAINT IF EXISTS report_template_fields_input_type_check;

ALTER TABLE public.report_template_fields
  ADD CONSTRAINT report_template_fields_input_type_check
  CHECK (input_type IN ('long_text', 'percent_0_100'));

COMMENT ON COLUMN public.report_template_fields.input_type IS 'UI: long_text (textarea) or percent_0_100 (0-100% slider).';

-- Superintendent Report: replace first field question with job completion slider
UPDATE public.report_template_fields f
SET
  label = 'How complete is the job?',
  input_type = 'percent_0_100'
FROM public.report_templates t
WHERE f.template_id = t.id
  AND t.name = 'Superintendent Report'
  AND f.sequence_order = 0
  AND f.label = 'Who was on the job?';

-- If the label was already changed but type not set (partial apply / manual)
UPDATE public.report_template_fields f
SET input_type = 'percent_0_100'
FROM public.report_templates t
WHERE f.template_id = t.id
  AND t.name = 'Superintendent Report'
  AND f.sequence_order = 0
  AND f.label = 'How complete is the job?'
  AND f.input_type = 'long_text';

-- Move stored answers to the new JSON key (field_values is keyed by label)
UPDATE public.reports r
SET field_values = (r.field_values - 'Who was on the job?')
  || jsonb_build_object(
    'How complete is the job?',
    r.field_values->'Who was on the job?'
  )
WHERE r.field_values ? 'Who was on the job?'
  AND NOT (r.field_values ? 'How complete is the job?');
