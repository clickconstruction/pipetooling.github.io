-- Allow primary and superintendent on public.people (roster / pay parity with other kinds).
-- Backfill from master_primaries / master_superintendents where no matching people row exists.

ALTER TABLE public.people
DROP CONSTRAINT IF EXISTS people_kind_check;

ALTER TABLE public.people
ADD CONSTRAINT people_kind_check
CHECK (
  kind IN (
    'assistant',
    'master_technician',
    'sub',
    'dev',
    'estimator',
    'primary',
    'superintendent'
  )
);

COMMENT ON CONSTRAINT people_kind_check ON public.people IS
  'Roster kind; primary/superintendent align with users.role and master_primaries / master_superintendents.';

CREATE INDEX IF NOT EXISTS idx_people_master_user_id_kind
ON public.people (master_user_id, kind);

-- Backfill: one people row per adopted primary per master (skip if same master+kind+email or same master+kind+name when emails empty)
INSERT INTO public.people (master_user_id, kind, name, email, phone, notes)
SELECT
  mp.master_id,
  'primary'::text,
  COALESCE(NULLIF(trim(u.name), ''), split_part(u.email, '@', 1), 'Primary') AS name,
  NULLIF(trim(u.email), ''),
  u.phone,
  u.notes
FROM public.master_primaries mp
INNER JOIN public.users u ON u.id = mp.primary_id
WHERE u.archived_at IS NULL
  AND u.role = 'primary'
  AND NOT EXISTS (
    SELECT 1
    FROM public.people p
    WHERE p.master_user_id = mp.master_id
      AND p.kind = 'primary'
      AND p.archived_at IS NULL
      AND (
        (
          NULLIF(trim(u.email), '') IS NOT NULL
          AND p.email IS NOT NULL
          AND lower(trim(p.email)) = lower(trim(u.email))
        )
        OR (
          (NULLIF(trim(u.email), '') IS NULL OR p.email IS NULL)
          AND trim(lower(COALESCE(p.name, ''))) = trim(lower(COALESCE(u.name, split_part(u.email, '@', 1), '')))
        )
      )
  );

INSERT INTO public.people (master_user_id, kind, name, email, phone, notes)
SELECT
  ms.master_id,
  'superintendent'::text,
  COALESCE(NULLIF(trim(u.name), ''), split_part(u.email, '@', 1), 'Superintendent') AS name,
  NULLIF(trim(u.email), ''),
  u.phone,
  u.notes
FROM public.master_superintendents ms
INNER JOIN public.users u ON u.id = ms.superintendent_id
WHERE u.archived_at IS NULL
  AND u.role = 'superintendent'
  AND NOT EXISTS (
    SELECT 1
    FROM public.people p
    WHERE p.master_user_id = ms.master_id
      AND p.kind = 'superintendent'
      AND p.archived_at IS NULL
      AND (
        (
          NULLIF(trim(u.email), '') IS NOT NULL
          AND p.email IS NOT NULL
          AND lower(trim(p.email)) = lower(trim(u.email))
        )
        OR (
          (NULLIF(trim(u.email), '') IS NULL OR p.email IS NULL)
          AND trim(lower(COALESCE(p.name, ''))) = trim(lower(COALESCE(u.name, split_part(u.email, '@', 1), '')))
        )
      )
  );
