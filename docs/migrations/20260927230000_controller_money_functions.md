# 20260927230000_controller_money_functions.sql (2026-09-27, v2.3899)

Batch 4 of the controller-access audit (punch list #48, `to-dos/controller-access.md`). `CREATE OR REPLACE FUNCTION` on 25 functions that gate money actions: marking invoices and jobs paid, removing a payment, reverting a Stripe payment, write-downs, bank-payment matching and duplicates, the ready-to-bill invoice, trip and hazmat charges, the terminal payment approval, and the invoice amount reads. Each is its live definition with the controller named beside the assistant in its role check; nothing else in any body changes.

The definitions were read with `pg_get_functiondef` on production the same day. `CREATE OR REPLACE` keeps each function's owner, grants and comment. `SET lock_timeout = '3s'`. No client change is needed and the order with the client does not matter.

Verify after the push: the audit's function query (a body naming `'assistant'` and never `controller`) returns none of this batch's functions, and each still exists with its grants.
