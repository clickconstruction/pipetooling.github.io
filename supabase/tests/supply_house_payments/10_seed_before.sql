-- What prod holds before the migration: bills paid and not paid, with no payment row anywhere.
-- Fixed ids so the scenarios can name them.
INSERT INTO public.users (id, name, role) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'Dana Whitfield', 'assistant'),
  ('00000000-0000-0000-0000-0000000000a2', 'Sam Field', 'subcontractor');
INSERT INTO public.supply_houses (id, name) VALUES
  ('00000000-0000-0000-0000-0000000000b1', 'Pecan Supply'),
  ('00000000-0000-0000-0000-0000000000b2', 'Cedar Fork Supply');
INSERT INTO public.supply_house_invoices (id, supply_house_id, invoice_number, amount, is_paid, paid_at, payment_link, document_kind) VALUES
  ('00000000-0000-0000-0000-000000000c01', '00000000-0000-0000-0000-0000000000b1', 'OLD-1', 100.00, true,  '2026-10-05 18:00:00+00', NULL, 'invoice'),
  ('00000000-0000-0000-0000-000000000c02', '00000000-0000-0000-0000-0000000000b1', 'OLD-2',  30.00, true,  '2026-10-07 03:30:00+00', ' https://example.test/receipt ', 'invoice'),
  ('00000000-0000-0000-0000-000000000c03', '00000000-0000-0000-0000-0000000000b1', 'OPEN-1', 50.00, false, NULL, NULL, 'invoice'),
  ('00000000-0000-0000-0000-000000000c04', '00000000-0000-0000-0000-0000000000b1', 'CM-OLD', -20.00, true, '2026-10-08 18:00:00+00', NULL, 'credit'),
  ('00000000-0000-0000-0000-000000000c05', '00000000-0000-0000-0000-0000000000b1', 'ZERO',    0.00, true,  '2026-10-09 18:00:00+00', NULL, 'invoice');

-- A paid bill with no paid day (prod has none; the backfill must still not write its row). The baseline's
-- trigger stamps a day on the way in, so it is taken off afterwards, and the row's last change is pinned.
INSERT INTO public.supply_house_invoices (id, supply_house_id, invoice_number, amount, is_paid) VALUES
  ('00000000-0000-0000-0000-000000000c07', '00000000-0000-0000-0000-0000000000b1', 'OLD-NODAY', 12.00, true);
ALTER TABLE public.supply_house_invoices DISABLE TRIGGER USER;
UPDATE public.supply_house_invoices SET paid_at = NULL, updated_at = '2026-09-30 18:00:00+00' WHERE id = '00000000-0000-0000-0000-000000000c07';
ALTER TABLE public.supply_house_invoices ENABLE TRIGGER USER;

-- What each bill said before the migration, to prove the backfill writes no bill row.
CREATE TEMP TABLE before AS SELECT id, is_paid, paid_at, updated_at FROM public.supply_house_invoices;
