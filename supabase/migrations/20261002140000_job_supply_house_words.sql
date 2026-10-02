SET lock_timeout = '3s';

-- What the house told us (v2.4411): supply houses on the Lien desk, step 3.
-- The desk's card estimates when a supply house's own § 53.056 notice is due on a job, from the
-- house's unpaid invoice dates. The house keeps its own calendar and its own balance: on the job
-- that started this work the house said its notice goes out on Oct 14 and named a balance that
-- was not the one in our books. This is where that gets written down: one row per job and
-- house, the latest word, with who said it and who wrote it. Clearing a word deletes the row.
CREATE TABLE IF NOT EXISTS public.job_supply_house_words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  supply_house_id uuid NOT NULL REFERENCES public.supply_houses(id) ON DELETE CASCADE,
  -- The house's own figure for what it is still owed on this job.
  their_balance numeric(12, 2)
    CONSTRAINT job_supply_house_words_balance_check CHECK (their_balance IS NULL OR their_balance >= 0),
  -- The day the house says its own notice goes out.
  notice_on date,
  -- Who at the house said it.
  said_by text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  noted_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  noted_by_name text NOT NULL DEFAULT '',
  noted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_supply_house_words_job_house_uniq UNIQUE (job_id, supply_house_id),
  CONSTRAINT job_supply_house_words_says_something CHECK (their_balance IS NOT NULL OR notice_on IS NOT NULL OR btrim(note) <> '')
);

COMMENT ON TABLE public.job_supply_house_words IS
  'What the house told us (v2.4411): per (job, supply house), the house''s own balance on the job and the day it says its own lien notice goes out, with who said it and who wrote it down. The Lien desk''s Supply houses on this job card shows it over the app''s estimate. One row = the latest word; no row = nothing recorded.';

CREATE INDEX IF NOT EXISTS job_supply_house_words_job_idx ON public.job_supply_house_words (job_id);

ALTER TABLE public.job_supply_house_words ENABLE ROW LEVEL SECURITY;

-- The office set that works the Lien desk (dev, assistant-like, master) — same as job_lien_desk_items.
DROP POLICY IF EXISTS job_supply_house_words_select_office ON public.job_supply_house_words;
CREATE POLICY job_supply_house_words_select_office
  ON public.job_supply_house_words FOR SELECT TO authenticated
  USING (
    public.is_dev()
    OR public.is_assistant()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'master_technician')
  );

DROP POLICY IF EXISTS job_supply_house_words_insert_office ON public.job_supply_house_words;
CREATE POLICY job_supply_house_words_insert_office
  ON public.job_supply_house_words FOR INSERT TO authenticated
  WITH CHECK (
    public.is_dev()
    OR public.is_assistant()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'master_technician')
  );

DROP POLICY IF EXISTS job_supply_house_words_update_office ON public.job_supply_house_words;
CREATE POLICY job_supply_house_words_update_office
  ON public.job_supply_house_words FOR UPDATE TO authenticated
  USING (
    public.is_dev()
    OR public.is_assistant()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'master_technician')
  )
  WITH CHECK (
    public.is_dev()
    OR public.is_assistant()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'master_technician')
  );

DROP POLICY IF EXISTS job_supply_house_words_delete_office ON public.job_supply_house_words;
CREATE POLICY job_supply_house_words_delete_office
  ON public.job_supply_house_words FOR DELETE TO authenticated
  USING (
    public.is_dev()
    OR public.is_assistant()
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'master_technician')
  );

-- Who wrote it and when are stamped on the server, whatever the client sends.
CREATE OR REPLACE FUNCTION public.job_supply_house_words_stamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.noted_by := auth.uid();
  NEW.noted_at := now();
  RETURN NEW;
END;
$$;
-- A trigger function is never called by hand.
REVOKE ALL ON FUNCTION public.job_supply_house_words_stamp() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS job_supply_house_words_stamp ON public.job_supply_house_words;
CREATE TRIGGER job_supply_house_words_stamp
  BEFORE INSERT OR UPDATE ON public.job_supply_house_words
  FOR EACH ROW EXECUTE FUNCTION public.job_supply_house_words_stamp();

-- House rules: read-only training mode + the twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
