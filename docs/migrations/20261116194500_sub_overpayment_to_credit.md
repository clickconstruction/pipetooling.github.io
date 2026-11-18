# 20261116194500_sub_overpayment_to_credit.sql (2026-11-15, v2.7420)

A sheet already paid past its total becomes a credit (punch list #347's residue). Ships with *Keep the $… over as credit…* on a sheet's ⋯ menu in Jobs → Subs.

- **`convert_sub_overpayment_to_credit(p_person_id, p_payment_id, p_amount)`**, `SECURITY DEFINER`, office staff only (`is_office_staff()`), returns `{ payment_id, amount_on_sheet, credit, bank_match_kept }`. It takes `p_amount` off the payment row and writes a `sub_credit_entries` row of the same amount tied to that payment and its sending, the shape `record_sub_sending` writes for a sending that went past its sheets.
- It refuses a caller who is not office staff (42501), no person, an amount at or below zero, a payment that is gone, a payment made from a credit, an amount that would leave the row at zero or below, a payment that already carries a credit, and a person who is not on the payment's sheet.
- **The tick and the bank match stand.** The amount edit fires `clear_sub_payment_check_on_change` (20261114040000), which clears the tick and deletes the match. The function reads both first and puts both back as they were made: the same day, the same person, the same bank line. The row's amount plus the credit kept with it is the figure it was, so `match_sub_payment` still counts the same sum against the line.
- Execute is revoked from `PUBLIC` and `anon` and granted to `authenticated`.

No new table, so no fence calls. One function, `CREATE OR REPLACE`: idempotent.

**Needs** 20261114020000 (the credit ledger), 20261114030000 (the tick) and 20261114040000 (the bank match), all in prod.

**Tried** in the bed `supabase/tests/sub_over_to_credit`, first run in CI.

**Order.** Push right after the merge. Until then the press says the repair is not switched on yet and changes nothing.

**Pushed** 2026-11-16, 06:19 UTC, alone, by `scripts/db-push.sh` from a checkout equal to `origin/main`. Read back on prod: the function is `SECURITY DEFINER`, a signed-out call is refused with 42501, and the ledger holds the version once. The types and the dev seat's catalog followed in a types PR, which also drops the window's `as never` casts.

**Applied** to prod by 2026-11-18: `npm run check:migration-drift` read 1,366 local files against 1,366 remote versions, fully applied, this version among them (run in the docs pass after #8630).
