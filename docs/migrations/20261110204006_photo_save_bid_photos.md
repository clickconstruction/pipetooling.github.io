# 20261110204006_photo_save_bid_photos.sql (2026-11-10, Bid photos, punch list #306 PR 2)

What the photo sweep needs from the database to file a bid's photos (v2.6856). No table is made.

- **`bid_photos.tried_at`** — when the sweep last tried a photo and could not file it (`fail_why` says why). The sweep and its cron leave the row alone for an hour after it; a filed row clears it. Most hand-made bid folders sit in a personal Drive the app cannot file into (card #240, call 4), so a held bid photo is the common case. A held row of any other source is tried every five minutes for as long as it waits; an hour keeps a week of held bid photos to a few hundred calls. `bid_photos` is new and empty, so the `ALTER` locks nothing in use.
- **`bid_photos_unfiled_idx`** is remade with `removed_at IS NULL`, the sweep's own read: added, still in the bucket, not removed, not filed.
- **The cron `photo-save`** is re-scheduled with every clause so far (`20261109190000_counter_tickets.sql` held nine) plus a tenth: a `bid_photos` row with `filed_at IS NULL AND storage_path IS NOT NULL AND added_at IS NOT NULL AND removed_at IS NULL` that was never tried or was tried over an hour ago. Unscheduled first, so a second run leaves one row.

The bed `npm run test:pg:bid-photos` applies it twice and reads the cron back: one row, every five minutes, naming all ten sources.

Apply order: after `20261110195527_bid_photos.sql`, which makes the table. Push both before `photo-save` and `bid-photos` deploy. Nothing on screen writes a `bid_photos` row until PR 3, so the clause finds nothing until then.

**Applied** to prod by 2026-11-11: `npm run check:migration-drift` read 1239 local files and 1239 remote versions, fully applied (read in the docs pass after #7525); types regenerated in #7576.
