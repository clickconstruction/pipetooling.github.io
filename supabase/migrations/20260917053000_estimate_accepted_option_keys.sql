SET lock_timeout = '3s';

-- Estimate options, approve more than one (v2.3554, PR 1 of
-- to-dos/estimate-options-approve-several/). Each option in estimates.options_snapshot now
-- carries a kind — a choice (pick exactly one) or an add-on (tick any) — and acceptance may
-- freeze several options at once. The frozen lines and total still land in
-- line_items_snapshot / total_cents (every downstream reader is unchanged); this column keeps
-- WHICH options were accepted, in offered order. accepted_option_key stays: the chosen choice,
-- or NULL when the estimate had no choice group. Additive; no new table, so no read-only
-- re-appliers.

ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS accepted_option_keys text[];

COMMENT ON COLUMN public.estimates.accepted_option_keys IS
  'v2.3554: every option key the customer accepted, in offered order (choice + add-ons). NULL = accepted before add-ons existed, or a single-option estimate; accepted_option_key keeps the chosen choice.';
