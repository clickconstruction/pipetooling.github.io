# 20261007020000_lien_pay_offer_nightly_cron.sql (2026-10-07, v2.4704)

The pay offer's nightly sweep: pg_cron job `lien-pay-offer-nightly` at 06:05 UTC (a few minutes after midnight Central) posts `{"action":"expire"}` to `/functions/v1/lien-pay-offer` with the vault's `CRON_SECRET`, which voids the Stripe credit on every bill whose offer day has passed unpaid and marks the row `lien_offer_ended_at`. Unschedules any earlier job of the same name first, so it can be re-run. Deploy `lien-pay-offer` before or with the push; a night before the deploy logs a 404 and does nothing.
