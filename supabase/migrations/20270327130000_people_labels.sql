-- Master-scoped label catalog and people_labels junction; FK integrity trigger; RLS aligned with people roster scope.

-- ============================================================================
-- Helper functions (used by labels / people_labels RLS)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.user_can_read_labels_for_master(p_master_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    public.is_dev()
    OR (
      p_master_user_id = auth.uid()
      AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'master_technician')
    )
    OR EXISTS (
      SELECT 1 FROM public.master_assistants
      WHERE master_id = p_master_user_id AND assistant_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.master_shares
      WHERE sharing_master_id = p_master_user_id AND viewing_master_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.master_assistants ma
      INNER JOIN public.master_shares ms ON ms.viewing_master_id = ma.master_id
      WHERE ma.assistant_id = auth.uid()
        AND ms.sharing_master_id = p_master_user_id
    )
    OR (
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superintendent')
      AND EXISTS (
        SELECT 1 FROM public.master_superintendents
        WHERE master_id = p_master_user_id AND superintendent_id = auth.uid()
      )
    );
$$;

COMMENT ON FUNCTION public.user_can_read_labels_for_master(uuid) IS
  'True if current user may read label catalog rows for this master (dev, own master, assistant, master_shares, superintendent adoption). Estimator/primary/subcontractor: false.';

CREATE OR REPLACE FUNCTION public.user_can_write_labels_for_master(p_master_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    public.is_dev()
    OR (
      p_master_user_id = auth.uid()
      AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'master_technician')
    )
    OR EXISTS (
      SELECT 1 FROM public.master_assistants
      WHERE master_id = p_master_user_id AND assistant_id = auth.uid()
    );
$$;

COMMENT ON FUNCTION public.user_can_write_labels_for_master(uuid) IS
  'True if current user may create/update/delete labels and assign people_labels for this master (dev, roster owner master, assistant). Shared-viewing masters are read-only for catalog writes.';

-- ============================================================================
-- labels
-- ============================================================================

CREATE TABLE public.labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT labels_master_slug_unique UNIQUE (master_user_id, slug)
);

CREATE INDEX idx_labels_master_user_id ON public.labels(master_user_id);

COMMENT ON TABLE public.labels IS 'Per-master catalog of roster labels (e.g. peer review cohorts). slug is stable for filters; unique per master.';

ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "labels_select_scope"
ON public.labels
FOR SELECT
TO authenticated
USING (public.user_can_read_labels_for_master(master_user_id));

CREATE POLICY "labels_insert_scope"
ON public.labels
FOR INSERT
TO authenticated
WITH CHECK (public.user_can_write_labels_for_master(master_user_id));

CREATE POLICY "labels_update_scope"
ON public.labels
FOR UPDATE
TO authenticated
USING (public.user_can_write_labels_for_master(master_user_id))
WITH CHECK (public.user_can_write_labels_for_master(master_user_id));

CREATE POLICY "labels_delete_scope"
ON public.labels
FOR DELETE
TO authenticated
USING (public.user_can_write_labels_for_master(master_user_id));

-- ============================================================================
-- people_labels
-- ============================================================================

CREATE TABLE public.people_labels (
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  label_id uuid NOT NULL REFERENCES public.labels(id) ON DELETE CASCADE,
  PRIMARY KEY (person_id, label_id)
);

CREATE INDEX idx_people_labels_label_id ON public.people_labels(label_id);
CREATE INDEX idx_people_labels_person_id ON public.people_labels(person_id);

COMMENT ON TABLE public.people_labels IS 'Many-to-many: roster people and master-scoped labels. Enforced: person and label share the same master_user_id.';

-- Integrity: label.master must equal people.master (trigger catches invalid pairs)
CREATE OR REPLACE FUNCTION public.enforce_people_labels_same_master()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  p_master uuid;
  l_master uuid;
BEGIN
  SELECT master_user_id INTO p_master FROM public.people WHERE id = NEW.person_id;
  SELECT master_user_id INTO l_master FROM public.labels WHERE id = NEW.label_id;
  IF p_master IS NULL THEN
    RAISE EXCEPTION 'people_labels: person not found for person_id %', NEW.person_id;
  END IF;
  IF l_master IS NULL THEN
    RAISE EXCEPTION 'people_labels: label not found for label_id %', NEW.label_id;
  END IF;
  IF p_master IS DISTINCT FROM l_master THEN
    RAISE EXCEPTION 'people_labels: person and label must belong to the same master';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_people_labels_same_master_trigger
  BEFORE INSERT OR UPDATE ON public.people_labels
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_people_labels_same_master();

ALTER TABLE public.people_labels ENABLE ROW LEVEL SECURITY;

-- SELECT: visible when both joined rows pass their table RLS (same master enforced by trigger)
CREATE POLICY "people_labels_select_join"
ON public.people_labels
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.labels l
    INNER JOIN public.people p ON p.id = people_labels.person_id
    WHERE l.id = people_labels.label_id
  )
);

-- INSERT/DELETE: require catalog write for the label master; join ensures person is visible and same master
CREATE POLICY "people_labels_insert_scope"
ON public.people_labels
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.labels l
    INNER JOIN public.people p ON p.id = people_labels.person_id
    WHERE l.id = people_labels.label_id
      AND public.user_can_write_labels_for_master(l.master_user_id)
  )
);

CREATE POLICY "people_labels_delete_scope"
ON public.people_labels
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.labels l
    INNER JOIN public.people p ON p.id = people_labels.person_id
    WHERE l.id = people_labels.label_id
      AND public.user_can_write_labels_for_master(l.master_user_id)
  )
);

CREATE POLICY "people_labels_update_scope"
ON public.people_labels
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.labels l
    INNER JOIN public.people p ON p.id = people_labels.person_id
    WHERE l.id = people_labels.label_id
      AND public.user_can_write_labels_for_master(l.master_user_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.labels l
    INNER JOIN public.people p ON p.id = people_labels.person_id
    WHERE l.id = people_labels.label_id
      AND public.user_can_write_labels_for_master(l.master_user_id)
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.labels TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.people_labels TO authenticated;
