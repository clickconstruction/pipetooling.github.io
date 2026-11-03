# 20261102200000_nudge_offers_about_on.sql (2026-11-02, v2.6387)

Today's sends: a moved visit's text expires with its visit (PR 3 of three on Taunya's report of 2026-11-02; PR 1 is
`20261102193000`). Two pieces, idempotent:

1. **`nudge_offers.about_on date`** — the day the words are about (a moved first visit's new day, written by the
   schedule's move through `offerRescheduledVisit`). Null for a text about no day. Past it the text is stale: the window
   holds it with why (`offers.ts`'s `heldStaleWords`), and the 9 AM run puts it away with `dismissed_why = 'stale'`.
2. **`nudge_offer_make(…, p_send_on date DEFAULT NULL, p_about_on date DEFAULT NULL)`** — the seven-argument function is
   `DROP`ped first and the eight-argument one created, so PostgREST has one match for a seven-argument call (a second
   overload would leave two). Same body; `about_on` written from the new argument. Grants restated.

No table is made, so no fence call.

**Apply order: push right after the merge.** A client behind the push calls the function with seven arguments and
takes the default. The new client passes `p_about_on` (PostgREST answers a missing match with `PGRST202`, which
`offerRescheduledVisit` swallows: no offer is made for a moved visit until the push) and selects `about_on` on Today's
sends (a missing column reads as *not there yet*, so the window shows nothing until the push while the Dashboard's line
still counts). `npm run check:calls-ahead` labels the PR *push right after the merge*. Redeploy `messages-nudge-dispatch`
after the push (it selects `about_on` and puts stale offers away). The generated `src/types/database.ts` and the dev-mcp
catalog are regenerated after the push, as always.
