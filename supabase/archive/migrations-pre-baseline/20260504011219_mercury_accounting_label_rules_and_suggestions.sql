-- Banking Mercury Accounting tab: auto-label rules and pending approval queue.

CREATE TABLE public.mercury_accounting_label_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (
    char_length(trim(name)) >= 1
    AND char_length(name) <= 200
  ),
  label_id uuid NOT NULL REFERENCES public.mercury_drag_sort_labels (id) ON DELETE RESTRICT,
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  criteria jsonb NOT NULL DEFAULT '{"v": 1}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.users (id) ON DELETE SET NULL
);

CREATE INDEX mercury_accounting_label_rules_enabled_sort_idx
  ON public.mercury_accounting_label_rules (enabled, sort_order ASC, id ASC);

CREATE INDEX mercury_accounting_label_rules_label_id_idx
  ON public.mercury_accounting_label_rules (label_id);

COMMENT ON TABLE public.mercury_accounting_label_rules IS
  'Org-wide rules for suggesting mercury_drag_sort_labels (Banking Accounting tab).';

CREATE TRIGGER mercury_accounting_label_rules_updated_at_trg
  BEFORE UPDATE ON public.mercury_accounting_label_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.mercury_accounting_label_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mercury_transaction_id uuid NOT NULL REFERENCES public.mercury_transactions (id) ON DELETE CASCADE,
  rule_id uuid NOT NULL REFERENCES public.mercury_accounting_label_rules (id) ON DELETE CASCADE,
  suggested_label_id uuid NOT NULL REFERENCES public.mercury_drag_sort_labels (id) ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  final_label_id uuid REFERENCES public.mercury_drag_sort_labels (id) ON DELETE SET NULL,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX mercury_accounting_label_suggestions_one_pending_per_tx_uidx
  ON public.mercury_accounting_label_suggestions (mercury_transaction_id)
  WHERE status = 'pending';

CREATE INDEX mercury_accounting_label_suggestions_status_idx
  ON public.mercury_accounting_label_suggestions (status);

CREATE INDEX mercury_accounting_label_suggestions_rule_id_idx
  ON public.mercury_accounting_label_suggestions (rule_id);

CREATE INDEX mercury_accounting_label_suggestions_mercury_tx_idx
  ON public.mercury_accounting_label_suggestions (mercury_transaction_id);

COMMENT ON TABLE public.mercury_accounting_label_suggestions IS
  'Rule-suggested accounting labels pending approval (Banking Accounting tab).';

ALTER TABLE public.mercury_accounting_label_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mercury_accounting_label_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mercury_accounting_label_rules banking staff select"
  ON public.mercury_accounting_label_rules
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  );

CREATE POLICY "mercury_accounting_label_rules banking staff insert"
  ON public.mercury_accounting_label_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  );

CREATE POLICY "mercury_accounting_label_rules banking staff update"
  ON public.mercury_accounting_label_rules
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

CREATE POLICY "mercury_accounting_label_rules banking staff delete"
  ON public.mercury_accounting_label_rules
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  );

CREATE POLICY "mercury_accounting_label_suggestions banking staff select"
  ON public.mercury_accounting_label_suggestions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  );

CREATE POLICY "mercury_accounting_label_suggestions banking staff insert"
  ON public.mercury_accounting_label_suggestions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  );

CREATE POLICY "mercury_accounting_label_suggestions banking staff update"
  ON public.mercury_accounting_label_suggestions
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

CREATE POLICY "mercury_accounting_label_suggestions banking staff delete"
  ON public.mercury_accounting_label_suggestions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant')
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mercury_accounting_label_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mercury_accounting_label_suggestions TO authenticated;
GRANT ALL ON public.mercury_accounting_label_rules TO service_role;
GRANT ALL ON public.mercury_accounting_label_suggestions TO service_role;
