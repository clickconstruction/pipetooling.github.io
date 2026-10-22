# 20261021220000_count_supply_house_move_window.sql (2026-10-21, v2.5723)

The move window's Needs You line (punch list #132, `to-dos/ap-aging-cell-invoices/`, decision
8 amended on the owner's ask of 2026-10-21): the Accounts payable strip's four numbers as one
read, so the Dashboard and Quickfill can carry the line without the tab's whole book.

## What it does

- **`count_supply_house_move_window()`** → one row: `count` (still-current unpaid charges not
  on a job account, allocated to exactly one job), `dollars` (their amounts summed), `asked`
  (how many of them have an open — unconfirmed — row in `supply_house_invoice_move_requests`),
  `soonest_due` (the first window to close). The predicate is the tab's `movableCandidates` +
  `isMovableAgingInvoice` ([`supplyHouseAging.ts`](../../src/lib/supplyHouseAging.ts)):
  `NOT is_paid`, `amount > 0`, `on_job_account` not true, `due_date >= app_today()` (the
  company calendar, so the evening does not close a window early), one allocation row.
- `SECURITY DEFINER`, `STABLE`, gated inside on `is_office_staff()` (dev, master_technician,
  assistant, controller) — everyone else gets the zero row (`0, 0, 0, NULL`). `REVOKE … FROM
  PUBLIC, anon`; `GRANT EXECUTE TO authenticated, service_role`. Idempotent (`CREATE OR
  REPLACE`); no table, no index.

## The pin

`supabase/tests/supply_house_move_window/` (the `supply-house-move-window` bed, in
`scripts/sql-beds.txt`) seeds eleven invoices from one JSON block — due today, due yesterday,
flagged, a credit, no due date, split across two jobs, no job, paid, an ask confirmed, an ask
open — and asserts the four numbers as the dev and as an assistant, the zero row as an
estimator and signed out. `src/lib/supplyHouseMoveWindow.parity.test.ts` reads the same JSON
block out of the scenario file, runs the kernel the way the tab composes it, and expects the
same four numbers — one set of rows, two readers, one answer.

## Apply order

Push any time after the client merge: `useSupplyMoveWindowNudge` treats an RPC error as "no
line", so the client can deploy first. Regenerate `src/types/database.ts` after the push (the
hook calls the RPC untyped until then).
