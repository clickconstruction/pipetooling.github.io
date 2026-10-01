---
title: reconcile HCP billing history
category: Office
roles: dev
keywords: housecall pro, hcp, import, reconcile, backfill, bill dates, payment dates, pay speed, invoices export, payments report
---
Jobs that came over from HouseCall Pro often have payments with no bill and dates that mean the wrong thing. The HCP reconcile tool fixes that from HCP's own exports.

Those wrong dates starve the pay-speed math behind the Payment forecast. You open **{{icon:gear}} Settings → Jobs & billing → HCP reconcile**. It is safe to re-run any time. It previews everything first. A second run of the same files finds nothing left to do.

## Lane 1: bill dates & links

You feed it the HCP **invoices export**. In HCP that is Customers → Invoices → Actions → Export. It looks at each *paid* HCP invoice it can match to exactly one app job. For each one it does three things:

- It creates a dated, already-paid bill on jobs that have payments but no bill at all. That bill is invisible to the board. It is pure history.
- It stamps the HCP send date onto bills that have no date.
- It attaches loose payments to the job's bill so they count.

It never imports **open** HCP invoices. Since the migration, the move off HCP, this app is the system of record for open money. That means this app is the one true list of what is still owed. Everything it skips is listed with a reason.

## Lane 2: true payment dates

You feed it two files. The first is the HCP **payments report**, from Reporting → Payments. HCP emails it to you. The second is the HCP **jobs export**. That export is the bridge. It turns each payment's customer and job-created time into a job number.

- Where one payment on a job matches one app payment by amount, the app date is corrected. It becomes the day the money actually arrived.
- Where one imported lump equals several real payments, the lump is split into them. The total stays the same, and the dates are true.
- Bank-dated Mercury payments and Stripe payments are **never** touched. Those dates are already authoritative. Payments HCP knows about but the app does not are **never** auto-added. Money changes are yours to make deliberately.

:::example Why bother?
A check recorded as "paid the day we billed" teaches the forecast that the customer pays instantly. The payments report says it actually cleared 11 days later — after reconciling, the customer's {{chip:blue|pays in ~11d}} chip tells the truth, and the corrected rows count as verified history instead of being quarantined.
:::

Corrected and split rows carry a note tag, `hcp-paydate-corrected-…` or `hcp-payments-split-…`. That tag is what lets the pay-speed math trust them.
