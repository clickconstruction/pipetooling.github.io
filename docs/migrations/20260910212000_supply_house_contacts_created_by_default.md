# 20260910212000_supply_house_contacts_created_by_default.sql (2026-09-10, v2.3243)

`supply_house_contacts.created_by` gets `DEFAULT auth.uid()`. The Directory's "added by" label (v2.3166) read this column, but nothing ever wrote it — the column shipped without a default in v2.1605 and neither the reps editor nor the RFQ window's "remember as rep" passed it. With the default every rep added through any authenticated path is stamped; service-role writes stay NULL, and rows older than this migration keep NULL (nobody can say who added them after the fact).

Additive, idempotent (`SET DEFAULT` is a no-op on re-run). The client in the same PR also passes `created_by` explicitly on both inserts, so provenance works even before this is pushed. No ordering constraint; pushed after the v2.3243 client deploys as usual.
