---
title: raise a purchase order
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: purchase order, PO, PO number, PO code, PO generator, PO builder, purchase orders tab, supply house, counter, line-item PO, draft PO, finalize, price at time, parts book price, price coverage, duplicates, tally
order: 83
---
"PO" means two different things in ClickTooling, and the Materials page has a tab for each. Knowing which one you need is most of the job.

:::example Which PO do you mean?
{{chip:blue|A number for the counter}} — the supply house asks for a PO number before they'll put material on the job's account → **PO Generator** (or the **PO** tab in Dispatch Mode).
{{chip:gray|A priced parts list}} — a document listing every part, quantity and price → **PO Builder** → **Purchase Orders**.
:::

Each of the three PO-named tabs carries a one-line signpost at the top saying which lane it is, so a wrong first click costs a second, not a morning.

## A PO number for the supply house (PO Generator)

**Materials → PO Generator** (dev, leaders, assistants and controllers). Four fields and a button:

1. **Job** — search by HCP #, job name or address. The job's trade has to match the trade pill you're on.
2. **Who the material is for** — the person picking it up.
3. **Supply house** — optional.
4. **Notes** — optional.

{{button:blue|Generate}} mints a five-digit code (10000–99999) that is unique across the company. Read it across the counter; the ledger under the form lists every code with its job, person, supply house and who made it, newest first, so anyone can look a code up when the invoice arrives.

On a phone, turn on **Dispatch Mode** and use its **PO** tab — same numbering, same ledger, three taps (today's jobs are offered first, the job's crew floats to the top, your last supply house is pre-picked), with **Copy** and **Text to the tech** buttons under the big code ([run the day from your phone with Dispatch Mode](?g=dispatch-mode)).

**Why the ledger matters:** when the supply house's invoice is entered under Materials → Supply Houses, its PO # is checked against this ledger — a code that isn't on file for that house lights a red warning. The number you read at the counter is how the bill finds its job.

## A priced parts list (PO Builder → Purchase Orders)

This lane makes a real document — parts, quantities, a chosen supply house per line, prices — and it is reachable by estimators too.

1. **Materials → PO Builder.** Pick an assembly (a named kit — "Toilet rough-in") and press {{button:blue|Create PO}} to start a draft from it, or {{button:outline|→ Add to PO}} to drop it into the draft you're already editing. Each part lands with the price on file at that moment and the supply house it came from.
2. Edit the draft right there — quantity, supply house (the dropdown shows every house that has a price for that part), price, notes. Rename it so the counter can read it.
3. **Materials → Purchase Orders** lists every PO for the trade pill, Draft or Finalized. Open one to add notes, confirm prices (the **Confirmed** column shows who checked the number and how long ago), **Print** it (a draft prints every house's price beside the chosen one; the supply-house print shows just the chosen prices with tax), or {{button:outline|Duplicate as Draft}} for a repeat order.
4. {{button:green|Finalize}} locks it — the confirm says so: *It will become immutable.* A finalized PO can't be edited (only a one-time note can be added), and it becomes pickable as a line item on a project's Workflow and Forecast.

Two other doors make POs in this lane without visiting PO Builder:

- **Bids → Takeoffs** on a **By Stage** bid: map an assembly onto each fixture, then {{button:blue|Create purchase orders for Stages}} makes one PO per stage (rough-in / top-out / trim-set). Those POs are what the bid's "exact materials" totals add up — so don't delete a takeoff's PO to tidy the list; the bid's material cost estimate is reading it ([choose By Stage or Combined](?g=choose-by-stage-or-combined-for-materials)).
- **Job Parts Tally** turns a tallied job's parts into a PO with one tap; it is stamped with whoever tallied it.

## Three prices for one part — all true

A single part can show three different numbers, and none of them is wrong:

| Where | What it is | When it moves |
|---|---|---|
| **Parts Book price** | The cost on file for that part at that supply house — one price per (part, house). | Whenever someone updates the book; the history keeps every change. |
| **Takeoff line price** | The price copied onto a bid's takeoff line when the part was assigned to a fixture. | Frozen at assignment, so the bid you sent still adds up the way it did. |
| **PO line price** | The price stamped on a purchase-order line when the part was added. | Frozen when the line was added; **confirm price** is how you say "still good". |

The book is where you fix a price for the future; the bid and the PO remember what was true when they were made. **Price coverage** — the button beside Add Part on the Parts Book — tells you how much of the book has a price at all ("1,709 items · 74% have prices · 27% have more than one"), house by house.

## Keeping the book clean

Two parts with the same name mean two prices to maintain and a coin-flip in every picker. **Settings → Catalogs → Duplicates** (dev) lists parts that share a name — ignoring case and spacing — by default. Tick **Show near-matches (80%+ similar, same numbers)** to also see spelling variants; two names have to agree on every number they carry (sizes, lengths, model numbers) before they can pair, so a 1-1/2" and a 1-1/4" fitting never get grouped as one. Delete the extras and the pickers stop guessing.
