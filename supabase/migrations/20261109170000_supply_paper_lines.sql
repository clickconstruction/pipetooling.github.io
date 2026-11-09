SET lock_timeout = '3s';

-- v2.6817 — Supply house bill lines as rows (punch list #298 PR 1; docs/migrations/20261109170000_supply_paper_lines.md).
--
-- A bill is recorded with its total, its job and a link to its PDF; the lines on the paper were rows nowhere. These two
-- tables hold every line of every paper a supply house sends, so the office can ask what the company buys, how often
-- and at what price. Nothing in the app writes them yet: PR 2's sweep fills them from the PDF the bill's row links,
-- through the bill reader, and a paper counts only when its lines add up (src/lib/materials/lines/paperChecks.ts).
--
--   * supply_papers — one row per document read: the house, what the paper is (an invoice, a credit, a ship ticket, an
--     acknowledgement, a quote, a bid, a statement), its number and date, the supplier's order number that ties an
--     acknowledgement to its tickets and bills, the PO text, where the file is and which pages, the bill's row when
--     the paper is a bill on file, the printed money, which reader read it and when, and the check state: adds_up
--     when every sum holds, off when one does not (its lines are kept and do not count), accepted when a person
--     looked and said count it anyway.
--   * supply_paper_lines — one row per printed line: the house's own part code, the manufacturer's number when
--     printed, the description as printed, the unit, quantity ordered, shipped and back ordered, the unit price as
--     printed with its pricing unit (each, per hundred, per thousand), the extension in cents, the kind of line (a
--     part, a charge such as freight or a restock fee, or a kit component that carries no price of its own), and the
--     part in the parts book once matched (PR 2a's crosswalk), empty until then.
--   * supply_purchase_lines — the one view that says what a purchase is: the lines of papers whose kind is invoice or
--     credit and whose check is adds_up or accepted, components left out, a credit's quantity and money signed
--     negative. Every count and every chart reads this view, so a quote is never counted.
--
-- The office roles read; the service role writes (the reader and the sweep). Additive and idempotent. Four tables and
-- views are new, so the four fence appliers run at the end.

-- ---------- The papers ----------

CREATE TABLE IF NOT EXISTS public.supply_papers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  supply_house_id uuid REFERENCES public.supply_houses(id) ON DELETE SET NULL,
  -- The bill's row when this paper is a bill on file; null for a ship ticket, a quote or a paper with no row yet.
  invoice_id uuid REFERENCES public.supply_house_invoices(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('invoice', 'credit', 'ship_ticket', 'acknowledgement', 'quote', 'bid', 'statement', 'other')),
  number text NOT NULL DEFAULT '',
  dated_on date,
  order_number text NOT NULL DEFAULT '',
  po_text text NOT NULL DEFAULT '',
  -- Where the file is: the Drive file the bill's row links, or our copy in the message-attachments bucket.
  drive_file_id text,
  file_path text,
  page_from integer,
  page_to integer,
  subtotal_cents integer,
  tax_cents integer,
  freight_cents integer,
  total_cents integer,
  -- Which reader read it (model:<name> or parser:<layout>) and the fill's ledger row when the model did.
  read_by text NOT NULL DEFAULT '',
  read_id uuid REFERENCES public.supply_bill_reads(id) ON DELETE SET NULL,
  read_at timestamptz,
  check_state text NOT NULL DEFAULT 'off' CHECK (check_state IN ('adds_up', 'off', 'accepted')),
  check_note text NOT NULL DEFAULT '',
  accepted_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  accepted_at timestamptz
);

COMMENT ON TABLE public.supply_papers IS
  'Supply house bill lines (v2.6817, punch list #298): one row per paper a supply house sent, read from its PDF — the house, the kind, the number and date, the order number, the file and pages, the bill''s row when it is one, the printed money, the reader, and whether the lines add up (adds_up · off · accepted). Its lines are supply_paper_lines; what counts as a purchase is the view supply_purchase_lines.';

CREATE INDEX IF NOT EXISTS supply_papers_invoice_idx ON public.supply_papers (invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS supply_papers_house_date_idx ON public.supply_papers (supply_house_id, dated_on);
CREATE INDEX IF NOT EXISTS supply_papers_drive_file_idx ON public.supply_papers (drive_file_id) WHERE drive_file_id IS NOT NULL;

ALTER TABLE public.supply_papers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS supply_papers_office_read ON public.supply_papers;
CREATE POLICY supply_papers_office_read ON public.supply_papers
  FOR SELECT TO authenticated USING ((SELECT public.is_office_staff()));

REVOKE ALL ON TABLE public.supply_papers FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.supply_papers TO authenticated;
GRANT ALL ON TABLE public.supply_papers TO service_role;

-- ---------- The lines ----------

CREATE TABLE IF NOT EXISTS public.supply_paper_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id uuid NOT NULL REFERENCES public.supply_papers(id) ON DELETE CASCADE,
  line_no integer NOT NULL,
  line_kind text NOT NULL DEFAULT 'part' CHECK (line_kind IN ('part', 'charge', 'component')),
  house_code text NOT NULL DEFAULT '',
  mfr_number text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT '',
  qty_ordered numeric(12, 3),
  qty_shipped numeric(12, 3),
  qty_backordered numeric(12, 3),
  -- The unit price as printed, in dollars to four places (a wholesaler prices a fitting at 2.159 each, pipe at 0.286 a foot).
  unit_price numeric(14, 4),
  pricing_unit text NOT NULL DEFAULT 'each' CHECK (pricing_unit IN ('each', 'per_hundred', 'per_thousand')),
  extended_cents integer,
  part_id uuid REFERENCES public.material_parts(id) ON DELETE SET NULL,
  -- How the part was matched: crosswalk · mfr_number · description · person; empty until matched.
  matched_how text NOT NULL DEFAULT '',
  UNIQUE (paper_id, line_no)
);

COMMENT ON TABLE public.supply_paper_lines IS
  'Supply house bill lines (v2.6817, punch list #298): one row per printed line of a supply_papers row — the house''s part code, the manufacturer''s number, the description as printed, the unit, quantity ordered, shipped and back ordered, the unit price as printed with its pricing unit, the extension in cents, the kind of line (part · charge · component), and the parts-book part once matched. Read through supply_purchase_lines for what counts as a purchase.';

CREATE INDEX IF NOT EXISTS supply_paper_lines_paper_idx ON public.supply_paper_lines (paper_id);
CREATE INDEX IF NOT EXISTS supply_paper_lines_house_code_idx ON public.supply_paper_lines (house_code) WHERE house_code <> '';
CREATE INDEX IF NOT EXISTS supply_paper_lines_part_idx ON public.supply_paper_lines (part_id) WHERE part_id IS NOT NULL;

ALTER TABLE public.supply_paper_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS supply_paper_lines_office_read ON public.supply_paper_lines;
CREATE POLICY supply_paper_lines_office_read ON public.supply_paper_lines
  FOR SELECT TO authenticated USING ((SELECT public.is_office_staff()));

REVOKE ALL ON TABLE public.supply_paper_lines FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.supply_paper_lines TO authenticated;
GRANT ALL ON TABLE public.supply_paper_lines TO service_role;

-- ---------- What a purchase is ----------

-- security_invoker: the two tables' policies decide who reads. A credit's quantity and money come out negative, so a
-- sum over the view is what was bought less what came back. Components never appear: their money is on the line above.
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
  AND p.check_state IN ('adds_up', 'accepted')
  AND l.line_kind <> 'component';

COMMENT ON VIEW public.supply_purchase_lines IS
  'Supply house bill lines (v2.6817, punch list #298): the lines that count as purchases — invoices and credits whose lines add up or a person accepted, components left out, a credit signed negative. Every count and chart of what the company buys reads this view and never the tables.';

REVOKE ALL ON TABLE public.supply_purchase_lines FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.supply_purchase_lines TO authenticated;
GRANT SELECT ON TABLE public.supply_purchase_lines TO service_role;

-- The four fences every CREATE TABLE migration closes with (CLAUDE.md → DB migrations).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
