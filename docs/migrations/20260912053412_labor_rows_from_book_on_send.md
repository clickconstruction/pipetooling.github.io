# 20260912053412_labor_rows_from_book_on_send.sql (2026-09-12, v2.3369)

Hours by default (PR 3 of the Costs-tab refresh; owner: "zero people who have been bidding have been adding in labor").

- `mint_labor_rows_from_book(bid)` — the Labor tab's mint in SQL (mirrors `useBidPricingEngine.loadCostEstimateLaborRowsAndSync`): for a bid with a count sheet (the active version's rows, else the unversioned ones), ensure its `cost_estimates` row, pick the bid's chosen book else the first `labor_book_versions` by name for its trade (what the tab auto-selects), and insert one `cost_estimate_labor_rows` row per count fixture with hours from the book entry by fixture-type name, then by alias (case-insensitive), then `fixture_labor_defaults` by name, else zero (source NULL — the New view's queue). Never overwrites a row a person touched; a zero-hour, source-less row takes the book's hours. SECURITY DEFINER, revoked from the API roles; returns rows minted or filled.
- Trigger `bids_mint_labor_on_send` — AFTER UPDATE OF `bid_date_sent`, first time it is set (the per-GC send roll-up writes it), skipped for digital-twin sessions.
- Back-fill: every sent bid with a count sheet.

No new table. Client change: none required (the Labor tab reads the rows it would have minted). Deploy order does not matter.
