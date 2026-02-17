-- Add show_in_cost_matrix to people_pay_config (Show in Cost Matrix checkbox)
ALTER TABLE public.people_pay_config
ADD COLUMN IF NOT EXISTS show_in_cost_matrix BOOLEAN NOT NULL DEFAULT false;

COMMENT ON TABLE public.people_pay_config IS 'Pay config per person: wage, salary flag, show in Hours tab, show in cost matrix. Global; dev and approved masters only.';
