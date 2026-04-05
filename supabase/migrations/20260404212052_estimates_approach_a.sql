-- Customer-facing Estimates (Approach A): internal drafts + public token accept (Edge Functions).
-- Anonymous clients do not get RLS; Edge uses service role.

CREATE TYPE public.estimate_status AS ENUM (
  'draft',
  'sent',
  'customer_accepted',
  'declined',
  'superseded'
);

COMMENT ON TYPE public.estimate_status IS
  'Estimate workflow: draft, sent (awaiting customer), customer_accepted, declined, superseded.';

CREATE TABLE public.estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  master_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  customer_id uuid REFERENCES public.customers (id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects (id) ON DELETE SET NULL,
  job_ledger_id uuid REFERENCES public.jobs_ledger (id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '',
  line_items_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  terms_snapshot text NOT NULL DEFAULT '',
  total_cents integer NOT NULL DEFAULT 0 CHECK (total_cents >= 0),
  valid_until date,
  status public.estimate_status NOT NULL DEFAULT 'draft',
  sent_at timestamptz,
  customer_email text,
  public_token_hash text,
  public_token_expires_at timestamptz,
  acceptor_printed_name text,
  acceptor_consented_at timestamptz,
  acceptor_ip text,
  acceptor_user_agent text,
  internal_notes text,
  CONSTRAINT estimates_sent_requires_token CHECK (
    status <> 'sent' OR public_token_hash IS NOT NULL
  )
);

CREATE UNIQUE INDEX estimates_public_token_hash_unique
  ON public.estimates (public_token_hash)
  WHERE public_token_hash IS NOT NULL;

CREATE INDEX estimates_master_status_updated
  ON public.estimates (master_user_id, status, updated_at DESC);

COMMENT ON TABLE public.estimates IS
  'Simple customer estimates with optional public accept link (token hash); Edge Functions set sent/accepted.';

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.estimates_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER estimates_updated_at
BEFORE UPDATE ON public.estimates
FOR EACH ROW
EXECUTE FUNCTION public.estimates_set_updated_at();

-- ---------------------------------------------------------------------------
-- After customer_accepted, only job_ledger_id and internal_notes may change
-- (via trigger column-level guard)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.estimates_protect_after_accept()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'customer_accepted' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
      OR NEW.master_user_id IS DISTINCT FROM OLD.master_user_id
      OR NEW.created_by IS DISTINCT FROM OLD.created_by
      OR NEW.customer_id IS DISTINCT FROM OLD.customer_id
      OR NEW.project_id IS DISTINCT FROM OLD.project_id
      OR NEW.title IS DISTINCT FROM OLD.title
      OR NEW.line_items_snapshot IS DISTINCT FROM OLD.line_items_snapshot
      OR NEW.terms_snapshot IS DISTINCT FROM OLD.terms_snapshot
      OR NEW.total_cents IS DISTINCT FROM OLD.total_cents
      OR NEW.valid_until IS DISTINCT FROM OLD.valid_until
      OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.sent_at IS DISTINCT FROM OLD.sent_at
      OR NEW.customer_email IS DISTINCT FROM OLD.customer_email
      OR NEW.public_token_hash IS DISTINCT FROM OLD.public_token_hash
      OR NEW.public_token_expires_at IS DISTINCT FROM OLD.public_token_expires_at
      OR NEW.acceptor_printed_name IS DISTINCT FROM OLD.acceptor_printed_name
      OR NEW.acceptor_consented_at IS DISTINCT FROM OLD.acceptor_consented_at
      OR NEW.acceptor_ip IS DISTINCT FROM OLD.acceptor_ip
      OR NEW.acceptor_user_agent IS DISTINCT FROM OLD.acceptor_user_agent
    THEN
      RAISE EXCEPTION 'estimate is accepted; only job_ledger_id and internal_notes can change';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER estimates_protect_after_accept_trigger
BEFORE UPDATE ON public.estimates
FOR EACH ROW
EXECUTE FUNCTION public.estimates_protect_after_accept();

-- ---------------------------------------------------------------------------
-- Access helper (aligns with jobs_ledger + bids breadth for staff roles)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_can_access_estimate(e public.estimates)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_dev()
    OR e.created_by = auth.uid()
    OR e.master_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
    OR (
      e.project_id IS NOT NULL
      AND public.can_access_project_row(e.project_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.master_assistants
      WHERE master_id = auth.uid()
      AND assistant_id = e.master_user_id
    )
    OR EXISTS (
      SELECT 1 FROM public.master_assistants
      WHERE master_id = e.master_user_id
      AND assistant_id = auth.uid()
    )
    OR public.assistants_share_master(auth.uid(), e.master_user_id);
$$;

COMMENT ON FUNCTION public.user_can_access_estimate(public.estimates) IS
  'RLS: dev, owner master, creator, primary-all, project superintendent, assistant/adoption.';

CREATE OR REPLACE FUNCTION public.superintendent_can_access_estimate(e public.estimates)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superintendent')
    AND e.project_id IS NOT NULL
    AND public.can_access_project_row(e.project_id);
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estimates_select"
ON public.estimates
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN (
      'dev',
      'master_technician',
      'assistant',
      'estimator',
      'primary',
      'superintendent'
    )
  )
  AND (
    public.user_can_access_estimate(estimates)
    OR public.superintendent_can_access_estimate(estimates)
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN (
        'dev',
        'assistant',
        'estimator',
        'master_technician',
        'primary'
      )
    )
  )
);

CREATE POLICY "estimates_insert"
ON public.estimates
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN (
      'dev',
      'master_technician',
      'assistant',
      'estimator',
      'primary',
      'superintendent'
    )
  )
  AND created_by = auth.uid()
  AND (
    public.is_dev()
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
    OR estimates.master_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.master_assistants
      WHERE master_id = estimates.master_user_id
      AND assistant_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'estimator'
    )
    OR public.superintendent_can_access_estimate(estimates)
  )
);

-- Clients may edit only drafts; transitions to sent / accepted use Edge + service role.
CREATE POLICY "estimates_update_draft"
ON public.estimates
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN (
      'dev',
      'master_technician',
      'assistant',
      'estimator',
      'primary',
      'superintendent'
    )
  )
  AND estimates.status = 'draft'
  AND (
    public.user_can_access_estimate(estimates)
    OR public.superintendent_can_access_estimate(estimates)
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN (
        'dev',
        'assistant',
        'estimator',
        'master_technician',
        'primary'
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN (
      'dev',
      'master_technician',
      'assistant',
      'estimator',
      'primary',
      'superintendent'
    )
  )
  AND estimates.status = 'draft'
);

CREATE POLICY "final_estimates_update_accepted_link_job"
ON public.estimates
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN (
      'dev',
      'master_technician',
      'assistant',
      'estimator',
      'primary',
      'superintendent'
    )
  )
  AND estimates.status = 'customer_accepted'
  AND (
    public.user_can_access_estimate(estimates)
    OR public.superintendent_can_access_estimate(estimates)
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN (
        'dev',
        'assistant',
        'estimator',
        'master_technician',
        'primary'
      )
    )
  )
)
WITH CHECK (
  estimates.status = 'customer_accepted'
);

CREATE POLICY "estimates_delete_draft"
ON public.estimates
FOR DELETE
TO authenticated
USING (
  estimates.status = 'draft'
  AND (
    public.is_dev()
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'primary')
    OR public.user_can_access_estimate(estimates)
    OR public.superintendent_can_access_estimate(estimates)
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('dev', 'assistant', 'estimator', 'master_technician', 'primary')
    )
  )
);
