---
title: raise a purchase order
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: purchase order, PO, PO number, PO code, PO generator, what they said they need, said they need, PO builder, purchase orders tab, supply house, counter, line-item PO, draft PO, finalize, price at time, parts book price, price coverage, duplicates, tally
order: 83
---
A PO, a purchase order, means two different things in ClickTooling. The Materials page has a tab for each, and knowing which one you need is most of the job.

:::example Which PO do you mean?
{{chip:blue|A number for the counter}} — the supply house asks for a PO number before they'll put material on the job's account → **PO Generator** (or the **PO** tab in Dispatch Mode).
{{chip:gray|A priced parts list}} — a document listing every part, quantity and price → **PO Builder** → **Purchase Orders**.
:::

Each of the three PO-named tabs carries a one-line signpost at the top. It says which lane it is. So a wrong first click costs a second, not a morning.

## A PO number for the supply house (PO Generator)

You open **Materials → PO Generator**. Devs, leaders, assistants and controllers can use it. It has four fields and a button:

1. **Job**: you search by HCP #, job name or address. HCP # is the job's HouseCall Pro number. The job's trade has to match the trade pill you're on.
2. **Who the material is for** is the person picking it up.
3. **Supply house** is optional.
4. **What they said they need** is optional. The tech has just told you what the code is for. It might be *40 ft of ¾" PEX and two stop valves*, *a 2" drain machine* or *just fittings*. PEX is flexible water tubing. Write it down in their words. It shows on the ledger under **Said they need**. The ledger is the list of codes under the form. It comes back when the invoice arrives, as described below.

You do not have to know it before you press Generate. The card that shows the new code asks **What did they say they need?** You read them the code, then ask. Then {{button:blue|Write it down}} while they are still on the line. A ledger row with nothing written down reads *add what it was for…*. You click it any time later, say when the tech texts you the list. *change* fixes a claim that was typed wrong.

{{button:blue|Generate}} mints a five-digit code from 10000 to 99999. It is unique across the company. You read it across the counter. The ledger under the form lists every code with its job, person, supply house and who made it, newest first. So anyone can look a code up when the invoice arrives.

**Before the code: the job account.** You pick the job and the supply house. Then a line under the house says whether the job has a **job account** there. A job account is the job's own account at that house. The line is amber when there is none. It reads *No job account at Ferguson for 964 yet. Ferguson expects one per property. Curly Conley opens them: 210-344-4950.* It offers {{button:outline|Call Curly}}, {{button:green|Mark opened…}}, {{button:outline|Send the packet}} and *Not needed for this job*. Mark opened takes two taps after the call: how, the reference, a note. The line is teal once the account is open. It reads *Ferguson job account open · ref JA-4114 · Sep 2 · by phone*. The code mints either way, since the tech is standing at the counter. But this is the moment to make the call. See [open a job account before buying parts](?g=open-a-job-account-before-buying-parts).

On a phone, you turn on **Dispatch Mode** and use its **PO** tab. It is the same numbering and the same ledger, in three taps. Today's jobs are offered first, the job's crew floats to the top, and your last supply house is pre-picked. **Copy** and **Text to the tech** buttons sit under the big code. See [run the day from your phone with Dispatch Mode](?g=dispatch-mode).

**Why the ledger matters:** the supply house's invoice is entered under Materials → Supply Houses. Its PO # is checked against this ledger. A code that isn't on file for that house lights a red warning. A code that is on file shows a card under the field. The card holds the job and who it was for. It holds when and by whom it was minted, and what they said they needed. The amount on the paper sits right above it. So *$612 against "40 ft of PEX and two valves"* is a question you can ask the same day. The number you read at the counter is how the bill finds its job.

Most houses print the job name the tech said at the counter instead of the code. So the form also reads the ledger by the job. Once the invoice is on a job, a box under the job card lists the codes minted for that job. It shows only codes at that house within a week of the invoice date. Each shows who made the trip, when, and what they said they needed. Or the box says in one line that there is none. The PO # may be a code minted for a different job than the one the invoice is on. Then an amber line says so: one of the two is wrong.

## A priced parts list (PO Builder → Purchase Orders)

This lane makes a real document: parts, quantities, a chosen supply house per line, and prices. Estimators can reach it too.

1. **Materials → PO Builder.** Pick an assembly, a named kit such as "Toilet rough-in". Press {{button:blue|Create PO}} to start a draft from it. Or press {{button:outline|→ Add to PO}} to drop it into the draft you're already editing. Each part lands with the price on file at that moment and the supply house it came from.
2. Edit the draft right there: quantity, supply house, price, notes. The supply house dropdown shows every house that has a price for that part. Rename it so the counter can read it.
3. **Materials → Purchase Orders** lists every PO for the trade pill, Draft or Finalized. You open one to add notes or confirm prices. The **Confirmed** column shows who checked the number and how long ago. You can **Print** it. A draft prints every house's price beside the chosen one. The supply-house print shows just the chosen prices with tax. Or press {{button:outline|Duplicate as Draft}} for a repeat order.
4. {{button:green|Finalize}} locks it. The confirm says so: *It will become immutable.* A finalized PO can't be edited. Only a one-time note can be added. It becomes pickable as a line item on a project's Workflow and Forecast.

One other door makes a PO in this lane without visiting PO Builder. **Job Parts Tally** turns a tallied job's parts into a PO with one tap. It is stamped with whoever tallied it.

## Three prices for one part: all true

A single part can show three different numbers, and none of them is wrong:

| Where | What it is | When it moves |
|---|---|---|
| **Parts Book price** | The cost on file for that part at that supply house. One price per part and house. | Whenever someone updates the book. The history keeps every change. |
| **Takeoff line price** | The price on a bid's takeoff line. It was copied when the part was assigned to a fixture. | Frozen at assignment, so the bid you sent still adds up the way it did. |
| **PO line price** | The price stamped on a purchase-order line when the part was added. | Frozen when the line was added. **Confirm price** is how you say "still good". |

The book is where you fix a price for the future. The bid and the PO remember what was true when they were made. **Price coverage** is the button beside Add Part on the Parts Book. It tells you how much of the book has a price at all, house by house. It reads like *1,709 items · 74% have prices · 27% have more than one*.

## Keeping the book clean

Two parts with the same name mean two prices to maintain and a coin-flip in every picker. **Settings → Catalogs → Duplicates** is for devs. By default it lists parts that share a name, ignoring case and spacing. You tick ***Show near-matches (80%+ similar, same numbers)*** to also see spelling variants. Two names have to agree on every number they carry before they can pair. That means sizes, lengths and model numbers. So a 1-1/2" and a 1-1/4" fitting never get grouped as one. Delete the extras and the pickers stop guessing.
