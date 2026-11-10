SET lock_timeout = '3s';

-- v2.6824 — A purchase line needs its bill (punch list #298; docs/migrations/20261109230000_supply_purchase_lines_need_a_bill.md).
--
-- supply_papers.invoice_id is ON DELETE SET NULL, so a bill deleted from the house's list left its paper standing with no
-- bill, and supply_purchase_lines still counted the paper's lines as purchases (found on the 1b live walk, 2026-11-09).
-- The view now counts an invoice or credit paper only while it has its bill: a paper whose bill is gone keeps its rows
-- and drops out of every count until a bill owns it again. Same columns in the same order, so CREATE OR REPLACE holds
-- and nothing that reads the view changes. The kernel's countsAsPurchase (src/lib/materials/lines/paperChecks.ts) is the
-- same rule in TypeScript for the sweep.

CREATE OR REPLACE VIEW public.supply_purchase_lines
WITH (security_invoker = true) AS
SELECT
  l.id,
  l.paper_id,
  p.supply_house_id,
  p.invoice_id,
  p.kind,
  p.number,
  p.dated_on,
  p.check_state,
  l.line_no,
  l.line_kind,
  l.house_code,
  l.mfr_number,
  l.description,
  l.unit,
  l.pricing_unit,
  l.unit_price,
  l.part_id,
  l.matched_how,
  CASE WHEN p.kind = 'credit' THEN -1 ELSE 1 END AS sign,
  CASE WHEN p.kind = 'credit' THEN -COALESCE(l.qty_shipped, l.qty_ordered) ELSE COALESCE(l.qty_shipped, l.qty_ordered) END AS quantity,
  CASE WHEN p.kind = 'credit' THEN -l.extended_cents ELSE l.extended_cents END AS extended_cents
FROM public.supply_paper_lines l
JOIN public.supply_papers p ON p.id = l.paper_id
WHERE p.kind IN ('invoice', 'credit')
  AND p.invoice_id IS NOT NULL
  AND p.check_state IN ('adds_up', 'accepted')
  AND l.line_kind <> 'component';

COMMENT ON VIEW public.supply_purchase_lines IS
  'Supply house bill lines (v2.6817, punch list #298): the lines that count as purchases — invoices and credits that still have their bill (invoice_id, v2.6824) and whose lines add up or a person accepted, components left out, a credit signed negative. Every count and chart of what the company buys reads this view and never the tables.';
