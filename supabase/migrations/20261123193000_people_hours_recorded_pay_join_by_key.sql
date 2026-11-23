SET lock_timeout = '3s';

-- Recorded time finds a person's pay row by its key (punch list #430). people_hours_recorded, the view job costing reads
-- (a job's Cost and Labor panels, Jobs crew P&L, bid labor and pricing, the Projects board), joins people_pay_config as
-- pc.person_name = COALESCE(ph.person_name, p.person_name): the name from whichever side of the FULL OUTER JOIN has the
-- row. Postgres uses a join clause as an index condition on a table with row policies only when it can prove the clause
-- leaks nothing, and it does not prove that of a COALESCE (v2.8301, Documents → Photos, taught it). people_pay_config's
-- self-read policy reads person_name, so the pay rows were filtered whole under their policies for every person-day
-- instead of found by the primary key.
--
-- The view is restated from its only definition, 20260909022534_recorded_time_costing.sql, with that join clause
-- written as a CASE and nothing else changed:
--   pc.person_name = CASE WHEN ph.person_name IS NOT NULL THEN ph.person_name ELSE p.person_name END
-- The CASE picks the same name the COALESCE picked, so every row is the same. The person_name column still reads the
-- COALESCE: one in the select list costs nothing. The six columns are the same and in the same order, so the grant,
-- the generated types and the dev seat's catalog stay as they are. security_invoker as before.
--
-- Either order with the client: it reads the same columns from the old view and the new. No table is made, so there is
-- no fence to call. Safe to run twice. Doc: docs/migrations/20261123193000_people_hours_recorded_pay_join_by_key.md.

CREATE OR REPLACE VIEW public.people_hours_recorded
WITH (security_invoker = true)
AS
WITH pending AS (
  SELECT
    trim(u.name) AS person_name,
    cs.work_date,
    SUM(EXTRACT(EPOCH FROM (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0) AS hours
  FROM public.clock_sessions cs
  JOIN public.users u ON u.id = cs.user_id
  WHERE cs.clocked_out_at IS NOT NULL
    AND cs.clocked_out_at > cs.clocked_in_at
    AND cs.approved_at IS NULL
    AND cs.rejected_at IS NULL
    AND cs.revoked_at IS NULL
    AND trim(u.name) <> ''
  GROUP BY trim(u.name), cs.work_date
)
SELECT
  COALESCE(ph.person_name, p.person_name) AS person_name,
  COALESCE(ph.person_id, pc.person_id)    AS person_id,
  COALESCE(ph.work_date, p.work_date)     AS work_date,
  (COALESCE(ph.hours, 0) + COALESCE(p.hours, 0))::numeric AS hours,
  COALESCE(ph.hours, 0)::numeric          AS approved_hours,
  COALESCE(p.hours, 0)::numeric           AS pending_hours
FROM public.people_hours ph
FULL OUTER JOIN pending p
  ON p.person_name = ph.person_name AND p.work_date = ph.work_date
LEFT JOIN public.people_pay_config pc
  ON pc.person_name = CASE WHEN ph.person_name IS NOT NULL THEN ph.person_name ELSE p.person_name END;

COMMENT ON VIEW public.people_hours_recorded IS
  'Recorded time per person/day (v2.3179): people_hours (approved + manual) plus closed clock sessions still awaiting approval. Job COSTING reads this; PAYROLL keeps reading people_hours. security_invoker — the caller''s RLS on people_hours / clock_sessions applies.';

GRANT SELECT ON public.people_hours_recorded TO authenticated;
