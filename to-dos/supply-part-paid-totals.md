---
name: "Dashboard and Bridge: a part-paid supply house bill counts what is left"
number: 374
mockup: not required — the same cards and lines with the right amounts; no screen changes shape
group: ready
status: written 2026-11-17 from the supply house payments build session · nothing built
summary: >
  Since v2.7459 a supply house bill can be paid in part. Materials counts such a bill for what is
  left on it, but the Dashboard's money cards and the Bridge still add its whole amount. The
  Dashboard's payables total, the Bridge's owed by you, its Supply invoices due in the cash
  forecast and its net position history all overstate what is owed once a bill is paid in part.
  One small PR reads the open balance in each, plus the payment lines by their day for the money
  that went out.
next: "One PR: buildApBucket and the Bridge's due bills count openAmount, the Bridge's paid-by-day reads the payment lines by their payment's day; then regenerate the kernel copy and redeploy what check:edge-drift names."
size: S
blocker: None.
ver: v2.7459
opinion: build — one small PR; the numbers are still right today, since no bill on prod is paid in part yet, and they drift from the first one Taunya pays in part.
---

# Dashboard and Bridge: a part-paid supply house bill counts what is left

## The ask

The owner, 2026-11-17, on the last report of the supply house payments build: "add to the punchlist to Fix the Dashboard and Bridge totals so a part-paid bill counts what is left".

The build (v2.7450 to v2.7471) left this out on purpose. These readers also run on the edge through the kernel copy, so the fix wants its own PR and its own redeploys.

## Why the totals are off

Since v2.7459 a bill can be paid in part. `supply_house_invoices.amount_paid` holds what the live payment lines put on it, and `is_paid` stays false until the bill is paid in full. The readers that already count what is left go through `openAmount` in `src/lib/materials/payments/supplyPayment.ts`: the aging table, Held for suppliers, the house card, `useSupplyHousesAPTotal` and Settings' financial pins.

Four readers still take the whole amount. Take a made-up $812.40 bill with $300.00 paid on it:

1. **The Dashboard's payables card.** `buildApBucket` in `src/lib/dashboardFinancials.ts` adds `amount` for every unpaid bill, and `loadDashboardFinancials` in `src/lib/dashboardFinancialsLoad.ts` never selects `amount_paid`. The card's *Supply* line and its total count $812.40 where $512.40 is owed. The card's window lists the bill at $812.40 too (`apBills[…].amount`). The assistant path, `buildApBucketFromAggregates`, calls `buildApBucket`, so it follows the fix.
2. **The Bridge's owed by you.** `src/pages/Bridge.tsx` reads the same `fin.data.ap.total`: the *owed by you* figure, the accrual line, the net position's starting AP and the AP split. Fixing item 1 fixes these with no change on the Bridge.
3. **The Bridge's Supply invoices due.** `loadBridgeData` in `src/lib/bridge/loadBridgeData.ts` reads `amount, due_date` of the unpaid bills due in the next `BRIDGE_DAYS_AHEAD` days, into `hazardsByDay`. The cash forecast then shows them as *Supply invoices due* at $812.40.
4. **The Bridge's net position history.** `supplyPaidByDay` reads `amount, paid_at` from the bills. A part payment shows nowhere until the bill is paid in full. Then the whole bill lands on the day the last part was paid. `truthCheck.ts` reads the same map. Money kept on account never shows at all, since it sits on no bill.

Left as it is, on purpose: the Bridge's materials read (bills by invoice date, through their job allocations) and `supplyDatedByDay`. A bill's cost and the debt it adds are its whole amount on its date, however it is paid later. Interest bills carry no job allocation since v2.7467, so they stay out of the materials read.

## The plan: one PR (S)

1. `FinancialSupplyInvoiceRow` gains `amount_paid` and `is_paid`, both optional. `buildApBucket` counts `openAmount(inv)`, and skips a bill with nothing left as it skips a zero today. A part-used credit memo counts what is left of it, negative, which `openAmount` already does.
2. `loadDashboardFinancials` selects `amount_paid`, and the card's window shows what is left. Its row can say `partPaidWords` (*$300.00 paid · $512.40 left of $812.40*), the words Materials already shows.
3. `loadBridgeData`'s due read selects `amount, amount_paid, due_date` and adds `openAmount` into `hazardsByDay`.
4. `supplyPaidByDay` reads the live payment lines by their payment's `paid_on`: `supply_house_payment_lines` with its payment, removed payments left out. Every bill paid before v2.7450 carries one payment "from before" with one line on its paid day, so the history before then reads as it does today.
5. Lift the two sums into pure functions (say `supplyDueByDay` and `supplyPaidByDayFromLines`) with unit tests, as the repo's kernels-first rule asks.
6. `npm run gen:edge-kernels` regenerates the copy. `openAmount`'s file imports nothing, so the copy can take it.
7. A release note and its `docs/recent-features/` fragment. `drill-into-the-dashboard-money-cards.md` says nothing about a bill's amount today, so it may need no change. Read it, and the Bridge guides, for any sentence the fix makes wrong.

**After the merge:** `npm run check:edge-drift` names the functions to redeploy. Expect `bridge-weekly-sheet`, whose Monday sheet runs both loaders through `lib/bridge/sheetReads.ts`, and `team-scores`, which imports `loadBridgeData.ts` through `scorecardReads.ts`.

No migration. `amount_paid` and the payment lines exist since v2.7450.

## Open calls

- **Money on account in the net position.** Step 4 counts what went on bills. Money kept on account left the bank but paid no bill yet. Should it lower AP on its day, or only once it is put on a bill? Counting lines alone is the plain reading of *what is owed*. Ask the owner if the history then reads wrong to him.
- **Who can read the payment lines.** `supply_house_payment_lines` is read under `is_office_staff()` since v2.7450. Check that every role that sees the Bridge passes it. Make a refused read fall back to today's bill read, so a role without access never sees the history break.

## How to verify

- **Unit tests.** The $812.40 bill with $300.00 paid counts $512.40 in the payables bucket and in the due bills. A bill paid in two parts lands on two days in paid-by-day. A payment that was removed counts nowhere.
- **Read-only on prod after the push.** The Dashboard card's *Supply* figure equals the Accounts payable total on Materials → Supply Houses at the same minute. They read the same rows, so any gap is a bug.
- **A bill paid in part.** None is on prod as of 2026-11-17. A ZZ Test bill paid in part, made and deleted in the same sitting as `AGENTS.md` allows, shows the change, with the user's yes in chat first.

## Where it plugs in

- `src/lib/dashboardFinancials.ts` (`buildApBucket`, `FinancialSupplyInvoiceRow`) and `src/lib/dashboardFinancialsLoad.ts` (the select, `apBills`).
- `src/lib/bridge/loadBridgeData.ts` (the due read and `hazardsByDay`, the paid read and `supplyPaidByDay`), `src/lib/bridge/netPosition.ts` and `src/lib/bridge/truthCheck.ts`, which read the map.
- `src/lib/materials/payments/supplyPayment.ts` (`openAmount`, `partPaidWords`).
- The copy under `supabase/functions/_shared/gcKernels/`, made by `scripts/edge-kernels.mjs` and checked by `src/lib/gc/edgeKernels.test.ts`.
