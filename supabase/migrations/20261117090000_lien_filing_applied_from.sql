-- v2.7505 — Lien filings: a notice applied from a paper already on record
-- (the migration alone; the Lien desk's route follows in its own PR).
--
-- A § 53.056 notice sometimes goes out as one paper for several jobs at a
-- property and is recorded on some of them, or with the months it printed
-- and not the month the desk later asks about. The desk then keeps asking a
-- job for a notice that went, and offers to print and mail a second one.
-- The office needs to say "that paper stands for this job's month" without
-- typing the paper in again and without changing the row that records it.
--
-- So a filing can point at the filing that holds the paper. The new row sits
-- on the job it is applied to, with the months that job stands on, the
-- paper's own day, mail numbers, total and saved copy, and four new facts:
-- which row it was applied from, that row's job as the office read it, the
-- reason typed, and who applied it. The paper's own row is never changed.
-- Undo is the void every filing already has.
--
-- Every reader of a job's notices reads filing rows (list_lien_notice_months,
-- list_lien_affidavit_windows, the affidavit's notice paragraph), so none of
-- them changes. Additive, a default on every column; nothing writes the
-- columns until the route's client ships.
SET lock_timeout = '3s';

ALTER TABLE public.job_lien_filings
  ADD COLUMN IF NOT EXISTS applied_from uuid REFERENCES public.job_lien_filings(id),
  ADD COLUMN IF NOT EXISTS applied_from_label text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS applied_reason text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS applied_by_name text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.job_lien_filings.applied_from IS 'Lien filings (v2.7505): set on a notice row that applies a paper already on record to this job. It points at the filing that holds the paper, on this job or another job at the same property. NULL on every row that records its own paper. The row pointed at is never changed; voiding this row is the undo.';
COMMENT ON COLUMN public.job_lien_filings.applied_from_label IS 'Lien filings (v2.7505): the job the paper was recorded on, as the office read it when applying (its job number), so the row can say "as part of the notice on job N" without a second read. Empty on a row that records its own paper.';
COMMENT ON COLUMN public.job_lien_filings.applied_reason IS 'Lien filings (v2.7505): why the paper stands for this job''s months, typed by the office when the desk warned (a month the paper does not print, no copy to the original contractor on record, a day outside the month''s window). Empty when nothing was warned about.';
COMMENT ON COLUMN public.job_lien_filings.applied_by_name IS 'Lien filings (v2.7505): the name of the person who applied the paper, kept beside created_by so the row reads without a join. Empty on a row that records its own paper.';

-- An applied row is a monthly notice, and never points at itself.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'job_lien_filings_applied_from_chk'
      AND conrelid = 'public.job_lien_filings'::regclass
  ) THEN
    ALTER TABLE public.job_lien_filings
      ADD CONSTRAINT job_lien_filings_applied_from_chk
      CHECK (applied_from IS NULL OR (kind = 'notice_53_056' AND applied_from <> id));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS job_lien_filings_applied_from_idx ON public.job_lien_filings (applied_from) WHERE applied_from IS NOT NULL;
