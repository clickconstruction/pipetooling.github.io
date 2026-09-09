# 20260909001806_bid_rfqs_outside_links.sql (2026-09-09, v2.3175)

Price requests table on Edit Bid → Files & Links. Requests the estimator sends by hand (email, phone) become `bid_rfqs` rows next to the ones the app sends, so the bid has one list of who was asked.

- `sent_via text NOT NULL DEFAULT 'app'` — `app` (Send price requests: token, email, scope) or `outside` (recorded by hand).
- `requested_on date` — the day an outside request went out (app rows use `created_at`).
- `request_url text`, `quote_url text` — links to the request as sent and the quote as received (a quote plugged in on Pricing is `bid_quotes.rfq_id`, not this).
- Checks: `sent_via IN ('app','outside')`; an outside row has no `token`.
- Column comments on all four.

Additive and idempotent. **Push after the v2.3175 client deploys** — until then the client reads the legacy column set and hides "Add a request" behind a notice; after, everything is live. No RLS change: the pricing-sharer policies (office roles + estimator) already cover the table. Regenerate types afterwards.
