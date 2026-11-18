# 20261116213000_sub_gather_sendings.sql (2026-11-16, v2.7440)

Old payments typed one per sheet are gathered into the sending they were (punch list #347's residue). Ships with *Gather old payments…* on the Subs Ledger.

- **`gather_sub_payments_into_sending(p_person_id, p_payment_ids)`**, `SECURITY DEFINER`, office staff only (`is_office_staff()`), returns `{ sending_id, number, payments }`. It inserts one `sub_payment_sendings` row for the person and sets `sending_id` on each payment row. A credit a row already kept moves under the sending with it.
- It changes no amount, date, sheet, tick or bank match. An update of `sending_id` alone fires neither `guard_sub_credit_payment` nor `clear_sub_payment_check_on_change`.
- It refuses a caller who is not office staff (42501), no person, fewer than two distinct payments, a payment that is gone, a row already in a sending, a back-charge, a payment made from a credit, and a row on a sheet the person is not on.
- **It refuses rows matched to different bank lines.** A sending's rows share one line (`match_sub_payment`), so two lines mean two payments. Rows on one line, or some matched and some not, are gathered as they are, and no match is written here.
- Execute is revoked from `PUBLIC` and `anon` and granted to `authenticated`.

No new table, so no fence calls. One function, `CREATE OR REPLACE`: idempotent.

**Needs** 20261114020000 (sendings), 20261114030000 (the tick) and 20261114040000 (the bank match), all in prod.

**Tried** in the bed `supabase/tests/sub_gather_sendings`, first run in CI.

**Order.** Push right after the merge. Until then the window says gathering is not switched on yet and changes nothing.

**Pushed** 2026-11-16, 09:39 UTC, alone, by `scripts/db-push.sh` from a checkout equal to `origin/main`, 48 minutes after the merge: a merge woke no session, and every site deploy of main failed on `check:calls-ahead` until the push, which re-ran the held deploy. Read back on prod: the function is `SECURITY DEFINER`, its body refuses rows on different bank lines, a signed-out call is refused with 42501, and the ledger holds the version once. The types and the dev seat's catalog followed in a types PR, which also drops the window's `as never` casts.

**Applied** to prod by 2026-11-18: `npm run check:migration-drift` read 1,366 local files against 1,366 remote versions, fully applied, this version among them (run in the docs pass after #8630).
