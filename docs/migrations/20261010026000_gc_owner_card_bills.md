# 20261010026000_gc_owner_card_bills.sql

GC mode, Owner Billing's O8a: the database side of a customer paying a certified bill by card, with a 3% credit card fee (v2.5113). The plan is `to-dos/gc-mode/mockups/owner-billing-o8.md`, whose SQL block is this file byte for byte but for the version, on branch `spike/gc-mode` (a74385168). The bills are O4a's (`gc_record_certificate`, `20261009220000`); the riders are v2.5091's (`job_rider_fees`, `20261010023000`).

**Why:** the owner's answer to the Stripe Pay question (2026-10-09). The customer turns a certified GC bill into a card payment from their portal, the turn adds a 3% credit card fee, and staff never turn one. Counsel said the 3% surcharge is okay the same day, and the owner kept card only. The fee is a recovery of Stripe's processing cost, not the project's revenue (the lead's call): it rides on the bill so the billing job's Pipeline total covers it, and every GC figure reads the bill at its amount less its fee.

## What it does

1. **`gc_owner_card_bills`**: one row per bill turned to card, keyed by the bill (`invoice_id`). It holds the project, the base (what the bill asked), the rate (`fee_pct`, default 3, at most 3) and the fee, checked as `round(base × fee_pct / 100, 2)`. `status` is `pending` while `gc-card-bill` makes the Stripe invoice, `on_card` once it is made (with its Stripe id), and `undone` once the office took the bill back to a check bill (with the day and who). `chosen_how` is always `portal`. Row security: the money team reads, and may update only `status`, `undone_on` and `undone_by`. Nobody signed in inserts or deletes. Ends with the three fences.
2. **`gc_card_bill_begin(p_invoice_id)`**, the service role only. It locks the bill and refuses, in words:
   - an interest bill or any bill no certificate made (*Only a certified bill goes on card.*);
   - a paid bill, a bill on Stripe already, and a bill with any payment on it (*A payment is on this bill already, so it cannot move to card.*);
   - a bill taken back to a check bill (*This bill went back to a check bill. Call our office to pay it by card.*);
   - a second press while the page is made (*This bill is being set up for card. Try again in a minute.*). A pending row older than ten minutes may be begun again.

   It then writes the pending row at 3% of what the bill asks, rounded to the cent. It returns the base, the rate, the fee, the total, the pay application's number, whether it is the final, the certificate's day and the contract's days to pay. A bill on card already answers with its card page.
3. **`gc_card_bill_finish(p_invoice_id, p_stripe_invoice_id, p_hosted_url, p_stripe_status, p_mode)`**, the service role only. It refuses a page that did not come back whole (an `in_` id, an `https://` link, `live` or `test`), a bill not being set up, and a bill that changed meanwhile. It writes onto the bill:
   - its total, the base plus the fee;
   - the Stripe id, link, status and mode, and `external_send_channel = 'stripe'`;
   - the fee as a rider in `fee_lines`: `{ description: "Credit card fee (3%)", amount, card_bill, added_at }`.

   It then sets the row `on_card` and lays the billing job's revenue again.
4. **`gc_card_bill_undo(p_invoice_id)`**. Signed in, it is back to a check bill. It refuses in words no one signed in, a training account, a digital twin and anyone off the money team, then a bill not on card, and a bill with a payment (*A payment is on this bill, so it stays on card.*). It writes the bill back to its base, clears the Stripe columns, takes the rider off, keeps the row as `undone`, and lays the revenue again. As the service role it clears a pending row whose Stripe invoice was never made, and nothing else.
5. **`job_rider_fees`**, restated byte for byte from `20261010023000` but for one more kind of `fee_lines` entry it sums: one that names its `card_bill`, beside one that names its `case_id`. Its client twin, `riderFeeLineCents` (`src/lib/jobs/arReturnCaseFee.ts`), which `jobFormRiderFeesDollars` reads, learns the same entry in this PR.
6. **`gc_owner_billing_revenue`**, restated: the contract today, the interest billed, and `job_rider_fees` on the billing job. Without the rider a card payment, which carries its fee, would bring the job's payments to its revenue while a bill is still open, and `mark_invoice_paid` would mark the job paid. Its only readers are the three functions that set the billing job's revenue (the send, the certificate and the interest bill), so none of them changes, and no GC figure reads it. It also counts a returned check fee on a GC bill now, which v2.5091 left to the GC crew. `gc_owner_billing_revenue` and `gc_owner_contract_now` gain the service role's EXECUTE so finish can lay the revenue.

