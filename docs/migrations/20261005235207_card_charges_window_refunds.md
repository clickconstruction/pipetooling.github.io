# 20261005235207_card_charges_window_refunds.sql (2026-10-05, v2.4611)

`CREATE OR REPLACE` of `_card_charges_window_rows` — the rows function behind `list_card_charges_window` (20261005212106) — so a **card refund** counts. Same signature, same columns, still `LANGUAGE sql STABLE SECURITY DEFINER` (checked in full when the push creates it), execute still revoked from `PUBLIC`, `anon` and `authenticated`. The wrapper is untouched.

## Why

People → Spending's comparison against the Job window (2026-10-05, read-only on the dev server) matched to the cent everywhere but three cells, and each difference was a refund: Malachi on J363 16¢ (half of a $0.32 Shell refund), Michael A. on J1033 $168.06 (a Home Depot return), and J583 over its whole life $1,045.69 (six refunds). Spending plus those refunds equalled the Job window and Job Summary exactly.

Mercury files a refund to a card as **`kind = 'other'`**, still carrying the card's `debitCardInfo`. The first definition kept only `debitCardTransaction` / `creditCardTransaction`, so the refunds never reached Spending, and its totals read high by them.

## What the `other` rows with a card are

Read 2026-10-05 as the owner (dev), read-only:

| | Rows | Dollars | Direction |
|---|---|---|---|
| 90 days to 2026-10-05 | 27 | +$1,083.34 | every one money in |
| All time | 135 | +$11,618.37 | every one money in |

Merchant refunds and returns: Shell and Fuelman pump refunds (the bank description starts `RBT`, a fuel pre-authorization given back), The Home Depot, Lowe's, O'Reilly Auto Parts, AutoZone, Elliott Electric, Amazon, H-E-B and a few others. No outbound `other` row carries a card. A few all-time rows have status `failed`; the read keeps them as the Job window does (neither filters on status). Of the 642 `other` rows all time, the 507 with no card are not card activity and stay out. No card-kind row lacks a card id, and there are no `creditCardTransaction` rows at all.

The kernel needs no change: an amount keeps the bank's sign, `cardChargeCostUsd` turns a refund into negative cost, and a refund on a job's split nets against that job — exactly as the Job window counts it.

## The filter

A card kind, **or** any transaction that carries a card id; duplicates still out. The window's rows are read once (`w`, with the card id) and filtered (`c`), both `MATERIALIZED`, so `raw` is still read once per row: about 1,800 rows in and 1,132 out for 90 days.

## House rules

Opens with `SET lock_timeout = '3s'`. `CREATE OR REPLACE`, idempotent. No table, so no read-only block calls. `src/lib/banking/cardChargesWindow.test.ts` holds this file's `RETURNS TABLE` equal to the wrapper's, the function `LANGUAGE sql` and closed to the app roles, and the filter.

## Apply

`supabase db push` once this is on `main`. **Before PR 4b-2 (#4585) merges.** No client change: the same rows, plus the refunds.

## Verify after the push

On the dev server, read-only, as an office user: Spending over 2026-07-08 – 2026-10-05 against the Job window for Malachi on J363 and Michael A. on J1033, and J583 over 2026-03-15 – 2026-09-23 — each difference reads **0**. The 90-day read returns about 1,132 rows (1,105 purchases + 27 refunds) in under a second.
