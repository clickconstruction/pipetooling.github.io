SET lock_timeout = '3s';

-- v2.6584 · Punch list #255 · The customer's words reach the techs on the job.
--
-- A customer's answer on /rate (customer_ratings, v2.5876; the review ask v2.5934) stopped at the office. Now a
-- 4 or 5 star answer is credited to every tech with a clock session on the job, and reaches them the day it lands as
-- a green strip on their home. Three stars or fewer stay with the office (Needs you), as the card's call 1 decided.
--
-- my_customer_words() is the tech's read, on auth.uid() alone: the answered ratings of the last eight weeks, four
-- stars or more, on jobs the caller clocked onto (a session not revoked or rejected), with the job's name, number and
-- address and whether the caller pressed Got it. customer_ratings itself stays closed to techs: the read sends the
-- customer's name, stars and words and nothing of the ask (no token, no contact, no call note).
--
-- rating_credit_seen holds the Got it press: one row a tech a rating. A tech reads and writes their own rows only.

CREATE TABLE IF NOT EXISTS public.rating_credit_seen (
  rating_id uuid NOT NULL REFERENCES public.customer_ratings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (rating_id, user_id)
);

COMMENT ON TABLE public.rating_credit_seen IS
  'Punch list #255 (v2.6584): a tech pressed Got it on a customer''s words credited to them (the green strip on their home). One row a tech a rating; the strip hides the rating for that tech and the week''s card keeps it.';

ALTER TABLE public.rating_credit_seen ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rating_credit_seen_own_read ON public.rating_credit_seen;
CREATE POLICY rating_credit_seen_own_read ON public.rating_credit_seen FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_dev());

DROP POLICY IF EXISTS rating_credit_seen_own_press ON public.rating_credit_seen;
CREATE POLICY rating_credit_seen_own_press ON public.rating_credit_seen FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS rating_credit_seen_dev_delete ON public.rating_credit_seen;
CREATE POLICY rating_credit_seen_dev_delete ON public.rating_credit_seen FOR DELETE TO authenticated
  USING (public.is_dev());

REVOKE ALL ON public.rating_credit_seen FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.rating_credit_seen TO authenticated;

CREATE OR REPLACE FUNCTION public.my_customer_words()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', r.id,
      'customer_name', coalesce(r.customer_name, ''),
      'score', r.score,
      'words', coalesce(r.words, ''),
      'answered_at', r.answered_at,
      'google_pressed_at', r.google_pressed_at,
      'job_id', r.job_id,
      'job_number', COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), ''),
      'job_name', COALESCE(jl.job_name, ''),
      'job_address', COALESCE(jl.job_address, ''),
      'seen_at', s.seen_at
    ) ORDER BY r.answered_at DESC)
    FROM public.customer_ratings r
    JOIN public.jobs_ledger jl ON jl.id = r.job_id
    LEFT JOIN public.rating_credit_seen s ON s.rating_id = r.id AND s.user_id = auth.uid()
    WHERE auth.uid() IS NOT NULL
      AND r.answered_at IS NOT NULL
      AND r.score >= 4
      AND r.answered_at >= now() - interval '56 days'
      AND EXISTS (
        SELECT 1 FROM public.clock_sessions cs
        WHERE cs.job_ledger_id = r.job_id
          AND cs.user_id = auth.uid()
          AND cs.revoked_at IS NULL
          AND cs.rejected_at IS NULL
      )
  ), '[]'::jsonb);
$$;

COMMENT ON FUNCTION public.my_customer_words() IS
  'Punch list #255 (v2.6584): the signed-in tech''s credited customer words. The answered ratings of the last 56 days at four stars or more on jobs the caller holds a clock session on (not revoked, not rejected): the customer''s name, stars, words, the day, the Google press, the job''s number, name and address, and the caller''s Got it. Nothing of the ask itself. [] for everyone else.';

REVOKE ALL ON FUNCTION public.my_customer_words() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_customer_words() TO authenticated;

select public.apply_read_only_write_blocks();
select public.apply_read_only_stmt_blocks();
select public.apply_digital_twin_write_blocks();
select public.apply_archived_read_blocks();
