---
name: "Truck stock: what each truck holds, and what to restock"
number: 162
group: gated
status: proposed 2026-10-24 from the trade ERP comparison (gap 2 of 9) · waiting on the owner's yes that trucks carry enough stock to count
summary: >
  The app knows what a job used (Parts Tally) but not what a truck or the shop holds, so nobody
  can see what is on a truck or what to reorder. The smallest useful version makes each truck a
  stock location with a short list of parts, a count set by hand and a minimum; Parts Tally's
  lines bring the count down on their own, and a restock list under the minimum drafts a PO in the
  PO Builder.
next: The owner says whether the service trucks carry enough stock to be worth counting and which parts, and may also book a demo of Ply, the add-on two of the vendors send their users to. Then a mock-up of a truck's stock card.
size: M as a train of four (S · S · S · S); one migration
blocker: Whether trucks carry enough stock to count.
opinion: build small if trucks carry real stock; a short list per truck, never the whole Parts Book
---

# Truck stock: what each truck holds, and what to restock (#162)

## The ask

The owner, 2026-10-24: *"Draft to-dos in the repo for the top five gaps, each with its smallest
useful version, as one docs PR."* This is gap 2 of the trade ERP comparison the owner ran the same day.
The owner kept its weight at 2 of 3. Its gap is 2, so it scores 4, tied with #161 and #163.

This is a proposal. Nothing here is built until the owner picks.

## What the comparison found

- ServiceTitan tracks stock by warehouse and truck, with transfers, replenishment POs, cycle
  counts and a barcode app.
- FieldPulse treats trucks, vans and warehouses as stock hubs. The company chooses when stock
  comes off: when the job's material list is done or when the invoice is final. Reorder POs run on
  their own.
- Successware treats each truck as a warehouse and restocks from the parts used against a minimum
  and a maximum.
- Housecall Pro and FieldEdge send their users to Ply, a third-party add-on, for truck stock.

## Today

- **Trucks** are `vehicles` rows on People → Vehicles, and `vehicle_possessions` says who has a
  truck from which day to which.
- **Parts Tally** ([`JobTally.tsx`](../../src/pages/JobTally.tsx), `jobs_tally_parts`) records
  the parts a tech used on a job.
- **The Parts Book** (`material_parts`, `material_part_prices`) holds every part and its price at
  each supply house; **the PO Builder** writes `purchase_orders`.
- Nothing holds a count of what is on hand anywhere.

## The decision (open)

- Whether the service trucks carry enough stock to be worth counting, and which parts. The answer
  sets the list.
- When a part comes off a truck: when it is tallied (the proposal), or when the job is billed.
- Whether to try Ply first. It would mean a demo and an account, which is the owner's call.

## The smallest useful version

1. **A truck's stock card** on People → Vehicles: a short list of parts from the Parts Book, each
   with a count set by hand and a minimum.
2. **The count comes down by itself.** On hand is the count set, less every part tallied since
   then by whoever had the truck that day (`vehicle_possessions`). Nothing is written to the tally.
3. **A restock list** of the parts under their minimum, per truck, with **Draft a PO**, which opens
   the PO Builder with the lines filled. A part with no supply house price yet stays on the list
   with that reason, and the draft takes the rest.

## Where it plugs in

| Piece | Exists | New |
|---|---|---|
| Trucks and who has them | `vehicles`, `vehicle_possessions` | — |
| Parts used | `jobs_tally_parts` | — |
| The parts and prices | `material_parts`, `material_part_prices` | — |
| The count and the minimum | — | a table such as `truck_stock_items` (truck, part, count, counted at, minimum), RLS for the office roles, the three fences |
| The math | — | `lib/stock/truckStock.ts`: on hand, below minimum, the restock lines; pure and tested |
| The card and the list | People → Vehicles | the stock card, the restock list |
| The PO | the PO Builder | its draft opened with lines |

## The plan

1. **The kernel.** On hand from a count and the tallies since, the tally matched to the truck
   through who had it that day, the below-minimum list, the restock lines. Tests only.
2. **The table.** The migration and the stock card: add a part, set its count and minimum.
3. **The restock list** and its **Draft a PO**.
4. **Optional.** A Needs you line or a Quickfill station for trucks under their minimum.

## How to verify

On a ZZ test truck with three parts: set the counts, tally two of one part on a ZZ job as the tech
who has the truck, and read the card's count drop by two. Push one part under its minimum and
draft the PO.

## Open questions

- Which trucks and which parts.
- Whether the shop counts as a location too.
- Whether techs may see or set their own truck's counts.
