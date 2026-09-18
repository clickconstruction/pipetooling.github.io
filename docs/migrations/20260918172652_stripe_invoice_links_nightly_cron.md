# 20260918172652_stripe_invoice_links_nightly_cron.sql (2026-09-18, v2.3589)

Stripe invoice links, the nightly refresh ([`docs/recent-features/v2.3589.md`](../recent-features/v2.3589.md)).

- **`cron.schedule('stripe-invoice-links-nightly', '45 8 * * *', …)`** → `net.http_post` to `/functions/v1/refresh-stripe-invoice-links` with the vault `PROJECT_URL` and `CRON_SECRET` (the `owner-confirm-nightly` pattern, `20260914270000`); unschedules any earlier job of the same name first. 08:45 UTC is 03:45 Central in summer, 02:45 in winter.

No tables, no columns. Idempotent. Apply order: merge → `supabase functions deploy refresh-stripe-invoice-links` → `supabase db push`. Until the function is deployed the schedule's POST 404s harmlessly; until the push, nothing calls the function.
