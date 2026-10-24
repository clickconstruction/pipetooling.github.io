# 20261024010000_prospect_trade_ranks.sql (2026-10-24, v2.5809)

Prospects → Subs, the board by trade (punch list #153, PR 3). The board stores the two things only a person knows and computes the rest:

- **`prospect_trade_ranks`** (`prospect_id` → `prospects` on delete cascade, `trade`, `rank_order` ≥ 1, `set_by`, `set_at`; primary key on the prospect and the trade): a card dragged by hand in one trade's column. A row is a pin at `rank_order` (dense 1..n among the column's pins); no row means the card flows by its record. One row a company a trade, since a sub can name two trades and sit in two columns. `trade` is the bench's spelling, compared case-blind by the app (`tradeKey`).
- **`prospects.priority`** (smallint, `NULL`, 1 or 3): the office's priority, Call first · Normal · Later, sorting a column over the record.

RLS: `user_has_prospects_staff_access()` on every verb, as the prospects' own policies; anon revoked, authenticated granted, the service role everything; the three fence appliers run (read-only users, the statement trigger, digital twins).

Additive. Shipped with PR 3 (`claude/subs-board-pr3`); pushed with `supabase db push` before the client deploy, since the old client ignores the new table and column and the new client reads them (the types regenerated in the same PR).
