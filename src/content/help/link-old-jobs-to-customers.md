---
title: link old jobs to their customers in one sweep
category: Office
roles: dev, master_technician, assistant, controller
keywords: link jobs, missing customer, unlinked jobs, job customer, HCP import, backfill customers
order: 44
---
Jobs imported from HouseCall Pro often carry the customer's name as text with no link to a customer record. The link sweep fixes them in one sitting.

The name may sit as text on the job, or as the job's name. Until they are linked, those jobs do not show up in lifetime value, open balances, or the customer's page.

## Run the sweep

1. Go to **Customers**. If any jobs are missing a customer, the stat band shows **Jobs missing a customer** with the count.
2. Click **Link →**.
3. Jobs are grouped **one row per name**. Linking a row links all of its jobs at once. Each row shows a match badge:
   - {{chip:green|name match}} or {{chip:green|job-name match}}: the name exactly matches one customer. The row is **pre-checked**.
   - {{chip:yellow|starts with}}: the job name starts with a customer's name. An example is *Mary Evans (to be paid by DRF)*. The row is proposed but unchecked until you confirm.
   - {{chip:gray|no match}}: usually an alias or typo, like *Dudley Mason* for *RMC- Dudley Mason*. Click **pick customer…** and choose once for the whole group.
4. Check or uncheck rows, then click {{button:blue|Link}}. Nothing is saved until you do. Unchecked rows are simply skipped and stay for next time.

:::example What linking does
Each job gets its customer set (and the customer's canonical name stamped on the job). The customer's lifetime value, open balance, page tabs, and activity feed pick the jobs up immediately.
:::
