SET lock_timeout = '3s';

-- The register of sub papers (punch list #350, PR 3): every Work statement, Payment record and
-- Statement of account that was made, with its number, its revision and the paper as it read.
--
-- Until now a paper for a sub was drawn fresh each time and nothing said which copy went out. The
-- register is what makes a paper quotable:
--   * A work statement's number is WS-<job>-<n>, minted the first time the sheet's paper is made.
--     It belongs to the sheet for good. A change to the sheet makes a revision under the same
--     number, and the copy it replaces stays, pointing at the one that replaced it.
--   * A payment record's number is its sending's (sub_payment_sendings.number, v2.7235), printed
--     PR-<n>. A payment recorded before sendings has none, and its record is filed with no number.
--   * A statement of account's number is SA-<n>, from a sequence across the company.
--   * No number is ever given out twice. A voided paper keeps its number and reads void. A deleted
--     sheet's row stays (labor_job_id goes NULL), so its number is not handed to another sheet.
--
-- snapshot is the paper as issued: the model the HTML print and the PDF both draw
-- (supabase/functions/_shared/subPapers.ts). A paper prints again from it, word for word.
--
-- Additive. Nothing here changes how a sheet is counted or paid. Idempotent: safe to apply twice.

-- ── 1. Numbers ───────────────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS public.sub_paper_sa_number_seq AS bigint START WITH 1 INCREMENT BY 1 NO CYCLE;

-- One counter per job for WS-<job>-<n>. A row is locked while its next number is taken, so two
-- people making papers on one job at the same moment cannot get the same n.
CREATE TABLE IF NOT EXISTS public.sub_paper_job_counters (
  job_key text PRIMARY KEY,
  last_n integer NOT NULL DEFAULT 0 CHECK (last_n >= 0)
);

COMMENT ON TABLE public.sub_paper_job_counters IS
  'Punch list #350: the last n given out for WS-<job>-<n>, per job number. Only mint_sub_paper writes it. A number is never reused.';

ALTER TABLE public.sub_paper_job_counters ENABLE ROW LEVEL SECURITY;
-- No policy: only the definer function below reads or writes it.

-- ── 2. The register ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sub_papers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('work_statement', 'payment_record', 'statement_of_account')),
  -- '' only on a payment record for a payment recorded before sendings had numbers.
  number text NOT NULL DEFAULT '',
  revision integer NOT NULL DEFAULT 1 CHECK (revision >= 1),
  person_id uuid REFERENCES public.people(id) ON DELETE SET NULL,
  -- The sheet a work statement is for. NULL once the sheet is deleted: the number stays taken.
  labor_job_id uuid REFERENCES public.people_labor_jobs(id) ON DELETE SET NULL,
  -- The sending a payment record is for.
  sending_id uuid REFERENCES public.sub_payment_sendings(id) ON DELETE SET NULL,
  -- A lone payment row's record, for a payment recorded before sendings.
  payment_id uuid REFERENCES public.people_labor_job_payments(id) ON DELETE SET NULL,
  -- The period of a statement of account. Both NULL is "to date".
  period_from date,
  period_to date,
  -- The paper as issued, and a short text of its figures to tell a change from a reprint.
  snapshot jsonb NOT NULL,
  fingerprint text NOT NULL DEFAULT '',
  comes_to numeric(12, 2),
  still_open numeric(12, 2),
  issued_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  issued_by_name text,
  issued_at timestamptz NOT NULL DEFAULT now(),
  -- The newer revision of the same number, once there is one.
  replaced_by uuid REFERENCES public.sub_papers(id) ON DELETE SET NULL,
  voided_at timestamptz,
  void_reason text
);

COMMENT ON TABLE public.sub_papers IS
  'Punch list #350: every sub paper that was made, with its number, revision and the paper as issued (snapshot). Written only by mint_sub_paper. A number is never reused; a change is a revision; a voided paper keeps its number.';

CREATE UNIQUE INDEX IF NOT EXISTS sub_papers_number_revision_key
  ON public.sub_papers (kind, number, revision) WHERE number <> '';
