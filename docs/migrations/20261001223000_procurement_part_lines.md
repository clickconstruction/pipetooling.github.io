# 20261001223000 — `bid_procurement_items.part_key` (v2.4327)

**What**: one nullable column, `part_key uuid`, on the procurement log's lines, and the one-line-per-tag unique index split in two: `uq_bid_procurement_items_bid_tag` now covers only the tag lines (`tag IS NOT NULL AND part_key IS NULL`), and `uq_bid_procurement_items_bid_part` keeps one line per part per bid (`part_key IS NOT NULL`).

**Why**: a submittal row's parts are bought one by one (v2.4319, `bid_submittal_item_parts`), so the log keeps a line per part — its own order date, PO, expected and delivered dates. `part_key` is the part's `procure_key`, which follows it from revision to revision, so a part's line holds through a resubmit. A line with no `part_key` reads as before: a tag's own line, or a hand row.

**Safety**: `SET lock_timeout = '3s'`; `ADD COLUMN IF NOT EXISTS`, nullable, no default (no rewrite). The index swap is `DROP INDEX IF EXISTS` + two `CREATE UNIQUE INDEX IF NOT EXISTS` on a small table. The client deployed before the push only ever inserts tag lines with no `part_key` and updates by id (no upsert), so the narrowed index keeps it working. No new table. Dry-run in `BEGIN … ROLLBACK` on 2026-10-01: clean, the four indexes as above.

**Client**: `procurementRecordFromRow` reads `partKey`; `SubmittalProcurementPanel.write` inserts a part's line with `part_key`; `get-submittal-room` passes it to the GC's Procurement card.
