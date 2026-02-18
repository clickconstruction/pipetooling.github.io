-- Create customer_contacts table for logging outreach not tied to bids (Builder Review tab)

CREATE TABLE public.customer_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  contact_date timestamptz NOT NULL,
  details text,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_customer_contacts_customer_id ON public.customer_contacts(customer_id);
CREATE INDEX idx_customer_contacts_contact_date ON public.customer_contacts(contact_date);

ALTER TABLE public.customer_contacts ENABLE ROW LEVEL SECURITY;

-- RLS: Same pattern as customers - devs, masters, assistants, estimators can access
-- rows for customers they can access (ownership, adoption, sharing)

CREATE POLICY "Devs, masters, assistants, and estimators can read customer contacts"
ON public.customer_contacts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = customer_contacts.customer_id
    AND (
      c.master_user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'master_technician')
      )
      OR EXISTS (
        SELECT 1 FROM public.master_assistants
        WHERE master_id = c.master_user_id
        AND assistant_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.master_shares
        WHERE sharing_master_id = c.master_user_id
        AND viewing_master_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role = 'estimator'
      )
    )
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can insert customer contacts"
ON public.customer_contacts
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = customer_contacts.customer_id
    AND (
      c.master_user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'master_technician')
      )
      OR EXISTS (
        SELECT 1 FROM public.master_assistants
        WHERE master_id = c.master_user_id
        AND assistant_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.master_shares
        WHERE sharing_master_id = c.master_user_id
        AND viewing_master_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role = 'estimator'
      )
    )
  )
  AND created_by = auth.uid()
);

CREATE POLICY "Devs, masters, assistants, and estimators can update customer contacts"
ON public.customer_contacts
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = customer_contacts.customer_id
    AND (
      c.master_user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'master_technician')
      )
      OR EXISTS (
        SELECT 1 FROM public.master_assistants
        WHERE master_id = c.master_user_id
        AND assistant_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.master_shares
        WHERE sharing_master_id = c.master_user_id
        AND viewing_master_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role = 'estimator'
      )
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
);

CREATE POLICY "Devs, masters, assistants, and estimators can delete customer contacts"
ON public.customer_contacts
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = customer_contacts.customer_id
    AND (
      c.master_user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('dev', 'master_technician')
      )
      OR EXISTS (
        SELECT 1 FROM public.master_assistants
        WHERE master_id = c.master_user_id
        AND assistant_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.master_shares
        WHERE sharing_master_id = c.master_user_id
        AND viewing_master_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role = 'estimator'
      )
    )
  )
);
