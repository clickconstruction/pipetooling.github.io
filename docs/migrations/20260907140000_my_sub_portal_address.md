# 20260907140000_my_sub_portal_address.sql (2026-09-07, v2.3067)

Journey map **SP-2** (`customer-portal-visit.md`, Tier 5 P1 walk): a sub with a login had no way to reach their own statement from inside the app — `/sub` needs the link's key and the Job Mode Dashboard had no door.

- **`my_sub_portal_address()`** (new, `STABLE SECURITY DEFINER`, `authenticated` + `service_role`, revoked from `PUBLIC` / `anon`): for the caller's own roster row (`people.account_user_id = auth.uid()`, `kind` sub / helper, not archived) with an active `sub_portal_links` row, returns `{slug, token}` — the `sub_portal_slugs` slug when one exists, the raw token only where the link still stores it (hash-only links answer with the slug or nothing). NULL otherwise. Never mints; a turned-off portal stays off.
- Consumer: `useMySubPortalAddress` → the **My statement ↗** door on `DashboardJobModeCard` (subcontractor / helpers). Short address first (`portalShortUrl`), else `/sub?t=<token>`.

Apply order: either — the hook reads a missing RPC as "no door".
