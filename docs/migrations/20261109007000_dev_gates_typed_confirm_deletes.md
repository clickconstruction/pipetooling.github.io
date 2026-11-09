# 20261109007000_dev_gates_typed_confirm_deletes.sql (2026-11-08, v2.6765)

Punch list #188, PR 12 of the dev gates: the typed confirms on the single-row deletes, rows 72, 73, 78 and 79 of the audit table, taken as written by the owner on 2026-11-08. Each door opens wider behind a typed word in the client (`src/lib/typedConfirm.ts`); this is the database side.

- **Delete a report (row 73)** — `"Owner deletes reports"`: `DELETE` on `reports` for `is_master_or_dev()`, beside the dev's and the superintendent's own-row policies. The row lands in Recently deleted.
- **Delete a pay report (row 78)** — `"Controller deletes pay stubs"`: `DELETE` on `pay_stubs` for `is_controller()`, beside the dev's.
- **Delete a submitted write-up (row 79)** — `"Writeups owner delete submitted"`: `DELETE` on a `submitted` `writeups` row for `is_master_or_dev()`, beside the dev's; drafts keep their staff policy.
- **Delete a supply house (row 72)** needs nothing: `can_manage_supply_house_directory()` admitted the office already.

No table is created, so no fence call is owed. Every policy is `DROP POLICY IF EXISTS` then `CREATE`: idempotent, additive.

**Order**: push right after the merge. Until the push the owner's report and write-up deletes and the controller's pay report delete come back as refusals in words.

**Applied** to prod by 2026-11-09, read the same day through `npm run check:migration-drift` and the dev seat's `check_migration_ledger`: 1207 local files against 1207 remote versions, fully applied, this one among them.
