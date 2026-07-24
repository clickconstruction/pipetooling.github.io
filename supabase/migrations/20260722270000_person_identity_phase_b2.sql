-- Person identity Phase B2 (v2.1009; docs/PERSON_IDENTITY_PLAN.md): finish
-- Phase B's deferred scope. The five "remaining" tables already carried
-- person_id (plan doc was stale) — so: backfill + insert-triggers on them,
-- plus the people_labor_job_assignees junction shadowing the delimited
-- people_labor_jobs.assigned_to_name (' | ' separated), kept in sync by
-- trigger. Names remain display + fallback. Idempotent.

-- 1) Backfill person_id (NULL-only) via resolve_pay_person_id (Phase B).
UPDATE public.people_crew_bids           SET person_id = public.resolve_pay_person_id(person_name) WHERE person_id IS NULL;
UPDATE public.pay_stub_days              SET person_id = public.resolve_pay_person_id(person_name) WHERE person_id IS NULL;
UPDATE public.people_hours_display_order SET person_id = public.resolve_pay_person_id(person_name) WHERE person_id IS NULL;
UPDATE public.person_offsets             SET person_id = public.resolve_pay_person_id(person_name) WHERE person_id IS NULL;
UPDATE public.hours_reviewed             SET person_id = public.resolve_pay_person_id(person_name) WHERE person_id IS NULL;

-- 2) Auto-resolve on insert (same trigger fn as Phase B).
DROP TRIGGER IF EXISTS set_person_id_on_insert ON public.people_crew_bids;
CREATE TRIGGER set_person_id_on_insert BEFORE INSERT ON public.people_crew_bids
  FOR EACH ROW EXECUTE FUNCTION public.pay_tables_set_person_id();
DROP TRIGGER IF EXISTS set_person_id_on_insert ON public.pay_stub_days;
CREATE TRIGGER set_person_id_on_insert BEFORE INSERT ON public.pay_stub_days
  FOR EACH ROW EXECUTE FUNCTION public.pay_tables_set_person_id();
DROP TRIGGER IF EXISTS set_person_id_on_insert ON public.people_hours_display_order;
CREATE TRIGGER set_person_id_on_insert BEFORE INSERT ON public.people_hours_display_order
  FOR EACH ROW EXECUTE FUNCTION public.pay_tables_set_person_id();
DROP TRIGGER IF EXISTS set_person_id_on_insert ON public.person_offsets;
CREATE TRIGGER set_person_id_on_insert BEFORE INSERT ON public.person_offsets
  FOR EACH ROW EXECUTE FUNCTION public.pay_tables_set_person_id();
DROP TRIGGER IF EXISTS set_person_id_on_insert ON public.hours_reviewed;
CREATE TRIGGER set_person_id_on_insert BEFORE INSERT ON public.hours_reviewed
  FOR EACH ROW EXECUTE FUNCTION public.pay_tables_set_person_id();

-- 3) Junction shadowing the delimited assignee text.
CREATE TABLE IF NOT EXISTS public.people_labor_job_assignees (
  labor_job_id uuid NOT NULL REFERENCES public.people_labor_jobs(id) ON DELETE CASCADE,
  person_id    uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  PRIMARY KEY (labor_job_id, person_id)
);
ALTER TABLE public.people_labor_job_assignees ENABLE ROW LEVEL SECURITY;

-- Visibility inherits the parent labor job's RLS via EXISTS (runs as caller);
-- writes additionally require the parent-writing office roles.
DROP POLICY IF EXISTS plja_select ON public.people_labor_job_assignees;
CREATE POLICY plja_select ON public.people_labor_job_assignees FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.people_labor_jobs plj WHERE plj.id = labor_job_id));
DROP POLICY IF EXISTS plja_insert ON public.people_labor_job_assignees;
CREATE POLICY plja_insert ON public.people_labor_job_assignees FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.people_labor_jobs plj WHERE plj.id = labor_job_id)
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid())
                  AND u.role IN ('dev','master_technician','assistant','estimator'))
  );
DROP POLICY IF EXISTS plja_update ON public.people_labor_job_assignees;
CREATE POLICY plja_update ON public.people_labor_job_assignees FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.people_labor_jobs plj WHERE plj.id = labor_job_id)
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid())
                  AND u.role IN ('dev','master_technician','assistant','estimator'))
  );
DROP POLICY IF EXISTS plja_delete ON public.people_labor_job_assignees;
CREATE POLICY plja_delete ON public.people_labor_job_assignees FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.people_labor_jobs plj WHERE plj.id = labor_job_id)
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid())
                  AND u.role IN ('dev','master_technician','assistant','estimator'))
  );

-- 4) Sync: rebuild a job's junction rows from its delimited text.
CREATE OR REPLACE FUNCTION public.sync_people_labor_job_assignees()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.people_labor_job_assignees WHERE labor_job_id = NEW.id;
  INSERT INTO public.people_labor_job_assignees (labor_job_id, person_id)
  SELECT DISTINCT NEW.id, public.resolve_pay_person_id(btrim(seg))
  FROM unnest(string_to_array(COALESCE(NEW.assigned_to_name, ''), ' | ')) AS seg
  WHERE btrim(seg) <> '' AND public.resolve_pay_person_id(btrim(seg)) IS NOT NULL
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS sync_assignees_on_write ON public.people_labor_jobs;
CREATE TRIGGER sync_assignees_on_write AFTER INSERT OR UPDATE OF assigned_to_name ON public.people_labor_jobs
  FOR EACH ROW EXECUTE FUNCTION public.sync_people_labor_job_assignees();

-- 5) Backfill the junction from existing rows.
INSERT INTO public.people_labor_job_assignees (labor_job_id, person_id)
SELECT DISTINCT plj.id, public.resolve_pay_person_id(btrim(seg))
FROM public.people_labor_jobs plj,
     unnest(string_to_array(COALESCE(plj.assigned_to_name, ''), ' | ')) AS seg
WHERE btrim(seg) <> '' AND public.resolve_pay_person_id(btrim(seg)) IS NOT NULL
ON CONFLICT DO NOTHING;

-- New table: mandatory read-only training-mode blocks (CLAUDE.md).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
