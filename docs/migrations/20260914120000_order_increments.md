# 20260914120000_order_increments.sql (2026-09-14, v2.3406)

Sold in sticks PR 1 — the minimum-order rule, three tables, six nullable columns.

- `part_types.order_increment numeric(12,4)` + `order_increment_unit text` — the rule for every part of the type (*Copper pipe · 20 ft sticks*). NULL = sold by the each.
- `material_parts.order_increment` + `order_increment_unit` — a part's own rule, overriding its type; NULL = inherit.
- `bids_takeoff_rough_part_lines.order_increment` + `order_increment_unit` — the effective rule snapshotted when the part was picked, the `unit_price` pattern, so a later catalog change never re-costs a sent bid. NULL = the line never rounds.

`order_increment_unit` is one of `ft_stick` · `ft_coil` · `box` · `bundle`; the client kernel [`src/lib/materials/orderIncrement.ts`](../../src/lib/materials/orderIncrement.ts) is the one reader (`effectiveOrderIncrement`, `formatOrderIncrement`, `roundUpToIncrement`).

Additive and idempotent (`ADD COLUMN IF NOT EXISTS`); no CREATE TABLE, so no read-only-block calls; each table's existing RLS governs writes (part types and parts: the price-book roles; lines: the bid's editors).

Apply order: **push before the client deploy** — the Add Part modal and the line writers insert the new columns by name; against the old schema those inserts error. The rounding itself (PR 2) reads the line snapshot and is inert until lines carry a value.

`src/types/database.ts` carries the six columns by hand (Row / Insert / Update); the next `gen-types` run reorders them.
