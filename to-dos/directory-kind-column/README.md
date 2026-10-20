---
name: "The Directory's Kind column retires: a chip on the exceptions, a Ledger only band"
number: 131
group: gated
status: proposed 2026-10-20 — waits on the owner's go
summary: >
  The office's Directory (Materials → Supply houses, pane 1) spends a column repeating
  "Supply house" on most rows, and the pill wraps into a two-line oval because nothing
  holds it on one line. The proposal: the column goes; a ledger-only vendor carries a
  small kind chip beside its name; a quiet "Ledger only" band names the group the sort
  already builds; the freed width goes to the crowded Reps column. The estimator's view
  and the All kinds filter are untouched.
next: The owner picks between the retirement and the one-line nowrap fix; then one S PR.
size: S
blocker: The owner's go.
opinion: retire the column — the band and the chips say more with less; the nowrap fix is the fallback if the column must stay
mockup: to-dos/directory-kind-column/mockup.html
---

# The Directory's Kind column retires (#131)

## The ask

The owner, 2026-10-20, on a screenshot of Materials → Supply houses: *I don't like how the
Supply house box looks on this screen. How can I improve this?* The box is the Kind column's
pill — "Supply house" wrapped onto two lines inside an oval, repeated down most of the table.

## What is already there

- **The pane** is [`SupplyHouseDirectory`](../../src/components/materials/SupplyHouseDirectory.tsx)
  (to-dos/supply-house-directory, closed 2026-09-14), rendered twice: the office's
  `SupplyHousesTab` with `audience="office"` (the Kind column draws, `showKind`), and the
  estimator's tab with `audience="estimator"` (supply houses only, no Kind column).
- **The pill** (line ~511) has `fontSize: 0.75rem, borderRadius: 999` but no `whiteSpace: 'nowrap'`,
  and the Kind `<th>` has no width — the table squeezes the column and the two-word label wraps.
  That is the literal defect in the screenshot.
- **The kinds** live in [`vendorKind.ts`](../../src/lib/materials/vendorKind.ts): `supply_house`
  (the default — an unknown kind reads as one), `insurer`, `rental_yard`, `sub_ledger`, `other`,
  each with a one-line hint (`VENDOR_KIND_HINTS`) the vendor form's chips already show. Only
  `supply_house` rows are quoted from or listed for estimators.
- **The sort already groups by kind**:
  [`supplyHouseDirectory.ts`](../../src/lib/materials/supplyHouseDirectory.ts) `rowGroup` orders
  houses-with-a-rep → ledger-only kinds → needs-a-rep, and the amber **Needs a rep** band
  (v2.3166) already marks the third group's start. The middle group has no marker — the Kind
  column is the only thing telling the reader those rows are different.
- **The toolbar's All kinds select** filters the office view by kind; it stays.
- **The guide** *find a supply house and its rep* never describes a Kind column on the rows; Kind
  is described as the form's chips. *send a supply house a quote link* explains why ledger-only
  vendors are hidden from estimators. So the column can go without contradicting a guide.
- **No render smoke pins the column** — the kernel tests (`supplyHouseDirectory.test.ts`,
  `vendorKind.test.ts`) cover the shaping, not the table.

## Three lenses

- **The seat.** The office person scanning this list knows their vendors. A column that says
  "Supply house" nine times tells them nothing nine times, and the wrapped pill makes every
  default row the tallest thing in it. What they actually use the kind for is the exceptions:
  *why does this row have no reps, no prices?*
- **The job.** The question behind the column is "which rows are real counters and which are
  ledger buckets?" The sort already answers it by grouping; the answer just isn't visible. Name
  the group once (a band), mark the exception rows (a chip), and the column has nothing left to do.
- **The office.** Estimators never see the column. The app's idiom is that exceptions get chips
  and the default goes unmarked (the teal Job accounts tag, the Late chips). The Needs a rep band
  is this table's own precedent for naming a group once instead of per row.

## The decision (proposed)

One S PR on the office audience of `SupplyHouseDirectory`:

1. **The Kind column goes.** The office table gets the estimator's five columns; the freed ~12%
   goes to Reps, the column that carries the amber job-accounts sentences.
2. **The exceptions carry a chip.** A ledger-only vendor (any kind but `supply_house`) shows a
   small muted chip beside its name — *Insurer*, *Rental yard*, *Sub ledger*, *Other* —
   `whiteSpace: nowrap`, `title` from `VENDOR_KIND_HINTS`. Supply houses show nothing extra: the
   coverage line already counts them and the bands bound them.
3. **A Ledger only band** where the middle group starts, the Needs a rep band's quiet sibling
   (gray, not amber): *Ledger only · N vendors — paid through Accounts payable, never quoted.
   Estimators don't see these.* A `firstLedgerIndex` helper lands beside `rowGroup` in the kernel,
   with a test. The band only draws on the unfiltered office view (searching or narrowing the
   kind select hides it, like the Needs a rep band when no row needs one).
4. **The phone card gets the same chip.** The office's narrow cards currently show no kind at
   all; the ledger-only card gets the chip beside its name. Estimator cards unchanged.

Rejected:

- **Keep the column, stop the wrap** (`whiteSpace: nowrap` + a column width). One line of code,
  and the mock-up shows it as the fallback — but the column still spends its width repeating the
  default, and the real information (the grouping) stays invisible.
- **Print the kind only on exception rows, in the column.** A mostly-empty column is stranger
  than no column.
- **A tint per kind on the chip.** The words differ; color would add a legend to learn. One muted
  chip for every ledger kind.

## Where it plugs in

- [`src/components/materials/SupplyHouseDirectory.tsx`](../../src/components/materials/SupplyHouseDirectory.tsx) —
  the table head/row (drop `showKind` column, add the name-side chip, the band row), the narrow
  card (chip), `colCount`.
- [`src/lib/materials/supplyHouseDirectory.ts`](../../src/lib/materials/supplyHouseDirectory.ts) —
  `firstLedgerIndex(rows)` beside `rowGroup`, exported and tested.
- Nothing else: no migration, no RPC, no edge function. `vendorKind.ts` is read as is.

## The plan

One PR: the component + kernel helper + its test, the release note, the
`docs/recent-features/` fragment, and one sentence in the guide *find a supply house and its
rep* naming the Ledger only band (plain-words rules apply). `PROJECT_DOCUMENTATION.md` only if
its Materials map names the Kind column (check at build time).

## How to verify

- `npm test -- supplyHouseDirectory` for the kernel.
- Live as the office (sample assistant via view_as or the app): Materials → Supply houses — no
  Kind column, the band between the last rep'd house and the first ledger vendor, chips on the
  ledger rows, the All kinds select still narrowing (pick *Insurer only*: no band, chips still
  shown). Narrow the window under 640px: the ledger card carries the chip.
- As an estimator: the tab is byte-for-byte unchanged (no band, no chips — the kind filter
  already strips ledger vendors).

## The owner's calls

1. **Retire the column, or just stop the wrap?** Recommended: retire (the mock-up shows both).
2. **The Ledger only band — yes or no?** Recommended: yes; without it the middle group is only
   implied by the chips.
3. **Chip color.** Recommended: one muted gray for all ledger kinds.
4. **The phone card chip.** Recommended: yes, same rule as the table.
