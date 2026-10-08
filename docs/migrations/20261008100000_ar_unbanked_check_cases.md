# 20261008100000_ar_unbanked_check_cases.sql (2026-10-08, v2.4902)

A check typed in by hand that never reached the bank is a case (punch list #76, piece 3). The returned-check train (v2.4313–v2.4333) opens a case only for a check the bank holds: one it sent back, or one Mercury could not take in. A payment typed as a check with no deposit linked leaves nothing at the bank, so its job read paid and nobody was told.

- **`ar_unbanked_check_cases`** — one case per payment: `payment_id` (unique, no foreign key, so a case outlives a payment taken off its job), the job, amount, day, type and check number kept on the case, `opened_at`, `closed_at` / `closed_reason` (deposited · settled_other_way · not_coming · taken_off) / `closed_by` / `closed_note`, `deposited_mercury_transaction_id`, `notified_at`. RLS: the AR roles read; every write goes through the functions below. The three house block calls.
- **`ar_check_payment_type(text)`** — IMMUTABLE; *Check*, *Cheque*, *checkDeposit*, *ck*. Twin of `isCheckPayment()` (`src/lib/jobs/checkClearing.ts`).
- **`open_ar_unbanked_check_cases(p_days default 10, p_floor default 2026-07-01, p_quiet default false)`** — service role only; returns `{opened, closed_deposited, closed_taken_off}`.
  - Opens a case for a payment typed as a check, amount above zero, no `mercury_transaction_id`, on a job, typed in on or after `p_floor` and at least `p_days` ago. The exception: a `checkDeposit` posted since three days before it was typed in, not failed, not marked returned, with at least the payment's amount still unused by payments. That deposit may be this check waiting in To match.
  - Closes a case whose payment now has a deposit (deposited), or whose payment is gone (taken_off).
  - `p_quiet` marks new cases told.
  - `p_days` mirrors `AR_UNBANKED_CHECK_DAYS` in `_shared/bankReturnedDeposits.ts`; `bankReturnedDeposits.test.ts` reads this file to keep them equal. It is its own clock, not `CHECK_CLEAR_DAYS` (7): that counts a deposited check clearing, this counts a check that never got deposited.
  - The floor: before spring 2026 the office did not link checks to deposits. From 2025-04 to 2026-02, all 63 check payments have no link. From July on the rule finds eight.
- **Triggers on `jobs_ledger_payments`** — `jobs_ledger_payments_close_unbanked_case_link` (`AFTER UPDATE OF mercury_transaction_id`, a new link) closes the case as deposited with the deposit; `jobs_ledger_payments_close_unbanked_case_gone` (`AFTER DELETE`) closes it as taken_off. One SECURITY DEFINER function behind both.
- **`close_ar_unbanked_check_case(p_case_id, p_reason, p_note)`** — the AR roles; settled_other_way or not_coming, a note of at most 500 characters. **`reopen_ar_unbanked_check_case(p_case_id)`** — only a case the office closed. A deposited or taken-off one has nothing left to chase.
- **`list_ar_return_cases`** — `CREATE OR REPLACE` with the same columns. The body through its first `RETURN QUERY` is 20261001230000's, unchanged. A second `RETURN QUERY` adds the unbanked cases:
  - `source` is `unbanked`, and the case's own id rides in `mercury_transaction_id` (a uuid that names no deposit).
  - `recorded_payment` holds the payment, live or as the case kept it, with the check number. `live_payments` is `[]`.
  - `counterparty_name` is the job's payer: the GC when the GC pays.
  Every reader (Accounts Receivable, the Dashboard and Pipeline nudge, `ar-returned-checks`) gets them with no type change.
- **Backfill** — `open_ar_unbanked_check_cases(10, '2026-07-01', true)`: the cases already due open quietly, told now, so the first hourly run sends nothing for them.

## What the backfill opens (read 2026-10-08)

Eight payments, every job reading paid:

| Job | Typed in | Amount | Type · check | Payer |
|---|---|---|---|---|
| #066 Venancio Diaz — PRE | Aug 19 | $250 | ck · 2662 | Done Right Foundation |
| #032 Garry Montgomery — PRE | Aug 19 | $250 | Check · 2638 | Done Right Foundation |
| #025 Chris Vetter — POST | Aug 19 | $250 | Check · 2630 | Chris Vetter |
| #819 Harrell Carlson — Pretest | Aug 19 | $250 | Check · 3289 | Done Right Foundation |
| #894 Laura Shearer — Pretest | Aug 20 | $250 | Check | Done Right Foundation |
| #541 Darla Mcloud — Post | Aug 21 | $250 | Check | Done Right Foundation |
| #098 Doneright Foundation | Aug 19 | $1,200 | Check · 2745 | Done Right Foundation |
| #903 Big Easy Saloon | Jul 30 | $185 | Check | Big Easy Saloon |

Done Right Foundation's $250 check deposits (Aug 10 ×4, Aug 18, Aug 31 ×6, Sep 8 ×2) are every one applied to other jobs. So the six $250 checks were either never deposited, or deposited together with no link. #819 also carries a second $250 payment the same day with no type: a $250 job reading $500 paid. #903 has a $185 deposit linked Jul 14 and this $185 Check typed in Jul 30 with none.

## Verified

`npm run test:pg:ar-unbanked-checks`: the bed on Postgres 15 against stand-in tables, the migration applied twice. It checks each side of the window (an unused deposit of at least the amount posted two days before closes it; four days before does not; a used or failed deposit does not count), the floor, too soon, a card, a linked payment, both self-closes, the list rows (the GC as payer, a taken-off case read from the case), the office's close and reopen and their refusals, the quiet flag and the grants. 30 checks. The SQL beds workflow runs it on GitHub.

Apply order: merge → `supabase db push` → `supabase functions deploy ar-returned-checks` (it runs the sweep and tells the office) → regenerate types. The client is safe either side: before the push the list has no unbanked rows.
