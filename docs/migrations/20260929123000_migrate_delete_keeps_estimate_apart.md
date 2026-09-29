# 20260929123000_migrate_delete_keeps_estimate_apart.sql (2026-09-29, v2.4139)

`CREATE OR REPLACE` on `migrate_job_ledger_costs_and_delete(p_from, p_to, p_allow_billed)` — the v2.3900 body (`20260927233000_controller_functions_the_rest.sql`) verbatim except the estimate step. The function used to run `UPDATE estimates SET job_ledger_id = p_to WHERE job_ledger_id = p_from` unconditionally; `estimates_job_ledger_id_unique` (baseline, partial on `job_ledger_id IS NOT NULL`) allows one estimate per job, so when the target was itself made from an estimate the statement raised, the `EXCEPTION WHEN OTHERS` arm returned `{ok:false, code:'migrate_failed', error:'duplicate key value violates unique constraint "estimates_job_ledger_id_unique"'}`, and nothing moved. Now: when both jobs carry an estimate, the source's estimate gets `job_ledger_id = NULL` (what the FK's `ON DELETE SET NULL` would do on a plain delete) and the ok payload carries `estimate_unlinked: true`; otherwise the link moves as before and the key is `false`. The `COMMENT ON FUNCTION` says the same. No table, policy or grant change; `estimates_link_job_stamps_bid` (AFTER UPDATE OF job_ledger_id) still fires and does nothing on a NULL link.

Apply order: either side first. An old client ignores the new key; a new client on the old function shows the plain toast.

Shipped with v2.4139.
