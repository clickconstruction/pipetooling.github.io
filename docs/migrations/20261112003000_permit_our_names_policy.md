# 20261112003000_permit_our_names_policy.sql (2026-11-11, v2.6959)

Punch list #307, PR 3's leftover: who may say which names are us on a plumbing permit. The list is one row of `app_settings`, key `permit_our_names_v1`, JSON `{ "names": [...] }` in `value_text`, edited on Settings → Company → **Our names on plumbing permits** (`src/lib/research/ourNames.ts`). `app_settings` takes writes from a dev alone unless a key-scoped policy says otherwise, and this card is the owner's too.

## What it does

- **`master_or_dev_insert_permit_our_names`** and **`master_or_dev_update_permit_our_names`** on `app_settings`: insert and update of that one key for `is_master_or_dev()`, the predicate the client's `isOwnerOrDev` mirrors, the way the office address beside the card is held.

No delete policy: the card upserts the row and saves an emptied list as `{ "names": [] }`. No row is seeded, so the list starts empty. Reading is unchanged: every signed-in person reads `app_settings`.

**Tables**: none created, so no fence call is owed. **Idempotent**: each policy is `DROP POLICY IF EXISTS` then `CREATE`. The dev's standing policy (`Devs can manage app settings`) is untouched. **Lock**: `CREATE POLICY` takes a brief `ACCESS EXCLUSIVE` lock on `app_settings`, a small table; with `lock_timeout = '3s'` a busy moment fails fast and the push is retried.

**Apply**: `supabase db push` from a checkout of `main` after the PR merges. Order is free: the client calls nothing this creates. Before the push a dev saves the list as before, and the owner's save comes back as a refusal in words.
