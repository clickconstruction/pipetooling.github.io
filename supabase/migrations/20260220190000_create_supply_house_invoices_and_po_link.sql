-- Create supply_house_invoices table and add supply_house_id to purchase_orders
-- For Supply Houses tab: invoice tracking, PO management per supply house

-- ============================================================================
-- supply_house_invoices
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.supply_house_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supply_house_id UUID NOT NULL REFERENCES public.supply_houses(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  link TEXT,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supply_house_invoices_supply_house_id ON public.supply_house_invoices(supply_house_id);
CREATE INDEX IF NOT EXISTS idx_supply_house_invoices_is_paid ON public.supply_house_invoices(is_paid);
CREATE INDEX IF NOT EXISTS idx_supply_house_invoices_due_date ON public.supply_house_invoices(due_date);

ALTER TABLE public.supply_house_invoices ENABLE ROW LEVEL SECURITY;

-- RLS: dev, master_technician, assistant only (no estimator - Supply Houses tab hidden from estimators)
CREATE POLICY "Devs, masters, assistants can read supply house invoices"
ON public.supply_house_invoices
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

CREATE POLICY "Devs, masters, assistants can insert supply house invoices"
ON public.supply_house_invoices
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

CREATE POLICY "Devs, masters, assistants can update supply house invoices"
ON public.supply_house_invoices
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

CREATE POLICY "Devs, masters, assistants can delete supply house invoices"
ON public.supply_house_invoices
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('dev', 'master_technician', 'assistant')
  )
);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_supply_house_invoices_updated_at ON public.supply_house_invoices;
CREATE TRIGGER update_supply_house_invoices_updated_at
  BEFORE UPDATE ON public.supply_house_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.supply_house_invoices IS 'Invoices from supply houses. Unpaid invoices contribute to outstanding total. Paid invoices excluded.';

-- ============================================================================
-- purchase_orders: add supply_house_id
-- ============================================================================

ALTER TABLE public.purchase_orders
ADD COLUMN IF NOT EXISTS supply_house_id UUID REFERENCES public.supply_houses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_orders_supply_house_id ON public.purchase_orders(supply_house_id);

COMMENT ON COLUMN public.purchase_orders.supply_house_id IS 'Supply house this PO is for. Set when creating PO from Supply Houses tab.';
