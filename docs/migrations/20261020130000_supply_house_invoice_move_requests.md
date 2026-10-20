# 20261020130000_supply_house_invoice_move_requests.sql (2026-10-20, v2.5677)

The move window (punch list #132 PR 3, `to-dos/ap-aging-cell-invoices/`). The owner's rule,
2026-10-20: a supply house moves a charge onto a job account **only while the invoice is
current** — and the office wants the attempt tooled: an attested call, or an email from the
app with a follow-up until the house confirms. This table is the record of those asks.

## What it does

- **`supply_house_invoice_move_requests`** — one row per ask: the invoice, its job and house,
  `via` (email · phone), `sent_to` (the rep address an emailed ask went to), who asked and
  when, and `confirmed_by/at` once someone attests the house moved the charge (the invoice's
  `on_job_account` flips in the same act, client-side). A partial unique index allows **one
  open (unconfirmed) ask per invoice**; confirmed history stays. An unconfirmed ask is the
  follow-up the office owes, aged amber at 3 days and red at 7 (`SUPPLY_MOVE_ASK_AGE`).
- **RLS**: all four verbs for `is_office_staff()` — the same hands that work Accounts
  payable. No field, estimator, or portal read.
- **Stamp trigger** (`supply_house_invoice_move_requests_stamp`): `updated_at` always;
  `requested_by` defaults to the caller on insert; `confirmed_by` fills the moment
  `confirmed_at` lands. (The edge function writes with the service role and passes
  `requested_by` itself.)
- Ends with the three standard guards: `apply_read_only_write_blocks()`,
  `apply_read_only_stmt_blocks()`, `apply_digital_twin_write_blocks()`.

## Why the shape

- The ask is per invoice, not per job: the house moves charges one by one, and the follow-up
  chip sits on the invoice row that needs it.
- `sent_to` is a snapshot, not a contact reference: the question "who did we email" must
  survive the rep being archived or re-pointed.

## Verify

After `supabase db push`: as the dev, the aging screen's strip reads its asks; a send from
the move modal writes one row (`via = 'email'`, `sent_to` the rep); **Mark it moved ✓**
confirms it (`confirmed_by/at` stamped); a pure phone move writes a confirmed `via = 'phone'`
row. As the sample controller the table reads; as an estimator or field login it returns no
rows. `src/types/database.ts` was hand-extended in the same PR (regen after the push, as
v2.3423 did).
