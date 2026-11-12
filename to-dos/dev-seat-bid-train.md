---
name: "The dev seat's bid train, to pick up: counts, takeoff and labor shipped, pricing and the submission pair are briefed"
number: 317
group: ready
status: PR 1 (`plan_bid_update`, v2.6945) and PR 2 (`plan_bid_counts`, v2.6967) are merged, deployed and answering on `dev-mcp` 0.72.0 (2026-11-12) · PR 3 (`plan_bid_takeoff`, v2.6968, PR #7717) is live on `dev-mcp` 0.74.0 (2026-11-12) · PR 4 (`plan_bid_labor`, v2.6976) shipped at `dev-mcp` 0.75.0 (deploy and a dry run on b398 follow its merge) · PR 5 (pricing) and pair 6 (the submission paper) are briefed in `to-dos/mcp-servers.md` and not started · the splice scripts and the merge-up recipe are on the branch `claude/bid-train-handoff`
summary: >
  The owner asked on 2026-11-11 for dev seat verbs that change a bid and fill in its counts, takeoff,
  labor and pricing, so an agent can enter a bid from a paper proposal. He gave the go on the map's
  order the same day. Two of the pairs are live. This card is the hand-over for the rest: what is
  on which branch, what each still needs, and the recipe that gets a seat PR past the version
  collisions every other seat PR causes. The map and a build brief per pair stay in
  to-dos/mcp-servers.md under "The bid train"; this card is only the state.
next: If `whoami` does not list `plan_bid_labor` yet, deploy `dev-mcp` from `origin/main` and dry-run it on b398. Then PR 5, pricing (notes below), in two PRs.
size: L as a train (takeoff XS to finish · labor M · pricing L in two PRs · the submission pair M)
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
| 4 · `plan_bid_labor` | Shipped (v2.6976) at `dev-mcp` 0.75.0, ninety-five write verbs. | Its deploy, `whoami` and a dry run on b398, if the building session did not get to them after the merge. |
| 5 · `plan_bid_pricing` | Not started. | Two PRs: the pricing kernels into the kernel copy, then the pair. Brief in `mcp-servers.md`; notes below. |
| 6 · `plan_bid_submission` | Not started. | Brief in `mcp-servers.md`. The proposals work needs it to file a paper from Drive onto its bid. |

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
