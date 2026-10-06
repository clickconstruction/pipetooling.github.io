---
name: "Bid history: every value anyone entered on a bid, and a way to put one back"
number: 73
group: ready
status: PR 1 (capture) built 2026-10-05 as #4583; its full-schema bed ran green 2026-10-06 (33 checks, Docker started under the sessions' account), rebased onto main, migrations renumbered 20261007040000 / 20261007041000, auto-merge armed · planned 2026-09-30 (the ask, the read of Wendi's bid, the design and its three "is this the best we can do?" passes, the mock-up) · PR 0 waits for Wendi's answer
summary: >
  Wendi lost work on a SpaceX bid after re-importing counts and there was no way to see what the
  bid had said before, or who changed it. Nothing on a bid keeps its old value: an edit overwrites,
  a delete is kept for a dev only, and the Cover Letter's own boxes are never saved at all. Bid
  history is one ledger of every value anyone enters on a bid, written by a database trigger so no
  save path can miss it; a History switch on the Bids page that shows each cell's past under it and
  lists everything that happened on the bid, newest first, grouped into actions ("Imported 23 rows
  from CountTooling"); and Put back, per value and per removed row, so an estimator recovers her
  own work without a dev. Three small fixes stop the losses at the source and can ship first.
next: >
  When #4583 merges, `supabase db push` its two migrations (list the pending set first: a push
  applies every pending file; stamps 20261007040000 / 20261007041000 are above main's newest, so no
  --include-all unless a later stamp lands first). The deploy note is in the triggers migration's
  doc. Then PR 1b, the request tag (the labor minted on send and the copy RPCs need a
  transaction-local mark), then PRs 2 to 5. The owner's four calls (who sees whose edits; how long
  to keep; may a non-dev put a row back; which bid columns are shown) come before PRs 2 to 4. PR
  0's three loss fixes are independent; 0c is now archive coverage alone (the key shipped in v2.4413).
