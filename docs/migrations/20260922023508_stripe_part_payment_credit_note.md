# 20260922023508_stripe_part_payment_credit_note.sql (2026-09-22, v2.3695)

Adds `jobs_ledger_payments.stripe_credit_note_id text NULL` — the Stripe credit note that recorded a **part payment in cash or by check on an open Stripe bill** (`record-stripe-invoice-out-of-band-payment`, amount under the open balance). "Undo part payment" (`reverse-stripe-invoice-out-of-band-payment` with `payment_id`) voids exactly that note and deletes the row. NULL for every other payment; no RLS change, no backfill.

Apply order: push this **before** deploying the two edge functions (the record function inserts the column; the reverse function reads it). The client tolerates the column's absence (it only offers Undo when the value is present).
