-- Create customer_contact_persons table for employee/contact cards at each customer (Builder Review)

CREATE TABLE public.customer_contact_persons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  email text,
  note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_customer_contact_persons_customer_id ON public.customer_contact_persons(customer_id);

CREATE TRIGGER update_customer_contact_persons_updated_at
  BEFORE UPDATE ON public.customer_contact_persons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.customer_contact_persons ENABLE ROW LEVEL SECURITY;

-- RLS: Same pattern as customer_contacts - devs, masters, assistants, estimators can access
-- rows for customers they can access (ownership, adoption, sharing)

CREATE POLICY "Devs, masters, assistants, and estimators can read customer contact persons"
ON public.customer_contact_persons
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = customer_contact_persons.customer_id
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

CREATE POLICY "Devs, masters, assistants, and estimators can insert customer contact persons"
ON public.customer_contact_persons
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = customer_contact_persons.customer_id
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

CREATE POLICY "Devs, masters, assistants, and estimators can update customer contact persons"
ON public.customer_contact_persons
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = customer_contact_persons.customer_id
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

CREATE POLICY "Devs, masters, assistants, and estimators can delete customer contact persons"
ON public.customer_contact_persons
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant', 'estimator')
  )
  AND EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = customer_contact_persons.customer_id
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
