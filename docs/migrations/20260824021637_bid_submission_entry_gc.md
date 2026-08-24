# 20260824021637_bid_submission_entry_gc.sql (2026-08-23, v2.2214)

Per-GC bid notes (Bid Board clickable GC lines). Nullable `gc_customer_id uuid` on **`bids_submission_entries`** (FK customers, ON DELETE SET NULL) + `(bid_id, gc_customer_id)` index. NULL = whole-bid note — every existing note unchanged in meaning. The bid's PRIMARY GC (a `bids_gc_builders` entity, not a customer) keeps using whole-bid notes; scoped notes are for the added / "Also sent to" GCs, which are customers. **Apply order:** push before the client PR that writes the column.
