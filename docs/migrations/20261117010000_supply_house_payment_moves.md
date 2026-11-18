# 20261117010000_supply_house_payment_moves.sql (2026-11-16, v2.7462)

Supply house payments: move a payment's money to another bill, and remove a payment with a reason and a way back. PR 4 of the train. Needs `20261116230000_supply_house_payments.sql`.

- **`supply_house_payment_events`**: what happened to a payment after it was recorded. `kind` is `moved`, `removed` or `restored`. A move keeps `from_invoice_id` and `to_invoice_id` (NULL on either side is "on account"), the two bills' numbers as they read then (so the trace survives a deleted bill), `amount`, `reason` (`house_applied` | `wrong_bill` | `other` | `undo`) and `note`. A move that takes another back names it in `undoes_event_id`, and the one taken back names it in `undone_by_event_id`. A removal and a putting back keep what the payment had sent and the person's reason. `actor_user_id` / `actor_name` say who.
- **`move_supply_house_payment(p_payment_id, p_from_invoice_id, p_to_invoice_id, p_amount, p_reason, p_note, p_undoes_event_id)`**: moves an amount of one live payment from one bill to another bill of the same house, one house at a time (the ground's advisory lock). A whole line moves by changing its bill, so a payment is never left without a line half-way; part of a line lowers it and adds a line on the other bill. From NULL takes it from what the payment holds on account; to NULL puts it there, which a press payment cannot do. The ground's triggers check each line as it changes and read both bills again. Returns the event's id.
- **`undo_supply_house_payment_move(p_event_id)`**: the same amount, the other way, and both events say so. Refused when the move was already taken back, is itself a taking back, or a bill of it is gone.
- **`remove_supply_house_payment(p_payment_id, p_reason)`**: stamps `removed_at`, who and why on the payment and writes the event. Its lines stay, so putting it back is exact.
- **`restore_supply_house_payment(p_payment_id)`**: clears the removal within 30 days and writes the event. The ground's guard refuses, naming the bill, when a bill it paid has been paid or changed since, or has moved house.

All four are `SECURITY INVOKER` and check `is_office_staff()` themselves; granted to `authenticated`, revoked from `anon`. The table is office staff only: read, insert, and update (the functions mark a move as taken back); nobody deletes an event. Ends with the four fence calls. Additive and idempotent.

**Locks.** A new table and its foreign keys to `supply_house_payments`, `supply_houses`, `supply_house_invoices` and `users`: a short lock on each that holds writes, not reads. `lock_timeout` is 3 s.

**Tried** on the bed `supabase/tests/supply_house_payments/` (`30_moves.sql`), which CI runs on Postgres 15: both migrations apply twice and every scenario passes, the row-level security ones as the API's role.

**Order.** Push right after the merge. Until then the client's Move, Take it back, Remove and Put it back are refused by the API with the missing function's name; the reads fail soft (no events), and recording a payment is unaffected.

**After the push:** `npm run gen-types:linked`, then `node scripts/build-dev-mcp-catalog.mjs`, in one types PR.

**Applied** to prod by 2026-11-18: `npm run check:migration-drift` read 1,366 local files against 1,366 remote versions, fully applied, this version among them (run in the docs pass after #8630).
