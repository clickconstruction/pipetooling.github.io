SET lock_timeout = '3s';

-- The customer's own word (v2.5876, item 6 of the measuring follow-ups after the Zendesk/Intercom
-- comparison, 2026-10-26): both tools anchor on a rating the customer gives after the conversation;
-- the app had none. One row per ask: the office mints a link ({rate} in the reply box, the next PR),
-- the customer opens /rate?t=<public_token> and answers with one tap (the job-rating function, service
-- role), and The last 7 days counts asked, answered and the score. The token is plaintext like
-- job_contracts.public_token and bid_proposal_rooms.public_token: the link rides a text, and it can
-- reach nothing but this one rating's score and words.

CREATE TABLE IF NOT EXISTS public.customer_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  contact_id uuid,
  job_id uuid,
  customer_name text NOT NULL DEFAULT '',
  public_token text NOT NULL DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  asked_by uuid,
  asked_at timestamptz NOT NULL DEFAULT now(),
  score integer CHECK (score >= 1 AND score <= 5),
  words text NOT NULL DEFAULT '',
  answered_at timestamptz
);

COMMENT ON TABLE public.customer_ratings IS
  'One rating ask to a customer (v2.5876): minted by mint_customer_rating ({rate} in the reply box), answered with one tap at /rate?t=<public_token> through the job-rating function. score 1..5 and words are the customer''s; answered_at stamps the first answer and a later tap may change the score. No foreign keys: the ask outlives a merged contact or a deleted job.';
COMMENT ON COLUMN public.customer_ratings.contact_id IS 'The Messages contact the ask went to (no FK: the history outlives a merge).';
COMMENT ON COLUMN public.customer_ratings.job_id IS 'The job the ask was about, when one was tied (no FK).';
COMMENT ON COLUMN public.customer_ratings.public_token IS 'The /rate?t= link''s token, plaintext like job_contracts.public_token: it reaches this one rating alone.';

CREATE UNIQUE INDEX IF NOT EXISTS customer_ratings_public_token_idx ON public.customer_ratings (public_token);
CREATE INDEX IF NOT EXISTS customer_ratings_asked_at_idx ON public.customer_ratings (asked_at DESC);
CREATE INDEX IF NOT EXISTS customer_ratings_contact_idx ON public.customer_ratings (contact_id);

ALTER TABLE public.customer_ratings ENABLE ROW LEVEL SECURITY;

-- The office reads (the strip, the thread); writes go through mint_customer_rating and the
-- job-rating function's service role alone.
DO $$ BEGIN
  CREATE POLICY customer_ratings_office_read ON public.customer_ratings
    FOR SELECT TO authenticated USING (public.gc_office_team());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- The office mints an ask. A fresh unanswered ask to the same person about the same job is reused,
-- so a re-send never forks the asked count.
CREATE OR REPLACE FUNCTION public.mint_customer_rating(p_contact_id uuid, p_job_id uuid DEFAULT NULL, p_customer_name text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.customer_ratings%ROWTYPE;
  v_name text := left(COALESCE(TRIM(p_customer_name), ''), 200);
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT public.gc_office_team() THEN RETURN jsonb_build_object('error', 'Not authorized'); END IF;
  IF p_contact_id IS NULL THEN RETURN jsonb_build_object('error', 'Name the contact the ask goes to'); END IF;
  SELECT * INTO v_row FROM public.customer_ratings
    WHERE contact_id = p_contact_id AND answered_at IS NULL
      AND job_id IS NOT DISTINCT FROM p_job_id
      AND asked_at > now() - interval '30 days'
    ORDER BY asked_at DESC LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'rating_id', v_row.id, 'token', v_row.public_token, 'reused', true);
  END IF;
  INSERT INTO public.customer_ratings (contact_id, job_id, customer_name, asked_by)
  VALUES (p_contact_id, p_job_id, v_name, auth.uid())
  RETURNING * INTO v_row;
  RETURN jsonb_build_object('ok', true, 'rating_id', v_row.id, 'token', v_row.public_token, 'reused', false);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.mint_customer_rating(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mint_customer_rating(uuid, uuid, text) TO authenticated;
COMMENT ON FUNCTION public.mint_customer_rating(uuid, uuid, text) IS
  'Mint a rating ask (v2.5876): a customer_ratings row whose public_token the {rate} fill puts in the link. Office roles (gc_office_team). Reuses a fresh unanswered ask to the same contact about the same job.';

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