Every function is `SECURITY INVOKER`. Nothing calls begin, finish or undo yet: `gc-card-bill` and the portal's **Pay by card** are O8b, and the office's **Back to a check bill** is O8c.

## The lock note

`CREATE TABLE` makes a new table. `CREATE OR REPLACE FUNCTION` and the grants take no lock a crew's query waits on. `SET lock_timeout = '3s';` heads it as every migration's does.

## Verify after the push

Read only, every write rolled back:
1. **The table, its policies and the fences.** `relrowsecurity` is `true` on `gc_owner_card_bills`. Its two policies `gc_owner_card_bills_money_read` and `gc_owner_card_bills_money_undo` are there, beside at least one restrictive policy and one statement trigger from the fences. `SELECT count(*) FROM public.gc_owner_card_bills` is `0`.
2. **Who runs what.** The five functions (`gc_card_bill_begin`, `gc_card_bill_finish`, `gc_card_bill_undo`, `job_rider_fees`, `gc_owner_billing_revenue`) are `SECURITY INVOKER`. `has_function_privilege` gives:
   - `authenticated` on begin and finish: `false`;
   - `service_role` on begin, finish and undo: `true`;
   - `anon` on undo: `false`;
   - `service_role` on `gc_owner_billing_revenue` and `gc_owner_contract_now`: `true`.
3. **The revenue holds on prod.** For every GC project with a billing job, `gc_owner_billing_revenue(project_id)` equals the billing job's `jobs_ledger.revenue`. No GC bill carries a `fee_lines` entry yet, so the riders add nothing.
4. **Who may undo.** As an estimator, `gc_card_bill_undo` on any bill id refuses *Only the money team takes a bill off card.* As a dev, a made-up id gives *That bill is not on card.* Nothing is written.

A bill turned to card on the test project waits on O8b and on Grace's yes. The function runs in Stripe's test mode until the owner says live.

## The SQL beds

`scripts/pgtest-gc-owner-billing.sh` re-applies this migration with Owner Billing's others and runs `90_card_bills.sql`, 42 checks. A $100,000 contract is billed in five certified bills, with one interest bill of $100:
- the migration's shape: row security, the two policies, the fences, who may run what;
- begin refused as a signed-in dev, on an interest bill, on a bill that is not there, on a bill on Stripe already, on a second press while the page is made, and on a bill with a payment;
- a pending row that never came back, cleared by the service role and begun again;
- finish refused for a broken page and a page in no mode, and refused a second time;
- the fee to the cent: $42,750.00 → $1,282.50, and a half cent rounding up, $12,345.50 → $370.37;
- finish writes the total, the Stripe columns and one `card_bill` rider. `job_rider_fees` reads $1,282.50, and the revenue reads the contract, the interest and the fee;
- a second press opens the card page it has;
- the controller's certificate keeps the riders in the revenue, read through the controller's own rights;
- back to a check bill: refused for the service role, and in words for an estimator, a dev in training mode and a digital twin. Then the controller does it: the base, no Stripe, the rider off, the fee out of the revenue, the row kept undone;
- their portal cannot turn that bill again;
- **the early-paid case**: every bill paid but bill 2's fee. Without the riders the revenue would be $100,100.00, under the $101,382.50 paid, and the job would read paid. With them it keeps its status, and $370.37 is left owed, bill 2's fee;
- a paid card bill stays on card;
- a returned check fee on a GC bill rides with the card fees: $1,682.87 of riders.

It ran first on a local Docker copy of the whole schema at main bc658b02f, with every migration applied and Owner Billing's applied twice; all nine files passed. Five mutants of the migration were each caught: the revenue without the riders, the riders without `card_bill`, begin without the payment check, undo keeping the rider, and finish writing no rider. It runs on the whole schema in GitHub's `SQL beds`.

## Status

Cut 2026-10-09 by Helper 5 (the Owner Billing lane). The lead pushes it once the PR merges.
