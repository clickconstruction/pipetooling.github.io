-- Job Mode Customers tab (v2.913): field crew (any authenticated user) may READ
-- a customer when one of that customer's jobs has a schedule block assigned to
-- them — the tab lists "customers who have been or are on my schedule", and the
-- existing SELECT policies (owning master / dev / master_technician / adopted
-- assistants) returned nothing for subcontractors and helpers.
--
-- SECURITY DEFINER helper: the check must see jobs_ledger/job_schedule_blocks
-- rows regardless of the caller's own RLS on those tables (a block can exist on
-- a job the assignee is not a team member of). Read-only, additive, idempotent.
CREATE OR REPLACE FUNCTION public.user_has_schedule_block_for_customer(p_customer_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM jobs_ledger jl
    JOIN job_schedule_blocks jsb ON jsb.job_id = jl.id
    WHERE jl.customer_id = p_customer_id
      AND jsb.assignee_user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.user_has_schedule_block_for_customer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_schedule_block_for_customer(uuid) TO authenticated;

DROP POLICY IF EXISTS "Field crew see customers on their schedule" ON "public"."customers";
CREATE POLICY "Field crew see customers on their schedule" ON "public"."customers"
  FOR SELECT USING (public.user_has_schedule_block_for_customer("id"));
