# 20260821233000_merged_portal_audience.sql (2026-08-21, v2.2008)

Merged portal audience (portal custom-links train, PR A migration 1): widens
the `customer_portal_links.audience` CHECK to `('customer','gc','all')`.
`all` is the ONE merged statement per company — union of jobs where they are
the customer and jobs where they are the GC — and becomes
`mint_customer_portal_link`'s default audience (v3 of the function; behavior
otherwise unchanged: returns the existing active raw token, `p_rotate`
revokes + re-mints in one transaction). Existing `customer` / `gc` rows keep
working untouched — they are now the gear's "Separate views" scoped links.
No new tables; constraint swap is drop-and-re-add (idempotent via IF EXISTS).
