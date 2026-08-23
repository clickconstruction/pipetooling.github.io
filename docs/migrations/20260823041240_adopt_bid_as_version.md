# 20260823041240 — adopt_bid_as_version + bids.adopted_into_bid_id (v2.2137)

**What:**
- `bids.adopted_into_bid_id uuid NULL REFERENCES bids(id) ON DELETE SET NULL` + partial index. Marks a bid that was adopted as a version of another bid. Lists filter it out; the row is never deleted.
- `public.adopt_bid_as_version(p_target_bid_id, p_source_bid_id, p_name, p_target_base_name DEFAULT NULL) RETURNS uuid` — SECURITY INVOKER; requires `can_access_bid_for_pricing` on both bids; refuses self-adoption, already-adopted source/target, and a source that has versions. Unsplit target → `materialize_bid_version` first. Creates the version (in letter, base, GC override when the source's customer differs), **moves** the source's NULL-version count rows / takeoff mappings / rough-in lines / price scenarios (+ custom prices, hides, assignments) under it, sets ★ from the source's saved ★, seeds `bid_version_sends` from `bid_date_sent`/`bid_value`, and stamps the source `adopted_into_bid_id` + `working_board_archived_at`.

**Why:** "a version is a separate bid you can send" + per-version counts (`20260823034820`) make adoption a data move; the Jakes eleven-row case collapses to one package.

**Safety:** `lock_timeout 3s`; `IF NOT EXISTS` / `CREATE OR REPLACE`; row locks on both bids (`FOR UPDATE`); nothing deleted; the source's cost estimate stays put. Old clients still list adopted bids (no filter) until the new client deploys — harmless duplication for a few minutes.

**Apply:** `supabase db push` after CI on the PR is green (owner-authorized for this train); live test; then auto-merge. `npm run gen-types:linked` afterwards (types hand-added).
