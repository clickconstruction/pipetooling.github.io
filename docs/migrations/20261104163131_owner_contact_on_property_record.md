# 20261104163131_owner_contact_on_property_record.sql (2026-11-04, v2.6497)

The owner of record's email and phone get a home on the property record (Taunya's report on job 663, 2026-11-03: the courtesy notice before a lien could not reach the owner because nothing on the property window took the owner's email or phone).

- **`customer_addresses.owner_email`**, **`customer_addresses.owner_phone`**: `text NOT NULL DEFAULT ''`, beside `owner_mailing_address`. The property window, Edit Job's *Change the record* panel and Edit customer's property sheet write them through the one draft kernel (`payloadFromDraft`); the appraisal roll never fills them.
- **`job_property_owners.owner_phone`**: `text NOT NULL DEFAULT ''`, beside the override's `owner_email`, so the per-job owner block that wins at resolution (`resolveLienProperty`) can carry a phone too. Nothing writes it yet; a blank falls back to the property record's.

No table is made, so no fence calls; additive and idempotent (`ADD COLUMN IF NOT EXISTS`).

Apply order: the client in the same PR reads the columns through `select('*')` and writes them only when the row it read carries them, so before the push the property window saves as before and the courtesy window shows *no email on the property record*. A typed owner email cannot be saved until the column exists, so **push right after the merge** (`bash scripts/db-push.sh` from a checkout at `origin/main`), then `npm run gen-types:linked` as its own `chore(types)` PR.

**Applied** to prod by 2026-11-05: the dev seat's `check_migration_ledger` read 1118 applied with this file's version among them, against the 1118 files on `main` (read in the docs pass after #6998; `supabase` is not linked in that worktree, so `check:migration-drift` was not run there); `check:edge-drift` read every one of the 179 functions deployed and current the same day; types regenerated from prod through #7069.
