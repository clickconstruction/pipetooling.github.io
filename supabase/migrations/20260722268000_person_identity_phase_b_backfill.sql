-- Person identity Phase B (v2.1008; docs/PERSON_IDENTITY_PLAN.md, option chosen
-- 2026-07-24): make people.id the canonical pay key by (1) creating linked
-- people rows for pay-named users that have none, (2) backfilling person_id on
-- the five tables that already carry it, (3) auto-resolving person_id on
-- insert. Names remain as denormalized display + fallback — a failed
-- resolution degrades to today's behavior, never worse.
-- Idempotent throughout; no CREATE TABLE (read-only-block calls not required).

-- 1) People rows for internal staff appearing in pay tables. The people.kind
--    CHECK already admits internal roles; map users.role faithfully
--    (helpers→helper, subcontractor→sub, rest 1:1). Owner = the single
--    master_technician org owner.
INSERT INTO public.people (master_user_id, kind, name, email, account_user_id)
SELECT
  (SELECT id FROM public.users WHERE role = 'master_technician' ORDER BY created_at LIMIT 1),
  CASE u.role::text
    WHEN 'helpers' THEN 'helper'
    WHEN 'subcontractor' THEN 'sub'
    ELSE u.role::text
  END,
  btrim(u.name),
  NULLIF(btrim(u.email), ''),
  u.id
FROM public.users u
WHERE btrim(u.name) IN (
        SELECT btrim(person_name) FROM public.people_pay_config
        UNION SELECT btrim(person_name) FROM public.people_hours
        UNION SELECT btrim(person_name) FROM public.people_crew_jobs
        UNION SELECT btrim(person_name) FROM public.pay_stubs
      )
  AND NOT EXISTS (SELECT 1 FROM public.people p WHERE p.account_user_id = u.id);

-- 2) Resolver: pay name → users (exact trimmed) → linked active people row;
--    else direct active-people name match. NULL when ambiguous or unknown.
CREATE OR REPLACE FUNCTION public.resolve_pay_person_id(p_name text)
RETURNS uuid
LANGUAGE sql STABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT p.id FROM public.users u
       JOIN public.people p ON p.account_user_id = u.id AND p.archived_at IS NULL
      WHERE btrim(u.name) = btrim(p_name)
      LIMIT 1),
    (SELECT p.id FROM public.people p
      WHERE p.archived_at IS NULL AND btrim(p.name) = btrim(p_name)
        AND (SELECT count(*) FROM public.people p2
              WHERE p2.archived_at IS NULL AND btrim(p2.name) = btrim(p_name)) = 1
      LIMIT 1)
  );
$$;

-- 3) Backfill person_id where NULL on the five carrier tables.
UPDATE public.people_hours          SET person_id = public.resolve_pay_person_id(person_name) WHERE person_id IS NULL;
UPDATE public.people_pay_config     SET person_id = public.resolve_pay_person_id(person_name) WHERE person_id IS NULL;
UPDATE public.people_crew_jobs      SET person_id = public.resolve_pay_person_id(person_name) WHERE person_id IS NULL;
UPDATE public.pay_stubs             SET person_id = public.resolve_pay_person_id(person_name) WHERE person_id IS NULL;
UPDATE public.people_team_members   SET person_id = public.resolve_pay_person_id(person_name) WHERE person_id IS NULL;

-- 4) Auto-populate on insert (BEFORE INSERT; only when person_id not provided).
CREATE OR REPLACE FUNCTION public.pay_tables_set_person_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.person_id IS NULL THEN
    NEW.person_id := public.resolve_pay_person_id(NEW.person_name);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_person_id_on_insert ON public.people_hours;
CREATE TRIGGER set_person_id_on_insert BEFORE INSERT ON public.people_hours
  FOR EACH ROW EXECUTE FUNCTION public.pay_tables_set_person_id();
DROP TRIGGER IF EXISTS set_person_id_on_insert ON public.people_pay_config;
CREATE TRIGGER set_person_id_on_insert BEFORE INSERT ON public.people_pay_config
  FOR EACH ROW EXECUTE FUNCTION public.pay_tables_set_person_id();
DROP TRIGGER IF EXISTS set_person_id_on_insert ON public.people_crew_jobs;
CREATE TRIGGER set_person_id_on_insert BEFORE INSERT ON public.people_crew_jobs
  FOR EACH ROW EXECUTE FUNCTION public.pay_tables_set_person_id();
DROP TRIGGER IF EXISTS set_person_id_on_insert ON public.pay_stubs;
CREATE TRIGGER set_person_id_on_insert BEFORE INSERT ON public.pay_stubs
  FOR EACH ROW EXECUTE FUNCTION public.pay_tables_set_person_id();
DROP TRIGGER IF EXISTS set_person_id_on_insert ON public.people_team_members;
CREATE TRIGGER set_person_id_on_insert BEFORE INSERT ON public.people_team_members
  FOR EACH ROW EXECUTE FUNCTION public.pay_tables_set_person_id();
