-- v2.3763 — Lien filings: a link to the saved copy, and the columns the
-- by-hand record and the combined notice need (punch list #35, PR 1 of 3).
--
-- Taunya mailed a § 53.056 notice on 2026-09-22 (job 273 with 858 and 866 at
-- the same property, one paper, $28,987) and the app never learned of it: the
-- filings table had no row for any notice ever, and no row could have pointed
-- at the PDF she saved. Every filing now carries a link to the saved copy and a
-- note, both plain text. The three further columns land here so one push
-- serves the stream: packet_id (the filings one paper covered share it, PR 2
-- and PR 3), by_hand (recorded after the fact, not by the run, PR 2) and
-- printed_claim (the total the paper claimed when it differs from this job's
-- amount, PR 2). Additive, defaults on every column; the client sends the
-- new keys only when they carry a value, so a client deployed before this
-- push keeps recording.
SET lock_timeout = '3s';

ALTER TABLE public.job_lien_filings
  ADD COLUMN IF NOT EXISTS document_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS document_note text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS packet_id uuid,
  ADD COLUMN IF NOT EXISTS by_hand boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS printed_claim numeric(12,2);

COMMENT ON COLUMN public.job_lien_filings.document_url IS 'Lien filings (v2.3763): a link to the saved copy of the paper as sent or filed — a Drive link, plain text. Empty when nobody kept one.';
COMMENT ON COLUMN public.job_lien_filings.document_note IS 'Lien filings (v2.3763): one line beside the link — where the copy lives, what the file is.';
COMMENT ON COLUMN public.job_lien_filings.packet_id IS 'Lien filings (v2.3763, for #35 PR 2/3): the filings one paper covered share this id — a notice recorded by hand across several jobs at one property, or a combined notice the run printed.';
COMMENT ON COLUMN public.job_lien_filings.by_hand IS 'Lien filings (v2.3763, for #35 PR 2): recorded after the fact for a paper that went out outside the run.';
COMMENT ON COLUMN public.job_lien_filings.printed_claim IS 'Lien filings (v2.3763, for #35 PR 2): the total the paper claimed when it differs from this job''s amount (one paper over several jobs). NULL when the paper claimed the amount.';

CREATE INDEX IF NOT EXISTS job_lien_filings_packet_idx ON public.job_lien_filings (packet_id) WHERE packet_id IS NOT NULL;
