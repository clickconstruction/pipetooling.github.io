SET lock_timeout = '3s';

-- Punch list #52 follow-up (v2.6672): the comment on people_pay_config.vehicle_rate_override
-- still read as 20260903233954 wrote it — "replaces the computed vehicle rate" — while since
-- v2.4653 (punch list #52 PR 5) the override is the vehicle line's FIXED part only: insurance +
-- registration + service + wear per field hour. Fuel is never in it. Fuel stays on the jobs it
-- was put on, and Review adds the person's fuel on no job beside the fixed rate. A comment
-- change takes a brief lock on the table's row in pg_description only; no data moves.

COMMENT ON COLUMN public.people_pay_config.vehicle_rate_override IS
  'Manual FIXED $/field hour for the vehicle line, replacing only the computed fixed part (insurance + registration + service + wear ÷ field hours, trailing 90 days). Never fuel: fuel stays on the jobs, and Review adds the person''s fuel on no job beside it. NULL = computed. v2.2733; fixed part only since v2.4653 (v2.6672)';
