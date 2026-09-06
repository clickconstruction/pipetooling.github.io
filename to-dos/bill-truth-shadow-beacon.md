# Bill truth: remove the shadow beacon

Status: dated chore — remove by **2026-09-19** or with the next bill-truth PR, whichever comes first · source: fragment v2.2862 "Shadow beacon (one release)"

## What it is

`src/lib/billing/billTruthShadow.ts` keeps every adopter's OLD sum beside the shared kernel's and calls `reportBillTruthShadow(...)`. On a > 1¢ difference it warns in dev builds and, where a user id is passed (Dashboard AR card, Quickfill), writes one `ui_nav_clicks` row with `control = 'bill_truth_mismatch'`. Surfaces: `dashboard-ar-card`, `dashboard-billed-pin`, `pipeline-strip-billed`, `quickfill-ar-count`, `customer-hub-lifetime`, `customer-hub-open-balance`, `customers-list-open-balance`.

## Before removing

Read the beacon: `select target, count(*) from ui_nav_clicks where control = 'bill_truth_mismatch' group by 1`. A fired beacon is the old number being wrong in live data (an orphan, a negative shell, a settled row) — expected on day one for `dashboard-ar-card` (the $488) and `quickfill-ar-count`; a beacon on `pipeline-strip-billed` would mean a negative billed shell exists and wants a look before the legacy sums go.

## The plan

One PR: delete the `legacy*` sums and the `reportBillTruthShadow` calls at each adopter, delete `billTruthShadow.ts`, note the beacon's findings in the fragment.
