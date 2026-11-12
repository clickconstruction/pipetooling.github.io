---
name: "The dev seat's bid train, to pick up: takeoff is built and waits for its turn, labor is drafted, pricing and the submission pair are briefed"
number: 317
group: ready
status: PR 1 (`plan_bid_update`, v2.6945) and PR 2 (`plan_bid_counts`, v2.6967) are merged, deployed and answering on `dev-mcp` 0.72.0 (2026-11-12) · PR 3 (takeoff) is built and green, pushed as draft PR #7717, not armed, waiting to take its server version after #7686 · PR 4 (labor) has its kernel drafted and untested on the branch `claude/dev-seat-bid-labor-draft` · PR 5 (pricing) and pair 6 (the submission paper) are briefed in `to-dos/mcp-servers.md` and not started · the splice scripts and the merge-up recipe are on the branch `claude/bid-train-handoff`
summary: >
  The owner asked on 2026-11-11 for dev seat verbs that change a bid and fill in its counts, takeoff,
  labor and pricing, so an agent can enter a bid from a paper proposal. He gave the go on the map's
  order the same day. Two of the pairs are live. This card is the hand-over for the rest: what is
  on which branch, what each still needs, and the recipe that gets a seat PR past the version
  collisions every other seat PR causes. The map and a build brief per pair stay in
  to-dos/mcp-servers.md under "The bid train"; this card is only the state.
next: Finish PR 3. Wait until PR #7686 (the property record pair) is on main, then bring draft PR #7717 up to main at the next server version with the scripts on `claude/bid-train-handoff`, mark it ready, arm it, and after the merge deploy `dev-mcp` and dry-run it on b398. Then PR 4 from the labor draft, then PR 5.
size: L as a train (takeoff XS to finish · labor M · pricing L in two PRs · the submission pair M)
blocker: none. PR 3 waits only on #7686 landing first, by the order the seat sessions agreed on 2026-11-11.
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
| 3 · `plan_bid_takeoff` | **Draft PR #7717**, branch `claude/dev-seat-bid-takeoff`, one commit. Built: the kernel, 17 tests, the wiring, the README row, the release note and fragment. Green locally. | One merge-up, then arm (steps below). Its pins read 0.73.0 and ninety-one verbs; #7686 holds 0.73.0 and lands first. |
| 4 · `plan_bid_labor` | Branch `claude/dev-seat-bid-labor-draft`: `supabase/functions/_shared/devMcpBidLabor.ts`, one commit on top of takeoff's. **Never run.** | Tests, the kernel copy entries, the wiring, the docs, a version. Brief below. |
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

## Finish PR 3 (takeoff)

1. Wait for #7686 to be on main. Two seat PRs must never carry the same server version.
2. Check out `claude/dev-seat-bid-takeoff`. Read main's pins: `SERVER_VERSION`, the words in
   *Writes are N verbs and nothing else*, the count of `restRows(` in `dev-mcp/index.ts`.
3. `git merge origin/main`, then take main's copy of every shared file and run takeoff's scripts
   again: `wire-takeoff-edge.mjs`, `npm run gen:edge-kernels`, `wire-takeoff.mjs`, `bump.mjs`,
   `fix-tv3.mjs`, `docs-takeoff.mjs`, and the one pin in `src/lib/photos/boxPhotoRefile.test.ts`.
   Takeoff adds two write verbs and five `restRows(` calls to whatever main reads.
4. `docs-takeoff.mjs` also marks pair 2 as live in `mcp-servers.md` and pair 3 as built. If an
   anchor is not found once, main's sentence moved: read it and fix the anchor.
5. Run the checks in the kit's README. Commit the merge, `git push` (no rebase, no force),
   `gh pr ready 7717`, `gh pr merge 7717 --auto`.
6. After the merge: deploy `dev-mcp` from `origin/main`, confirm `whoami`, deploy the four
   functions `check:edge-drift` names, and dry-run on b398.

A dry run for it, once live (b398 holds a "Water closet" count row or its like; read its sheet
with `plan_bid_counts` first and name a fixture it has):

```bash
seat.sh plan_bid_takeoff '{"takeoff":{"bid_id":"a5a3a840-0a7b-4c67-8b59-3e95d0d80150","rows":[{"fixture":"<a fixture on the sheet>","materials_each":1}]}}'
```

## Build PR 4 (labor) from the draft

What the draft kernel holds, as designed from a reading of the Labor tab on 2026-11-11:

- **The ask**: `labor = { bid_id, estimate?, rows?, direct?, version_id? }`.
- **The estimate's boxes** (`cost_estimates`): held to the ranges `buildCostEstimateAutosavePayload`
  holds them to. The estimate is made (`{ bid_id }`) when the bid has none, as the tab makes it on a
  counted bid; a bid with no count rows is refused.
- **Labor rows** are keyed by the fixture's name, and no screen adds one by hand. The draft
  changes an existing row, mints a row for a counted fixture that has none (the sync's own insert,
  with the ask's hours), and holds a fixture nobody counts. Typed hours carry `source: typed` and
  the queue's note, so the database's mint on a first sent date leaves them alone. A task is fixed
  hours; a sub line has none.
- **Direct cost lines**: the five tables, dollars a stage, found again by kind and note.
- **The cost** is `computeBidCostBreakdown` at the bid's own rate. With no rate the tab uses the
  company crew rate, which the seat does not compute, so the plan leaves labor dollars out and
  says so.
- **Refused in words**: a bid whose `created_by` is null. `can_access_bid_for_pricing` answers
  false for it even to a dev, so nobody can write its labor or its prices. PR 5 needs the same
  refusal.

What it still needs:

1. A branch from main once PR 3 is merged, with the draft file taken from
   `claude/dev-seat-bid-labor-draft`. It imports `devMcpBidTakeoff.ts`, which PR 3 brings.
2. Kernel copy entries in `scripts/edge-kernels.mjs`, off the index like the others:
   `lib/bids/bidTotalCostBreakdown.ts` (it brings `bidCostCalc`, `costEstimateDirectCosts` and
   `bidPricingRowCalculations` with `laborRowHours`) and `lib/bids/laborSyncPlan.ts`. Then
   `npm run gen:edge-kernels` and the list in `src/lib/gc/edgeKernels.test.ts`.
3. A test file on a made-up bid, in the shape of `devMcpBidTakeoff.test.ts`: the columns against
   the generated catalog, the mint row against the sync's insert in `useBidPricingEngine.ts`, the
   typed patch against `saveQueueRow` in `BidsLaborNewView.tsx`, the job scope rule against
   `jobScopeRows`, the kinds and units against the table's CHECKs (migration `20260911161857`),
   the cost against `computeBidCostBreakdown`.
4. The wiring, copied from takeoff's scripts: `WRITE_VERBS`, `writeRpcBody`, `alreadyApplied`,
   the tool entries, the instructions phrase, the case. The apply's order: make the estimate
   when missing, PATCH its boxes, insert the minted rows, PATCH each changed row, then the direct
   cost lines table by table. A row that fails is named and the rest goes on.
5. Decide one thing before writing the apply: the draft leaves the mint untagged, since the hours
   are a person's. The tab's own mint is tagged `labor-sync`, which History shows as the app's own
   doing. Untagged is the honest reading; keep it unless the owner says otherwise.
6. The docs every seat PR carries: the README row and counts, GLOSSARY, ACCESS_CONTROL, the
   EDGE_FUNCTIONS note, the verb row and the section item in `mcp-servers.md`, a release note and
   its fragment, a claimed version.

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
