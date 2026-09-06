---
title: choose By Stage or Combined for a bid's materials
category: Bids & Estimating
roles: dev, master_technician, assistant, controller, estimator, primary, superintendent
keywords: by stage, combined, materials model, rough parts list, exact assemblies, rough-in, top-out, trim-set, takeoffs, labor, switch materials model, purchase orders per stage, count each fixture
order: 97
---
Every bid prices its materials one of two ways, and the two are different jobs of work. The pills at the top of **Takeoffs** and **Labor** say which one this bid is on, and a one-line caption under them says what each means:

:::example The two models, in the app's words
{{chip:blue|By Stage}} {{chip:gray|Combined}} — *By Stage = exact assemblies per rough-in / top-out / trim-set stage. Combined = one rough parts list for the whole job.*
:::

## In trade words

- **By Stage — count each fixture.** Every fixture gets its own assembly — the parts that go in at rough-in, at top-out, at trim-set — and the takeoff adds them up per stage. Pick this when the plans are complete enough to count fixtures one by one and you want the material number to hold up on the job: it hands the crew a per-stage list, and each stage's purchase order feeds the bid's material cost estimate.
- **Combined — one parts list.** One rough materials list for the whole job, priced from the Parts Book, no per-stage split. Pick this for budget numbers, design-build, or a scope where you know what the job takes without counting every fixture.

**New bids start on Combined.** Moving to By Stage is a choice you make on Takeoffs when the count is real.

## Switching

Tap the other pill and the app asks **Switch materials model?** — the same caption again, then the part that matters: *By Stage and Combined data are stored separately. Switching does not copy lines from the other mode.* So a Combined list you built stays put when you switch to By Stage and comes back when you switch again; nothing is merged or lost, but nothing is carried across either. {{button:outline|Cancel}} leaves the bid where it was.

:::example Which one is this bid on?
Open **Takeoffs**. The lit pill is the model; the caption under it is the one-line reminder. On Labor the same pills show, because the hours table follows the same fixtures.
:::

## What each model changes downstream

- **Filling from the book.** On a Combined bid the button reads {{button:blue|Fill from book · 5 matches}} and expands each matched fixture's assembly into priced part lines (fixtures that already have lines are left alone). On a By Stage bid the same button reads **Apply Matching Fixture Assemblies** and maps each book entry's assembly *and its stage* onto the fixture — see [fill a takeoff from the book](?g=fill-a-takeoff-from-the-book).
- **Pricing and documents.** By Stage totals show per stage (rough-in / top-out / trim-set) on Pricing and in the approval PDF and cost-estimate page; Combined shows one materials line.
- **Purchase orders.** On a By Stage takeoff, {{button:blue|Create purchase orders for Stages}} mints one PO per stage; those POs are what the bid's "exact materials" totals add up — see [raise a purchase order](?g=raise-a-purchase-order). Combined has no per-stage POs.

Counts themselves never change with the model — they came from the plans (or from [CountTooling](?g=import-a-takeoff-from-counttooling)) and belong to the bid's version either way.
