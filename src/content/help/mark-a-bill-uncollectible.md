---
title: mark a bill uncollectible and keep it off your numbers
category: Billing & Money
roles: dev, master_technician, assistant, controller
keywords: uncollectible, collections, write off, give up, bad debt, stamp, lien desk, accounts receivable, owed, put it back, stripe
---
Some bills will never be paid. You can mark such a job **Uncollectible** from the Collections section of the Pipeline. The job stays where it is, stamped with your reason, and leaves every total of what customers owe.

## Mark a job Uncollectible

The job must already be in **Collections**. On **Jobs → Pipeline**, open the Collections section and find the row.

1. Under the row's icons, press {{button:outline|Uncollectible…}}.
2. Write the reason. It needs at least a short sentence. It is stamped on the row for everyone to read.
3. Press {{button:red|Mark Uncollectible}}.

The row moves into the **Uncollectible** band at the bottom of Collections. A red stamp across its money cell reads the word, your reason, the day and the dollars.

:::example What the stamp reads
**UNCOLLECTIBLE** · Customer refused the bill and will not answer. · Oct 6, 2026 · $7,502 given up on
:::

## What changes once it is marked

- The Collections header counts only the jobs you still chase. The band carries its own count and dollars.
- The Pipeline's In collections tile and the Dashboard's Accounts receivable card leave the money out. They still say the dollars in grey, so the number is never hidden.
- The job is on no lien clock. It leaves the Lien desk's queues, the Deadlines calendar and any GC-on-notice run.
- The row drops its expected pay date. Nobody is waiting on that money now.
- The **Jobs on a map** card still pins the job. It counts nothing to collect and leaves the list of jobs to ask for money.
- The job leaves the contract sweep. It also leaves the dev's count of Collections accounts awaiting review.
- The bill's Stripe invoice is marked uncollectible too. The pay link stops asking.
- Nothing is deleted and no bill is rewritten. The job's activity thread records who marked it, when and why.
- The next time someone opens a new job for that customer, the job form shows a nudge. It asks whether to set the customer's payment terms to Deposit required.

## If the money turns up

{{button:blue|Mark Paid}} still works on a stamped row. When the job pays in full, the stamp clears itself. Stripe still accepts a late payment on an uncollectible invoice, and that clears the stamp the same way.

## Put it back

Press {{button:outline|Put back}} under the stamped row and confirm. The stamp comes off, the job counts in Collections again and goes back on its lien clock.

## The accountant's list

Settings → Jobs & dispatch has a section called **Uncollectible: the accountant's list**. It lists every bill the office gave up on, by year, with the reason and the dollars. The {{button:outline|Download CSV}} button hands your accountant the bad-debt list for the books. A bill paid later leaves the list, because that debt was recovered.

## Who can do this

Any office staff: a master, an assistant or a controller. The same people who move a job into Collections. See [Collections on the Pipeline](/help/ready-to-bill-pipeline) for how a job gets there.
