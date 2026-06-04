-- Employee credit: pending amount owed to the person (e.g. overpayment recorded as offset).
-- Applying to Net Pay on a pay stub is handled separately (Additional lines); pending rows use pay_stub_id null.

ALTER TABLE public.person_offsets DROP CONSTRAINT IF EXISTS person_offsets_type_check;

ALTER TABLE public.person_offsets
  ADD CONSTRAINT person_offsets_type_check
  CHECK (type IN ('backcharge', 'damage', 'employee_credit'));

COMMENT ON TABLE public.person_offsets IS 'Backcharges, damages, and employee credits per person. Pending (pay_stub_id null) or Applied (linked to pay stub). Same access as pay_stubs.';
