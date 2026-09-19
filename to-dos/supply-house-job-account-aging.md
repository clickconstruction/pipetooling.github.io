---
name: "Supply houses: aging heat map + the Job accounts leftovers"
group: residual
status: >
  item 1 shipped v2.3568 (B, shade — the teal "job acct" line under each cell and Owed, the Mark
  toggle) with item 3's remembered toggles · item 3 closed v2.3604 (Last Paid — and every summary
  column — sortable; the editable Paid On was already in the Edit invoice modal) · items 2 and 6 shipped v2.3621 (Flag n invoices on an open row; Mark all N opened… on the roster) · left: items 4 (office) and 5 (owner)
summary: >
  The May follow-ups (an editable Paid On date, Last Paid sortable); after the Job accounts train
  (v2.3423–v2.3440): Curly's missing phone, the *Job Accounts* tab rename question, a mark-all
  back-fill. The heat map's job-account line shipped v2.3568.
next: >
  Curly's phone and email are an office fix (item 4); the tab rename (item 5) is an owner call.
  Both back-fills (items 2 and 6) shipped v2.3621 — delete this file once 4 and 5 are answered.
size: S
blocker: None.
ver: item 1 v2.3568 · item 3 v2.3604 · items 2 + 6 v2.3621 · items 4–5 added 09-14
opinion: later — what is left is an office fix and a naming call.
---

# Supply houses: job-account invoices in the aging heat map, and the old small follow-ups

## The items (validated 2026-09-05)

1. ~~**Aging heat map still counts job-account invoices**~~ — shipped v2.3568 as B: in its past-due buckets; only the Job Accounts tab bars (v2.2652) treat owner-secured debt separately. `SupplyHousesTab.tsx` reads `on_job_account` on the invoice rows, so the split is a filter away. **Decided 2026-09-17 (owner): B — shade.** The cells keep the house's totals; each cell and the Owed column carry a teal "of which on a job account" line, behind a *Mark job-account invoices* toggle. Drawn in [`supply-house-job-account-aging-before-after.html`](./supply-house-job-account-aging-before-after.html). On 2026-09-17 prod had one unpaid job-account invoice ($2,759.01, current), so the build changes little on day one and everything the day one ages.
2. ~~**No bulk back-fill** for the flag~~ — shipped v2.3621: *Flag n invoices* on an open roster row flags every invoice allocated to that job alone (`unflaggedInvoiceIds` in `buildHouseJobAccountRoster`).
3. ~~**Old easy follow-ups (v2.581 / v2.582, May 2026)**~~ — closed: the two toggles persist (v2.3568); the summary table sorts by every column, Last Paid included, with the pick remembered (v2.3604); and the user-editable Paid On date turned out to be already in the Edit invoice modal's Status row when v2.3604 was picked up.

4. **Curly's contact needs a phone** (found live 2026-09-14): the Ferguson job-accounts rep has no phone on file, so the field's *Call Curly* button stays hidden; his email is also the typo `curly.conley@furguson.com`. Office fix on Edit house → Contacts — no code.
5. **Rename Materials → Job Accounts?** "Held for suppliers" says what that tab is; since v2.3423 "job account" means the account at the house everywhere else. Owner call; no code depends on the label.
6. ~~**Bulk back-fill**~~ — shipped v2.3621: *Mark all N opened…* on the roster header (two or more amber rows) opens the shared sheet in bulk — one open row per job with the same how, rep and note, references left for each row's Edit.

## Where it plugs in

- `src/components/SupplyHousesTab.tsx` (summary, aging, invoice modal), `supply_house_invoices.on_job_account` / `paid_at`, `supply_house_job_accounts`.

## How to verify

- **B, on prod today:** National Wholesale's *Current* cell reads $4,298.65 with a teal *$2,759.01 job acct* line under it (the one unpaid job-account invoice on 2026-09-17), and its Owed cell carries the same line; every other cell is unchanged; the *Mark job-account invoices* toggle hides the lines; the "N houses 60+ past due" sentence and the totals row do not move. The Job Accounts tab is unchanged. To see an aged one, flag any 90+ invoice on a test house through Edit Invoice → *On job account* and confirm the cell stays red with the line under it, then unflag it.
- Also confirm the toggle state survives a refresh (item 3's remembered-toggles fix, if built in the same PR).
