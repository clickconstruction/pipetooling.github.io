---
name: "SupplyHousesTab's twelve cuts: land the last two pieces"
number: 386
group: close
status: asked 2026-11-17 · the map re-drawn the same day (#8547) with a twelve-step order · cuts 1 to 5 built and merged the same evening (#8568) · cuts 6 to 12's first half built and in the merge queue (#8607) · cut 12's second half and the map's re-read built on branches pushed to GitHub, no PR · the owner stopped the build for the night and put what is left here
summary: >
  The office's Supply houses tab was one file of 3,678 lines, the eleventh largest in the app, with
  no test of its own. The owner asked how close it was to needing a split. The Materials map was
  re-drawn and ranked twelve cuts. Eleven and a half are built: the money rules are tested files,
  the tab has a render test, and the bill form, the reads, the aging windows, the open house and
  the aging table are their own files. The tab itself falls to 768 lines once the queued PR lands.
  Two pieces are built and not opened: the one cut that changes what the page asks the database
  for, and the map's re-read after the cuts.
next: "See #8607 to its merge. Then open cut 12's second half from `claude/supply-cut-12-small-pieces` as its own PR, rebased with the `--onto` command the card gives. Then the map's re-read from `claude/supply-map-reread`, regenerated against main, last. Then the owner's look at the tab on the live site, and the card retires."
size: L as a train of twelve cuts; left: the queued PR, the paged reads (S) and the map's re-read (S)
blocker: None. Cut 12's second half must not open before #8607 merges, since it is stacked on it.
mockup: not required — a refactor; the first eleven and a half cuts move code and change no screen, and the last changes what is read, not what is shown
opinion: finish — the hard part is built and tested, and the two pieces left are small
ver: v2.7662 · v2.7664 · v2.7667 · v2.7669 · v2.7671
---

# SupplyHousesTab's twelve cuts: land the last two pieces (#386)

The map is [`docs/MATERIALS_TABS_ARCHITECTURE.md`](../docs/MATERIALS_TABS_ARCHITECTURE.md) → *SupplyHousesTab extraction order*. The method is [`docs/PAGE_DECOMPOSITION_PLAYBOOK.md`](../docs/PAGE_DECOMPOSITION_PLAYBOOK.md).

## The ask

The owner, 2026-11-17, while working on Materials: *Should we in a new session, let's re-map SupplyHousesTab? how big is the largest file? how close are we to needing to do a decomposition?* The file had nearly doubled in seven weeks, from 1,898 lines to 3,678, most of it the supply house payments train (v2.7450 to v2.7471). He said to re-map it, then had the cuts built the same evening. Late that night: *Add cuts of supply houses tab to a punch list card. We're not going to build any more here tonight.*

## Where it stands

`src/components/SupplyHousesTab.tsx` is the office's Supply houses tab on the Materials page, also mounted bare by Quickfill's `SupplyHousesSection`.

| Cut | Version | What it did | State |
|---|---|---|---|
| The map | none | The Materials map re-drawn at the file's 3,678 lines, with the twelve-step order | merged, #8547 |
| 1 | v2.7662 | What each bill lists: the rows of a house's bills, tested | merged, #8568 |
| 2 | v2.7664 | The Accounts payable total and the two pins read one tested sum | merged, #8568 |
| 3 | v2.7667 | How a house's jobs and PO codes are read, tested | merged, #8568 |
| 4 | v2.7669 | The move window worked out in one tested place | merged, #8568 |
| 5 | v2.7671 | The bill form's own rules, tested | merged, #8568 |
| 6 | v2.7672 | `SupplyHousesTab.render.test.tsx`, 27 cases, written before any window moved | in the merge queue, #8607 |
| 7 | v2.7673 | The bill form's state and writes → `useSupplyHouseInvoiceForm` | in the merge queue, #8607 |
| 8 | v2.7674 | The bill form's window → `SupplyHouseInvoiceFormModal` | in the merge queue, #8607 |
| 9 | v2.7677 | The page's reads → `useSupplyHouseAccountsPayable` | in the merge queue, #8607 |
| 10 | v2.7678 | The aging windows → `useSupplyHouseAgingWindows` and `AgingCellWindow` | in the merge queue, #8607 |
| 11 | v2.7680 | An open house and the payment windows → `useSupplyHousePayments`, `SupplyHouseDetailPanel`, `SupplyHousePaymentWindows` | in the merge queue, #8607 |
| 12, first half | v2.7681 | The aging table → `SupplyHouseAgingMap`; the dead `showTitle` prop gone | in the merge queue, #8607 |
| 12, second half | v2.7682 claimed | The paged reads, below | **built, no PR** |
| The map's re-read | none | The map's line numbers and regions after the cuts | **drafted, no PR** |

After cuts 1 to 5 the file is 3,532 lines on `main`. #8607 takes it to 768. Every cut in #8607 is a move: nothing a person sees or presses changes, and the tab's render test passes unedited through each commit.

## What is left

### 1. See #8607 to its merge

[#8607](https://github.com/clickconstruction/pipetooling.github.io/pull/8607) was in the merge queue when this card was written. If the queue kicks it out, rebase `claude/supply-moves` on `main`, run the tab's render test and the four hook tests under `src/components/materials/` (`useSupplyHouse*.render.test.tsx`), and arm it again.

### 2. Cut 12's second half: the paged reads (S)

Built as one commit on `claude/supply-cut-12-small-pieces`, stacked on `claude/supply-moves`. It is the one cut that changes behaviour: what the page asks the database for. What the page shows is the same today. All three changes are in `src/components/materials/useSupplyHouseAccountsPayable.ts`, the data hook cut 9 made.

- **The book's read is paged.** `loadSupplyHouseSummary` read every bill in one request with no range, and the API cuts such a read at 1,000 rows with no error. It reads through `fetchAllRows` now. Past 1,000 bills the Accounts payable total, the aging table and the move window would all have been short.
- **The jobs read is scoped.** `loadSupplyHouseDetail` read the whole `supply_house_invoice_job_allocations` table to draw one house. It reads that house's bills' allocations only, through `fetchAllRowsChunkedIn`.
- **A read nothing used is gone.** Opening a house ran one `purchase_order_items` query per purchase order, and the page drew only each order's name and status.

Neither table is near the cap today, so nothing is being cut on the live site. Three new cases in `useSupplyHouseAccountsPayable.render.test.tsx` hold it: a book of 1,200 bills read whole in two pages, a house reading the jobs on its own bills only, and a house with no bills asking for no jobs.

To land it: after #8607 merges, move the one commit onto `main`. A plain rebase replays the seven moves commits the queue squashed and conflicts, so name the old base:

```
git rebase --onto origin/main 1df647f7ef claude/supply-cut-12-small-pieces
```

Then run that hook's test, the tab's render test and the Materials and Quickfill suites, open the PR and arm it. Its release note and fragment (`v2.7682`) are on the branch. The claim on v2.7682 is no longer held on GitHub, though the number was unused when this card was written: claim again, and rename the two files if the number has gone.

### 3. The map's re-read (S, docs only)

Drafted on `claude/supply-map-reread`: `docs/MATERIALS_TABS_ARCHITECTURE.md` with the tab's regions and ranges after the cuts, and one line each in the playbook and `docs/QUICKFILL_ARCHITECTURE.md`. Its `mapped_at` is left pending on purpose, as the placeholder `PENDING0000`, four times in the map and once in the playbook's row. It goes last, once the paged reads have landed. It is stacked on the paged reads' commit, so move it the same way:

```
git rebase --onto origin/main eec3bda2eb claude/supply-map-reread
```

Then regenerate the fact sheet against `main` (`npm run map -- src/components/SupplyHousesTab.tsx`), check every range against the file, put the commit in place of every `PENDING0000`, and open it. The scripts that regenerated and checked the draft are not in the repo. They are on the office Mac, in the sessions' notes folder under `supply-map-reread-tools/`.

### 4. The owner's look

No cut was looked at in a browser; the proof is the tests. After #8607 deploys, open Materials → Supply houses and Quickfill's supply houses station on the live site. Open a house, open a bill's Edit window, press an aging cell, and open Record a payment without saving. Each should read as it did.

## Where the branches are

All three are on GitHub: `claude/supply-moves` at `1df647f7ef` (the head of #8607), `claude/supply-cut-12-small-pieces` at `eec3bda2eb` and `claude/supply-map-reread` at `f2d97ec87d`. The last two have no PR. Check with `git ls-remote --heads origin 'claude/supply-*'`.

## Not on this card

The Materials page's own steps (PO Builder's state into its tab, the small inline windows, the split of `updatePOItemSupplyHouse`) are a separate list in the map under *`Materials.tsx` extraction order*. Nobody has asked for them.
