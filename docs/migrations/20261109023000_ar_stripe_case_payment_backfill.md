# 20261109023000 — ar_stripe_case_payment_backfill (v2.6775)

Punch list #76 (`to-dos/ar-returned-checks.md`), the defect the 2026-11-09 Stripe walk found: both ZZ TEST dispute cases held `payment_id` NULL, because `charge.dispute.created` reached `stripe-webhook` about 13 ms before `invoice.paid` wrote the `jobs_ledger_payments` row (Stripe's dispute test card disputes the charge the instant it is paid), and the later dispute events only brought the status up to date. The lost case's pane drew the words of **Put the bill back** and no press, since `arReturnCase` draws it only with `payment_live`.

- `CREATE OR REPLACE FUNCTION public.record_ar_stripe_case(...)`: when the case already exists, is a dispute and holds no payment, the same lookup the open branch runs (the bill's payment of this amount, else the newest) runs again against the case's `invoice_id` and fills `payment_id`. Every other branch is as it was. The result gains `payment_filled`; the webhook ignores a key it does not read.
- No table, so no fence calls; the grants and the comment are restated.

Deploy order: nothing in the client reads the new key, so push any time after the merge. The back-fill runs only on a new dispute event for the case: for a case already open, resend one of its dispute events from the Stripe Dashboard's Workbench (Webhooks → the endpoint → Event deliveries → Resend).

**Applied** to prod by 2026-11-09, read the same day through `npm run check:migration-drift` and the dev seat's `check_migration_ledger`: 1207 local files against 1207 remote versions, fully applied, this one among them.
