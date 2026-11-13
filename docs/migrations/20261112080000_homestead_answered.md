# 20261112080000_homestead_answered.sql (2026-11-11, v2.6937)

The homestead question gets a record of its answer (punch list #305, item 3). `customer_addresses.homestead` is `boolean NOT NULL DEFAULT false`, so a property nobody asked about read the same as one answered no.

- **`customer_addresses.homestead_answered_at`**: `timestamptz`, NULL until a person answers yes or no on the property record, then the time of the answer. The Lien desk holds a residential property's affidavit while it is NULL (`homesteadGate` in `src/lib/jobs/lienDeskAffidavits.ts`).
- **One backfill**: a row already marked `homestead = true` is stamped with its `updated_at` (else `now()`), since whoever marked it answered yes. One row on prod on 2026-11-11.

No table is made, so no fence calls; additive and idempotent (`ADD COLUMN IF NOT EXISTS`, the backfill only where the stamp is NULL). Starts with `SET lock_timeout = '3s'`.

Apply order: the client in the same PR reads the column through `select('*')` and judges nothing off a row that does not carry it, so before the push the desk reads as before. A yes or no pressed on a property record names the column, so it cannot be saved until the column exists: **push right after the merge** (`supabase db push` from a checkout at `origin/main`), then `npm run gen-types:linked` as its own `chore(types)` PR. From the push on, every residential property under an affidavit holds until answered: read on 2026-11-11 that was 11 of the 12 approved affidavits due 2026-11-16 and the one to draft, which is why the card holds the PR until those are filed or the owner says otherwise.

**Applied** to prod by 2026-11-13: the dev seat's `check_migration_ledger` read 1274 applied, this version among them, against 1274 files in `supabase/migrations/` (read in the docs pass after #7659).
