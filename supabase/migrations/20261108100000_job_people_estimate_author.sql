SET lock_timeout = '3s';

-- The estimate's author among the job's people (punch list #129, the leftovers; to-dos/estimator-money-word/README.md).
-- The owner's call of 2026-11-08: when a job is made from a signed estimate (auto_create_job_from_signed_estimate,
-- or the office's Create job on a signed estimate — either writes estimates.job_ledger_id), the estimator who wrote
-- the estimate sold the job as surely as a bid's estimator did, and hears the customer's word on paying first. Until
-- now is_job_people (20261019060000) knew only the bid's estimator or account manager and the job's account manager,
-- so a residential job from an estimate had no estimator among its people. This re-states the predicate with one
-- more leg: a signed-in estimator or primary who is estimates.created_by on a customer_accepted estimate that points
-- at the job and is not a change order (a change order is applied to a job, never the job's source). The role check
-- stays, so an author who has since become a helper opens nothing. Every gate that reads is_job_people — the promise
-- writes, the paid claim, the per-job and company reads, the money strips, a primary's paid verbs — widens with it;
-- none is re-stated. Nothing on jobs_ledger's or estimates' policies changes.
-- Idempotent: CREATE OR REPLACE, so a second run changes nothing.

CREATE OR REPLACE FUNCTION public.is_job_people(p_job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL
     AND p_job_id IS NOT NULL
     AND (
       public.is_office_staff()
       OR EXISTS (
            SELECT 1
            FROM public.jobs_ledger j
            LEFT JOIN public.bids b ON b.id = j.bid_id
            JOIN public.users u ON u.id = (SELECT auth.uid())
            WHERE j.id = p_job_id
              AND u.role IN ('estimator', 'primary')
              AND (
                j.account_manager_user_id = u.id
                OR b.estimator_id = u.id
                OR b.account_manager_id = u.id
                -- The author of the signed estimate the job came from (2026-11-08).
                OR EXISTS (
                     SELECT 1
                     FROM public.estimates e
                     WHERE e.job_ledger_id = j.id
                       AND e.created_by = u.id
                       AND e.status = 'customer_accepted'
                       AND e.doc_kind IS DISTINCT FROM 'change_order'
                   )
              )
          )
     );
$$;

COMMENT ON FUNCTION public.is_job_people(uuid) IS
  'The job''s people (punch list #129): the office (dev, master, assistant, controller), or an estimator or primary who is the job''s account manager, the estimator or account manager of the bid the job came from, or the author of the signed estimate the job came from (estimates.created_by, job_ledger_id, customer_accepted, not a change order). The scope for the customer''s word on paying.';

REVOKE ALL ON FUNCTION public.is_job_people(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_job_people(uuid) TO authenticated, service_role;
