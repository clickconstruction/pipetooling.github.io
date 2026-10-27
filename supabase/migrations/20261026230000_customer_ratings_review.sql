SET lock_timeout = '3s';

-- The rating ask becomes the owner's review ask (v2.5934, punch list #185; the plan to-dos/customer-reviews/). The
-- one-tap rating of v2.5876 (customer_ratings, mint_customer_rating, the job-rating function, /rate) is the review's
-- table and page; this adds what the owner asked for on top of it:
--
--   * customer_ratings.opened_at: the first time the link was opened, so the office reads asked, opened, answered.
--   * customer_ratings.google_pressed_at: they pressed Post it on Google after answering. Whether they posted is never
--     known; the press is the honest fact.
--   * customer_ratings.called_at, called_by, call_note: the office's call on a low score, recorded through
--     customer_rating_called below (the table has no client write, as v2.5876 made it).
--   * app_settings google_review_link_v1: the company's own Google review link, '' as it ships. The page names Google
--     only while it holds an https address. The owner or a dev changes it (is_master_or_dev()), keyed to this row alone.
--
-- No table is made, so no fence is added (customer_ratings has its three since v2.5876). Additive and idempotent: the
-- columns are added only when missing, the row is inserted only when missing, the function and the policy are made
-- again.

ALTER TABLE public.customer_ratings
  ADD COLUMN IF NOT EXISTS opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS google_pressed_at timestamptz,
  ADD COLUMN IF NOT EXISTS called_at timestamptz,
  ADD COLUMN IF NOT EXISTS called_by uuid,
  ADD COLUMN IF NOT EXISTS call_note text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.customer_ratings.opened_at IS 'The first time the /rate link was opened (the job-rating function''s GET), v2.5934.';
COMMENT ON COLUMN public.customer_ratings.google_pressed_at IS 'When they pressed Post it on Google after answering (v2.5934). Whether they posted is never known.';
COMMENT ON COLUMN public.customer_ratings.called_at IS 'The office''s call on the answer (v2.5934), through customer_rating_called.';
COMMENT ON COLUMN public.customer_ratings.called_by IS 'Who recorded the call (no FK, as the table''s other people).';
COMMENT ON COLUMN public.customer_ratings.call_note IS 'What was said on the call, the office''s words, up to 1,000 characters.';

-- The office records its call on an answer. Office roles (gc_office_team), never a training account or a twin.
CREATE OR REPLACE FUNCTION public.customer_rating_called(p_rating_id uuid, p_note text DEFAULT '')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Sign in to record the call.'); END IF;
  IF public.is_read_only() THEN RETURN jsonb_build_object('error', 'A training account cannot record a call.'); END IF;
  IF public.is_digital_twin() THEN RETURN jsonb_build_object('error', 'A digital twin cannot record a call.'); END IF;
  IF NOT public.gc_office_team() THEN RETURN jsonb_build_object('error', 'Only the office records a call.'); END IF;
  UPDATE public.customer_ratings
     SET called_at = now(), called_by = auth.uid(), call_note = left(COALESCE(btrim(p_note), ''), 1000)
   WHERE id = p_rating_id
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN RETURN jsonb_build_object('error', 'That rating is not there.'); END IF;
  RETURN jsonb_build_object('ok', true, 'rating_id', v_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.customer_rating_called(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customer_rating_called(uuid, text) TO authenticated;
COMMENT ON FUNCTION public.customer_rating_called(uuid, text) IS
  'Record the office''s call on a rating (v2.5934, punch list #185): stamps called_at and called_by and keeps the note. Office roles (gc_office_team); refuses a training account and a twin.';

INSERT INTO public.app_settings (key, value_text)
VALUES ('google_review_link_v1', '')
ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS master_or_dev_update_google_review_link ON public.app_settings;
CREATE POLICY master_or_dev_update_google_review_link ON public.app_settings
  FOR UPDATE TO authenticated
  USING (key = 'google_review_link_v1' AND public.is_master_or_dev())
  WITH CHECK (key = 'google_review_link_v1' AND public.is_master_or_dev());
