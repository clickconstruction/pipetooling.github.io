# 20260821213000_customer_portal_links.sql (2026-08-21, v2.1982)

Customer portal spine: `customer_portal_links` capability-link table
(customer_id, audience `customer|gc`, `token_hash` = sha256 of the raw link
token — raw is returned exactly once by the mint RPC, estimate-customer-view
model; partial unique index enforces one ACTIVE link per customer+audience;
office-read RLS) + `mint_customer_portal_link(p_customer_id, p_audience,
p_rotate)` SECURITY DEFINER RPC (dev/master/assistant-like; rotate revokes
then re-mints). Ensures the `pgcrypto` extension (first migration to use
`digest()`). Ends with both read-only block calls. All public access goes
through the `customer-portal` edge function; apply order free — the /portal
page fails soft ("link no longer active") until both sides exist.
