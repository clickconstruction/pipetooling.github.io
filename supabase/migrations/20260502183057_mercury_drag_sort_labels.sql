-- Banking Mercury "Drag Sort": per-user labels and transaction assignments (internal taxonomy only).

CREATE TABLE public.mercury_drag_sort_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  name text NOT NULL CHECK (
    char_length(trim(name)) >= 1
    AND char_length(name) <= 120
  ),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mercury_drag_sort_labels_user_sort_idx
  ON public.mercury_drag_sort_labels (user_id, sort_order ASC, id ASC);

COMMENT ON TABLE public.mercury_drag_sort_labels IS
  'User-defined labels for Banking Mercury Drag Sort tab; scoped per user_id.';

CREATE TABLE public.mercury_transaction_drag_sort_assignments (
  mercury_transaction_id uuid NOT NULL REFERENCES public.mercury_transactions (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  label_id uuid NOT NULL REFERENCES public.mercury_drag_sort_labels (id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (mercury_transaction_id, user_id)
);

CREATE INDEX mercury_transaction_drag_sort_assignments_user_label_idx
  ON public.mercury_transaction_drag_sort_assignments (user_id, label_id);

COMMENT ON TABLE public.mercury_transaction_drag_sort_assignments IS
  'At most one Drag Sort label per mercury_transaction per user (Banking staff only).';

-- RLS: same banking staff roles as mercury_transaction_attributions; row ownership via user_id = auth.uid().

ALTER TABLE public.mercury_drag_sort_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mercury_transaction_drag_sort_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mercury_drag_sort_labels banking staff select"
  ON public.mercury_drag_sort_labels
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
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
    user_id = auth.uid()
    AND EXISTS (
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
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
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
    user_id = auth.uid()
    AND EXISTS (
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
    user_id = auth.uid()
    AND EXISTS (
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
    user_id = auth.uid()
    AND EXISTS (
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
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
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
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mercury_drag_sort_labels TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mercury_transaction_drag_sort_assignments TO authenticated;
GRANT ALL ON public.mercury_drag_sort_labels TO service_role;
GRANT ALL ON public.mercury_transaction_drag_sort_assignments TO service_role;
