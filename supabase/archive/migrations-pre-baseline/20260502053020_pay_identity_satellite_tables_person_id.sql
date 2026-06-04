-- Satellite pay/hours tables: person_id FK + backfill; keep person_name for transition.

ALTER TABLE public.people_cost_matrix_tags
  ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES public.people(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS people_cost_matrix_tags_person_id_uniq
  ON public.people_cost_matrix_tags (person_id)
  WHERE person_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_people_cost_matrix_tags_person_id ON public.people_cost_matrix_tags (person_id);

UPDATE public.people_cost_matrix_tags t
SET person_id = s.pid
FROM (
  SELECT btrim(t2.person_name) AS nk, (array_agg(p.id ORDER BY p.id))[1] AS pid
  FROM public.people_cost_matrix_tags t2
  JOIN public.people p
    ON p.archived_at IS NULL
   AND btrim(p.name) = btrim(t2.person_name)
  GROUP BY btrim(t2.person_name)
  HAVING COUNT(DISTINCT p.id) = 1
) s
WHERE btrim(t.person_name) = s.nk
  AND t.person_id IS NULL;

ALTER TABLE public.people_hours_display_order
  ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES public.people(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS people_hours_display_order_person_id_uniq
  ON public.people_hours_display_order (person_id)
  WHERE person_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_people_hours_display_order_person_id ON public.people_hours_display_order (person_id);

UPDATE public.people_hours_display_order t
SET person_id = s.pid
FROM (
  SELECT btrim(t2.person_name) AS nk, (array_agg(p.id ORDER BY p.id))[1] AS pid
  FROM public.people_hours_display_order t2
  JOIN public.people p
    ON p.archived_at IS NULL
   AND btrim(p.name) = btrim(t2.person_name)
  GROUP BY btrim(t2.person_name)
  HAVING COUNT(DISTINCT p.id) = 1
) s
WHERE btrim(t.person_name) = s.nk
  AND t.person_id IS NULL;

ALTER TABLE public.hours_reviewed
  ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES public.people(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS hours_reviewed_person_id_start_uniq
  ON public.hours_reviewed (person_id, start_date)
  WHERE person_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_hours_reviewed_person_id ON public.hours_reviewed (person_id);

UPDATE public.hours_reviewed t
SET person_id = s.pid
FROM (
  SELECT btrim(t2.person_name) AS nk, (array_agg(p.id ORDER BY p.id))[1] AS pid
  FROM public.hours_reviewed t2
  JOIN public.people p
    ON p.archived_at IS NULL
   AND btrim(p.name) = btrim(t2.person_name)
  GROUP BY btrim(t2.person_name)
  HAVING COUNT(DISTINCT p.id) = 1
) s
WHERE btrim(t.person_name) = s.nk
  AND t.person_id IS NULL;

ALTER TABLE public.person_offsets
  ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES public.people(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_person_offsets_person_id ON public.person_offsets (person_id);

UPDATE public.person_offsets t
SET person_id = s.pid
FROM (
  SELECT btrim(t2.person_name) AS nk, (array_agg(p.id ORDER BY p.id))[1] AS pid
  FROM public.person_offsets t2
  JOIN public.people p
    ON p.archived_at IS NULL
   AND btrim(p.name) = btrim(t2.person_name)
  GROUP BY btrim(t2.person_name)
  HAVING COUNT(DISTINCT p.id) = 1
) s
WHERE btrim(t.person_name) = s.nk
  AND t.person_id IS NULL;

ALTER TABLE public.people_team_members
  ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES public.people(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS people_team_members_team_person_id_uniq
  ON public.people_team_members (team_id, person_id)
  WHERE person_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_people_team_members_person_id ON public.people_team_members (person_id);

UPDATE public.people_team_members t
SET person_id = s.pid
FROM (
  SELECT btrim(t2.person_name) AS nk, (array_agg(p.id ORDER BY p.id))[1] AS pid
  FROM public.people_team_members t2
  JOIN public.people p
    ON p.archived_at IS NULL
   AND btrim(p.name) = btrim(t2.person_name)
  GROUP BY btrim(t2.person_name)
  HAVING COUNT(DISTINCT p.id) = 1
) s
WHERE btrim(t.person_name) = s.nk
  AND t.person_id IS NULL;

ALTER TABLE public.pay_stubs
  ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES public.people(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pay_stubs_person_id ON public.pay_stubs (person_id);

UPDATE public.pay_stubs t
SET person_id = s.pid
FROM (
  SELECT btrim(t2.person_name) AS nk, (array_agg(p.id ORDER BY p.id))[1] AS pid
  FROM public.pay_stubs t2
  JOIN public.people p
    ON p.archived_at IS NULL
   AND btrim(p.name) = btrim(t2.person_name)
  GROUP BY btrim(t2.person_name)
  HAVING COUNT(DISTINCT p.id) = 1
) s
WHERE btrim(t.person_name) = s.nk
  AND t.person_id IS NULL;

ALTER TABLE public.pay_stub_days
  ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES public.people(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pay_stub_days_person_id ON public.pay_stub_days (person_id);

UPDATE public.pay_stub_days t
SET person_id = s.pid
FROM (
  SELECT btrim(t2.person_name) AS nk, (array_agg(p.id ORDER BY p.id))[1] AS pid
  FROM public.pay_stub_days t2
  JOIN public.people p
    ON p.archived_at IS NULL
   AND btrim(p.name) = btrim(t2.person_name)
  GROUP BY btrim(t2.person_name)
  HAVING COUNT(DISTINCT p.id) = 1
) s
WHERE btrim(t.person_name) = s.nk
  AND t.person_id IS NULL;

COMMENT ON COLUMN public.pay_stubs.person_id IS
  'Canonical roster person for this stub; person_name remains display snapshot.';

COMMENT ON COLUMN public.pay_stub_days.person_id IS
  'Canonical roster person for this stub day; person_name remains display snapshot.';
