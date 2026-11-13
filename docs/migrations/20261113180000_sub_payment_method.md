# 20261113180000_sub_payment_method.sql (2026-11-13, v2.7176)

A sub payment says how it was sent. Ships with the sub's **Record payment** window (Jobs → Subs → Pay), which draws the pay stubs' *How it was sent* chips with a sub's own methods.

- `people_labor_job_payments.method text` and `.method_ref text`, both nullable. `method` is checked against `check`, `zelle`, `mercury`, `cashapp`, `apple_pay`, `cash`, `client_direct`, `other` (the client's `SUB_PAY_METHODS`, `src/lib/subWorkOrders/subPaymentWindow.ts`). `method_ref` is that method's own number as typed.
- The same two columns on `people_labor_job_payment_events`, the snapshot a removal keeps.
- `remove_labor_job_payment` and `restore_labor_job_payment` re-created from their 20260917140000 bodies with the two columns spliced into the three inserts, so a removed payment is restored with its method. Signatures, `SECURITY INVOKER` and grants are unchanged. `move_labor_job_payment` re-points the live row and is not touched.

Additive and idempotent. No table is created, so no fence call is needed. The `ADD CONSTRAINT` validates the payments table under its lock: the table is small, and `lock_timeout` is 3 s.

**Order.** Push right after the merge. Until then the client's payment read falls back to the row as it was (no sheet reads unpaid), a payment with no method records as before, and a payment with a method is refused by the database. The sub portal names its payment columns and shows neither new one.

**After the push:** `npm run gen-types:linked`, then `node scripts/build-dev-mcp-catalog.mjs` (the dev seat's catalog lists the two columns), in one types PR.
