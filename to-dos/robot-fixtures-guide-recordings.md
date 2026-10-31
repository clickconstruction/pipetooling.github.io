---
name: "Robot fixtures: record the estimator guide's screen recordings"
number: 227
group: ready
status: proposed 2026-10-31 · not started
summary: >
  The owner wants a guide to share with an estimator that walks her through robot fixtures, showing more than
  telling. The text guide (`add-the-robots-fixtures-to-your-count`) matches every live screen, checked on
  2026-10-31. The house rule is recordings, never still screenshots, so this records six short takes on a ZZ test
  bid and wires them into the guide.
next: With the owner's yes, seed a ZZ test bid, record the six takes, wire them into the guide, then delete the ZZ bids.
size: S
blocker: The owner's yes to seed a ZZ test bid on prod. No real bid has a robot pull yet.
ver: v2.6188 · v2.6237
mockup: not required — recordings of screens that are already live
---

# Robot fixtures: record the estimator guide's screen recordings

## The ask

The owner, 2026-10-30: *"let me know when this is live to the point we can make a guide that I can share with an
estimator that walks them through how this works showing them more then telling them along the way"*. On
2026-10-31 the feature went live and was walked end to end on a ZZ test bid (b569). This card is that guide's
recordings. The owner asked the same day to put it on the punch list.

## The takes

Light theme, 1400×900 unless a phone take helps, 10 to 20 seconds each, under 3 MB, in `public/help/` named after
the guide's slug:

1. Open the list from the Counts tab's Robot fixtures button.
2. Open a row's backing text with ▸ text.
3. Tick and press Add. The rows land shaded with a Robot pill.
4. Change a robot row's count. The pill reads Robot 5 → yours 6.
5. Set aside with a reason, then Put back.
6. Press Undo on the toast. Only that press comes back off.

## The stage

No real bid has a robot pull yet, so seed one ZZ test bid on prod with the owner's yes: an unsent bid owned by the
dev account with two typed rows and its own copy of the Default plumbing book, the robot's ZZ shell owned by a twin
that is not the rounds key's, a sealed run, the robot's read of a 31-sheet set, and seven robot fixtures with
invented backing text. Fixed ids keep the teardown to one delete of the two bids. The 2026-10-31 seed and teardown
SQL are in the #221 hand-over notes on the office Mac (`robot-fixtures-zz-seed.sql`,
`robot-fixtures-zz-teardown.sql`). Never record a real bid.

## How

Headless Playwright on a Vite dev server, signed in through `/dev-login`, then ffmpeg to a gif, the way the job
contract recordings were made (`docs/HELP_MEDIA_PLAN.md`). On Halloween the app shows a wandering easter-egg
creature that lands in captures, so record on another day. Wire each take into the guide with
`{{gif:<file>|caption}}`, keep the guide passing the plain-words test, add a row to `docs/HELP_MEDIA_PLAN.md`'s
status table, and ship one PR with a release note and fragment. Then delete the ZZ bids and this file.
