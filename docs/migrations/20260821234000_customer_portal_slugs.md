# 20260821234000_customer_portal_slugs.sql (2026-08-21, v2.2008)

Custom portal addresses (portal custom-links train, PR A migration 2). Two
new tables, office-read RLS matching `customer_portal_links`, writes only via
SECURITY DEFINER RPCs:

- **`customer_portal_slugs`** — one row per customer (PK `customer_id`):
  `slug` (UNIQUE, `^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$` — 3–60 chars),
  `locked_at` (set on first share: office Copy via
  `mark_customer_portal_slug_shared`, or first public resolve in the
  `customer-portal` edge fn), `created_by`, timestamps. Company-level so the
  address survives token rotation.
- **`customer_portal_slug_events`** — append-only history
  (`created`/`changed`/`locked`, slug value, who, when) feeding the globe
  modal's History row.

RPCs (office writers — dev/master/assistant-like):

- `set_customer_portal_slug(p_customer_id, p_slug)` — upsert with friendly
  error strings ("Addresses are 3-60 characters…", "That address is taken —
  try another."); allowed before AND after lock (the modal warns post-lock);
  logs `created`/`changed` events.
- `mark_customer_portal_slug_shared(p_customer_id)` — sets `locked_at` once,
  idempotent, logs the `locked` event on the transition.

Both read-only-block calls applied (CREATE TABLE migration).
