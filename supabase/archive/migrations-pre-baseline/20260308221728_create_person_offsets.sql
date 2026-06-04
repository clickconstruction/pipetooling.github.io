-- Person offsets: backcharges and damages per person
-- Pending: pay_stub_id null (shows on pay report for visibility)
-- Applied: pay_stub_id set (deducted from that pay stub)
-- Same RLS as pay_stubs

CREATE TABLE IF NOT EXISTS public.person_offsets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('backcharge', 'damage')),
  amount NUMERIC(10, 2) NOT NULL,
  description TEXT,
  occurred_date DATE NOT NULL,
  pay_stub_id UUID REFERENCES public.pay_stubs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_person_offsets_person_name ON public.person_offsets(person_name);
CREATE INDEX IF NOT EXISTS idx_person_offsets_pay_stub_id ON public.person_offsets(pay_stub_id);
CREATE INDEX IF NOT EXISTS idx_person_offsets_occurred_date ON public.person_offsets(occurred_date DESC);

COMMENT ON TABLE public.person_offsets IS 'Backcharges and damages per person. Pending (pay_stub_id null) or Applied (linked to pay stub). Same access as pay_stubs.';

ALTER TABLE public.person_offsets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pay access users can manage person offsets"
ON public.person_offsets FOR ALL
USING (
  public.is_dev()
  OR public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
)
WITH CHECK (
  public.is_dev()
  OR public.is_pay_approved_master()
  OR public.is_assistant_of_pay_approved_master()
  OR public.is_assistant()
);;
