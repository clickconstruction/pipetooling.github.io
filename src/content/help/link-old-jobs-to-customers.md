---
title: link old jobs to their customers in one sweep
category: Office
roles: dev, master_technician, assistant, controller
keywords: link jobs, missing customer, unlinked jobs, job customer, HCP import, backfill customers
order: 44
---
Jobs imported from HouseCall Pro often carry the customer's name as text (or as the job's name) without being linked to a customer record — so they don't show up in lifetime value, open balances, or the customer's page. The link sweep fixes them in one sitting.

## Run the sweep

1. Go to **Customers**. If any jobs are missing a customer, the stat band shows **Jobs missing a customer** with the count.
2. Click **Link →**.
3. Jobs are grouped **one row per name** — linking a row links all of its jobs at once. Each row shows a match badge:
   - {{chip:green|name match}} / {{chip:green|job-name match}} — the name exactly matches one customer; **pre-checked**.
   - {{chip:yellow|starts with}} — the job name starts with a customer's name (like "Mary Evans (to be paid by DRF)"); proposed but unchecked until you confirm.
   - {{chip:gray|no match}} — usually an alias or typo ("Dudley Mason" for "RMC- Dudley Mason"); click **pick customer…** and choose once for the whole group.
4. Check or uncheck rows, then click {{button:blue|Link}}. Nothing is saved until you do; unchecked rows are simply skipped and stay for next time.

:::example What linking does
Each job gets its customer set (and the customer's canonical name stamped on the job). The customer's lifetime value, open balance, page tabs, and activity feed pick the jobs up immediately.
:::
