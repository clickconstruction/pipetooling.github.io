SET lock_timeout = '3s';

-- v2.3099 — teacher attribution on BACKTEST scores (the shadow side landed in
-- v2.3080). twin_run_scores now records WHOSE sent number each backtest was
-- measured against, resolved from the reference bid the same way as shadows:
-- assigned estimator, else the sender who attested the send, else the creator.
-- Backfilled here for every existing row (2026-09-07: 23 scores, all resolve on
-- the first hop — 18 Wendi, 3 Malachi, 2 William). Additive, idempotent.

ALTER TABLE public.twin_run_scores ADD COLUMN IF NOT EXISTS teacher_user_id uuid;
ALTER TABLE public.twin_run_scores ADD COLUMN IF NOT EXISTS teacher_name text;
COMMENT ON COLUMN public.twin_run_scores.teacher_user_id IS
  'WHOSE number this backtest scored against: the reference bid''s estimator (else attested sender, else creator). Stamped by score_backtest; the Scoreboard treats non-calibration-standard teachers as practice.';
COMMENT ON COLUMN public.twin_run_scores.teacher_name IS 'Display snapshot of the teacher''s name at scoring time.';

UPDATE public.twin_run_scores s
   SET teacher_user_id = t.uid,
       teacher_name = u.name
  FROM (
    SELECT b.bid_number,
           COALESCE(b.estimator_id, b.bid_date_sent_attested_by, b.created_by) AS uid
      FROM public.bids b
     WHERE b.bid_number IS NOT NULL
  ) t
  LEFT JOIN public.users u ON u.id = t.uid
 WHERE s.teacher_user_id IS NULL
   AND s.reference_bid_number IS NOT NULL
   AND t.bid_number = regexp_replace(s.reference_bid_number, '^[bB]', '')
   AND t.uid IS NOT NULL;