size: S (PR 0, three small fixes) + S (PR 1 capture) + M (PR 2 the pane) + M (PR 3 the switch on the cells) + M (PR 4 put back) + S (PR 5 action captions)
blocker: None for PR 1 — the bed ran green on 2026-10-06 (Docker Desktop started with `open -a Docker` from the sessions' account). PR 0 waits for Wendi's answer; PRs 2–4 for the owner's four calls.
---

# Bid history: every value anyone entered on a bid, and a way to put one back

Mock-up: [`mockup.html`](./mockup.html) (the Pricing tab with History on, and the pane) — also at https://claude.ai/artifact/399oWZLPy7xi22D8gciNFi.

## The ask

Grace, 2026-09-30: "Estimator Wendi is reporting that after a recent attempt to upload some SpaceX
information she lost her history on her bid. Do we have a tool to see price history on a bid where a
user could potentially toggle a mode and see all the values he or she or anyone has entered on the
bid? If not, can you help me come up with a plan to add this and deeply think through what this
could look like?"

## What exists today (read off the code and prod, 2026-09-30)

- **No table keeps an old value when a bid is edited.** Edit Bid autosaves a diff and moves its
  baseline forward (`useBidEditController.ts`); Pricing, Takeoffs, Labor and Counts write straight to
  their tables. Only `bid_pricing_assignments` and `bid_count_row_custom_prices` carry
  `updated_by` / `updated_at`, and those say who wrote last, not what it was.
- **Deletes are kept, for a dev, for 90 days.** `deleted_records_archive` (a BEFORE DELETE trigger
  over the bid's cascade closure) and Settings → Data & recovery → *Recently deleted*, which puts a
  whole bundle back, all or nothing. Three bid tables are not covered: `bid_count_row_custom_costs`
  (its count-row key came with v2.4413 on 2026-10-02, so a removed count row now takes its quoted
  cost with it; the archive still does not keep it), `bid_takeoff_stage_splits`,
  `bid_submittal_takeoff_choices`.
- **Two things called "history" on the tabs are not this bid's past**: `bid_pricing_history` is the
  Pricing tab's win/loss calibration strip from other bids; `takeoff_fixture_history` is "what this
  fixture usually gets" on other bids.
- **Undo exists twice, one level each**: the ten-second toast after a counts import
  (`countsImportUndo.ts`) and the margin brush's Undo sweep, both in memory.
- **Two ways work vanishes without any delete being pressed**:
  - the Cover Letter's per-bid Inclusions, Exclusions and Terms boxes are React state only
    (`Bids.tsx` ~556, `BidsCoverLetterTab.tsx` ~2128) — typed, shown, never saved; a reload empties them;
  - the Labor tab's load sync (`useBidPricingEngine.ts` ~685) deletes every hours row whose fixture
    name no longer matches a count row and mints book defaults in its place, so a re-import that
    renames fixtures (the `[Group]` fix of v2.4188 changes names) wipes typed hours.
- The counts import itself only **appends** rows (`insertCountRows`, one row at a time); Clear all
  counts hard-deletes the version's rows and the cascade takes prices, assignments, takeoff lines,
  mappings, splits and submittal ticks with them. twin-mcp's `paste_counts` with `replace: true`
  deletes every count row of the bid across all versions.

**Wendi's bid, read on 2026-09-30 (B494 SPACEX BA02 9 GANG RESTROOMS, and B375):** nothing on B494
reads as lost — all 35 count rows carry her prices and allowances. The archive holds 47 rows she
removed from it that day: 44 takeoff part lines added and removed within a minute of each other,
one count row (SUMP ×2 with its $3,700 price and its labor row) and one assignment. B375 has no
deletions since 09-28. So what she saw as lost is most likely one of the two silent paths above, or
CountTooling (a separate app). Ask her which tab and which values before restoring anything.

## The decision (draft 3, after three passes)

**What it is.** One ledger of every value anyone enters on a bid, and a **History** switch on the
Bids page. Off, the tabs are as today. On: every editable number shows its past under it in soft
text; a side pane lists everything that happened on the bid, newest first, grouped into actions; any
old value or removed row has **Put back**.

**Capture — one table, one trigger, no client.** `bid_changes`: `bid_id`, `bid_version_id` (the
version the row belongs to, so the reader's "an earlier Lav-1" fallback stays inside one version),
`table_name`, `record_id`, `count_row_id` (when the row hangs off one; a count row's own id),
`op` (insert · update · delete), `changed` (the columns that changed), `old_values` and
`new_values` (those columns only, jsonb), `label` (the row's human name, computed at write time:
the count row's fixture, the part's name, the labor row's fixture; none for a `bids` row, since one
row can carry several columns and the reader words each — so the reader never joins back to a row
that may be gone), `changed_by` (`auth.uid()`; null for a robot or the system), `changed_at`,
`action` (the request's tag, see captions), `by_app` (true when the write was the app's own doing,
not a person's press). One generic `AFTER INSERT OR UPDATE OR DELETE` trigger,
`record_bid_change()`, attached to the seventeen tables that hold what people type: `bids` (48
columns: everything Edit Bid saves and the Pricing, Cover Letter and SOV picks — not `updated_at`,
the stamps or the robot columns — under `UPDATE OF`), `bids_count_rows`,
`bid_count_row_custom_prices`, `bid_count_row_custom_costs`, `bid_pricing_assignments`,
`bids_takeoff_rough_part_lines`, `bid_takeoff_stage_splits`, `cost_estimates`,
`cost_estimate_labor_rows` and the five direct-cost row tables, `bid_sov_lines`,
`bid_payment_schedule_rows`, `bid_versions`. Not `bids_takeoff_template_mappings`: it is By
Stage's, unwritten since v2.4396. It is the contract-text history's pattern
(`20260928050129`): SECURITY DEFINER, writes only when something actually changed
(`IS DISTINCT FROM`), swallows its own errors so a save can never fail. Deletes are recorded too
(old values only), so history outlives the archive's 90-day purge; the archive stays the thing a
restore reads. The volume was guessed at about 500 bid-table writes a week and never checked
(Wendi's bid alone had 47 deletes in one day, and a copy writes a row per copied row), so plan for
hundreds of thousands of rows over three years, purged by `pg_cron` like the archive. RLS: read for
whoever can read the bid under their own `bids` policies (an estimator every bid, a primary only
theirs), and a dev after it is deleted; no client writes.

**Actions, not rows.** Each REST call is its own transaction and the import inserts one row at a
time, so a transaction id cannot group a burst. The reader groups instead: same person, same bid,
gaps under five seconds → one action, captioned from its shape ("Added 23 count rows",
"Changed 4 prices", "Removed SUMP ×2 and what hung on it"). A bulk path tags its requests instead of
opening anything: PostgREST hands the request headers to the database
(`current_setting('request.headers', true)`), so the client sends `x-bid-action: counts-import`
on each call of the import (supabase-js `setHeader`) and the trigger stores it — the import then
reads "Imported 23 rows from CountTooling" with no state to open or close. The same tag marks the
app's own writes: the Labor load sync, the assignments minted from a book, the pricing engine's
resyncs send `x-bid-action: labor-sync` and the ledger says "the app" did it, not whoever happened
to open the tab (today those writes would be laid at the viewer's door). twin-mcp sends the tag
too, so a robot's paste reads as the robot's.

**Reading.** `list_bid_history(p_bid_id, p_since, p_table)` returns the rows with labels; a pure kernel
(`bidHistory.ts`) groups them into actions and words each line ("Lav-1 · price · $9,800 → $10,300 ·
Wendi · Tue 8:14 pm"), formatting by a table+column map (money · count · hours · text · pick). The
cells read a second, narrow RPC — `latest_bid_cell_history(p_bid_id)`: the last two values and a
count per (table, row, column) — so a bid that lives for years never loads its whole ledger to draw a
tab. **A row with no past of its own borrows its label's**: after Clear all and a re-import, Lav-1 is
a new row with a new id, so the reader falls back to the same bid, table and label and draws the
earlier row's values marked "an earlier Lav-1 row · removed Wed" — Wendi's case exactly. The pane
says plainly that history starts the day PR 1 deployed, and shows the archive's removed rows
alongside so it is not empty on day one.

**The switch.** A **History** pill on the Bids lens bar, remembered per person. On:

- Pricing's price cells, Counts' count cells, Takeoffs' quantity and price cells and Labor's hours
  cells show up to two prior values under the box, newest first, in the soft-line style the
  procurement log uses ("$9,800 · Wendi · Tue"), with "+3 more" opening the pane on that row. A cell
  with no past shows nothing, so rows do not all grow.
- The pane (the *See what the GC sees* side-pane pattern, v2.4189) lists actions newest first, each
  expandable to its rows, filterable by tab and by person, with a search box for a fixture.
- Removed rows appear in the pane with **Put back**, row by row.

**Put back.** One RPC, `put_back_bid_change(p_change_id)`: the ledger row names the table, the row and
the column, so the server writes the old value back under the caller's own RLS (a person who cannot
edit the bid cannot put anything back) and the trigger logs it as a change by them; the client
refetches. No per-tab client code. A removed row comes back through a row-level version of the archive's restore
(`restore_deleted_record(p_archive_id)` reusing the bundle machinery's FK checks and insert order),
allowed to whoever can edit the bid; a row whose parent is gone reads "its count row was removed
too — put that back first". Putting back a whole action (undo an import after the toast is gone)
is the same loop over its rows and comes last.

**Stop the losses at the source (PR 0, independent):**

1. Save the Cover Letter's Inclusions, Exclusions and Terms per bid (three text columns on `bids`,
   the org defaults still the fallback).
2. The Labor sync keeps a typed hours row whose fixture was renamed: match on the count row's id
   when the row carries one, else by name; a row it would drop moves to an "unmatched" band with its
   hours instead of being deleted.
3. Give `bid_count_row_custom_costs` its FK (`ON DELETE CASCADE`) and put it, the stage splits and
   the submittal ticks under the delete archive.

**Rejected on the way:** Supabase's `supa_audit` extension (generic row versions, but no labels, no
bid key, a second pattern beside the archive's); a nightly snapshot of every bid table with a diff
(cheap, but no *who*, and Wendi's churn was inside one hour); grouping by transaction id (see above);
`begin_bid_action` / `end_bid_action` RPCs (state to open and close, and no answer for the app's own
writes — the request tag does both); per-cell history on every editable field (heavy; the four
numbers people type are enough); per-tab put-back code (one RPC does it for every table).

## Where it plugs in

- Tables: the seventeen above; the archive's coverage list (`20260716120000`, `..._tier2`) for what a
  delete already keeps; `stamp_updated_by()` (`20260905233000`) for the two stamped tables.
- Kernels (new): `src/lib/bids/bidHistory.ts` (grouping, captions, wording, the column map),
  `bidHistoryPutBack.ts` (the write each revert makes). Tests beside each.
- Client: `BidsLensBar` (the pill; `useBidsLoadGates` for the pane's read), a new
  `BidHistoryPane.tsx`, small hooks into `BidsPricingTab` / `BidsCountsTab` / `BidsTakeoffTab` /
  `BidsLaborTab` for the under-cell lines (`useBidHistory(bidId)` → a map by `(table, record_id, column)`).
- RPCs (new): `list_bid_history`, `latest_bid_cell_history`, `put_back_bid_change`, `restore_deleted_record`.
- The request tag: `src/lib/bids/bidActionHeader.ts` (`withBidAction(builder, 'counts-import')`), sent by
  the import, Clear all, the labor sync, the engine's resyncs, the margin brush; twin-mcp's `paste_counts`.
- Docs: `docs/BIDS_SYSTEM.md` (a *History* section), `docs/BIDS_TABS_ARCHITECTURE.md`, the guide
  *price a bid* (one paragraph and the switch), `docs/PROJECT_DOCUMENTATION.md` (the audit trail is
  "partially implemented" at ~2711 — amend), `docs/GLOSSARY.md` (History, Put back).

## The plan

| PR | What | Size |
|---|---|---|
| 0a | Cover Letter Inclusions / Exclusions / Terms saved per bid | S |
| 0b | Labor sync keeps typed hours through a rename; unmatched band | S |
| 0c | Archive coverage for `bid_count_row_custom_costs`, `bid_takeoff_stage_splits` and `bid_submittal_takeoff_choices` (the custom-costs FK itself shipped in v2.4413) | XS (migration) |
| 1 | `bid_changes` + `record_bid_change()` on the seventeen tables, RLS, purge, `docs/migrations` — built as v2.4598 (two migrations: the ledger, then the triggers alone) | S — ship first |
| 1b | The request tag on the bulk paths and the app's own writes (`x-bid-action`), read by the trigger | S — with or right after PR 1 |
| 2 | `list_bid_history` + `bidHistory.ts` + the pane, read-only, with the archive's removed rows | M |
| 3 | The History pill and the under-cell lines on the four tabs (`latest_bid_cell_history`, the label fallback) | M |
| 4 | Put back: `put_back_bid_change` for a value, `restore_deleted_record` for a row | S–M |
| 5 | Undo a whole action (the loop over its rows) | S |

Each PR ships its release note and fragment; PR 1 its migration doc; PR 2 the guide paragraph.

## How to verify

- PR 1: on a ZZ test bid, type a price, change it twice, delete a count row, run an import and Clear
  all; `select label, op, changed, old, new, changed_by from bid_changes where bid_id = … order by
  changed_at` reads every step with the right labels; a write with the trigger deliberately broken
  (rename its target table in a transaction, roll back) still saves.
- PR 2–3: the same bid's pane groups the import as one action of 23 rows; the price cell shows the
  two earlier values; an estimator on another service type cannot read the bid's history (RLS).
- PR 4: put a price back → the cell reads the old value and the pane shows the revert by the
  person who pressed it; put the removed count row back → its price and labor row come with it.
- Live data left in prod: none beyond the ZZ bid.

## Is this the best we can do? (the two passes)

**Pass 1, on the plan.** The first draft grouped changes by transaction id — that fails with
PostgREST, where every request is its own transaction, so grouping moved to the reader (bursts) with
optional captions. It kept deletes out of the ledger — added, so history outlives the 90-day purge.
It put per-cell history on every editable field — cut to the four numbers people type. It had the
pane before capture — reversed: capture is PR 1 and stands alone, because nothing typed before it
deploys can ever be shown. It had no answer for the two silent losses that most likely bit Wendi —
they became PR 0, ahead of the feature.

**Pass 2, on the mock-up.** The first cut showed prior values under every cell and doubled the
table's height; now a cell with no past shows nothing and a cell with a past shows two lines at most.
"Put back" sat on every history line; now it shows on hover and on the pane, once per line. The pane
first listed rows; now it lists actions with the rows folded, so an import is one line, not 23. The
pill's location on the lens bar had no place on the mock-up; drawn. A look at the rendered page
found the table's line-total column clipped under the pane (it said nothing the mock-up needs and
went) and one action out of time order in the pane (fixed).

**Pass 3, asked again.** The captions leaned on open/close RPCs and left the app's own writes (the
Labor load sync, minted assignments) attributed to whoever opened the tab — replaced by a request
tag the trigger reads, which fixes both. Put back was four tabs of client code — one RPC. A
re-imported row would have shown no past — the label fallback. The cells would have loaded the whole
ledger — a narrow RPC for the last two values. And PR 0 was three guesses at what bit Wendi — it now
waits a day for her answer, while PR 1 ships regardless.

## Where it stands

Planned 2026-09-30. **PR 1 built 2026-10-05 as v2.4598**, directed and reviewed by PUNCHLIST: two
migrations (`20261007040000_bid_changes`, then `20261007041000_bid_changes_triggers`, the
seventeen triggers alone so their write locks are held for nothing else), the CI test
`bidChangesCapture.test.ts`, and the full-schema bed `npm run test:pg:bid-changes`. It ran on a
scratch Postgres 15 with stub tables (33 assertions; the bed itself needs docker and has not run, and the PR merges only after it runs green);
not pushed. What the build settled, beyond the decision above (the migration docs hold the detail):

- A row trigger, not statement triggers: measured, the statement design still passes 64
  subtransactions on a copy and is 3–7 times slower per single-row save; concurrent reads showed
  no cost from the subtransactions.
- A child removed with its parent takes the parent's fixture, version or bid from the delete
  archive's snapshot; a row is never written without its bid; a deleted bid writes one row.
- `bid_id` has no foreign key: a deleted bid's history stays for a dev and returns if the bid is
  put back.
- Not captured yet, and typed on a bid: `bid_sov_stage_overrides` (keyed `(bid_id, stage)`, no
  `id`) and the entries of a bid's own price book. PR 1b also needs a transaction-local mark for
  the app's writes made inside a person's request (the labor minted on send, the copies).

Owner's calls open (front matter). PR 0 waits for Wendi's answer, so the right loss gets fixed.
