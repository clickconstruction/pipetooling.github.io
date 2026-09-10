# 20260910223000_discount_line_items.sql (2026-09-10, v2.3252)

Discount rows in ① Line Items (fragment `docs/recent-features/v2.3252.md`), four additive columns on **`jobs_ledger_fixtures`**:

- **`line_kind text NOT NULL DEFAULT 'work'`** — `work` | `discount` (CHECK). A discount row reduces the work rows it applies to.
- **`discount_pct numeric(7,4)`** — percent of the basis (CHECK 0–100); the row's negative `line_unit_price` is derived from it on every save, so a percent stays live as prices change. NULL = a fixed dollar discount.
- **`discount_basis_positions integer[]`** — `sequence_order` positions of the work rows it applies to; NULL = every work row on the job. Positions rather than ids because the save engine reinserts rows with fresh ids and keys invoice links on positions the same way.
- **`discount_reason text`** — the preset chip picked when the row was made (Negotiated · Referral · Repeat customer · Goodwill · Price match), or NULL.

The signed amount lives in the existing `line_unit_price` (negative, `count` 1), so `revenueDollarsFromFixtures`, the hazmat revenue resync, and the money-rollup RPCs that sum `count × price` need no branch. Existing rows read as `work`; the old client never selects the new columns, so the push is safe ahead of the client.

Apply order: **push first** (`bash scripts/db-push.sh`, then `npm run check:migration-drift`), regenerate types (`npm run gen-types:linked`), then PR 2 (the row UI + save engine) may merge — it selects and writes these columns. No edge function.
