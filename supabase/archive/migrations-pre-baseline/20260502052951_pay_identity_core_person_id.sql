-- Canonical pay identity (Phase 1): people.id on core pay tables + optional account link on people.
-- people_pay_config / people_hours get person_id (FK) with denormalized person_name kept for transition.

-- Link roster rows to at most one app login (clock / RPC resolution).
ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS account_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS people_account_user_id_uniq
  ON public.people (account_user_id)
  WHERE account_user_id IS NOT NULL;

COMMENT ON COLUMN public.people.account_user_id IS
  'Optional: app user (users.id) for this roster row. Used to resolve clock_sessions.user_id → people.id for pay/crew.';

-- Backfill account link where people.email uniquely matches users.email (case-insensitive trim).
WITH pick AS (
  SELECT DISTINCT ON (p.id)
    p.id AS people_id,
    u.id AS user_id
  FROM public.people p
  JOIN public.users u
    ON p.archived_at IS NULL
   AND p.email IS NOT NULL
   AND btrim(lower(u.email)) = btrim(lower(p.email))
  ORDER BY p.id, u.id
)
UPDATE public.people p
SET account_user_id = pick.user_id
FROM pick
WHERE p.id = pick.people_id
  AND p.account_user_id IS NULL;

ALTER TABLE public.people_pay_config
  ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES public.people(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_people_pay_config_person_id ON public.people_pay_config (person_id);

COMMENT ON COLUMN public.people_pay_config.person_id IS
  'Canonical roster key; person_name is denormalized display until legacy removal.';

-- Unique person_id when set (one pay config row per roster person).
CREATE UNIQUE INDEX IF NOT EXISTS people_pay_config_person_id_uniq
  ON public.people_pay_config (person_id)
  WHERE person_id IS NOT NULL;

-- Backfill: only when exactly one active people row matches trimmed name.
UPDATE public.people_pay_config ppc
SET person_id = s.pid
FROM (
  SELECT btrim(ppc2.person_name) AS nk, (array_agg(p.id ORDER BY p.id))[1] AS pid
  FROM public.people_pay_config ppc2
  JOIN public.people p
    ON p.archived_at IS NULL
   AND btrim(p.name) = btrim(ppc2.person_name)
  GROUP BY btrim(ppc2.person_name)
  HAVING COUNT(DISTINCT p.id) = 1
) s
WHERE btrim(ppc.person_name) = s.nk;

ALTER TABLE public.people_hours
  ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES public.people(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_people_hours_person_id ON public.people_hours (person_id);

COMMENT ON COLUMN public.people_hours.person_id IS
  'Canonical roster key; person_name is denormalized display until legacy removal.';

UPDATE public.people_hours ph
SET person_id = s.pid
FROM (
  SELECT btrim(ph2.person_name) AS nk, (array_agg(p.id ORDER BY p.id))[1] AS pid
  FROM public.people_hours ph2
  JOIN public.people p
    ON p.archived_at IS NULL
   AND btrim(p.name) = btrim(ph2.person_name)
  GROUP BY btrim(ph2.person_name)
  HAVING COUNT(DISTINCT p.id) = 1
) s
WHERE btrim(ph.person_name) = s.nk
  AND ph.person_id IS NULL;

-- Merge duplicate rows that share the same (person_id, work_date) after backfill.
WITH agg AS (
  SELECT
    person_id,
    work_date,
    SUM(hours) AS total_hours,
    (array_agg(id ORDER BY id))[1] AS keep_id
  FROM public.people_hours
  WHERE person_id IS NOT NULL
  GROUP BY person_id, work_date
  HAVING COUNT(*) > 1
)
UPDATE public.people_hours ph
SET hours = agg.total_hours
FROM agg
WHERE ph.id = agg.keep_id;

DELETE FROM public.people_hours ph
USING (
  SELECT person_id, work_date, (array_agg(id ORDER BY id))[1] AS keep_id
  FROM public.people_hours
  WHERE person_id IS NOT NULL
  GROUP BY person_id, work_date
  HAVING COUNT(*) > 1
) d
WHERE ph.person_id = d.person_id
  AND ph.work_date = d.work_date
  AND ph.id <> d.keep_id;

CREATE UNIQUE INDEX IF NOT EXISTS people_hours_person_id_work_date_uniq
  ON public.people_hours (person_id, work_date)
  WHERE person_id IS NOT NULL;

-- When roster display name changes, keep denormalized pay strings aligned for legacy readers.
CREATE OR REPLACE FUNCTION public.sync_denormalized_pay_names_from_people()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.name IS DISTINCT FROM OLD.name THEN
    UPDATE public.people_pay_config
    SET person_name = btrim(NEW.name)
    WHERE person_id = NEW.id;

    UPDATE public.people_hours
    SET person_name = btrim(NEW.name)
    WHERE person_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS people_pay_names_sync ON public.people;
CREATE TRIGGER people_pay_names_sync
  AFTER UPDATE OF name ON public.people
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_denormalized_pay_names_from_people();

-- Self-read pay config: prefer roster link; keep name match for unmigrated rows.
DROP POLICY IF EXISTS "Users can read own people pay config row" ON public.people_pay_config;

CREATE POLICY "Users can read own people pay config row"
ON public.people_pay_config
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.people p
    WHERE p.id = people_pay_config.person_id
      AND p.account_user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND btrim(u.name) = btrim(people_pay_config.person_name)
  )
);

COMMENT ON POLICY "Users can read own people pay config row" ON public.people_pay_config IS
  'Self-service salary schedule read: people.account_user_id = auth.uid() or legacy users.name = person_name.';