CREATE INDEX IF NOT EXISTS sub_papers_person_idx ON public.sub_papers (person_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS sub_papers_sheet_idx ON public.sub_papers (labor_job_id) WHERE labor_job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sub_papers_sending_idx ON public.sub_papers (sending_id) WHERE sending_id IS NOT NULL;

ALTER TABLE public.sub_papers ENABLE ROW LEVEL SECURITY;

-- The office roles who see sub pay read the register. Nobody writes it directly: the mint is a
-- definer function, so a number cannot be typed by hand. A sub reads their own papers through the
-- sub-portal function, which holds the service key.
DROP POLICY IF EXISTS "Office staff can read sub papers" ON public.sub_papers;
CREATE POLICY "Office staff can read sub papers" ON public.sub_papers FOR SELECT
  USING (public.is_office_staff());

GRANT SELECT ON public.sub_papers TO authenticated;

-- What a sub said back about a paper (PR 6 and PR 7): "Got it" on a payment record, "Confirm" on a
-- work statement. Recorded the way a signed work order is: the name, the time, the address it came
-- from and the revision they saw. Written only by the sub-portal function (service key).
CREATE TABLE IF NOT EXISTS public.sub_paper_acks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id uuid NOT NULL REFERENCES public.sub_papers(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('received', 'confirmed', 'something_wrong')),
  revision integer NOT NULL,
  amount numeric(12, 2),
  said_by_name text,
  said_from text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sub_paper_acks IS
  'Punch list #350: what a sub said back about a paper from their portal: received a payment record, confirmed a work statement (behind SUB_PAPER_CONFIRM_LIVE), or said something is wrong. The revision they saw is kept. Written only by the sub-portal function.';

CREATE INDEX IF NOT EXISTS sub_paper_acks_paper_idx ON public.sub_paper_acks (paper_id, created_at DESC);

ALTER TABLE public.sub_paper_acks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Office staff can read sub paper acks" ON public.sub_paper_acks;
CREATE POLICY "Office staff can read sub paper acks" ON public.sub_paper_acks FOR SELECT
  USING (public.is_office_staff());

GRANT SELECT ON public.sub_paper_acks TO authenticated;

-- ── 3. The mint ──────────────────────────────────────────────────────────────

-- Register one paper and hand back its number and revision.
--   work_statement: the sheet's current paper with the same fingerprint is handed back as it is (a
--     reprint makes nothing). A different fingerprint makes the next revision under the same
--     number. A sheet with no paper yet takes the job's next n.
--   payment_record: one per sending (or per payment row with no sending). The number is the
--     sending's. A reprint hands back the row.
--   statement_of_account: always a new paper with the next SA number.
CREATE OR REPLACE FUNCTION public.mint_sub_paper(
  p_kind text,
  p_person_id uuid,
  p_snapshot jsonb,
  p_fingerprint text,
  p_labor_job_id uuid DEFAULT NULL,
  p_sending_id uuid DEFAULT NULL,
  p_payment_id uuid DEFAULT NULL,
  p_period_from date DEFAULT NULL,
  p_period_to date DEFAULT NULL,
  p_comes_to numeric DEFAULT NULL,
  p_still_open numeric DEFAULT NULL
) RETURNS TABLE (id uuid, number text, revision integer, reused boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current public.sub_papers%ROWTYPE;
  v_number text;
  v_revision integer := 1;
  v_job_key text;
  v_n integer;
  v_sending_no bigint;
  v_new uuid;
  v_name text;
BEGIN
  IF NOT public.is_office_staff() THEN
    RAISE EXCEPTION 'Only the office roles who see sub pay can make a sub paper.' USING ERRCODE = '42501';
  END IF;
  IF p_kind NOT IN ('work_statement', 'payment_record', 'statement_of_account') THEN
    RAISE EXCEPTION 'Unknown paper kind %.', p_kind USING ERRCODE = '22023';
  END IF;
  IF p_snapshot IS NULL OR jsonb_typeof(p_snapshot) <> 'object' THEN
    RAISE EXCEPTION 'A paper is registered with the paper itself.' USING ERRCODE = '22023';
  END IF;
  SELECT u.name INTO v_name FROM public.users u WHERE u.id = auth.uid();

  IF p_kind = 'work_statement' THEN
    IF p_labor_job_id IS NULL THEN
      RAISE EXCEPTION 'A work statement is for one sheet.' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_current FROM public.sub_papers sp
      WHERE sp.kind = 'work_statement' AND sp.labor_job_id = p_labor_job_id AND sp.replaced_by IS NULL AND sp.voided_at IS NULL
      ORDER BY sp.revision DESC LIMIT 1 FOR UPDATE;
    IF FOUND AND v_current.fingerprint = COALESCE(p_fingerprint, '') THEN
      RETURN QUERY SELECT v_current.id, v_current.number, v_current.revision, true;
      RETURN;
    END IF;
    IF FOUND THEN
      v_number := v_current.number;
      v_revision := v_current.revision + 1;
    ELSE
      SELECT COALESCE(NULLIF(btrim(lj.job_number), ''), '0') INTO v_job_key FROM public.people_labor_jobs lj WHERE lj.id = p_labor_job_id;
      IF v_job_key IS NULL THEN
        RAISE EXCEPTION 'That sheet is gone.' USING ERRCODE = 'P0002';
      END IF;
      INSERT INTO public.sub_paper_job_counters (job_key, last_n) VALUES (v_job_key, 1)
        ON CONFLICT (job_key) DO UPDATE SET last_n = public.sub_paper_job_counters.last_n + 1
        RETURNING last_n INTO v_n;
      v_number := 'WS-' || v_job_key || '-' || v_n::text;
    END IF;
  ELSIF p_kind = 'payment_record' THEN
    IF p_sending_id IS NULL AND p_payment_id IS NULL THEN
      RAISE EXCEPTION 'A payment record is for one sending.' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO v_current FROM public.sub_papers sp
      WHERE sp.kind = 'payment_record' AND sp.replaced_by IS NULL AND sp.voided_at IS NULL
        AND ((p_sending_id IS NOT NULL AND sp.sending_id = p_sending_id) OR (p_sending_id IS NULL AND sp.payment_id = p_payment_id))
      ORDER BY sp.revision DESC LIMIT 1 FOR UPDATE;
    IF FOUND AND v_current.fingerprint = COALESCE(p_fingerprint, '') THEN
      RETURN QUERY SELECT v_current.id, v_current.number, v_current.revision, true;
      RETURN;
    END IF;
    IF FOUND THEN
      v_number := v_current.number;
      v_revision := v_current.revision + 1;
    ELSE
      SELECT s.number INTO v_sending_no FROM public.sub_payment_sendings s WHERE s.id = p_sending_id;
      v_number := CASE WHEN v_sending_no IS NULL THEN '' ELSE 'PR-' || lpad(v_sending_no::text, 4, '0') END;
    END IF;
  ELSE
    v_number := 'SA-' || lpad(nextval('public.sub_paper_sa_number_seq')::text, 4, '0');
  END IF;

  INSERT INTO public.sub_papers (kind, number, revision, person_id, labor_job_id, sending_id, payment_id, period_from, period_to, snapshot, fingerprint, comes_to, still_open, issued_by_name)
    VALUES (p_kind, v_number, v_revision, p_person_id, p_labor_job_id, p_sending_id, p_payment_id, p_period_from, p_period_to, p_snapshot, COALESCE(p_fingerprint, ''), p_comes_to, p_still_open, v_name)
    RETURNING sub_papers.id INTO v_new;
  IF v_current.id IS NOT NULL THEN
    UPDATE public.sub_papers SET replaced_by = v_new WHERE sub_papers.id = v_current.id;
  END IF;
  RETURN QUERY SELECT v_new, v_number, v_revision, false;
END;
$$;

COMMENT ON FUNCTION public.mint_sub_paper(text, uuid, jsonb, text, uuid, uuid, uuid, date, date, numeric, numeric) IS
  'Punch list #350: register one sub paper and return its number and revision. A reprint of an unchanged paper returns the row it already has; a changed work statement or payment record becomes the next revision under the same number; a statement of account always takes the next SA number. Office staff only.';

REVOKE ALL ON FUNCTION public.mint_sub_paper(text, uuid, jsonb, text, uuid, uuid, uuid, date, date, numeric, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mint_sub_paper(text, uuid, jsonb, text, uuid, uuid, uuid, date, date, numeric, numeric) TO authenticated;

-- Void a paper: it keeps its number and reads void. The reason is kept.
CREATE OR REPLACE FUNCTION public.void_sub_paper(p_paper_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_office_staff() THEN
    RAISE EXCEPTION 'Only the office roles who see sub pay can void a sub paper.' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(btrim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'Say why the paper is void.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.sub_papers SET voided_at = now(), void_reason = btrim(p_reason) WHERE id = p_paper_id AND voided_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.void_sub_paper(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.void_sub_paper(uuid, text) TO authenticated;

-- House rules for every CREATE TABLE: training-mode blocks, the digital-twin fence and the archived seal.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
