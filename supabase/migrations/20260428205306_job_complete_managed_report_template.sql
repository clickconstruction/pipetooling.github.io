-- Managed "Job Complete" report template + signature_png input type + protection triggers.

-- 1. app_managed flag on report_templates
ALTER TABLE public.report_templates
  ADD COLUMN IF NOT EXISTS app_managed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.report_templates.app_managed IS
  'Built-in seeded templates cannot be deleted or edited via Gear UI; schema changes via migrations only.';

-- 2. Allow signature_png on report_template_fields
ALTER TABLE public.report_template_fields
  DROP CONSTRAINT IF EXISTS report_template_fields_input_type_check;

ALTER TABLE public.report_template_fields
  ADD CONSTRAINT report_template_fields_input_type_check
  CHECK (input_type IN ('long_text', 'percent_0_100', 'signature_png'));

COMMENT ON COLUMN public.report_template_fields.input_type IS
  'UI: long_text, percent_0_100, or signature_png (PNG image as data:image/png;base64,... text).';

-- 3. Seed Job Complete template + fields (idempotent)
DO $$
DECLARE
  tid uuid;
  next_ord int;
BEGIN
  IF EXISTS (SELECT 1 FROM public.report_templates WHERE name = 'Job Complete') THEN
    RETURN;
  END IF;

  SELECT COALESCE(MAX(sequence_order), -1) + 1 INTO next_ord FROM public.report_templates;

  INSERT INTO public.report_templates (name, sequence_order, app_managed)
  VALUES ('Job Complete', next_ord, true)
  RETURNING id INTO tid;

  INSERT INTO public.report_template_fields (template_id, label, sequence_order, input_type) VALUES
    (tid, 'Scope of work performed', 0, 'long_text'),
    (tid, 'Any deviations or issues encountered', 1, 'long_text'),
    (tid, 'Signature', 2, 'signature_png');
END $$;

-- 4. Prevent DELETE of managed templates
CREATE OR REPLACE FUNCTION public.prevent_delete_managed_report_templates()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.app_managed THEN
    RAISE EXCEPTION 'Cannot delete managed report templates';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS prevent_delete_managed_report_templates ON public.report_templates;
CREATE TRIGGER prevent_delete_managed_report_templates
  BEFORE DELETE ON public.report_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_delete_managed_report_templates();

-- 5. Prevent renaming managed templates (copy changes via migration)
CREATE OR REPLACE FUNCTION public.prevent_rename_managed_report_templates()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.app_managed AND (NEW.name IS DISTINCT FROM OLD.name) THEN
    RAISE EXCEPTION 'Cannot rename managed report templates';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_rename_managed_report_templates ON public.report_templates;
CREATE TRIGGER prevent_rename_managed_report_templates
  BEFORE UPDATE ON public.report_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_rename_managed_report_templates();

-- 6. Prevent INSERT/UPDATE/DELETE of fields for managed templates (after seed)
CREATE OR REPLACE FUNCTION public.prevent_mutate_managed_report_template_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  managed boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT rt.app_managed INTO managed FROM public.report_templates rt WHERE rt.id = OLD.template_id;
    IF COALESCE(managed, false) THEN
      RAISE EXCEPTION 'Cannot change field definitions for managed report templates';
    END IF;
    RETURN OLD;
  END IF;

  SELECT rt.app_managed INTO managed FROM public.report_templates rt WHERE rt.id = NEW.template_id;
  IF COALESCE(managed, false) THEN
    RAISE EXCEPTION 'Cannot change field definitions for managed report templates';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_mutate_managed_report_template_fields ON public.report_template_fields;
CREATE TRIGGER prevent_mutate_managed_report_template_fields
  BEFORE INSERT OR UPDATE OR DELETE ON public.report_template_fields
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_mutate_managed_report_template_fields();
