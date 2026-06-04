-- User Review Modal: one-call lister returning Mercury tx rows for a user inside a calendar-day window,
-- flattened across job allocations and accounting (drag sort) label assignments.
--
-- Returns one row per (mercury_transaction, mercury_transaction_job_allocations) pair when allocations exist;
-- one row with NULL allocation fields when the tx is unallocated. Callers should pivot into per-job, per-label
-- buckets in app code (see src/lib/buildUserJobLabelBreakdown.ts).
--
-- Date window: company calendar day, America/Chicago (matches APP_CALENDAR_TZ in src/utils/dateUtils.ts).
-- Uses COALESCE(posted_at, created_at) so not-yet-posted rows still surface, matching BankingMercuryUserReview.
--
-- Sources:
--   * mercury_transaction_attributions.user_id = p_user_id            -> attribution_source = 'user'
--   * mercury_transaction_attributions.person_id IS NOT NULL          -> attribution_source = 'person'
--                                                                       (when p_include_person_attributed)
--
-- RLS: banking staff only (dev / master_technician / assistant) — same gate as
-- mercury_transaction_attributions and mercury_transaction_job_allocations policies.
--
-- Person-as-user mapping: this v1 RPC returns *every* person-attributed tx in the window when the flag is on.
-- Caller (UserReviewModal) labels each row with its source and never merges — see plan caveat #1.

CREATE OR REPLACE FUNCTION public.list_user_mercury_review_window(
  p_user_id                   uuid,
  p_start_ymd                 date,
  p_end_ymd                   date,
  p_include_person_attributed boolean DEFAULT true
)
RETURNS TABLE (
  mercury_transaction_id uuid,
  posted_at              timestamptz,
  created_at             timestamptz,
  amount                 numeric(18, 4),
  counterparty_name      text,
  attribution_source     text,
  attribution_person_id  uuid,
  label_id               uuid,
  label_name             text,
  allocation_id          uuid,
  job_id                 uuid,
  allocation_amount      numeric(18, 4)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant')
  ) THEN
    RAISE EXCEPTION 'list_user_mercury_review_window: not authorized';
  END IF;

  RETURN QUERY
  WITH win AS (
    SELECT
      ((p_start_ymd::timestamp)            AT TIME ZONE 'America/Chicago') AS lo,
      (((p_end_ymd + INTEGER '1')::timestamp) AT TIME ZONE 'America/Chicago') AS hi
  ),
  tx AS (
    SELECT
      t.id,
      t.posted_at,
      t.created_at,
      t.amount,
      t.counterparty_name,
      a.user_id,
      a.person_id,
      CASE
        WHEN a.user_id = p_user_id THEN 'user'
        WHEN a.person_id IS NOT NULL AND p_include_person_attributed THEN 'person'
      END AS attribution_source
    FROM public.mercury_transactions t
    JOIN public.mercury_transaction_attributions a
      ON a.mercury_transaction_id = t.id
    CROSS JOIN win
    WHERE COALESCE(t.posted_at, t.created_at) >= win.lo
      AND COALESCE(t.posted_at, t.created_at) <  win.hi
      AND (
        a.user_id = p_user_id
        OR (p_include_person_attributed AND a.person_id IS NOT NULL)
      )
  )
  SELECT
    tx.id,
    tx.posted_at,
    tx.created_at,
    tx.amount,
    tx.counterparty_name,
    tx.attribution_source,
    tx.person_id,
    l.id   AS label_id,
    l.name AS label_name,
    al.id  AS allocation_id,
    al.job_id,
    al.amount AS allocation_amount
  FROM tx
  LEFT JOIN public.mercury_transaction_drag_sort_assignments asg
    ON asg.mercury_transaction_id = tx.id
  LEFT JOIN public.mercury_drag_sort_labels l
    ON l.id = asg.label_id
  LEFT JOIN public.mercury_transaction_job_allocations al
    ON al.mercury_transaction_id = tx.id
  WHERE tx.attribution_source IS NOT NULL
  ORDER BY
    COALESCE(tx.posted_at, tx.created_at) DESC NULLS LAST,
    tx.id,
    al.id NULLS FIRST;
END;
$$;

COMMENT ON FUNCTION public.list_user_mercury_review_window(uuid, date, date, boolean) IS
  'User Review Modal: returns Mercury tx rows (joined to job allocations + drag-sort label) attributed to a user (and optionally any person-attributed tx) within a company-calendar-day window. Banking staff only.';

REVOKE ALL    ON FUNCTION public.list_user_mercury_review_window(uuid, date, date, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_user_mercury_review_window(uuid, date, date, boolean) TO authenticated;
