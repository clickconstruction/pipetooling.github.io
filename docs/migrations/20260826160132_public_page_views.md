# 20260826160132 — public_page_views (portal view counting) (v2.2341, 2026-08-26)

Server-side view ledger for the unauthenticated customer surfaces.

- **Table** `public.public_page_views`: `id uuid PK`, `surface text CHECK
  (portal | estimate_terms | contract_accept | hazmat_notice)`, `entity_id
  uuid NULL` (portal → `customers.id`; deliberately no FK so entity deletion
  never erases view history), `via text CHECK (token | slug)`,
  `occurred_at timestamptz default now()`.
- **Indexes**: `(occurred_at)`, `(surface, entity_id)`.
- **RLS**: enabled with **no INSERT/UPDATE/DELETE policies** — the only
  writer is the service role inside the `customer-portal` edge function
  (bypasses RLS), so nothing anon-reachable can inflate counts. SELECT is
  `public.is_dev()`.
- Ends with both `apply_read_only_write_blocks()` and
  `apply_read_only_stmt_blocks()` (CREATE TABLE rule).
- **Not** used for estimate-accept views: those already land in
  `estimate_customer_events` (`public_link_view`, since `20260406034514`).
