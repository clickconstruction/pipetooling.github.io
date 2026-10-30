SET lock_timeout = '3s';

-- v2.6088 — Supply-house bill capture, the fill behind a switch (punch list #179 PR 2;
-- docs/migrations/20261030010000_supply_bill_read.md).
--
-- The Add invoice window stays the one way a bill is recorded (Taunya, 2026-10-29: augment the manual entry, never
-- replace it). What is new is that the bill's PDF can fill the form's fields, and the row keeps what was read:
--
--   * supply_house_invoices.bill_read — the read as the row keeps it (jsonb, `BillRowRead` in
--     src/lib/materials/bills/billRead.ts): the file, the model and when, each field's value with its source read ·
--     guessed · typed and the why, the lines as the paper printed them, the checks as they stood at Save. Null on a bill
--     typed with no PDF. The words read, guessed and typed live here and nowhere on a screen.
--   * supply_house_invoices.bill_attachment_id — the thread file the bill was recorded from, so the house's count of
--     bills to record and the form's picker know a file is on a row (PR 3). Null for a typed bill or a dropped-in file.
--   * app_settings bill_read_on_v1 — the switch. 'false' as it ships; 'true' lets the office start a bill from its PDF.
--     Every signed-in user reads app_settings already; only the owner or a dev changes this row (is_master_or_dev()),
--     the way the other switches are written (messages_texts_on_v1, 20261014160000). bill-read refuses every caller
--     but a dev while it is off.
--   * supply_bill_reads — one row per fill, written by bill-read as the service role: who asked, when, the file, the
--     house, the model, the tokens and cents, whether it came back whole, and the answer. The function counts today's
--     rows for its cap of so many fills a day, and a later look at how often the reader is right reads here. The office
--     roles read it; nobody writes it from the app.
--
-- Additive and idempotent. The client of v2.6088 writes neither column, so it may deploy before the push; PR 3's client
-- writes them only when a bill was filled from a PDF. A table is created, so the three fence appliers run at the end.

ALTER TABLE public.supply_house_invoices
  ADD COLUMN IF NOT EXISTS bill_read jsonb,
  ADD COLUMN IF NOT EXISTS bill_attachment_id uuid REFERENCES public.message_attachments(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.supply_house_invoices.bill_read IS
  'Supply-house bill capture (v2.6088, punch list #179): the read the row was filled from — the file, the model and when, each field''s value with its source (read · guessed · typed) and why, the lines, the checks at Save. Null on a bill typed with no PDF. Shape: BillRowRead in src/lib/materials/bills/billRead.ts.';
COMMENT ON COLUMN public.supply_house_invoices.bill_attachment_id IS
  'Supply-house bill capture (v2.6088, punch list #179): the message_attachments row (the PDF or picture on the house''s thread) this bill was recorded from, so the thread file counts as on a row. Null for a typed bill or a dropped-in file.';

CREATE INDEX IF NOT EXISTS supply_house_invoices_bill_attachment_idx
  ON public.supply_house_invoices (bill_attachment_id)
  WHERE bill_attachment_id IS NOT NULL;

-- ---------- The switch ----------

INSERT INTO public.app_settings (key, value_text)
VALUES ('bill_read_on_v1', 'false')
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS master_or_dev_update_bill_read_on ON public.app_settings;
CREATE POLICY master_or_dev_update_bill_read_on ON public.app_settings
  FOR UPDATE TO authenticated
  USING (key = 'bill_read_on_v1' AND public.is_master_or_dev())
  WITH CHECK (key = 'bill_read_on_v1' AND public.is_master_or_dev());

-- ---------- The ledger of fills ----------

CREATE TABLE IF NOT EXISTS public.supply_bill_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  read_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  read_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  supply_house_id uuid REFERENCES public.supply_houses(id) ON DELETE SET NULL,
  attachment_id uuid REFERENCES public.message_attachments(id) ON DELETE SET NULL,
  -- Where our copy is in the message-attachments bucket: the thread file's own path, or bills/<house>/<uuid>/<name>
  -- for a file dropped on the form.
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_mime text,
  model text NOT NULL,
  ok boolean NOT NULL,
  input_tokens integer,
  output_tokens integer,
  cents numeric(8, 2),
  -- The model's answer as the function read it (BillRead), or null when it did not come back whole.
  answer jsonb,
  -- Why a fill did not come back whole, in the function's words; null when ok.
  why text
);

COMMENT ON TABLE public.supply_bill_reads IS
  'Supply-house bill capture (v2.6088, punch list #179): one row per fill bill-read made — who, when, the file, the house, the model, the tokens and cents, whether it came back whole, the answer. The function counts today''s rows for its daily cap. Office roles read; the service role writes.';

CREATE INDEX IF NOT EXISTS supply_bill_reads_read_at_idx ON public.supply_bill_reads (read_at DESC);

ALTER TABLE public.supply_bill_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS supply_bill_reads_office_read ON public.supply_bill_reads;
CREATE POLICY supply_bill_reads_office_read ON public.supply_bill_reads
  FOR SELECT TO authenticated USING ((SELECT public.is_office_staff()));

REVOKE ALL ON TABLE public.supply_bill_reads FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.supply_bill_reads TO authenticated;
GRANT ALL ON TABLE public.supply_bill_reads TO service_role;

-- ---------- The fences, for the new table ----------

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
