---
title: search for jobs, bids, customers, and estimates
category: Getting Started
roles: dev, master_technician, assistant, controller
keywords: search, global search, find job, find bid, find customer, find estimate, address, job number, hcp number, c#, keyboard shortcut, cmd k, ctrl k, s key, magnifier
order: 10
---
The magnifier {{icon:search}} in the header opens a search box that looks across jobs, bids, customers, and estimates at once. Type at least two characters and matching results appear as you type.

## Three ways to open it

- Click the magnifier {{icon:search}} in the header (top strip on phones, toolbar on desktop).
- Press {{chip:gray|⌘K}} (Mac) or {{chip:gray|Ctrl+K}} (Windows) from any page.
- On the **Dashboard**, just press {{chip:blue|S}} — the search opens with the cursor ready, so you can start typing right away.

:::example find a job fast
From the Dashboard, press {{chip:blue|S}}, type part of the job name or HCP number, and click the result — the job detail opens on the spot.
:::

## What it matches

You don't have to know the job's name. The same box matches:

- **Jobs** — the job name, the **address**, and either number: the **HCP #** or the **Click #** (C#). Typing the number's prefix is fine — `J1004`, `1004` and `j1004` all find the same job.
- **Bids** — the bid number (`B352`, `BP1005`), the project name, the address, the **customer name**, and the GC or builder's name.
- **Customers** — the customer's name.
- **Estimates** — the estimate number (`E12`), its title, the address, the customer's name or email.

Two habits worth knowing:

- **Symbols match literally.** `%`, `_` and `\` are treated as the characters you typed, not as wildcards — so searching `100%` finds a job with `100%` in its name and nothing else.
- **Job numbers sort as numbers.** When several jobs match, the newest (highest) job number is listed first — `1010` comes before `1009`, and `1009` before `999` — so the job you opened this week is near the top.

:::example the address is all you have
A customer calls about "the house on Oakmont". Press {{chip:blue|S}} on the Dashboard, type `oakmont`, and every job and bid at that address appears — pick the one whose stage chip says {{chip:yellow|Working}}.
:::

## What each result row tells you

Job and bid rows carry evidence on the right side so you can tell lookalike jobs apart without opening them:

- **Jobs** — the Pipeline stage ({{chip:yellow|Working}}, {{chip:blue|Billed}}, {{chip:green|Paid}}, …), the billed total, how recently the customer paid (or {{chip:yellow|unpaid}}), and how many schedule blocks the job has this week (e.g. **2 this wk**). The line items appear in small print underneath.
- **Bids** — the outcome ({{chip:green|Won}}, {{chip:yellow|Pending}}, {{chip:red|Lost}}, …), the bid value, and the sent or due date.

:::example two jobs, same customer
Searching a customer name shows every job at once — the one marked {{chip:blue|Billed}} with "1 this wk" is the live one; the {{chip:green|Paid}} one from last spring is finished.
:::

## What happens when you pick a result

- **Job** — opens the Job Detail view.
- **Bid** — opens the bid preview.
- **Customer** — opens the customer snapshot.
- **Estimate** — takes you to that estimate's page.

## Keyboard navigation

Once results appear, press {{chip:gray|↓}} / {{chip:gray|↑}} to move the highlight through the list (it wraps around) and {{chip:gray|Enter}} to open the highlighted result. Your cursor stays in the search box the whole time — keep typing whenever you want and the list refilters, clearing the highlight.

Press {{chip:gray|Esc}} to close the search. The {{chip:blue|S}} shortcut never fires while you're typing in another field, and it only works on the Dashboard — everywhere else, use the magnifier or {{chip:gray|⌘K}} / {{chip:gray|Ctrl+K}}.
