# 20260904211244_sub_work_orders_from_sheets

**Sub work orders from sheets (v2.2785, PR 1 of 5)** — a `step_commitments` row may now anchor to a Sub Labor sheet instead of a workflow step; the scope library and the Contract Book's `sub` audience arrive with it.

## What it does

- `step_commitments.step_id` drops NOT NULL. New CHECK `step_commitments_anchor_check` (`step_id IS NOT NULL OR labor_job_id IS NOT NULL`). Partial unique index `step_commitments_sheet_live_uniq` on `labor_job_id` where `step_id IS NULL AND status <> 'cancelled'` (one live work order per sheet). Index on `labor_job_id`. New `signer_acknowledgements jsonb` (what the sub ticked at signing, `[{text, acknowledgedAt}]`). Column comments document the extended `offer_scope_snapshot` shape (`anchor`, `sheetLabel`, `exclusions`, `references`, `acknowledgements`, `bond`, `specialProvisions`).
- Trigger `people_labor_jobs_drop_sheet_work_orders_del` (BEFORE DELETE on `people_labor_jobs`): deletes the sheet's own work order (`step_id IS NULL`) so the anchor CHECK can never be violated by the existing `ON DELETE SET NULL` FK. Step-anchored rows keep SET NULL.
- `can_access_sub_work_order(p_step_id, p_labor_job_id)` (SECURITY DEFINER, STABLE): step rows → `can_access_project_via_step`; sheet rows → office set + superintendent. All four `step_commitments` policies (`sc_select/insert/update/delete`) are dropped and recreated on it; the sub's own-row read clauses are unchanged.
- `respond_to_work_order` (CREATE OR REPLACE, same signature): sheet-anchored orders skip the step-date write, name the sheet (`job_number · address`) as `project_name`, return `labor_job_id`, and notify the creator else the sheet's `master_user_id`.
- `settle_step_commitment` (CREATE OR REPLACE, same signature): a sheet-anchored order settles in place (status → settled, no new sheet or line; report has `created_new_sheet=false`, `job_number` from the sheet). Step orders are byte-for-byte the previous behaviour.
- New table `sub_scope_items` (`service_type_id` nullable → all trades, `kind` scope | exclusion | acknowledgement, `label`, `is_default`, `sequence_order`, `archived_at`, `created_by`, timestamps). RLS: read = office set + superintendent; write = dev / master / assistant / controller. Seeds 16 starter rows only when the table is empty (10 all-trades scope lines, 3 exclusions, 3 acknowledgements).
- `contract_template_documents_audience_check` widened to `staff | customer | sub`.
- Ends with both read-only appliers and the digital-twin write fence.

## Order

Push before deploying PR 2's client (the Work order panel inserts `step_id = NULL` rows, which the old NOT NULL rejects). `sub-portal` / `submit-sub-portal` redeploy with PR 4, not this one — until then the portal simply shows sheet work orders with the fallback title.

## Rollback

Additive apart from the NOT NULL drop. To undo: cancel or delete sheet-anchored rows (`step_id IS NULL`), then `ALTER TABLE step_commitments ALTER COLUMN step_id SET NOT NULL`; the helper and policies keep working for step rows.
