# 20260910213000_drop_supply_houses_is_insurer.sql (2026-09-10, v2.3244)

Drops `supply_houses.is_insurer`, its derive trigger `supply_houses_derive_is_insurer` and that trigger's function. v2.3172 introduced `vendor_kind` and kept the flag one release as a derived column; every reader has since moved to `vendor_kind` (pickers, the Directory, the vendor form) and no RLS policy, RPC or edge function references it.

**Ordering: push only after the v2.3244 client has deployed.** The pre-v2.3244 client still writes `is_insurer` on every house save and would fail against the dropped column. Idempotent (`IF EXISTS` throughout). Follow with `npm run gen-types:linked`.
