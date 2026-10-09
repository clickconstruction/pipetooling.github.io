---
name: "Bid history: every value anyone entered on a bid, and a way to put one back"
number: 73
group: ready
status: live 2026-10-06 — PR 1 capture (v2.4598 #4583, migrations 20261007040000 / 041000), PR 1b the request tag (v2.4736 #4747, migration 20261007050000, twin-mcp deployed), PR 0a the Cover Letter's three boxes saved (v2.4737 #4749, migration 20261007060000), types regen #4751; PR 0c archive coverage live 2026-10-07 (v2.4861 #4890, migration 20261008070000 pushed); PR 0b the Labor sync keeps typed hours live 2026-10-07 (v2.4864 #4899, migration 20261008071000 pushed; its race fixed v2.4903 #4936, migration 20261008091000 pushed); PR 2 the read-only History window live 2026-10-08 (v2.4948 #4994, migration 20261009060000 pushed); PR 3 Past values under the cells built (v2.4952 #5000, migration 20261009090000); PR 4 Put back for a value built (v2.4954, migration 20261009110000); PR 5 a bid's removed rows for its editors with Put back, and the brush's and a book switch's tags, built (v2.5079, migration 20261010017000) · left: undo a whole action, its own PR
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
  The owner answered all five calls on 2026-10-08. (1) Every estimator sees every change. (2) Keep
  three years, then purge. (3) Anyone who can edit the bid may Put back. (4) The builder picks the
  default column set. (5) The pane follows the adopt and shows both bids' history, each row labelled
  with its bid number. PR 2 (the read-only window) and PR 3 (Past values under the cells) are
  built on them, then PR 4 (Put back a value). A sixth call, answered 2026-10-09: a bid's editors
  see the bid's own removed rows so they can Put them back (PR 5, with the brush's and a book
  switch's tags). Next: undo a whole action, its own small PR.
size: S (PR 0, three small fixes) + S (PR 1 capture) + M (PR 2 the pane) + M (PR 3 the switch on the cells) + M (PR 4 put back) + M (PR 5 removed rows and action captions) + S (PR 6 undo a whole action)
blocker: None.
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
  - the Cover Letter's per-bid Inclusions, Exclusions and Terms boxes were React state only
    (`Bids.tsx` ~556, `BidsCoverLetterTab.tsx` ~2128) — typed, shown, never saved; a reload emptied them
    (fixed in v2.4737, PR 0a: three columns on `bids`);
  - the Labor tab's load sync (`useBidPricingEngine.ts` ~685) deletes every hours row whose fixture
    name no longer matches a count row and mints book defaults in its place, so a re-import that
    renames fixtures (the `[Group]` fix of v2.4188 changes names) wipes typed hours. Found while
    building PR 0b (2026-10-07): labor rows belong to the bid but the sync reads the **active
    version's** count rows, so switching to a version without a fixture deleted its typed hours too.
    PR 0b (v2.4864) closes both.
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
too — put that back first" (built in PR 5 as `restore_bid_removed_row`, behind `can_edit_bid`). Putting back a whole action (undo an import after the toast is gone)
is the same loop over its rows and comes last.

**Stop the losses at the source (PR 0, independent):**

1. Save the Cover Letter's Inclusions, Exclusions and Terms per bid (three text columns on `bids`,
   the org defaults still the fallback).
2. The Labor sync keeps a typed hours row whose fixture was renamed: match on the count row's id
   when the row carries one, else by name; a row it would drop moves to an "unmatched" band with its
   hours instead of being deleted. (Built v2.4864: labor rows carry no count-row id, so the match is
   by name, loosely through case, spacing and a `[Group] ` prefix; the band's rows live in their own
   table so no total counts them.)
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
- RPCs (new): `list_bid_history`, `latest_bid_cell_history`, `put_back_bid_change`, and for a removed row `can_edit_bid`, `list_bid_removed_rows` and `restore_bid_removed_row`.
- The request tag: `src/lib/bids/bidActionHeader.ts` (`withBidAction(builder, 'counts-import')`), sent by
  the import, Clear all, the labor sync, the engine's resyncs, the margin brush; twin-mcp's `paste_counts`.
