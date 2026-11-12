# The Bridge spike of 2026-11-11: hand-over

Branch `spike/bridge-scaling`. One commit of candidates on top of `main`. Nothing here is shipped: no version is
claimed, no release note is written, no migration is applied. The owner walked every candidate on the dev server and
said what to keep. His words are quoted under each one.

His aim, in his words: "the goal of my recent changes were to get the Bridge more useful so I can narrow in on the
scaling function as it is the limiting factor". He has not defined *the scaling function*. Ask him before building on
a reading of it.

The Market and Sales work (candidates 5, 6, 8 and the two windows of 9) has its own punch list card with every rule
and what is left: `to-dos/market-sales-won-rates/README.md` on `main`. Start there for that work.

## The candidates

1. **The header says the window.** `Bridge.tsx`: *reads the last 8 weeks, since …* beside the date, and the loading
   line is *Reading the last 8 weeks…*. "If I should be seeing it on the loaded bridge, I should probably include the
   fact that it's the last eight weeks somewhere."
2. **The pipe stands up.** `flowStripDown.ts`, `BridgeFlowStripDown.tsx`, and `stripSide` on `BridgeWeek.tsx` (at a
   desk the pipe sits beside the call's card). `?pipe=across` draws the old one. "I think that section might look
   better if it was vertical instead of horizontal", pointing at frame C1 of `mockup.html`.
3. ***How the week runs* is off the first screen.** `BridgeWeek.tsx`. "I don't understand the section", then "Take
   it off".
4. **Market's word.** He could not read *asked $X a week* and chose *bid*. Since candidate 6 the Market row reads
   *worth $X a week*, and *bid* is only the fallback when that cannot be read.
5. **Estimates through their won rate.** See the card.
6. **Bids through theirs, and the Market amount.** See the card.
7. **What the Bridge leaves out.** `leftOut.ts`, `leftOutIo.ts`, `BridgeLeftOut.tsx`, an optional fifth argument on
   `useDashboardFinancials`. A list set on the page, by development, customer or address, saved as the `app_settings`
   row `bridge_left_out_v1`. Until it is saved the development named Gun Dog is left out. A job on the list leaves
   through the same ids every Bridge read takes for ZZ test jobs. "Yes, the whole Bridge", then "I need to add
   something in the graphical user interface that also shows this So a user can choose to exclude or not exclude
   gundog in the future Or any specific development, or any specific customer Or any specific address."
8. **Won by bid size on the Bid Board.** See the card.
9. **The five step windows on one frame.** `BridgeStepWindow.tsx`, and `BridgeCollectDesk.tsx`, `BridgeBuildDesk.tsx`,
   `BridgeBillDesk.tsx`, `BridgeMarketDesk.tsx`, `BridgeSalesDesk.tsx` rebuilt on it. Drawn first in `desks.html`.
   "Like all of your recommendations, build it all." Each window opens on where the step stands and up to a few
   things to do, each with one press. Everything else is behind *Show all* or a press at the foot.

## Owed before any of it ships

- **A migration** so the owner's role may save `bridge_left_out_v1`: insert and update on that key through
  `is_master_or_dev()`, the shape of `20261112013000_bridge_cash_keys_owner.sql`. Decide whether it seeds the row with
  Gun Dog's development.
- **The weekly email** (`bridge-weekly-sheet`) reads neither the left-out list nor the new Market amount. `weekCall.ts`,
  `flowStrip.ts` and `stageFlow.ts` are copied to the edge functions, so a change there means `npm run gen:edge-kernels`
  and a redeploy.
- **A dev who shows ZZ test jobs** loses ZZ bids on the Bridge once any rule is on the left-out list: the set of ids
  is also used as a switch in `withoutZzBridgeBids`.
- **The left-out picker lists ZZ test developments.** It should not.
- **Tests** exist for `bidWins.ts`, `estimateWins.ts`, `leftOut.ts` and each window's new kernel. Still without a test:
  `flowStripDown.ts`, `BridgeFlowStripDown.tsx`, `BridgeLeftOut.tsx`, `leftOutIo.ts`, `loadBidWins.ts`,
  `loadEstimateWins.ts`, `BridgeStepWindow.tsx`, `BidBoardWonBySizeSection.tsx`.
- **`BridgeCollectCounted.ts`** holds words and belongs under `src/lib/bridge/collect/` once the edge copy is
  regenerated.
- **Docs for each PR**: the guide *read the Bridge* (`src/content/help/the-bridge.md`), the Glossary,
  `PROJECT_DOCUMENTATION.md`, `ACCESS_CONTROL.md` for the migration, a release note and a fragment each.
- **No press that records was pressed in any walk.** *Record the answer*, the percent save and a save of the
  left-out list are untested against the live database.

## How to look

`npm ci`, copy `.env.local` from the main checkout, `npm run dev`, then open `/dev-login?as=1&to=/bridge`. It signs
in as a dev on production data: read only, and press nothing that records.

## The prompt for the next session

> Pick up the Bridge spike on `spike/bridge-scaling`. Read `to-dos/bridge-one-story/SPIKE_HANDOFF.md`, then the card
> `to-dos/market-sales-won-rates/README.md`. The owner has walked all nine candidates and kept them. Ship them as
> small PRs in the order the card and the hand-over give, each with its tests, release note, fragment and docs, per
> `CLAUDE.md`. Ask him before changing a rule he set: every rule is quoted in his words.
