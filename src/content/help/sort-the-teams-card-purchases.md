---
title: sort the team's card purchases from the office
category: Billing & Money
roles: dev, master_technician, assistant, controller
keywords: team purchases, follow-up, card purchases, mercury, assign, backcharge, invoices, link invoices, more than one invoice, sorted, recent transactions, change, tally, job parts tally, team, day card, likely, sort the day, split evenly
order: 60
---
When someone buys on a company card and does not sort the purchase themselves, it waits for the office. On the Dashboard, the **Needs you** card says *Team purchases waiting to be sorted*. {{button:amber|Sort for the team}} opens the **Team purchases follow-up** window.

## The three lists

- {{chip:blue|To sort}} is every purchase still waiting, grouped by the person whose card it was on.
- {{chip:gray|Stale}} is the same list, only the ones older than the cutoff. They are tinted red.
- {{chip:gray|Sorted}} is what was sorted in the last 30 days, newest first. Use it to go back to a purchase after it has left the first list.

## Sorting a purchase

1. Find the purchase under the person's name.
2. Press {{button:outline|Assign}} and pick the job. Pick two or more jobs to split the cost.
3. If the purchase was personal, press {{button:outline|Backcharge}} instead. It goes to the Office job and opens a pay offset for that person.

## When the purchase paid supply house invoices

Some card charges pay invoices that are already in the app. Press {{button:outline|Assign}}, then **choose invoices**.

1. Tick the first invoice. It moves to a **Chosen** box at the top.
2. Search for the next invoice and tick it too. The ones you chose stay in the box while you search.
3. Read the line under the box. It is green when the invoices add up to the charge. It is amber when part of the charge has no invoice yet, and it says how much.
4. Press **Save 2 invoices**. The button counts the invoices you chose.

:::example One charge, two invoices
A $595.54 charge at The Home Depot paid invoice #88231 for $412.10 and invoice #88240 for $183.44. Tick both. The line reads *The invoices add up to the charge*.
:::

## Going back to a purchase you already sorted

Open {{chip:gray|Sorted}}. Each row says where the purchase went, who sorted it and when.

- {{button:outline|Add invoice}} shows on a purchase whose invoices add up to less than the charge. It opens the invoices with the ones already chosen ticked. Tick the missing one and save.
- {{button:outline|Invoices}} opens the same window on a purchase that already adds up.
- {{button:outline|Change}} opens the job picker on a purchase that went to a job.

An amber line at the top counts the purchases whose invoices do not add up. **Show only those** narrows the list to them.

## From Job Parts Tally

The same purchases wait in [Job Parts Tally](/tally?tab=transactions) under {{chip:blue|Team}}. There is one card per person per day.

1. Read the line at the top of a card. It says when the person clocked in and on which job.
2. Look at the first button. It is the likely job, marked *likely*, with the reason under it.
3. Tap the job that fits the day. The purchases on the card take it. A purchase with its own likely job waits for its own tap.
4. Press {{button:green|Sort the day}}. The button counts the purchases it will save.

Nothing is picked until you tap. A purchase can go somewhere else than the rest of its day. Use **Pick a job** on its line, or {{button:outline|Another job…}} for the full job picker. {{button:outline|Invoices}} and {{button:outline|Backcharge}} work as they do in the window.

On a day with two jobs, {{chip:blue|Split evenly}} splits each purchase between them. Under the amounts, **Split by hours instead** splits by the hours on each job.

If a purchase cannot be saved, it stays picked and says why. The rest of the day is saved. {{chip:gray|Sorted}} at the top is the same 30-day list as in the window. {{chip:gray|My card}} shows only the purchases on your own card.
