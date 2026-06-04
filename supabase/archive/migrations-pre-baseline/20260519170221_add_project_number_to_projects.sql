-- 1. Column
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS project_number TEXT DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_projects_project_number
  ON public.projects(project_number);
COMMENT ON COLUMN public.projects.project_number IS
  'Auto-assigned short identifier for projects (e.g. 42). Displayed as "Project #42" in the UI.';

-- 2. Sequence (org-global)
CREATE SEQUENCE IF NOT EXISTS public.projects_project_number_seq START 1;

-- 3. Backfill existing rows oldest-first
WITH numbered AS (
  SELECT id, row_number() OVER (ORDER BY created_at ASC NULLS LAST, id ASC) AS rn
  FROM public.projects
  WHERE project_number IS NULL OR trim(project_number) = ''
)
UPDATE public.projects p
SET project_number = n.rn::TEXT
FROM numbered n
WHERE p.id = n.id;

-- 4. Pin sequence to MAX(project_number)+1 so future inserts don't collide
SELECT setval(
  'public.projects_project_number_seq',
  COALESCE((
    SELECT MAX(CAST(NULLIF(trim(project_number), '') AS INTEGER))
    FROM public.projects
    WHERE project_number ~ '^\s*\d+\s*$'
  ), 0) + 1
);

-- 5. BEFORE INSERT trigger fills only when client did not provide a value
CREATE OR REPLACE FUNCTION public.set_project_number_if_empty()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.project_number IS NULL OR trim(COALESCE(NEW.project_number, '')) = '' THEN
    NEW.project_number := nextval('public.projects_project_number_seq')::TEXT;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS projects_set_project_number ON public.projects;
CREATE TRIGGER projects_set_project_number
  BEFORE INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.set_project_number_if_empty();
