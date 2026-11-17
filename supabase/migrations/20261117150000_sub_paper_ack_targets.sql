SET lock_timeout = '3s';

-- v2.7569 (punch list #371, step 1): what a sub answers from their page is kept on the thing itself.
--
-- sub_paper_acks (20261117040000) hung every answer on a paper in the register: paper_id, NOT NULL. A sub can answer
-- about a payment whose record the office has not made, or a sheet whose work statement the office has not made, and
-- those have no row in the register to hang on. The page must not make one: a work statement registered from the
-- page would hold the place the office's first number goes, which is the page giving out a number.
--
-- So an answer names what it is about:
--   * person_id: whose page said it.
--   * labor_job_id: the sheet, for "something is wrong" on a work statement.
--   * sending_id: the sending, for "got it" or "something is wrong" on a payment.
--   * payment_id: the one payment row, for a payment recorded before sendings.
--   * paper_id and revision stay, and are filled where the office has made the paper: the copy the sub saw.
--
-- A payment is marked received once: one unique index per target holds that against two presses at one moment.
--
-- Nothing has written the table yet (the sub-portal function is its only writer, and it is not deployed with these
-- writes until after this push), so no row needs a backfill. Additive, and idempotent: safe to apply twice. No table
-- is created, so no fence is called.

ALTER TABLE public.sub_paper_acks ALTER COLUMN paper_id DROP NOT NULL;
ALTER TABLE public.sub_paper_acks ALTER COLUMN revision DROP NOT NULL;

ALTER TABLE public.sub_paper_acks ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES public.people(id) ON DELETE SET NULL;
ALTER TABLE public.sub_paper_acks ADD COLUMN IF NOT EXISTS labor_job_id uuid REFERENCES public.people_labor_jobs(id) ON DELETE SET NULL;
ALTER TABLE public.sub_paper_acks ADD COLUMN IF NOT EXISTS sending_id uuid REFERENCES public.sub_payment_sendings(id) ON DELETE SET NULL;
ALTER TABLE public.sub_paper_acks ADD COLUMN IF NOT EXISTS payment_id uuid REFERENCES public.people_labor_job_payments(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.sub_paper_acks.paper_id IS
  'The paper in the register the answer is about, where the office has made one. NULL when the sub answered about a sheet or a payment the office has not papered (punch list #371).';
COMMENT ON COLUMN public.sub_paper_acks.revision IS
  'The revision of that paper the sub saw. NULL with paper_id.';
COMMENT ON COLUMN public.sub_paper_acks.person_id IS
  'Whose page the answer came from (punch list #371).';
COMMENT ON COLUMN public.sub_paper_acks.labor_job_id IS
  'The sheet the answer is about, for something_wrong on a work statement (punch list #371).';
COMMENT ON COLUMN public.sub_paper_acks.sending_id IS
  'The sending the answer is about, for received or something_wrong on a payment (punch list #371).';
COMMENT ON COLUMN public.sub_paper_acks.payment_id IS
  'The one payment row the answer is about, for a payment recorded before sendings (punch list #371).';
COMMENT ON TABLE public.sub_paper_acks IS
  'Punch lists #350 and #371: what a sub said back from their portal: received a payment, confirmed a work statement (behind SUB_PAPER_CONFIRM_LIVE), or said something is wrong. Each row names its person and its sheet, sending or payment, and the paper and revision the sub saw where the office has made one. Written only by the sub-portal function.';

-- A payment is marked received once.
CREATE UNIQUE INDEX IF NOT EXISTS sub_paper_acks_received_sending_key
  ON public.sub_paper_acks (sending_id) WHERE kind = 'received' AND sending_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sub_paper_acks_received_payment_key
  ON public.sub_paper_acks (payment_id) WHERE kind = 'received' AND payment_id IS NOT NULL;

-- The page reads one person's answers, and the office's Pay view reads them by sheet.
CREATE INDEX IF NOT EXISTS sub_paper_acks_person_idx ON public.sub_paper_acks (person_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sub_paper_acks_sheet_idx ON public.sub_paper_acks (labor_job_id) WHERE labor_job_id IS NOT NULL;
