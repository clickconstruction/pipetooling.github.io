# 20261112013000 — bridge_cash_keys_owner (v2.6964)

The owner's role saves the Bridge's three cash settings (punch list #303). Behind **Money** on `/bridge` the page upserts three `app_settings` rows: `bridge_cash_floor_usd_v1` (the cash floor), `bridge_cash_on_hand_v1` (the typed cash on hand) and `bridge_cash_accounts_out_v1` (the bank accounts left out of cash on hand). Until now only the baseline's *Devs can manage app settings* admitted the write, so the owner's role, which has opened the page since `20261109006000_dev_gates_pages_quickfill.sql`, was refused on all three.

- **`master_or_dev_insert_bridge_cash_keys`** (`FOR INSERT TO authenticated`) and **`master_or_dev_update_bridge_cash_keys`** (`FOR UPDATE TO authenticated`): the three keys and `is_master_or_dev()`, the shape of `master_or_dev_*_pipeline_money_keys` (`20261109003500`). An upsert needs both, and the floor has no row on prod.
- No delete policy: the page never deletes these rows. `bridge_target_usd_v1` is not named: the page stopped writing it.
- The table's restrictive write fences (read-only, digital twin, archived) still apply. No table is created, so no fence call is owed.
- Idempotent: each policy is dropped if it exists and made again.

Checked before the PR on a local Postgres 15 with the baseline's table, its two general policies, the read-only fences and the real role helpers, the file applied twice: the owner passes on the three keys by insert and by update and is refused on any other key; a read-only owner, the controller and the assistant are refused; the dev is unchanged.

Deploy order: none. The client's writes are the same before and after; they pass once this is pushed.
