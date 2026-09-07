# 20260907100000_customer_address_primary.sql (2026-09-07, v2.3008)

Customer properties train, PR 2: the primary address becomes a `customer_addresses` row, so the customer's own property can carry the lien-paperwork legal record and be linked to jobs like any other.

- `customer_addresses.is_primary boolean NOT NULL DEFAULT false` + partial unique index `customer_addresses_one_primary_idx (customer_id) WHERE is_primary` — one primary per customer.
- **Sync triggers, both directions, SECURITY DEFINER, `pg_trigger_depth() > 1` guard against ping-pong**:
  - `customer_address_primary_sync_to_customer_tr` (AFTER INSERT / UPDATE OF address, is_primary / DELETE on `customer_addresses`): starring a row demotes the other primary and writes `customers.address`; deleting the primary promotes the earliest remaining row (or clears the address).
  - `customer_address_sync_from_customer_tr` (AFTER INSERT / UPDATE OF address on `customers`): a new or retyped `customers.address` stars an existing row spelling the same address (case/space-insensitive), else retypes the current primary row, else inserts one; clearing the address un-stars the row but keeps it (its legal record is worth keeping). Every legacy writer — the New Customer page, `merge_customers`, the old Save — keeps working unchanged.
- **Backfill**: every customer with an address and no primary gets one — an existing matching row is starred, otherwise a row is inserted (`sequence_order 0`).

Apply order: after the client (v2.3008) is live is safest, but either order works — the client reads `is_primary` with `select('*')` and treats a missing column as false; only the ★ *Set as primary* write needs the column and fails with a toast before the push. Depends on `20260907090000_customer_address_parcel_record.sql` only by version order.

Verify after the push: `select count(*) from customers c where nullif(btrim(coalesce(c.address,'')),'') is not null and not exists (select 1 from customer_addresses a where a.customer_id=c.id and a.is_primary)` → 0. Star a different row on Edit customer → the hub header shows the new address; retype the Address field and Save → the ★ row follows.
