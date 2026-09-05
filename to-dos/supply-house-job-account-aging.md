# Supply houses: job-account invoices in the aging heat map, and the old small follow-ups

Status: waiting on Taunya's read · source: fragment v2.2669 "Open questions"

## The items (validated 2026-09-05)

1. **Aging heat map still counts job-account invoices** in its past-due buckets; only the Job Accounts tab bars (v2.2652) treat owner-secured debt separately. `SupplyHousesTab.tsx` reads `on_job_account` on the invoice rows, so the split is a filter away — but Taunya should say whether the heat map should exclude them or show them as their own shade.
2. **No bulk back-fill** for the flag; existing invoices are flagged one at a time through Edit Invoice. A "flag all invoices on this job account" action would close it.
3. **Old easy follow-ups (v2.581 / v2.582, May 2026)** never picked up: a user-editable Paid On date in the edit-invoice modal (today `paid_at` is set by the click), Last Paid sortable on the summary table, and the two toggles persisting across refresh (no `localStorage` in the tab).

## Where it plugs in

- `src/components/SupplyHousesTab.tsx` (summary, aging, invoice modal), `supply_house_invoices.on_job_account` / `paid_at`, `supply_house_job_accounts`.

## How to verify

- A job-account invoice 90+ days old: heat map cell changes per Taunya's answer; the Job Accounts tab is unchanged.
