SET lock_timeout = '3s';

-- v2.7103 — Supply house bill lines, the checks the measure asked for (punch list #298 PR 1c;
-- docs/migrations/20261113070000_supply_paper_check_rules.md).
--
-- The measure of every bill on file (2026-11-10) found papers that add up and were held off, because the check did
-- not know four things a paper does: a price rounded on the paper, a pack priced by the piece, a charge outside the
-- subtotal, a rebate line that is negative. The rules themselves are the kernel's (checkPaper and settlePaper,
-- supabase/functions/_shared/paperChecks.ts). Two things belong to the database:
--
--   * supply_papers.check_rules — the count of rule sets a paper was last checked under. Every paper on file was
--     checked under the first (1). bill-lines-sweep checks an off paper with check_rules < 2 once more from the lines
--     on file, with no model read, and stamps it 2 whether it now adds up or stays off, so no paper is checked twice.
--   * supply_paper_save — the sums that decide a paper's state are worked out here, so this door must know the one
--     rule that changes a sum: a charge line the printed subtotal leaves out. Without it a person who fixed a part
--     code on such a bill in the Look window would save an adding-up paper and read it back off. The other rules need
--     nothing here: a negative line is a negative extended_cents, which the sum already takes, and a rounded price or
--     a pack is a line's own arithmetic, which is the client's check and can only turn a paper off.
--
-- Additive and idempotent. The column add is a catalog change (a constant default), so it holds its lock for an
-- instant. Push before deploying bill-lines-sweep: the sweep writes check_rules on every paper it keeps.

ALTER TABLE public.supply_papers
  ADD COLUMN IF NOT EXISTS check_rules smallint NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.supply_papers.check_rules IS
  'The count of check rule sets this paper was last checked under (CHECK_RULES in paperChecks.ts; 1 the five sums of v2.6817, 2 with the rounded price, the pack, the charge outside the subtotal and the signed line of v2.7103). bill-lines-sweep checks an off paper under an older count once more.';

