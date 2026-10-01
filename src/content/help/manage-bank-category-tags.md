---
title: tag bank purchases so rules and reports read them the same way
category: Billing & Money
roles: dev, master_technician, controller
keywords: banking, accounting, tags, tag, bank category, fuel, gas, rules, label, mercury, category, cost line, review, job summary
order: 64
---
Every card purchase arrives from the bank with a category. Tags turn those categories into words you actually use.

The bank's categories look like FuelAndGas, Retail, Software or Utilities. **Tags** turn them into ⛽ Fuel & gas, 🛒 Retail & supply or 💻 Office & software. A tag is a name, an icon and a color. It also holds the bank categories it covers and the accounting labels it stands for. Rules can point at a tag. The Rules list shows tags on every row. A tag can be its own cost line on People → Review and Jobs → Job Summary.

## Open the manager

On **Banking → Accounting**, {{button:outline|Tags (6)}} sits beside {{button:blue|Rules (524)}}. The left column lists your tags. It shows how many categories, labels and rules each one holds. A ★ marks a tag that is drawn as its own cost line. Click a tag to edit it. Or click {{button:blue|New tag}} to start one.

## Edit a tag

- **Name, icon, color.** The icon is any emoji. The color is one of six families. Both show everywhere the tag appears.
- **Bank categories in this tag.** Click a category to add it or take it out. A category can belong to only one tag. If it is already in another, the chip says so. Clicking moves it here.
- **Accounting labels this tag stands for.** The same idea applies to your Schedule C labels. So a rule that sends purchases to *Fuel / Gas* is filed under ⛽ Fuel & gas even without a tag clause.
- **Show as its own cost line on Review and Job Summary.** Tick this and the tag's purchases get their own line in a job's or a person's cost breakdown. Fuel & gas starts ticked. Tick it on a Permits tag and permits get a line too.
- **Hide from the rule tag picker.** Use this for tags you only want for reporting.

{{button:blue|Save tag}} applies immediately. Rules that point at the tag follow the change. Nothing needs re-saving.

:::example Moving a category
Parking is in ⛽ Fuel & gas by default. Open 🏛 Government, click **Parking** (the chip reads "· ⛽ Fuel & gas"), save — parking fees now count as government, and the fuel rule stops catching them on the next sync.
:::

## Use a tag on a rule

In **New rule** the **Tag** box lists your tags as chips. Pick one and the rule matches any purchase the bank filed under the tag's categories. The note under the chips spells those out. The raw **Bank category** box underneath still exists for the odd one-off. But a tag is easier to read later. It keeps working when the bank adds a category to it.

## Read the Rules list

Each rule now shows what it matches on as small chips. Examples are *counterparty contains QuikTrip*, *amount ≤ $0* and ⛽ Fuel & gas. The tag bar at the top filters the list with one click. Its chips look like {{chip:yellow|⛽ Fuel & gas · 12}} {{chip:gray|No tag · 282}}. **Manage tags** on that bar opens the manager.

## Deleting and resetting

**Merge into…** folds one tag into another. Choose the target in the editor and click {{button:outline|Merge}}. Every bank category, accounting label and rule that named the old tag moves to the target. Then the old tag goes away. Use it when two tags turned out to be the same idea. An example is a *Gas* tag someone made beside ⛽ Fuel & gas.

Deleting a tag keeps its rules working. Each rule remembers the categories the tag covered when it was saved. The Rules list shows them as *deleted tag · FuelAndGas, VehicleExpenses* until you edit the rule. {{button:outline|Reset to defaults}} re-plants the six starter tags where they are missing. It never moves a category you have re-homed.
