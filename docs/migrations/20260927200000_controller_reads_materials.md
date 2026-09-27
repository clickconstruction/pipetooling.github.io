# 20260927200000_controller_reads_materials.sql (2026-09-27, v2.3896)

Batch 1 of the controller-access audit (punch list #48, `to-dos/controller-access.md`). `ALTER POLICY` on 56 policies across 17 Materials and supply-house tables: each keeps its name, its command and its expression, and gains `'controller'::user_role` beside `'assistant'::user_role` in its role list. The one lone equality (`purchase_order_items` · *Assistants can update price confirmation*) becomes a two-role list.

The expressions were read back from `pg_policies` on production the same day, so the migration sets `search_path = public` for the unqualified `users` and `user_role` they carry. No table, column, function or grant changes. `SET lock_timeout = '3s'`; each statement takes a brief lock on its table. No client change is needed and the order with the client does not matter.

Verify after the push: as the sample controller, `supply_houses`, `supply_house_invoices`, `material_parts` and `purchase_orders` return the same row counts as for the sample assistant.
