-- Drag Sort: org-wide Accounting Labels (shared catalog + one assignment per mercury_transaction).

-- 1) Drop RLS policies that reference user_id
DROP POLICY IF EXISTS "mercury_drag_sort_labels banking staff select" ON public.mercury_drag_sort_labels;
DROP POLICY IF EXISTS "mercury_drag_sort_labels banking staff insert" ON public.mercury_drag_sort_labels;
DROP POLICY IF EXISTS "mercury_drag_sort_labels banking staff update" ON public.mercury_drag_sort_labels;
DROP POLICY IF EXISTS "mercury_drag_sort_labels banking staff delete" ON public.mercury_drag_sort_labels;
DROP POLICY IF EXISTS "mercury_transaction_drag_sort_assignments banking staff select"
  ON public.mercury_transaction_drag_sort_assignments;
DROP POLICY IF EXISTS "mercury_transaction_drag_sort_assignments banking staff insert"
  ON public.mercury_transaction_drag_sort_assignments;
DROP POLICY IF EXISTS "mercury_transaction_drag_sort_assignments banking staff update"
  ON public.mercury_transaction_drag_sort_assignments;
DROP POLICY IF EXISTS "mercury_transaction_drag_sort_assignments banking staff delete"
  ON public.mercury_transaction_drag_sort_assignments;

-- 2) Map duplicate label rows to one survivor per default_key (built-ins) or lower(trim(name)) (custom)
CREATE TEMP TABLE _drag_sort_label_merge (
  old_id uuid PRIMARY KEY,
  survivor_id uuid NOT NULL
) ON COMMIT DROP;

INSERT INTO _drag_sort_label_merge (old_id, survivor_id)
SELECT l.id, s.survivor_id
FROM public.mercury_drag_sort_labels l
INNER JOIN (
  SELECT
    default_key,
    (array_agg(id ORDER BY created_at ASC, id ASC))[1] AS survivor_id
  FROM public.mercury_drag_sort_labels
  WHERE default_key IS NOT NULL
  GROUP BY default_key
) s ON l.default_key = s.default_key
  AND l.id IS DISTINCT FROM s.survivor_id;

INSERT INTO _drag_sort_label_merge (old_id, survivor_id)
SELECT l.id, s.survivor_id
FROM public.mercury_drag_sort_labels l
INNER JOIN (
  SELECT
    lower(trim(name)) AS nk,
    (array_agg(id ORDER BY created_at ASC, id ASC))[1] AS survivor_id
  FROM public.mercury_drag_sort_labels
  WHERE default_key IS NULL
  GROUP BY lower(trim(name))
) s ON lower(trim(l.name)) = s.nk
  AND l.id IS DISTINCT FROM s.survivor_id
ON CONFLICT (old_id) DO NOTHING;

UPDATE public.mercury_transaction_drag_sort_assignments a
SET label_id = m.survivor_id
FROM _drag_sort_label_merge m
WHERE a.label_id = m.old_id;

DELETE FROM public.mercury_drag_sort_labels l
WHERE EXISTS (
  SELECT 1 FROM _drag_sort_label_merge m WHERE m.old_id = l.id
);

-- 3) One assignment row per transaction (latest assigned_at wins; tie-break user_id DESC)
DELETE FROM public.mercury_transaction_drag_sort_assignments m
WHERE m.ctid IN (
  SELECT ctid
  FROM (
    SELECT
      ctid,
      row_number() OVER (
        PARTITION BY mercury_transaction_id
        ORDER BY assigned_at DESC, user_id DESC
      ) AS rn
    FROM public.mercury_transaction_drag_sort_assignments
  ) x
  WHERE rn > 1
);

-- 4) Indexes and keys: drop user-scoped indexes, change assignment PK, drop user_id columns
DROP INDEX IF EXISTS public.mercury_drag_sort_labels_user_default_key_uidx;
DROP INDEX IF EXISTS public.mercury_drag_sort_labels_user_sort_idx;
DROP INDEX IF EXISTS public.mercury_transaction_drag_sort_assignments_user_label_idx;
DROP INDEX IF EXISTS public.mercury_transaction_drag_sort_assignments_user_mercury_tx_idx;

ALTER TABLE public.mercury_transaction_drag_sort_assignments
  DROP CONSTRAINT mercury_transaction_drag_sort_assignments_pkey;

ALTER TABLE public.mercury_transaction_drag_sort_assignments
  DROP COLUMN user_id;

ALTER TABLE public.mercury_transaction_drag_sort_assignments
  ADD PRIMARY KEY (mercury_transaction_id);

ALTER TABLE public.mercury_drag_sort_labels
  DROP CONSTRAINT mercury_drag_sort_labels_user_id_fkey;

ALTER TABLE public.mercury_drag_sort_labels
  DROP COLUMN user_id;

CREATE UNIQUE INDEX mercury_drag_sort_labels_default_key_uidx
  ON public.mercury_drag_sort_labels (default_key)
  WHERE default_key IS NOT NULL;

CREATE INDEX mercury_drag_sort_labels_sort_order_idx
  ON public.mercury_drag_sort_labels (sort_order ASC, id ASC);

COMMENT ON TABLE public.mercury_drag_sort_labels IS
  'Org-wide labels for Banking Mercury Drag Sort tab.';

COMMENT ON TABLE public.mercury_transaction_drag_sort_assignments IS
  'At most one Drag Sort label per mercury_transaction (Banking staff only; org-wide).';

-- 5) Trigger: built-ins still immutable; user_id column removed
CREATE OR REPLACE FUNCTION public.mercury_drag_sort_labels_guard_system_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  IF OLD.is_system_default
     AND (
       NEW.name IS DISTINCT FROM OLD.name
       OR NEW.schedule_c_line IS DISTINCT FROM OLD.schedule_c_line
       OR NEW.description IS DISTINCT FROM OLD.description
       OR NEW.default_key IS DISTINCT FROM OLD.default_key
       OR NEW.is_system_default IS DISTINCT FROM OLD.is_system_default
     )
  THEN
    RAISE EXCEPTION 'Built-in Drag Sort labels cannot be edited'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$fn$;

-- 6) RLS: banking staff roles only (no per-row ownership)
CREATE POLICY "mercury_drag_sort_labels banking staff select"
  ON public.mercury_drag_sort_labels
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  );

CREATE POLICY "mercury_drag_sort_labels banking staff insert"
  ON public.mercury_drag_sort_labels
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  );

CREATE POLICY "mercury_drag_sort_labels banking staff update"
  ON public.mercury_drag_sort_labels
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  );

CREATE POLICY "mercury_drag_sort_labels banking staff delete"
  ON public.mercury_drag_sort_labels
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  );

CREATE POLICY "mercury_transaction_drag_sort_assignments banking staff select"
  ON public.mercury_transaction_drag_sort_assignments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  );

CREATE POLICY "mercury_transaction_drag_sort_assignments banking staff insert"
  ON public.mercury_transaction_drag_sort_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  );

CREATE POLICY "mercury_transaction_drag_sort_assignments banking staff update"
  ON public.mercury_transaction_drag_sort_assignments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  );

CREATE POLICY "mercury_transaction_drag_sort_assignments banking staff delete"
  ON public.mercury_transaction_drag_sort_assignments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  );
