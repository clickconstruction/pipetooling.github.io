---
title: tag bank purchases so rules and reports read them the same way
category: Billing & Money
roles: dev, master_technician, assistant, controller
keywords: banking, accounting, tags, tag, bank category, fuel, gas, rules, label, mercury, category, cost line, review, job summary
order: 64
---
Every card purchase arrives from the bank with a category — FuelAndGas, Retail, Software, Utilities. **Tags** turn those into words you actually use: ⛽ Fuel & gas, 🛒 Retail & supply, 💻 Office & software. A tag is a name, an icon, a color, the bank categories it covers, and the accounting labels it stands for. Rules can point at a tag, the Rules list shows tags on every row, and a tag can be its own cost line on People → Review and Jobs → Job Summary.

## Open the manager

On **Banking → Accounting**, {{button:outline|Tags (6)}} sits beside {{button:blue|Rules (524)}}. The left column lists your tags with how many categories, labels and rules each one holds; a ★ marks a tag that is drawn as its own cost line. Click a tag to edit it, or {{button:blue|New tag}} to start one.

## Edit a tag

- **Name, icon, color.** The icon is any emoji; the color is one of six families. Both show everywhere the tag appears.
- **Bank categories in this tag.** Click a category to add it or take it out. A category can belong to only one tag — if it is already in another, the chip says so, and clicking moves it here.
- **Accounting labels this tag stands for.** The same idea for your Schedule C labels, so a rule that sends purchases to *Fuel / Gas* is filed under ⛽ Fuel & gas even without a tag clause.
- **Show as its own cost line on Review and Job Summary.** Tick this and the tag's purchases get their own line in a job's or a person's cost breakdown. Fuel & gas starts ticked; tick it on a Permits tag and permits get a line too.
- **Hide from the rule tag picker.** For tags you only want for reporting.

{{button:blue|Save tag}} applies immediately. Rules that point at the tag follow the change — nothing needs re-saving.

:::example Moving a category
Parking is in ⛽ Fuel & gas by default. Open 🏛 Government, click **Parking** (the chip reads "· ⛽ Fuel & gas"), save — parking fees now count as government, and the fuel rule stops catching them on the next sync.
:::

## Use a tag on a rule

In **New rule** the **Tag** box lists your tags as chips. Pick one and the rule matches any purchase the bank filed under the tag's categories; the note under the chips spells those out. The raw **Bank category** box underneath still exists for the odd one-off, but a tag is easier to read later and keeps working when the bank adds a category to it.

## Read the Rules list

Each rule now shows what it matches on as small chips — *counterparty contains QuikTrip*, *amount ≤ $0*, ⛽ Fuel & gas — and the tag bar at the top filters the list with one click: {{chip:yellow|⛽ Fuel & gas · 12}} {{chip:gray|No tag · 282}}. **Manage tags** on that bar opens the manager.

## Deleting and resetting

**Merge into…** folds one tag into another: choose the target in the editor, click {{button:outline|Merge}}, and every bank category, accounting label and rule that named the old tag moves to the target before the old tag goes away. Use it when two tags turned out to be the same idea (say, a *Gas* tag someone made beside ⛽ Fuel & gas).

Deleting a tag keeps its rules working: each rule remembers the categories the tag covered when it was saved, and the Rules list shows them as *deleted tag · FuelAndGas, VehicleExpenses* until you edit the rule. {{button:outline|Reset to defaults}} re-plants the six starter tags where they are missing and never moves a category you have re-homed.
