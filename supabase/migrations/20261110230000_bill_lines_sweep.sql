SET lock_timeout = '3s';

-- v2.6882 — Supply house bill lines, the sweep (punch list #298 PR 2; docs/migrations/20261110230000_bill_lines_sweep.md).
--
-- PR 1 made supply_papers and supply_paper_lines; PR 1b let the office write a paper at Save of a bill filled from its
-- PDF. The office types most bills and pastes a Drive link, so their lines were still rows nowhere. The edge function
-- bill-lines-sweep reads those bills from the PDF each row links, as the service account, and is also the backfill of
-- the bills recorded before it. This file is what the sweep needs of the database:
--
--   * supply_bill_holds — one row per bill the sweep could not give a paper, with the reason and what it was tried on:
--     the app cannot open the file, the bill's number is not in its file, the file is a statement, the read was
--     refused or cut. A row being read now is held as `reading`, which is also how two runs never read one file. A
--     bill that gets its paper loses its hold. The held list of the backfill's screen (PR 3) reads this table.
--   * supply_papers.text_layer — whether the PDF had a text layer the reader's part codes were checked against (true),
--     was a scan (false), or it is not known (null: a paper written by the form, which has no text layer to hand).
--   * supply_papers: one paper per bill. supply_paper_save already kept it so; the unique index makes a second writer
--     lose instead of doubling a bill's lines, and replaces the plain index on the same column.
--   * supply_bill_reads.source — `form` for the office's fill, `sweep` for this function's reads, so each cap counts
--     its own: the form's 150 a day stays a tripwire for the office, the sweep's 600 covers the backfill.
--   * app_settings.bill_lines_sweep_on_v1 — the switch the cron reads; 'true' is the owner's call (a bill reads by
--     itself, about a cent each).
--   * the cron — every ten minutes, six minutes past the folder sweep's slot.
--
-- Additive and idempotent. One table is new, so the four fence appliers run at the end.

-- ---------- The holds ----------

CREATE TABLE IF NOT EXISTS public.supply_bill_holds (
  invoice_id uuid PRIMARY KEY REFERENCES public.supply_house_invoices(id) ON DELETE CASCADE,
  why text NOT NULL CHECK (why IN ('reading', 'link', 'cannot_open', 'not_readable', 'too_big', 'number_not_in_file', 'not_a_bill', 'statement', 'refused', 'cut', 'failed')),
  -- The reason in a sentence, for a person: what Drive answered, which numbers the file does hold.
  note text NOT NULL DEFAULT '',
  drive_file_id text,
  -- The file and the folded number the hold was made on; a person who changes either makes the bill due again.
  seen_key text NOT NULL DEFAULT '',
  tried_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  tries integer NOT NULL DEFAULT 1
);

COMMENT ON TABLE public.supply_bill_holds IS
  'Supply house bill lines (v2.6882, punch list #298): one row per bill bill-lines-sweep could not give a paper — why (cannot_open · number_not_in_file · statement · not_a_bill · link · not_readable · too_big · refused · cut · failed, or reading while a run has it), a sentence, the file and number it was tried on, when and how often. A bill that gets its paper loses its row. Office roles read; the service role writes.';

CREATE INDEX IF NOT EXISTS supply_bill_holds_why_idx ON public.supply_bill_holds (why);

ALTER TABLE public.supply_bill_holds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS supply_bill_holds_office_read ON public.supply_bill_holds;
CREATE POLICY supply_bill_holds_office_read ON public.supply_bill_holds
  FOR SELECT TO authenticated USING ((SELECT public.is_office_staff()));

-- Supabase grants every new table to authenticated by default; the office reads and nobody signed in writes.
REVOKE ALL ON TABLE public.supply_bill_holds FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.supply_bill_holds TO authenticated;
GRANT ALL ON TABLE public.supply_bill_holds TO service_role;

-- ---------- The paper: its text layer, and one per bill ----------

ALTER TABLE public.supply_papers ADD COLUMN IF NOT EXISTS text_layer boolean;

COMMENT ON COLUMN public.supply_papers.text_layer IS
  'Whether the PDF had a text layer the part codes were checked against (v2.6882): true a text layer read whole, false a scan or a picture, null not known (a paper the form wrote, or a text read that ran out of time).';

CREATE UNIQUE INDEX IF NOT EXISTS supply_papers_one_per_invoice ON public.supply_papers (invoice_id) WHERE invoice_id IS NOT NULL;
DROP INDEX IF EXISTS public.supply_papers_invoice_idx;

-- ---------- The ledger of reads: whose read it was ----------

ALTER TABLE public.supply_bill_reads ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'form' CHECK (source IN ('form', 'sweep'));

COMMENT ON COLUMN public.supply_bill_reads.source IS
  'Who made the read (v2.6882): form, the office''s fill through bill-read; sweep, bill-lines-sweep reading a bill on file. Each function''s daily cap counts its own.';

-- ---------- The switch ----------

INSERT INTO public.app_settings (key, value_text)
VALUES ('bill_lines_sweep_on_v1', 'true')
ON CONFLICT (key) DO NOTHING;

-- ---------- The cron ----------

-- Every ten minutes, six minutes past the folder sweep's slot and three past the file index's: POST
-- /functions/v1/bill-lines-sweep { sweep: {} } with the cron secret (Vault PROJECT_URL and CRON_SECRET, as the file
-- index sweep is scheduled). A run with nothing to read costs three small reads and no model call. Unscheduled first
-- if it exists, so a second run leaves one row.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'bill-lines-sweep';

SELECT cron.schedule(
  'bill-lines-sweep',
  '6,16,26,36,46,56 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/bill-lines-sweep',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{"sweep":{}}'::jsonb
  ) AS request_id;
  $$
);

-- The four fences every CREATE TABLE migration closes with (CLAUDE.md → DB migrations).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
