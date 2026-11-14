# 20261114040000_sub_payment_bank_matches.sql (2026-11-13, v2.7239)

A sub payment is matched to the Mercury line it left on (punch list #347, PR 5). Ships with **Find bank lines** on the Subs Ledger.

- **`sub_payment_bank_matches`**: `payment_id` (primary key, to `people_labor_job_payments`, cascade), `mercury_transaction_id` (to `mercury_transactions(id)`, cascade, indexed), who matched it and when. A payment has one bank line. A bank line may carry several payment rows. Office staff read, insert, update and delete (`is_office_staff()`).
- **`match_sub_payment(p_payment_id, p_transaction_id)`**, `SECURITY INVOKER`: links the payment and every row of its sending to the bank line and ticks them. It refuses a back-charge or a from-credit row, a bank line the caller cannot read, money in, a failed or cancelled line, and a link that would put more on a bank line than the line holds (the rows' amounts and the credit kept with them, against the line's amount).
- **`unmatch_sub_payment(p_payment_id)`**: clears the tick, which clears the match.
- **`set_sub_payment_checked`** is re-created from 20261114030000: clearing a tick now deletes the match for the same rows.
- **`clear_sub_payment_check_on_change`** is re-created `SECURITY DEFINER`: an edit to a ticked payment's amount or date clears the tick and the match, whoever makes the edit.

So a matched payment is always a checked one. Ends with the four fence calls. Idempotent.

**Needs** 20261114020000 and 20261114030000 first.

**Tried on a scratch Postgres 15** over the four migrations before it, with a stub of the bank table: applies twice. A sending's rows match together and are ticked. Each refusal above. Two rows typed per sheet share one bank line and a third that would overfill it is refused. The same match made twice is not an overfill of itself. Unticking clears the sending's matches, an amount edit clears the tick and the match, and a removed payment takes its match with it.

**Order.** Push right after the merge, after the two before it. Until then the matches read fails soft (nothing reads as matched), Find bank lines still reads the bank and offers lines, and choosing one says matching is not switched on yet.

**After the push:** the types and the dev seat's catalog, in one types PR for all three.
