---
title: choose By Stage or Combined for a bid's materials
category: Bids & Estimating
roles: dev, master_technician, assistant, controller, estimator, primary, superintendent
keywords: by stage, combined, materials model, rough parts list, exact assemblies, rough-in, top-out, trim-set, takeoffs, labor, switch materials model, purchase orders per stage, count each fixture
order: 97
---
Every bid prices its materials one of two ways. The two are different jobs of work.

The pills at the top of **Takeoffs** and **Labor** say which one this bid is on. A one-line caption under them says what each means:

:::example The two models, in the app's words
{{chip:blue|By Stage}} {{chip:gray|Combined}} — *By Stage = exact assemblies per rough-in / top-out / trim-set stage. Combined = one rough parts list for the whole job.*
:::

## In trade words

- **By Stage: count each fixture.** Every fixture gets its own assembly. An assembly is the set of parts that go in at each stage of the work: rough-in, top-out and trim-set. The takeoff, the count from the plans, adds them up per stage. Pick this when the plans are complete enough to count fixtures one by one. Pick it when you want the material number to hold up on the job. It hands the crew a per-stage list. Each stage's purchase order feeds the bid's material cost estimate.
- **Combined: one parts list.** One rough materials list for the whole job, priced from the Parts Book. There is no per-stage split. Pick this for budget numbers or design-build work, where you design the job as well as build it. Pick it for a scope where you know what the job takes without counting every fixture.

**New bids start on Combined.** Moving to By Stage is a choice you make on Takeoffs when the count is real.

## Switching

Tap the other pill and the app asks **Switch materials model?** It shows the same caption again, then the part that matters: *By Stage and Combined data are stored separately. Switching does not copy lines from the other mode.*

So a Combined list you built stays put when you switch to By Stage. It comes back when you switch again. Nothing is merged or lost. Nothing is carried across either. {{button:outline|Cancel}} leaves the bid where it was.

:::example Which one is this bid on?
Open **Takeoffs**. The lit pill is the model; the caption under it is the one-line reminder. On Labor the same pills show, because the hours table follows the same fixtures.
:::

## What each model changes downstream

- **Filling from the book.** On a Combined bid the button reads {{button:blue|Fill from book · 5 matches}}. It expands each matched fixture's assembly into priced part lines. Fixtures that already have lines are left alone. On a By Stage bid the same button reads **Apply Matching Fixture Assemblies**. It maps each book entry's assembly and its stage onto the fixture. See [fill a takeoff from the book](?g=fill-a-takeoff-from-the-book).
- **Pricing and documents.** By Stage totals show per stage on Pricing, in the approval PDF and on the cost-estimate page. The stages are rough-in, top-out and trim-set. Combined shows one materials line.
- **Purchase orders.** On a By Stage takeoff, {{button:blue|Create purchase orders for Stages}} mints one PO per stage. A PO is a purchase order. Those POs are what the bid's "exact materials" totals add up. See [raise a purchase order](?g=raise-a-purchase-order). Combined has no per-stage POs.

Counts themselves never change with the model. They came from the plans or from [CountTooling](?g=import-a-takeoff-from-counttooling). They belong to the bid's version either way.
