# 20260823031729 — bid_version_sends (v2.2124)

**What:** new table `public.bid_version_sends` — per-version send records: `bid_id` → bids (cascade), `bid_version_id` → bid_versions (cascade), `sent_on date`, `value numeric(14,2)` (the version's ★ revenue at send time; null when unpriced), `is_alternate`, `round_label`, `note`, `created_at`, `created_by` → auth.users. Indexes on (bid_id, sent_on desc) and (bid_version_id, sent_on desc). Append-only from the app; latest row per version = its current send.

**RLS:** enabled; select/insert/update/delete gated by `public.can_access_bid_for_pricing(bid_id)` — identical to `bid_versions`. Grants to `authenticated` (CRUD) and `service_role`. Ends with `apply_read_only_write_blocks()` + `apply_read_only_stmt_blocks()` (training-mode users can't write).

**Why:** a package of bids (versions) needs per-bid sent dates and values; `bids.bid_date_sent` / `bid_value` remain the roll-up every reader uses, kept in sync by the Cover Letter's "Mark sent today".

**Safety:** `lock_timeout 3s`; `CREATE TABLE IF NOT EXISTS`; policies `DROP IF EXISTS` + `CREATE`; additive. Old clients never touch the table.

**Apply:** `supabase db push` after merge; then `npm run gen-types:linked` (types were hand-added in the PR). Until pushed, "Mark sent today" fails with a toast and reads treat the table as empty.
