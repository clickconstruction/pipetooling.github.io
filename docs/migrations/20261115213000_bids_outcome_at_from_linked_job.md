# 20261115213000_bids_outcome_at_from_linked_job.sql (2026-11-15, v2.7347)

Punch list #360, PR 2. A data change, no DDL: `bids.outcome_at` (v2.3354) is stamped by a trigger when an outcome is set, so a bid won before 2026-09-11 has none. Counted on prod before the file was written, 2026-11-15: 47 awarded bids (`won`, `started_or_complete`), 41 with no award day, 16 of those with a linked job (`jobs_ledger.bid_id`).

The migration gives those **16 rows** the earliest linked job's `created_at`, and never a day before the bid was sent: 3 of the 16 are linked to a job older than their send, and take the send day (midnight Central). The days land between 2026-02-18 and 2026-09-04. The other 25 awarded bids have no job and stay empty, since nothing on record says when they were won; the 122 lost bids with no day are not touched. It prints the count it wrote as a NOTICE.

What else an UPDATE of `bids` sets off, checked before the push: `bids_stamp_outcome_at` keeps a day the statement writes itself; `record_bid_change` adds one history line per bid (`outcome_at`, no person); `update_bids_updated_at` moves `updated_at` on the 16; `bids_clear_working_board_archive_on_progress` would bring an archived bid back on the working board, and none of the 16 is archived. Safe to run twice: it fills a NULL only.

Order: any. No client reads a name this creates. Push after the merge as usual.

**Applied** to prod by 2026-11-16: `npm run check:migration-drift` read 1326 local files against 1326 applied, this version among them (run in the docs pass after #8111).
