---
name: "Bids: the Edit Bid controller comes out of the page (the Bids map's step 9)"
number: 51
group: ready
status: queued 2026-09-28 — the Bids map's steps 1–8 shipped (v2.3873 … v2.4003; the last run of them v2.3937 · v2.3953 · v2.3989 · v2.3999); this is the last region of the second pass, left for last on purpose
summary: >
  What is left of `src/pages/Bids.tsx` region R14: opening and closing the Bid window, the
  Edit tab's autosave and its close guard, Create bid / Create and open counts, the trade
  switch, delete, and the delete and evaluate windows — about 600 lines of the page's 3,343.
  It becomes a `useBidEditController` hook (and the two windows components), moved verbatim.
  Rated high risk in the map: it writes bids, and it sits on `useJobFormAutosaveSlice`, the
  autosave engine Edit Job and the Estimates draft share.
next: >
  PR 1 — refresh the Bids map's line ranges (`npm run map -- src/pages/Bids.tsx`; they predate
  the second pass) and give `useJobFormAutosaveSlice` a test of its own. Nothing moves in PR 1.
size: S (PR 1) · L (the train)
blocker: None. Take it alone, on a quiet day — `npm run sessions` first; no other PR open on `src/pages/Bids.tsx` or on the shared autosave slice.
ver: v2.3937 · 3953 · 3962 · 3978 · 3989 · 3999 · 4003
opinion: build — the last big piece of the page; the guards it needs (the page render smoke, the attestation and robot hooks) are in place.
mockup: not required — a refactor, no screen changes
---

# Bids: the Edit Bid controller

Punch list #46 row 5 (`to-dos/decomposition-queue.md`) is the Bids page's second pass. Its
map (`docs/BIDS_TABS_ARCHITECTURE.md` → *Recommended extraction order*) ran steps 1–8 on
2026-09-26 … 28 and took the page from 5,293 lines to 3,338. Step 9 was held back on purpose:
the map rates it **high** risk, and the owner asked (2026-09-28) for it to go on the punch
list rather than at the end of a long run.

## What moves

All in `src/pages/Bids.tsx` today (line numbers at `f92af8d10`; re-read them after PR 1's map
refresh):

| Piece | Where | Notes |
|---|---|---|
| Open / close the Bid window | `openNewBid` … `openEditBid` (1058–1110), `closeBidForm` (1113) | The four doors into the form; `useBidDateSentAttestation.resetTo` is already called from each (v2.3937) |
| Lost reason from the lost summary | `saveLossReasonFromLostSummaryModal` (1125) | Writes `bids` + a ledger note |
| Trade switch | ≈1150–1235, RPC `duplicate_bid_to_service_type` | Copies a bid into another trade; the most self-contained piece |
| After-save notes | `insertPendingBidSentFollowupSubmissionNoteAfterSave` (1238), `insertOutcomeChangeBidNoteAfterSave` (1259) | `bids_submission_entries` inserts |
| Autosave + close guard | `syncFreshBidIntoSelections` (1324), `autosaveBid` (1342), `bidAutosave` (1416, `useJobFormAutosaveSlice`), `requestCloseBidForm` (1444) | The high-risk part — see below |
| Create bid / Create and open counts | `saveBid` (1478), `saveBidAndOpenCounts` (1562), `openCountsForBid` (1624) | New-bid inserts |
| Quick add, delete, party windows | `saveBidSubmissionQuickAdd` (1645), `deleteBid` (1670), `openGcBuilderOrCustomerModal` (1685) | |
| Delete and evaluate windows | JSX at ≈3134 and ≈3210 | Become components beside the hook |

**Stays in the page:** the tab, the selections and `setSharedBid`, `loadBids` (it is
`useBidsPageData`'s now), the robot layer's hooks (`offerRobotEnvelope`,
`noteRobotReviewRevision` are called from the save paths — they are handed in), and the two
script windows, which belong to Submission & Followup.

## Why it is high risk

- **It writes bids.** Every save path builds a payload, prunes unchanged fields
  (`pruneUnchangedBidUpdateFields`), merges the attestation stamps, and checks the write was
  not refused (`bidUpdateRefused`). A move that reorders any of that can write stale values
  over a bid.
- **The autosave slice is shared.** `src/components/jobs/useJobFormAutosaveSlice.ts` drives
  Edit Job (through `hooks/useJobFormAutosaveEngine.ts`), the Estimates draft and Edit Bid. It
  has **no test of its own** — it is exercised only through Edit Job's engine test. The Bids
  side is not tested at all.
- **Effect order.** The page's autosave, the visibility flush and the close guard read each
  other's state; the hook must be called where that code stands now (the rule steps 7 and 8
  followed).

## The plan — one PR each, in order

1. **Map refresh + the slice's own test.** `npm run map -- src/pages/Bids.tsx`, re-anchor the
   map's R3 / R14 rows. `useJobFormAutosaveSlice.test` (render hook, fake timers): debounce,
   `flush`, `flushForClose` until clean or failed, a dirty-but-disabled slice never saves,
   `markSavedNow` / `clearBaseline` / `cancelPending`. No app code changes.
2. **Edit Bid in the page render smoke.** `Bids.render.test.tsx` with a write-recording stub:
   open a bid on Edit, change a field, the debounced `bids` UPDATE carries only that field;
   close with a pending change flushes first; a refused write (0 rows) holds the window open
   and says so; New Bid → Create bid inserts once. This is the guard for PRs 3–5.
3. **The trade switch** as `useBidTradeSwitch` (the smallest, most self-contained piece; its
   RPC path gets a hook test).
4. **`useBidEditController`** — open/close, autosave + close guard, the save paths, the
   after-save notes, quick add, delete. Called where the code stands; the page hands in the
   selections, `loadBids`, `openCountsForBid`'s tab switch and the robot layer's two calls.
5. **`BidDeleteConfirmModal` + `BidEvaluateChecklistModal`** — the two windows, verbatim.

Each PR: the page smokes (`Bids.render.test.tsx`, `Bids.followupDoors.render.test.tsx`) pass
before and after; eslint, typecheck, `npm test` in full; release note + fragment; the map row
flipped.

## How to verify

- Tests as above. The smoke must pass **before** the move in each PR, not only after.
- **Live, on a test bid only.** `npm run dev`, `/dev-login?as=1&to=/bids` (the dev account on
  production data — AGENTS.md). Use **b464 ZZ Takeoffs Test** (Plumbing, unsent, no customer):
  open it on Edit, change the project name and put it back (two autosave writes, the second
  restoring it), open and cancel the "Confirm bid sent" checklist, close with a pending change
  (the flush), open New Bid and close it unsaved. Never save a sent date, an outcome, a trade
  switch or a delete on a real bid. Record writes with a `fetch` wrapper on `/rest/v1/bids` and
  compare them with the same walk on `main` before the move.
- Afterwards: Edit Job and Estimates still autosave (the slice is theirs too) — open a ZZ TEST
  job's Edit form, change and restore one field.

## Where it plugs in

- `src/pages/Bids.tsx` (R14), `src/hooks/useBidDateSentAttestation.ts` (already out, called
  from every door and save path), `src/hooks/useBidsPageData.ts` (`loadBids`),
  `src/hooks/useBidRobotLayer.ts` (the two robot calls), `src/lib/bids/bidFormPayload.ts`,
  `bidUpdatePrune`, `bidFormAutosave`, `updateGuard` (the tested kernels the save paths use).
- `src/components/jobs/useJobFormAutosaveSlice.ts` — shared; changed by no PR here, tested by PR 1.
