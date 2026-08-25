---
title: reconcile HCP billing history
category: Office
roles: dev
keywords: housecall pro, hcp, import, reconcile, backfill, bill dates, payment dates, pay speed, invoices export, payments report
---
Jobs that lived in HouseCall Pro before the migration often have payments with no bill attached and dates that mean the wrong thing — which starves the pay-speed math behind the Payment forecast. **{{icon:gear}} Settings → Jobs & billing → HCP reconcile** fixes that from HCP's own exports, and it's safe to re-run any time: it previews everything first, and a second run of the same files finds nothing left to do.

## Lane 1 — bill dates & links

Feed it the HCP **invoices export** (in HCP: Customers → Invoices → Actions → Export). For each *paid* HCP invoice it can match to exactly one app job, it:

- creates a dated, already-paid bill on jobs that have payments but no bill at all — invisible to the board, pure history;
- stamps the HCP send date onto bills that have no date;
- attaches loose payments to the job's bill so they count.

It never imports **open** HCP invoices — since the migration, this app is the system of record for open money. Everything it skips is listed with a reason.

## Lane 2 — true payment dates

Feed it two files: the HCP **payments report** (Reporting → Payments — HCP emails it to you) and the HCP **jobs export** (the bridge that turns each payment's customer + job-created time into a job number).

- Where one payment on a job matches one app payment by amount, the app date is corrected to the day the money actually arrived.
- Where one imported lump equals several real payments, the lump is split into them — same total, true dates.
- Bank-dated (Mercury) and Stripe payments are **never** touched — those dates are already authoritative. Payments HCP knows about but the app doesn't are **never** auto-added; money changes are yours to make deliberately.

:::example Why bother?
A check recorded as "paid the day we billed" teaches the forecast that the customer pays instantly. The payments report says it actually cleared 11 days later — after reconciling, the customer's {{chip:blue|pays in ~11d}} chip tells the truth, and the corrected rows count as verified history instead of being quarantined.
:::

Corrected and split rows carry a note tag (`hcp-paydate-corrected-…` / `hcp-payments-split-…`) — that tag is what lets the pay-speed math trust them.
