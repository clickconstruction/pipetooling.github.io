# 20260823034820 — bids_count_rows.bid_version_id: versions own their counts (v2.2132)

**What:**
1. `ALTER TABLE bids_count_rows ADD COLUMN IF NOT EXISTS bid_version_id uuid NULL REFERENCES bid_versions(id) ON DELETE CASCADE` + index `(bid_id, bid_version_id)`. NULL = the unsplit bid's rows; V = version V's rows.
2. New `public.clone_count_rows_to_bid_version(p_bid_id, p_source_bid_version_id, p_target_bid_version_id) RETURNS integer` — clones the source rows (or the NULL set) onto the target version and re-keys the target's takeoff mappings, rough-in lines, and its price scenarios' custom prices / submission hides / assignments to the clones (jsonb old→new map). Executable by `authenticated` / `service_role` (only ever called by the version RPCs).
3. **Backfill** (`DO` block): for every bid that has versions and still has NULL rows — clone to each non-first version, then stamp the NULL rows onto the first version (lowest `sort_order`, then `created_at`).
4. `materialize_bid_version` stamps count rows on first split (and sets the base version's ★ from the bid's saved ★ when it belongs to it). `create_bid_version` clones counts from the source version and re-keys the new version's children, after the pricing clone.

**Why:** "a version is a separate bid you can send" needs its own counts; adopt-a-bid (F6b) moves a bid's counts under a version.

**Safety:** `lock_timeout 3s`; idempotent (`IF NOT EXISTS`, `CREATE OR REPLACE`, backfill touches only NULL rows on split bids). Old clients keep reading `bids_count_rows` by bid — on a split bid they would now see every version's rows together, so **deploy the new client before or together with the push** (the PR arms auto-merge only after the push + live test). Rows cascade-delete with their version.

**Apply:** `supabase db push` (owner-authorized for this train); then `supabase functions deploy send-bid-pricing-package`; then `npm run gen-types:linked`.
