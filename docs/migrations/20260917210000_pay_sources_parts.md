# 20260917210000_pay_sources_parts — Apple Pay as a source kind; the part memo on every row of a split send (v2.3580)

**What**:

- `pay_stub_payments.source_kind` gains `apple_pay` (source_id = the send's Mercury card row, the same shape as Cash App's card rows; may be recorded before the row posts, with no id).
- `pay_send_memo('apple_pay', …)` → `Apple Pay "note"`.
- `pay_send_part_memo(base, i, n, total)` → `base · i of n from $1,067.23`; `pay_send_strip_part(memo)` removes the suffix (so restamping never doubles it); `pay_send_total(kind, id)` reads the send's amount from its ledger row (`cashapp_transactions` or `mercury_transactions`).
- `pay_send_stamp_parts(kind, id, total = null)` — renumbers the memos of every payment sharing a source, ordered by paid_at then created_at: one row → any stale suffix stripped; several → `1 of n … n of n`, the total from the argument, else the ledger row, else the rows' sum.
- `record_pay_send` — when the send lands on more than one report, each row's memo carries its part and the whole; a leftover advance offset says `· $323.81 of $1,500.00 ahead`; the dry run returns the memos it would write and `parts`; `apple_pay` accepted; the idempotency check also recognises an offset whose description carries the suffix.
- `link_pay_send` — restamps the source's rows after each link (the backfill's "one send, five rows" reads `1 of 5 … 5 of 5`), and strips a stale suffix from a memo before folding it into the Cash App form.
- `split_pay_payment` unchanged: its parts are different sends, not one send in parts.

**Access**: as v2.3578 — payroll access or the service role, SECURITY INVOKER.

**Why**: the owner, 2026-09-17, paying Tristen $20 then $1,067.23 by Apple Pay against two open weeks: *"How should I record in the notes that both of those payments were a part of '1,067.23'? I want a robot to always do this."* The rule lives in the database so the modal, the scripts and any agent get it unasked. See `docs/recent-features/v2.3580.md`.

**Verified**: the 13-step scenario in `supabase/tests/pay_sources/20_scenario.sql` (run by `npm run test:pg:pay-sources`) now covers the part memos on record and on link, the offset wording, Apple Pay settling Tristen's two weeks to the cent, `apple_pay` without an id, and idempotent restamping.

**Idempotent**: `DROP CONSTRAINT IF EXISTS` + add, `CREATE OR REPLACE FUNCTION`. Additive; no data touched.
