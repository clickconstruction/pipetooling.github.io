# 20261009235500_submittal_link_sent_event.sql (2026-10-09, v2.5026)

Submittals decision 11, the owner's call of 2026-10-09: the app may send the room link. `bid_submittal_events_type_check` gains one value, `link_sent`. Every other value is as `20260916204602` left it.

`send-submittal-room-link` writes a `link_sent` event on the person after each email it sends. The Share step reads it two ways:
- the person's line reads *link sent Oct 9*, and their door reads **Send it again** (`personTrail`);
- the Share window's **Email each person their link** box starts ticked on a bid that has one (`roomHasSentLink`).

The person strips on What customers see read the newest one as *Link emailed Oct 9* (`submittal-room-email`).

Idempotent: the check is dropped and made again. No new table, so no read-only or digital-twin fences to re-apply.

## Order

1. **The push.** It waits behind GC MODE's 09:12 batch, as #5093's does: this stamp sorts after the batch's claimed stamps, so it pushes in order.
2. **Then `send-submittal-room-link`.** Deployed before the push, its emails would go and their events would be refused, so the Share step would not show them. The client says so (*This step will not show it.*).

Until the function is deployed, a press of **Send the link**, or a share with the box ticked, says *Something went wrong on our side*, and nothing is sent.

## Checked on a local Postgres 15

The stand-in was `bid_submittal_events (id, event_type)` with the old check and 30 rows of the eight old types.
- Before the migration, `link_sent` was refused by `bid_submittal_events_type_check`.
- The migration was applied twice.
- After it, the check read the eight old values and `link_sent`.
- A `link_sent` row went in, and an unknown type was still refused.

## The lock note

`SET lock_timeout = '3s';` is first. Dropping and adding a CHECK takes an ACCESS EXCLUSIVE lock on `bid_submittal_events` and scans it. The table held 30 rows on 2026-10-09. The review room writes a `view` there on each open, and that insert waits out the moment.

## Verify after the push

1. **The check.** `SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'bid_submittal_events_type_check';` names nine values, `link_sent` last.
2. **Nothing else moved.** `SELECT event_type, count(*) FROM public.bid_submittal_events GROUP BY 1;` gives the same counts as before the push.

Then `npm run check:migration-drift`, the function's deploy and `npm run check:edge-drift`. No types PR is needed, because a check constraint is not in `database.ts`.

## Status

Merged as v2.5026 (#5094) and pushed to prod in GC MODE's 09:12 UTC batch on 2026-10-09 (drift 813 of 813 at 09:13). `send-submittal-room-link` (new, `verify_jwt = false`) and `dev-mcp` deployed from the main checkout at 09:14 UTC (edge drift all 144 current). The verify steps ran read-only over the session pooler at 09:16 UTC:

1. **Passed.** `bid_submittal_events_type_check` names nine values, `link_sent` last.
2. **Passed.** The event counts are unchanged: asked 1 · closed 1 · decided 17 · file_dropped 3 · identified 3 · reply 1 · shared 1 · view 2; no `link_sent` yet.

## Rollback

A one-off migration restores the eight-value check, after deleting any `link_sent` rows. Before that, `send-submittal-room-link` is removed, or the client's door and box are taken out.