- Docs: `docs/BIDS_SYSTEM.md` (a *History* section), `docs/BIDS_TABS_ARCHITECTURE.md`, the guide
  *price a bid* (one paragraph and the switch), `docs/PROJECT_DOCUMENTATION.md` (the audit trail is
  "partially implemented" at ~2711 — amend), `docs/GLOSSARY.md` (History, Put back).

## The plan

| PR | What | Size |
|---|---|---|
| 0a | Cover Letter Inclusions / Exclusions / Terms saved per bid — **live v2.4737** (three columns on `bids`, in the ledger's list) | S |
| 0b | Labor sync keeps typed hours through a rename; unmatched band — **built v2.4864** (migration `20261008071000`: `cost_estimate_labor_rows_unmatched`, the ledger's eighteenth table, three app tags; closes the version-switch loss too) | S |
| 0c | Archive coverage for `bid_count_row_custom_costs`, `bid_takeoff_stage_splits` and `bid_submittal_takeoff_choices` (the custom-costs FK itself shipped in v2.4413) — **live v2.4861** (#4890, migration `20261008070000` pushed 2026-10-07, all three grouped under the bid) | XS (migration) |
| 1 | `bid_changes` + `record_bid_change()` on the seventeen tables, RLS, purge, `docs/migrations` — built as v2.4598 (two migrations: the ledger, then the triggers alone) | S — ship first |
| 1b | The request tag on the bulk paths and the app's own writes (`x-bid-action`), read by the trigger — **live v2.4736** (import, Clear all, labor sync, fill from the book, robot paste; brush and book-switch copy left for PR 2's reader) | S |
| 2 | `list_bid_history` + `bidHistory.ts` + the pane, read-only, with the archive's removed rows — **built v2.4948** (migration `20261009060000`; a window, not a side pane, and the archive's rows reach a dev only) | M |
| 3 | The History pill and the under-cell lines on the four tabs (`latest_bid_cell_history`, the label fallback) — **built v2.4952** (migration `20261009090000`; a *Past values* switch beside the History button, per device; the fallback reads the ledger's own removals, not the archive) | M |
| 4 | Put back: `put_back_bid_change` for a value — **built v2.4954** (migration `20261009110000`; Put back on each changed value in the window) | S–M |
| 5 | A bid's removed rows for its editors and Put back for a row (`can_edit_bid`, `list_bid_removed_rows`, `restore_bid_removed_row`), and the brush's and a book switch's tags — **built v2.5079** (migration `20261010017000`) | M |
| 6 | Undo a whole action (the loop over its rows) — its own small PR after PR 5 (PUNCHLIST, 2026-10-09) | S |

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
- PR 5, the walk, once `20261010017000` is on prod. Push it with `--include-all`, since
  `20261010020000` went first.
  - Sign in as Robert on the dev server:
    `/dev-login?as=1&to=%2Fbids%3Ftab%3Dcounts%26bidId%3Da5a3a840-0a7b-4c67-8b59-3e95d0d80150`.
  - On BP398 ZZ Test's *To Plans* version, add a count row *History walk* (count 1). Delete it with
    the trash, then **Delete**.
  - Open **History**. The removal has **Put back**. The press is a write on prod, so ask first.
  - After the press, the window says *History walk is back.* and the row is on the Counts tab again.
    History reads *Put back History walk*, by Robert.
  - Delete the row again, so ZZ Test ends as it was.
  - Signed in with `?as=twin:estimator`, the same History lists no removed rows and no Put back.
    Twin Estimator 1 neither made nor estimates ZZ Test. This step is read-only.
  - The 2026-10-02 removals show as archive lines. A price or part line removed with its count row
    has no Put back of its own. Do not press Put back on a *ZZ walk (delete me)* version: it brings
    back about 83 rows.
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

**PR 0c built 2026-10-07 as v2.4861**: the archive trigger on the three tables, grouped under `bid_id`; the restore needed no change (tested on stubs: a removed count row, then the bid, then a full restore). Merged as #4890 and `20261008070000` pushed the same day.

**PR 0b built 2026-10-07 as v2.4864**, directed by Punchlist: a pure plan (`laborSyncPlan.ts`) renames a row whose fixture changed only in case, spacing or a `[Group] ` prefix, sets aside a row no counted fixture claims in `cost_estimate_labor_rows_unmatched` (out of every total), and takes it back before the book when the fixture is counted again; a loose match never merges two fixtures. The Labor tab's *Hours not on the counts* band has Use for and Remove. Each step is tagged (`labor-rename`, `labor-park`, `labor-take-back`, `labor-use-parked`) and the table joined the ledger's list. Before the push the client deletes as before. Merged as #4899 and `20261008071000` pushed 2026-10-07. Its live walk found a race (one version switch started four syncs and each set the same rows aside, ZZ Test only, no total moved): **v2.4903** runs one sync at a time per estimate, claims a row by deleting it before moving it, and adds `UNIQUE (cost_estimate_id, fixture)` to the set-aside table after deleting the copies (migration `20261008091000`).

**PR 2 built 2026-10-08 as v2.4948**, after the owner's five answers: `list_bid_history` (SECURITY INVOKER: the ledger for whoever can read the bid, the adopted bids' rows with their numbers, the archive's removed rows the ledger lacks for a dev only), the kernel `bidHistory.ts` (actions by burst, captions, line words, tabs, filters, the default Edit Bid columns), and a History door on every bid tab's title that opens a read-only window. A window rather than the drawn side pane, as the GC window became on 2026-10-02 (a pane beside the road squeezed the rows). The guide *price a bid with the Workbench* has the paragraph. Push `20261009060000` after it merges, then regenerate the types.

**PR 3 built 2026-10-08 as v2.4952**: `latest_bid_cell_history` (SECURITY INVOKER, the ledger only: each cell's two newest earlier values and its count of changes, both price sources as one history, each removed row's last value by name), the kernel `bidCellHistory.ts`, and **Past values on/off** beside the History door. On, the Workbench price, the count, the takeoff quantity and unit price and each stage's labor hours show their past under the box; a row with no past borrows its name's (*an earlier Lav-1 row*), which covers a re-import. *+N more* opens the window on the row. The switch is per device, not per person: it sits on every bid tab, and a person read would add a load to each. Push `20261009090000` after it merges, then regenerate the types.

**PR 4 (a value) built 2026-10-08 as v2.4954**: `put_back_bid_change(p_change_id, p_column)`, SECURITY INVOKER, so the write runs under the presser's own policies (the owner's call 3). It writes the ledger row's old value for one column, tags the request `put-back` so the trigger records it as the presser's change, puts the headers back, and words its refusals (a removed row, a removal, no rights). In the window every changed value of the open bid has **Put back**; the window reads again and the open bid's tabs reload. Not a removed row: `restore_deleted_record` waits on Grace's call on the archive. Push `20261009110000` after it merges, then regenerate the types.

**Live walk 2026-10-08, and v2.4978.** Past values (v2.4952), Put back (v2.4954) and the History paging (v2.4963) passed on ZZ Test, walked by Helper 3 for PUNCHLIST. A Labor hours cell changed 1 h → 1.25 h showed its own past, Put back set it to 1 h again, and the window listed both. **v2.4978** fixes what the walk found: the action cut at a full page's edge was drawn as if whole, and now waits for **Show older changes**. Left from the walk:

- Left for its own small fix (PR 5's scope, set by PUNCHLIST on 2026-10-09, was the removed rows and the tags): after a Put back the tab's read re-arms the labor autosave, which writes the same six rows back (204s, no ledger rows). Harmless, but a read should not count as an edit.

**PR 5 built 2026-10-09 as v2.5079**, after the owner's call that day (a bid's editors see the bid's own removed rows so they can Put them back), directed by PUNCHLIST. Migration `20261010017000` adds `can_edit_bid` (the bids update policy as one check: its roles, a primary's own bids, training mode, the twin fence), `list_bid_removed_rows` (the bid's own archive rows still out, for its editors; the archive's dev-only read stays) and `restore_bid_removed_row` (a row back with what was removed with it, parents first, a gone reference cleared or refused in words, tagged `put-back`). The window lays the removed rows over the history: a removal the ledger holds gains Put back by its archive row, paired on table, row and time, and one from before the ledger joins as an archive line. A row whose count row was removed in the same action waits for that count row's Put back. The margin brush's strokes (`price-brush`) and a book switch (`book-switch`, the copy and the bid's pick) are tagged, so each reads as one action (*Brushed 6 prices*, *Switched the price book, copying 31 prices*). Undo a whole action is out: its own PR. Push `20261010017000` after it merges, then regenerate the types.
