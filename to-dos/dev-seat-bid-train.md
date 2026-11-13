---
name: "The dev seat's bid train: the bid, its counts, takeoff, labor and prices are live; the submission pair is card #339"
number: 317
group: waiting
status: LIVE on `dev-mcp` 0.78.0 (2026-11-12 08:48 UTC) — `plan_bid_update` (v2.6945, PR #7680), `plan_bid_counts` (v2.6967, #7714), `plan_bid_takeoff` (v2.6968, #7717), `plan_bid_labor` (v2.6976, #7728), `get_bid`'s priced total (v2.6990, #7744) and `plan_bid_pricing` (v2.6992, #7749); each deployed from main, `whoami` lists it, and each was dry-run on b398 "ZZ Test" · no live apply has been walked on prod: the building session's permission layer refused writes there, so the first real apply of each is the one to read closely · pair 6 (the submission paper) is live on 0.82.0, v2.7154, with one apply walked on b398 (card #339)
summary: >
  The owner asked on 2026-11-11 for dev seat verbs that change a bid and fill in its counts, takeoff,
  labor and pricing, so an agent can enter a bid from a paper proposal. He gave the go on the map's
  order the same day, and all five pairs on the Bids tabs went live by 2026-11-12. This card is the
  hand-over: what shipped where, and the recipe that gets a seat PR past the version collisions
  every other seat PR causes. The map and a brief per pair stay in to-dos/mcp-servers.md under
  "The bid train"; the one pair left, the submission paper, is card #339.
next: Pair 6, the submission paper, is its own card now: #339 (`to-dos/dev-seat-bid-submission.md`). Retire this card once #339 ships. A first live apply of any pair on a ZZ bid, with the owner's word, would close the one check not yet made.
size: L as a train, shipped; pair 6 is M
blocker: none.
opinion: build in order — counts, takeoff, labor and pricing each hang on the one before, and a paper proposal is entered in that order.
mockup: not required — the verbs have no screen; each plan's reply is the design.
---

# The dev seat's bid train: where it stands and how to pick it up

The plan is in [`mcp-servers.md`](./mcp-servers.md) under **The bid train**: the map of the Bids
tabs, the order, and a build brief for each pair. Read that first. This card says what is done,
what is on which branch, and what each piece still needs.

## The state, pair by pair

| Pair | Where it is | What it still needs |
|---|---|---|
| 1 · `plan_bid_update` | Merged (v2.6945, PR #7680). Live since `dev-mcp` 0.70.0. | A live apply was never walked: the building session's permission layer refused a write on prod. Read the first real apply's reply closely. |
| 2 · `plan_bid_counts` | Merged (v2.6967, PR #7714). Live on `dev-mcp` 0.72.0. | The same: dry runs on b398 only. |
| 3 · `plan_bid_takeoff` | Merged (v2.6968, PR #7717). Live on `dev-mcp` 0.74.0. | The same: dry runs on b398 only. |
| 4 · `plan_bid_labor` | Merged (v2.6976, PR #7728). Live on `dev-mcp` 0.75.0. | The same: dry runs on b398 only. |
| 5 · `plan_bid_pricing` | Merged: v2.6990 (`get_bid` states the grid's revenue total, PR #7744) and v2.6992 (the pair, PR #7749). Live on `dev-mcp` 0.78.0. | The same: dry runs on b398 only. On b398 `get_bid` reads $56,343.00, the bid's sent value. |
| 6 · `plan_bid_submission` | Merged (v2.7154, PR #7964), with `read_drive_folder`. Live on `dev-mcp` 0.82.0. | Walked on b398 on 2026-11-13: a dry run and one apply by Drive's copy. A bid with no folder, a file outside the Shared Drive and `replace: true` have not run on prod (card #339). |

## Get the kit

The scripts and the full recipe live on a branch that is never merged:

```bash
git fetch origin claude/bid-train-handoff
```

```bash
git show origin/claude/bid-train-handoff:to-dos/dev-seat-bid-train/README.md
```

Copy the folder's `scripts/` out to a scratch folder with `git show` or a second worktree. The
README there is the long form of the steps below.

## Bring a seat PR up to main

Every seat PR moves the same pin lines, so one that lands first makes the next conflict. Take
main's copy of every shared file and run the PR's own splice and pin scripts again; never
hand-resolve. The kit's README has the steps. Each PR of the train keeps its scripts beside the
kit's (`wire-<pair>.mjs`, `docs-<pair>.mjs`): copy the latest pair's as the pattern for the next.

## Notes for PR 5 (pricing)

- **Built in v2.6990, reuse it**: `openPricing` (the tab's pick of the open pricing, and where a write lands:
  own copy, shared book, robots' book) and `bidPricedTotal`'s reads in `_shared/devMcpBidPricing.ts`;
  `pricingWriteTarget` is in the kernel copy; add `lib/bids/resolvePricingEntry.ts` (no value imports) with the pair.
- **A custom price is ignored when a book entry of the row's fixture name exists**: the kernel prefers the
  entry. That is why the tab's write inserts an assignment with an override whenever an entry matches.
- **The sent-bid lock is the browser's alone** (`pricingLock.ts`, a Revise press kept in sessionStorage);
  no database guard reads `bid_date_sent`. Make the pair refuse a sent bid unless the ask says `revise: true`.
- **On a shared book the tab writes first and clones after** (`freezeSharedPricingAfterWrite`), leaving
  inert rows on the template. Cloning first (`clone_price_book_version_to_bid`, SECURITY INVOKER, as the
  dev) then writing onto the copy ends the same with nothing left behind; then set the copy's
  `bid_version_id` when the bid is split and save the ★ (`bids.selected_price_book_version_id`, and the
  version's `starred_price_book_version_id`). Say the difference in the docs.
- **A robots' book is never cloned** (the twin fence lives on it): refuse a price write that would land there.
- **`is_fixed_price`**: nothing on screen sets it. Leave it out of the ask.

- The priced total is `computeBidPricingRows` through `scenarioPricingRows`, both pure. The hook
  only loads rows. Copy them to the edge first, as their own PR, so the plan can state the
  screen's total and `get_bid.totals` can become a figure.
- One write rule covers a price on a row (`writeUnitPriceOverrideRow` in `BidsPricingTab.tsx`):
  the assignment's override, else a new assignment on the matching book entry, else a custom
  price. A write on a shared price book must clone it to the bid first
  (`clone_price_book_version_to_bid`), or it edits the shared book.
- The margin stamp (`stamp_bid_priced_margin`) only where the screen would stamp, and only on an
  unsent bid. Its revenue ignores `is_fixed_price`; state the screen's total, not the stamp's.

## What cost time, so it does not again

- **Version collisions.** Four other seat PRs were in flight on 2026-11-11 and each landing made
  ours conflict on twenty-odd pin lines. The scripts turn that into ten minutes. Agree an order
  with the other seat sessions and never push a version an open PR already holds.
- **The merge queue locks the branch.** A push to a queued PR is refused until the queue drops
  the entry. Wait, push, re-arm.
- **No rebase, no force push, no amend** on a PR branch from the desktop app: bring it up with a
  merge commit.
- **A pin outside the seat's folder**: `src/lib/photos/boxPhotoRefile.test.ts`.
- **b398 "ZZ Test"** has versions and a job on it, so it reads well and refuses Won and Lost in
  the per-GC words. A bid fresh from `plan_bid` has no versions. Never use a robot's ZZ Shadow or
  ZZ Twin bid.
- **Entry order for a paper proposal**: the bid, its counts, takeoff, labor, prices, then value,
  sent date and outcome last. A first sent date makes the database mint labor rows from the book.

## How to verify each pair

Plan on b398, read the reply against the tab, and ask the owner before any apply on prod. After
a merge: `whoami` lists the new verbs at the new version, `check:edge-drift` reads all current,
and each redeployed function answers an OPTIONS request with 200.
