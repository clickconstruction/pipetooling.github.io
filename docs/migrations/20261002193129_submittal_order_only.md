# 20261002193129_submittal_order_only.sql (2026-10-02, v2.4435)

Punch list ask from Wendi (2026-10-02): "some items do not need to be on submittals, so can we have a way to deselect and exclude items from this process?" PR 1 of the train: where the answer lives. Additive only: three columns, no row changes. No screen sets any of them yet.

| Column | Meaning |
|---|---|
| `bid_submittal_items.order_only boolean NOT NULL DEFAULT false` | the office buys the fixture and the GC never sees the row |
| `bid_submittal_takeoff_choices.order_only boolean NOT NULL DEFAULT false` | the fixture comes onto a revision as an order-only row |
| `bid_submittal_takeoff_choices.left_out_line_ids uuid[] NULL` | the takeoff lines left off the fixture; NULL = none |

**Three states for a fixture.** *GC sees it*: a row with `order_only = false`. *Order only*: a row with `order_only = true`. *Left out*: no row (and `ticked = false` on the bid's choice, as before).

**The flag is the one truth.** A row's parts keep their own `on_submittal` under an order-only row, so setting the row back to *GC sees it* restores them. Readers do not infer the state from the parts: the GC's room loads only the parts the GC sees and could not tell a row with none from a row typed as one product.

**No policy changes.** Both tables keep their row policies; a column needs none. `bid_submittal_takeoff_choices` is left behind by the bid copy functions as before (`20261002130000`).

**Locks.** `ADD COLUMN` with a constant default or NULL rewrites nothing. `lock_timeout = '3s'`.

**Order of work.** Merge → the client deploys (it writes `order_only` only when true, and nothing can set it yet) → `supabase db push` → deploy `get-submittal-room`, `submit-submittal-review` and `twin-mcp` (they select the column) → regenerate types.
