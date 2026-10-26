SET lock_timeout = '3s';

-- Customer reviews (v2.5896, punch list #185): the review a homeowner leaves us directly, from
-- the link the Review asked step texts after a job is paid. One row per job: the token's hash
-- (the link itself is never kept, the estimate's pattern), the stars and the words they left,
-- what they said we could have done better, whether they pressed Post it on Google, and the
-- office's follow-up call. The office reads and updates; the row is made through
-- customer_review_ask, which hands the token back once; the public page writes as the service
-- role through the customer-review function.

BEGIN;

CREATE TABLE IF NOT EXISTS public.customer_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  token_hash text NOT NULL
    CONSTRAINT customer_reviews_token_hash_shape CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  token_expires_at timestamptz NOT NULL,
  lang text NOT NULL DEFAULT 'en'
    CONSTRAINT customer_reviews_lang_known CHECK (lang IN ('en', 'es')),
  asked_at timestamptz NOT NULL DEFAULT now(),
  asked_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ask_count integer NOT NULL DEFAULT 1,
  opened_at timestamptz,
  answered_at timestamptz,
  stars smallint
    CONSTRAINT customer_reviews_stars_range CHECK (stars IS NULL OR stars BETWEEN 1 AND 5),
  words text
    CONSTRAINT customer_reviews_words_length CHECK (words IS NULL OR length(words) <= 1000),
  better text
    CONSTRAINT customer_reviews_better_length CHECK (better IS NULL OR length(better) <= 1000),
  google_pressed_at timestamptz,
  called_at timestamptz,
  called_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  call_note text
    CONSTRAINT customer_reviews_call_note_length CHECK (call_note IS NULL OR length(call_note) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_reviews_job_one UNIQUE (job_id),
  CONSTRAINT customer_reviews_token_hash_one UNIQUE (token_hash),
  CONSTRAINT customer_reviews_answer_whole CHECK ((answered_at IS NULL) = (stars IS NULL))
);

CREATE INDEX IF NOT EXISTS customer_reviews_customer_idx ON public.customer_reviews (customer_id);
CREATE INDEX IF NOT EXISTS customer_reviews_answered_idx ON public.customer_reviews (answered_at);

COMMENT ON TABLE public.customer_reviews IS
  'Customer reviews (v2.5896, punch list #185): one row per job, made by customer_review_ask when the office asks (the link''s SHA-256 only, 60 days), answered on /r/<token> through the customer-review function: stars 1 to 5, their words, what we could have done better, the Google press, and the office''s call.';
COMMENT ON COLUMN public.customer_reviews.token_hash IS 'SHA-256 of the link''s token, hex. The token itself is never stored; Ask again mints a new one and the old link dies.';
COMMENT ON COLUMN public.customer_reviews.ask_count IS 'How many times the link was made for this job. Each ask replaces the hash and the expiry.';
COMMENT ON COLUMN public.customer_reviews.google_pressed_at IS 'When they pressed Post it on Google. Whether they posted is never known.';
COMMENT ON COLUMN public.customer_reviews.called_at IS 'The office''s follow-up on a low score: when someone called, by whom, and what was said.';

DROP TRIGGER IF EXISTS customer_reviews_set_updated_at ON public.customer_reviews;
CREATE TRIGGER customer_reviews_set_updated_at
  BEFORE UPDATE ON public.customer_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.customer_reviews ENABLE ROW LEVEL SECURITY;

-- The office team reads every review and records its call; the row is made through the function below
-- and answered by the public page as the service role, so there is no insert policy.
DROP POLICY IF EXISTS customer_reviews_office_select ON public.customer_reviews;
CREATE POLICY customer_reviews_office_select ON public.customer_reviews
  FOR SELECT TO authenticated USING (public.gc_office_team());
DROP POLICY IF EXISTS customer_reviews_office_update ON public.customer_reviews;
CREATE POLICY customer_reviews_office_update ON public.customer_reviews
  FOR UPDATE TO authenticated USING (public.gc_office_team()) WITH CHECK (public.gc_office_team());
DROP POLICY IF EXISTS customer_reviews_office_delete ON public.customer_reviews;
CREATE POLICY customer_reviews_office_delete ON public.customer_reviews
  FOR DELETE TO authenticated USING (public.gc_office_team());

REVOKE ALL ON TABLE public.customer_reviews FROM PUBLIC, anon;
GRANT SELECT, UPDATE, DELETE ON TABLE public.customer_reviews TO authenticated;
GRANT ALL ON TABLE public.customer_reviews TO service_role;

-- The ask: the office makes (or remakes) the job's review link and gets the token back once. The row keeps the
-- hash and the expiry; a job already answered is refused in words, since the answer is the record.
CREATE OR REPLACE FUNCTION public.customer_review_ask(p_job_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_customer uuid;
  v_lang text;
  v_answered timestamptz;
  v_token text;
  v_hash text;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Sign in to ask for a review.' USING ERRCODE = 'P0001';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot ask for a review.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot ask for a review.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.gc_office_team() THEN
    RAISE EXCEPTION 'Only the office can ask for a review.' USING ERRCODE = '42501';
  END IF;
  SELECT j.customer_id INTO v_customer FROM public.jobs_ledger j WHERE j.id = p_job_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That job is not there.' USING ERRCODE = 'P0001';
  END IF;
  IF v_customer IS NULL THEN
    RAISE EXCEPTION 'This job has no customer yet. Add one on the job first.' USING ERRCODE = 'P0001';
  END IF;
  SELECT CASE WHEN c.language = 'es' THEN 'es' ELSE 'en' END INTO v_lang FROM public.customers c WHERE c.id = v_customer;
  SELECT r.answered_at INTO v_answered FROM public.customer_reviews r WHERE r.job_id = p_job_id;
  IF FOUND AND v_answered IS NOT NULL THEN
    RAISE EXCEPTION 'This job already has a review.' USING ERRCODE = 'P0001';
  END IF;
  -- 24 random bytes as URL-safe base64 with no padding: 32 characters, as the estimate's link reads.
  v_token := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');
  IF FOUND THEN
    UPDATE public.customer_reviews
       SET token_hash = v_hash,
           token_expires_at = now() + interval '60 days',
           asked_at = now(),
           asked_by = v_me,
           ask_count = ask_count + 1,
           lang = COALESCE(v_lang, lang),
           opened_at = NULL
     WHERE job_id = p_job_id;
  ELSE
    INSERT INTO public.customer_reviews (job_id, customer_id, token_hash, token_expires_at, lang, asked_by)
    VALUES (p_job_id, v_customer, v_hash, now() + interval '60 days', COALESCE(v_lang, 'en'), v_me);
  END IF;
  RETURN v_token;
END;
$$;

COMMENT ON FUNCTION public.customer_review_ask(uuid) IS
  'Customer reviews (v2.5896, punch list #185): makes or remakes the job''s review link and returns its token once; the row keeps the SHA-256 and a 60-day expiry, and an older link dies. The office team only; refuses a training account, a twin, a job not there, a job with no customer, and a job already answered.';

REVOKE ALL ON FUNCTION public.customer_review_ask(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customer_review_ask(uuid) TO authenticated;

COMMIT;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