CREATE OR REPLACE FUNCTION public.supply_paper_save(p_invoice_id uuid, p_paper jsonb, p_lines jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice public.supply_house_invoices%ROWTYPE;
  v_paper_id uuid;
  v_client_state text;
  v_state text;
  v_note text;
  v_kind text;
  v_line jsonb;
  v_n integer := 0;
  v_sum integer;
  v_subtotal integer;
  v_tax integer;
  v_freight integer;
  v_total integer;
  v_row integer;
  v_outside integer := 0;
  v_charges integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to keep a bill''s lines.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.is_office_staff() THEN
    RAISE EXCEPTION 'Only the office keeps a bill''s lines.' USING ERRCODE = '42501';
  END IF;
  -- A definer passes the read-only blocks, the twin fence and the archived seal, so each is said here before the write.
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot keep a bill''s lines.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot keep a bill''s lines.' USING ERRCODE = '42501';
  END IF;
  IF public.caller_is_archived() THEN
    RAISE EXCEPTION 'An archived account cannot keep a bill''s lines.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_invoice FROM public.supply_house_invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That bill is not on the list.' USING ERRCODE = 'P0002';
  END IF;
  IF p_paper IS NULL OR jsonb_typeof(p_paper) <> 'object' OR p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' THEN
    RAISE EXCEPTION 'The paper and its lines are needed.' USING ERRCODE = '22023';
  END IF;

  v_client_state := COALESCE(p_paper->>'check_state', 'off');
  IF v_client_state NOT IN ('adds_up', 'off') THEN
    RAISE EXCEPTION 'A paper is saved as adds_up or off; accepted is the Count it as read press.' USING ERRCODE = '22023';
  END IF;
  v_kind := COALESCE(NULLIF(p_paper->>'kind', ''), CASE WHEN v_invoice.document_kind = 'credit' THEN 'credit' ELSE 'invoice' END);
  IF v_kind NOT IN ('invoice', 'credit') THEN
    RAISE EXCEPTION 'A bill''s row holds an invoice or a credit, not a %.', v_kind USING ERRCODE = '22023';
  END IF;

  -- The sums the view's honesty rests on are worked out here, never taken from the client: the counted lines (every
  -- line but a kit component) to the subtotal, the subtotal with tax and freight to the total, the total to the bill
  -- row's amount, each within a cent, the same rules as checkPaper. The client's own checks (each line's arithmetic,
  -- a code found in the paper's text) can only make the state off, never adds_up.
  SELECT COALESCE(SUM((l->>'extended_cents')::integer), 0)
    INTO v_sum
    FROM jsonb_array_elements(p_lines) AS l
   WHERE COALESCE(l->>'line_kind', 'part') <> 'component' AND (l->>'extended_cents') IS NOT NULL;
  v_subtotal := (p_paper->>'subtotal_cents')::integer;
  v_tax := COALESCE((p_paper->>'tax_cents')::integer, 0);
  v_freight := COALESCE((p_paper->>'freight_cents')::integer, 0);
  v_total := (p_paper->>'total_cents')::integer;
  v_row := ABS(ROUND(v_invoice.amount * 100))::integer;

  -- A charge outside the subtotal (v2.7103, outsideChargeCents in paperChecks.ts): a shipping row printed under the
  -- subtotal and read as a line makes the lines pass the subtotal by exactly that charge. It is taken off the lines'
  -- side and put on the total's only when both sums say so: one charge line first, then every charge line together.
  IF v_subtotal IS NOT NULL AND v_total IS NOT NULL AND ABS(v_sum - v_subtotal) > 1 THEN
    SELECT (l->>'extended_cents')::integer
      INTO v_outside
      FROM jsonb_array_elements(p_lines) WITH ORDINALITY AS t(l, n)
     WHERE l->>'line_kind' = 'charge' AND (l->>'extended_cents') IS NOT NULL
       AND ABS((l->>'extended_cents')::integer - (v_sum - v_subtotal)) <= 1
     ORDER BY n
     LIMIT 1;
    IF v_outside IS NULL THEN
      SELECT COALESCE(SUM((l->>'extended_cents')::integer), 0)
        INTO v_charges
        FROM jsonb_array_elements(p_lines) AS l
       WHERE l->>'line_kind' = 'charge' AND (l->>'extended_cents') IS NOT NULL;
      v_outside := CASE WHEN ABS(v_charges - (v_sum - v_subtotal)) <= 1 THEN v_charges ELSE 0 END;
    END IF;
    IF v_outside <> 0 AND ABS(v_subtotal + v_tax + v_freight + v_outside - v_total) > 1 THEN
      v_outside := 0;
    END IF;
  END IF;

  v_note := '';
  IF jsonb_array_length(p_lines) = 0 THEN
    v_note := 'No line was read.';
  ELSIF v_subtotal IS NOT NULL AND ABS(v_sum - v_outside - v_subtotal) > 1 THEN
    v_note := format('The lines are %s the subtotal.', public.supply_paper_gap_words(v_sum - v_outside - v_subtotal));
  ELSIF v_subtotal IS NOT NULL AND v_total IS NOT NULL AND ABS(v_subtotal + v_tax + v_freight + v_outside - v_total) > 1 THEN
    v_note := format('The subtotal with tax and freight is %s the total.', public.supply_paper_gap_words(v_subtotal + v_tax + v_freight + v_outside - v_total));
  ELSIF v_subtotal IS NULL AND v_total IS NOT NULL AND ABS(v_sum + v_tax + v_freight - v_total) > 1 THEN
    v_note := format('The lines with tax and freight are %s the total.', public.supply_paper_gap_words(v_sum + v_tax + v_freight - v_total));
  ELSIF v_total IS NULL THEN
    v_note := 'No total was read.';
  ELSIF ABS(v_total - v_row) > 1 THEN
    v_note := format('The printed total is %s the amount on the bill''s row.', public.supply_paper_gap_words(v_total - v_row));
  END IF;
  IF v_note <> '' THEN
    v_state := 'off';
  ELSIF v_client_state = 'off' THEN
    v_state := 'off';
    v_note := LEFT(COALESCE(p_paper->>'check_note', ''), 400);
  ELSE
    v_state := 'adds_up';
  END IF;

  SELECT id INTO v_paper_id FROM public.supply_papers WHERE invoice_id = p_invoice_id ORDER BY created_at LIMIT 1;
  IF v_paper_id IS NULL THEN
    INSERT INTO public.supply_papers (supply_house_id, invoice_id, kind, number, dated_on, order_number, po_text, drive_file_id, file_path, page_from, page_to,
                                      subtotal_cents, tax_cents, freight_cents, total_cents, read_by, read_id, read_at, check_state, check_note, check_rules)
    VALUES (v_invoice.supply_house_id, p_invoice_id, v_kind, COALESCE(NULLIF(p_paper->>'number', ''), v_invoice.invoice_number),
            COALESCE((p_paper->>'dated_on')::date, v_invoice.invoice_date), COALESCE(p_paper->>'order_number', ''), COALESCE(p_paper->>'po_text', ''),
            NULLIF(p_paper->>'drive_file_id', ''), NULLIF(p_paper->>'file_path', ''), (p_paper->>'page_from')::integer, (p_paper->>'page_to')::integer,
            (p_paper->>'subtotal_cents')::integer, (p_paper->>'tax_cents')::integer, (p_paper->>'freight_cents')::integer, (p_paper->>'total_cents')::integer,
            COALESCE(p_paper->>'read_by', 'form'), NULLIF(p_paper->>'read_id', '')::uuid, COALESCE((p_paper->>'read_at')::timestamptz, clock_timestamp()),
            v_state, v_note, 2)
    RETURNING id INTO v_paper_id;
  ELSE
    UPDATE public.supply_papers
       SET kind = v_kind,
           number = COALESCE(NULLIF(p_paper->>'number', ''), v_invoice.invoice_number),
           dated_on = COALESCE((p_paper->>'dated_on')::date, v_invoice.invoice_date),
           order_number = COALESCE(p_paper->>'order_number', order_number),
           po_text = COALESCE(p_paper->>'po_text', po_text),
           drive_file_id = COALESCE(NULLIF(p_paper->>'drive_file_id', ''), drive_file_id),
           file_path = COALESCE(NULLIF(p_paper->>'file_path', ''), file_path),
           subtotal_cents = (p_paper->>'subtotal_cents')::integer,
           tax_cents = (p_paper->>'tax_cents')::integer,
           freight_cents = (p_paper->>'freight_cents')::integer,
           total_cents = (p_paper->>'total_cents')::integer,
           read_by = COALESCE(NULLIF(p_paper->>'read_by', ''), read_by),
           read_id = COALESCE(NULLIF(p_paper->>'read_id', '')::uuid, read_id),
           read_at = COALESCE((p_paper->>'read_at')::timestamptz, read_at),
           check_state = v_state,
           check_note = v_note,
           check_rules = 2,
           accepted_by = NULL,
           accepted_at = NULL
     WHERE id = v_paper_id;
    DELETE FROM public.supply_paper_lines WHERE paper_id = v_paper_id;
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_n := v_n + 1;
    INSERT INTO public.supply_paper_lines (paper_id, line_no, line_kind, house_code, mfr_number, description, unit, qty_ordered, qty_shipped, qty_backordered,
                                           unit_price, pricing_unit, extended_cents, part_id, matched_how)
    VALUES (v_paper_id, COALESCE((v_line->>'line_no')::integer, v_n),
            CASE WHEN v_line->>'line_kind' IN ('part', 'charge', 'component') THEN v_line->>'line_kind' ELSE 'part' END,
            LEFT(COALESCE(v_line->>'house_code', ''), 60), LEFT(COALESCE(v_line->>'mfr_number', ''), 60), LEFT(COALESCE(v_line->>'description', ''), 240),
            LEFT(COALESCE(v_line->>'unit', ''), 12), (v_line->>'qty_ordered')::numeric, (v_line->>'qty_shipped')::numeric, (v_line->>'qty_backordered')::numeric,
            (v_line->>'unit_price')::numeric,
            CASE WHEN v_line->>'pricing_unit' IN ('each', 'per_hundred', 'per_thousand') THEN v_line->>'pricing_unit' ELSE 'each' END,
            (v_line->>'extended_cents')::integer, NULLIF(v_line->>'part_id', '')::uuid, COALESCE(v_line->>'matched_how', ''));
  END LOOP;

  RETURN v_paper_id;
END;
$$;

REVOKE ALL ON FUNCTION public.supply_paper_save(uuid, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supply_paper_save(uuid, jsonb, jsonb) TO authenticated, service_role;
COMMENT ON FUNCTION public.supply_paper_save(uuid, jsonb, jsonb) IS
  'Supply house bill lines (v2.6819, punch list #298): the office writes a bill''s paper and lines, checked on the client — at Save of a bill filled from its PDF, and again when a person fixes or adds a line in the Look window. One paper per bill through this door; the lines are replaced whole. Since v2.7103 a charge line the printed subtotal leaves out is taken off the lines and put on the total, as checkPaper does. Office roles; never a training account, a twin or an archived caller.';
