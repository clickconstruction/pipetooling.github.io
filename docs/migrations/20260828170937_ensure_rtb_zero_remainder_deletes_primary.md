# 20260828170937 — ensure RPC: fully-allocated remainder deletes the primary (v2.2446)

`CREATE OR REPLACE` of `ensure_single_ready_to_bill_invoice_for_job` — byte-identical to the
`20260730221500` definition except the primary-exists zero-remainder tail: instead of UPDATEing
the never-sent primary bundle to $0.00 and returning
`{error: 'Nothing left to bill; invoice amount would be zero'}`, it DELETEs the row (plain
DELETE, same as `delete_ready_to_bill_invoice`; FKs release references — payments SET NULL,
fixtures unbill) and returns `{ok: true, fully_allocated: true, amount: 0, primary_deleted: true}`.

- Reached when a segment/partial invoice consumes the whole remainder — the pre-fix envelope made
  clients report a phantom failure after a successful invoice insert and left a zombie $0.00
  "auto" draft (Taunya, job 978, 2026-08-28).
- The Stripe-finalized guard still returns first — a sent primary is never deleted or resized.
- Primary-absent zero-remainder branches keep their error envelopes (Bill Customer's
  ensure-on-open relies on them); clients running resyncs treat those as benign via
  `ensureRemainderResyncOutcome` (`src/lib/jobs/ensureRtbRemainderResult.ts`).
- Idempotent (`CREATE OR REPLACE` + a re-run of the deleted-primary case is a no-op: the
  primary-absent branch answers). Apply via `supabase db push` after the PR merges.
- Safe in either deploy order relative to the v2.2446 client (old client sees `ok` = success;
  new client tolerates the old error strings).
