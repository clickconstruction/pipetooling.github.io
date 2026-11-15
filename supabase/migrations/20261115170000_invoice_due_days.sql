SET lock_timeout = '3s';

-- A bill's own due day (punch list #341, PR 4): one bill due on a named date.
--
-- A Pay calendar says when a payer's bills fall due, and a job can carry its own. Some bills
-- answer to neither: a retainage release, a dated draw once it is billed, a final payment. The
-- contract names a date for that one bill. The nearest thing the app had was a promised date
-- (They said), which is kept per job and so moves every open bill on it. One row here holds the
-- day for one bill, with the clause and a few of its words. It sits at the top of the ladder a
-- bill reads: the bill's own day, the job's calendar, the payer's calendar, the pace guess. A
-- bill with no row reads exactly as before.
--
-- Read by RLS through can_read_payment_promises(); written only by set_invoice_due_day behind
-- can_write_payment_promises(), the two gates the Pay calendar and the accepted day use.

CREATE TABLE IF NOT EXISTS public.invoice_due_days (
  invoice_id uuid PRIMARY KEY REFERENCES public.jobs_ledger_invoices(id) ON DELETE CASCADE,
  due_on date NOT NULL,
  clause text NOT NULL DEFAULT '',
  words text NOT NULL DEFAULT '',
  marked_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  marked_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoice_due_days_clause_len_check CHECK (char_length(clause) <= 40),
  CONSTRAINT invoice_due_days_words_len_check CHECK (char_length(words) <= 240)
);

COMMENT ON TABLE public.invoice_due_days IS
  'A bill''s own due day (punch list #341): one bill due on a named date, with the clause that says so. It wins over the job''s and the payer''s pay calendar for that one bill. Read by RLS (can_read_payment_promises()); written only by set_invoice_due_day.';

ALTER TABLE public.invoice_due_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invoice_due_days_select_billed_money ON public.invoice_due_days;
CREATE POLICY invoice_due_days_select_billed_money ON public.invoice_due_days
  FOR SELECT TO authenticated
  USING (public.can_read_payment_promises());

REVOKE ALL ON TABLE public.invoice_due_days FROM anon, authenticated;
GRANT SELECT ON TABLE public.invoice_due_days TO authenticated;
GRANT ALL ON TABLE public.invoice_due_days TO service_role;

-- Set, replace or clear (NULL day) one bill's own due day. Returns {dueOn, clause, words} or {cleared: true}.
CREATE OR REPLACE FUNCTION public.set_invoice_due_day(p_invoice_id uuid, p_due_on date, p_clause text DEFAULT '', p_words text DEFAULT '')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clause text := left(btrim(COALESCE(p_clause, '')), 40);
  v_words text := left(btrim(COALESCE(p_words, '')), 240);
BEGIN
  IF NOT COALESCE(public.can_write_payment_promises(), false) THEN
    RAISE EXCEPTION 'Not allowed to set the day a bill is due';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.jobs_ledger_invoices i WHERE i.id = p_invoice_id) THEN
    RAISE EXCEPTION 'Bill not found';
  END IF;

  IF p_due_on IS NULL THEN
    DELETE FROM public.invoice_due_days WHERE invoice_id = p_invoice_id;
    RETURN jsonb_build_object('cleared', true);
  END IF;

  INSERT INTO public.invoice_due_days (invoice_id, due_on, clause, words, marked_by, marked_at)
  VALUES (p_invoice_id, p_due_on, v_clause, v_words, auth.uid(), now())
  ON CONFLICT (invoice_id)
  DO UPDATE SET due_on = EXCLUDED.due_on,
                clause = EXCLUDED.clause,
                words = EXCLUDED.words,
                marked_by = EXCLUDED.marked_by,
                marked_at = now();
  RETURN jsonb_build_object('dueOn', to_char(p_due_on, 'YYYY-MM-DD'), 'clause', v_clause, 'words', v_words);
END;
$$;

COMMENT ON FUNCTION public.set_invoice_due_day(uuid, date, text, text) IS
  'Set, replace or clear (NULL day) one bill''s own due day, with its clause and a few words; stamps who marked it. Gated on can_write_payment_promises() (punch list #341).';

REVOKE EXECUTE ON FUNCTION public.set_invoice_due_day(uuid, date, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_invoice_due_day(uuid, date, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_invoice_due_day(uuid, date, text, text) TO authenticated;

-- The four fences every CREATE TABLE migration closes with (CLAUDE.md → DB migrations).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
