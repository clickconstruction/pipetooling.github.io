-- Add covering indexes for unindexed foreign keys on the HOT / sizable tables.
-- Addresses Supabase advisor `unindexed_foreign_keys`, scoped deliberately:
-- only tables with meaningful size and/or query activity (clock_sessions,
-- checklist_instances, jobs_ledger, people_hours, job_schedule_blocks, and the
-- large mercury_* tables) are indexed here. The ~110 remaining flagged FKs sit on
-- tiny/empty audit tables (8 kB / 0 rows) where an index adds write cost and
-- unused-index bloat for negligible benefit -- intentionally left unindexed.
-- All IF NOT EXISTS (idempotent); non-concurrent builds are sub-second at this scale.

BEGIN;

-- mercury_accounting_label_suggestions (2 MB, ~9.8k rows)
CREATE INDEX IF NOT EXISTS idx_macct_label_suggestions_final_label_id     ON public.mercury_accounting_label_suggestions (final_label_id);
CREATE INDEX IF NOT EXISTS idx_macct_label_suggestions_resolved_by        ON public.mercury_accounting_label_suggestions (resolved_by);
CREATE INDEX IF NOT EXISTS idx_macct_label_suggestions_suggested_label_id ON public.mercury_accounting_label_suggestions (suggested_label_id);

-- mercury_transaction_drag_sort_assignments (792 kB, ~10.4k rows)
CREATE INDEX IF NOT EXISTS idx_mtx_drag_sort_assignments_label_id ON public.mercury_transaction_drag_sort_assignments (label_id);

-- mercury_transaction_attributions (296 kB, ~4.6k rows)
CREATE INDEX IF NOT EXISTS idx_mtx_attributions_person_id ON public.mercury_transaction_attributions (person_id);

-- mercury_transaction_job_allocations (120 kB, ~1k rows)
CREATE INDEX IF NOT EXISTS idx_mtx_job_allocations_created_by ON public.mercury_transaction_job_allocations (created_by);

-- mercury_accounting_label_rules (128 kB, ~469 rows)
CREATE INDEX IF NOT EXISTS idx_macct_label_rules_created_by ON public.mercury_accounting_label_rules (created_by);

-- clock_sessions (280 kB, ~1.2k rows) -- hottest table in the incident
CREATE INDEX IF NOT EXISTS idx_clock_sessions_approved_by ON public.clock_sessions (approved_by);
CREATE INDEX IF NOT EXISTS idx_clock_sessions_rejected_by ON public.clock_sessions (rejected_by);
CREATE INDEX IF NOT EXISTS idx_clock_sessions_revoked_by  ON public.clock_sessions (revoked_by);
CREATE INDEX IF NOT EXISTS idx_clock_sessions_bid_id      ON public.clock_sessions (bid_id);

-- checklist_instances (432 kB, ~2.6k rows)
CREATE INDEX IF NOT EXISTS idx_checklist_instances_completed_by_user_id ON public.checklist_instances (completed_by_user_id);

-- checklist_instance_assignees (248 kB, ~2.6k rows)
CREATE INDEX IF NOT EXISTS idx_checklist_instance_assignees_user_id ON public.checklist_instance_assignees (user_id);

-- job_status_events (336 kB, ~1.6k rows)
CREATE INDEX IF NOT EXISTS idx_job_status_events_changed_by_user_id ON public.job_status_events (changed_by_user_id);

-- material_part_price_history (328 kB, ~1.4k rows)
CREATE INDEX IF NOT EXISTS idx_material_part_price_history_changed_by ON public.material_part_price_history (changed_by);

-- people_hours (248 kB, ~1.2k rows)
CREATE INDEX IF NOT EXISTS idx_people_hours_entered_by ON public.people_hours (entered_by);

-- bid_count_row_custom_prices (224 kB, ~1.8k rows)
CREATE INDEX IF NOT EXISTS idx_bid_count_row_custom_prices_count_row_id          ON public.bid_count_row_custom_prices (count_row_id);
CREATE INDEX IF NOT EXISTS idx_bid_count_row_custom_prices_price_book_version_id ON public.bid_count_row_custom_prices (price_book_version_id);

-- jobs_ledger (224 kB, ~675 rows)
CREATE INDEX IF NOT EXISTS idx_jobs_ledger_customer_id ON public.jobs_ledger (customer_id);

-- job_schedule_blocks (128 kB, ~703 rows)
CREATE INDEX IF NOT EXISTS idx_job_schedule_blocks_created_by ON public.job_schedule_blocks (created_by);

-- bids (152 kB, ~267 rows) -- account_manager_id is filtered ("my bids"); audit-only *_by cols skipped
CREATE INDEX IF NOT EXISTS idx_bids_account_manager_id ON public.bids (account_manager_id);

COMMIT;
