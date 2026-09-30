---
title: search for jobs, bids, customers, and estimates
category: Getting Started
roles: dev, master_technician, assistant, controller
keywords: search, global search, find job, find bid, find customer, find estimate, address, job number, hcp number, c#, keyboard shortcut, cmd k, ctrl k, s key, magnifier
order: 10
---
You click the magnifier in the header to open a search box. It looks across jobs, bids, customers and estimates at once.

Type at least two characters. Matching results appear as you type.

## Three ways to open it

- Click the magnifier {{icon:search}} in the header. It sits in the top strip on phones and in the toolbar on desktop.
- Press {{chip:gray|⌘K}} on a Mac or {{chip:gray|Ctrl+K}} on Windows from any page.
- On the **Dashboard**, just press {{chip:blue|S}}. The search opens with the cursor ready, so you can start typing right away.

:::example find a job fast
From the Dashboard, press {{chip:blue|S}}, type part of the job name or HCP number, and click the result — the job detail opens on the spot.
:::

## What it matches

You don't have to know the job's name. The same box matches:

- **Jobs**: the job name, the **address**, and either number. The **HCP #** and the **Click #**, also called C#, both work. Typing the number's prefix is fine. `J1004`, `1004` and `j1004` all find the same job.
- **Bids**: the bid number, such as `B352` or `BP1005`. Also the project name, the address and the **customer name**. Also the builder's name or the name of the GC, the general contractor.
- **Customers**: the customer's name.
- **Estimates**: the estimate number, such as `E12`. Also its title, the address, and the customer's name or email.

Two habits worth knowing:

- **Symbols match literally.** `%`, `_` and `\` are treated as the characters you typed, not as wildcards. Searching `100%` finds a job with `100%` in its name and nothing else.
- **Job numbers sort as numbers.** When several jobs match, the newest job number is listed first. That is the highest number. `1010` comes before `1009`, and `1009` before `999`. So the job you opened this week is near the top.

:::example the address is all you have
A customer calls about "the house on Oakmont". Press {{chip:blue|S}} on the Dashboard, type `oakmont`, and every job and bid at that address appears — pick the one whose stage chip says {{chip:yellow|Working}}.
:::

## What each result row tells you

Job and bid rows carry evidence on the right side. It helps you tell lookalike jobs apart without opening them:

- **Jobs**: the Pipeline stage, such as {{chip:yellow|Working}}, {{chip:blue|Billed}} or {{chip:green|Paid}}. Then the billed total and how recently the customer paid, or {{chip:yellow|unpaid}}. Then how many schedule blocks the job has this week, such as **2 this wk**. The line items appear in small print underneath.
- **Bids**: the outcome, such as {{chip:green|Won}}, {{chip:yellow|Pending}} or {{chip:red|Lost}}. Then the bid value and the sent or due date.

:::example two jobs, same customer
Searching a customer name shows every job at once — the one marked {{chip:blue|Billed}} with "1 this wk" is the live one; the {{chip:green|Paid}} one from last spring is finished.
:::

## What happens when you pick a result

- **Job**: opens the Job Detail view.
- **Bid**: opens the bid preview.
- **Customer**: opens the customer snapshot.
- **Estimate**: takes you to that estimate's page.

## Keyboard navigation

Once results appear, press {{chip:gray|↓}} or {{chip:gray|↑}} to move the highlight through the list. The highlight wraps around. Press {{chip:gray|Enter}} to open the highlighted result. Your cursor stays in the search box the whole time. Keep typing whenever you want. The list refilters and clears the highlight.

Press {{chip:gray|Esc}} to close the search. The {{chip:blue|S}} shortcut never fires while you're typing in another field. It only works on the Dashboard. Everywhere else, use the magnifier, {{chip:gray|⌘K}} or {{chip:gray|Ctrl+K}}.
