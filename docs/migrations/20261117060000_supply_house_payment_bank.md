# 20261117060000_supply_house_payment_bank.sql (2026-11-16, v2.7471)

Supply house payments: the bank match. PR 7 of the train. Needs `20261116230000_supply_house_payments.sql`.

- **`supply_house_payments.mercury_transaction_id`** (FK → `mercury_transactions.id`, `ON DELETE SET NULL`), with `bank_matched_at`, `bank_matched_by` and `bank_matched_by_name`: the Mercury transaction a payment left on. A partial index covers the matched rows.
- **`supply_house_payments_bank_guard`** (before an update of `amount` or `removed_at`): a payment whose amount changes, or that is removed, lets go of its bank line, so a matched payment is always one the bank agrees with.
- **`match_supply_house_payment(p_payment_id, p_transaction_id, p_fill)`**: ties a live payment that sent money to one outgoing bank line. The caller must be able to read the line (the transactions table's own policies). Refused for money in, for a failed or cancelled line, and when the live payments on the line would come to more than the line. With `p_fill`, a payment that has no method takes one from the line's kind (a kind with `card` in it is `card`, anything else is `ach`) and its `paid_on` becomes the day the line posted, in the company's time zone; the ground's triggers then read its bills again.
- **`unmatch_supply_house_payment(p_payment_id)`**: clears the match.

Both functions are `SECURITY INVOKER` and check `is_office_staff()` themselves; granted to `authenticated`, revoked from `anon`. The guard is a plain trigger function with an empty `search_path`, revoked from every API role. No new table, so no fence calls. Additive and idempotent.

**Locks.** `ADD COLUMN` with nullable references takes short locks on `supply_house_payments` (a new, small table), `mercury_transactions` and `users` that hold writes, not reads. `lock_timeout` is 3 s.

**Tried** on the bed `supabase/tests/supply_house_payments/` (`50_bank.sql`), which CI runs on Postgres 15.

**Order.** Push right after the merge. Until then the client's read of the matches fails soft to none.

**After the push:** `npm run gen-types:linked`, then `node scripts/build-dev-mcp-catalog.mjs`, in one types PR.

**Applied** to prod by 2026-11-18: `npm run check:migration-drift` read 1,366 local files against 1,366 remote versions, fully applied, this version among them (run in the docs pass after #8630).
