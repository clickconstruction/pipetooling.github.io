# 20260914045157_job_contract_not_needed.sql (2026-09-14, v2.3384)

Contract sweep PR 0 — the office's "this job needs no agreement of ours" answer, on the job.

- `jobs_ledger.contract_not_needed_at timestamptz` — when the office answered. NULL = the job is in the contract count (or nobody said). The coverage kernel reads it as its own state, *No contract · not needed*: a signed record (contract, paper, e-signed estimate, bid room) still wins over it; it wins over a sent or drafted contract. The Needs You item, the Pipeline card, the No-contract filter and the sweep skip the job while it is set.
- `jobs_ledger.contract_not_needed_by uuid` → `users(id)` ON DELETE SET NULL — who answered.
- `jobs_ledger.contract_not_needed_reason text` — why, in the office's words (the chip's hover shows it).

Written by the Contract modal's **Not needed…** / **Needed after all** (a plain `jobs_ledger` update; the office set that edits jobs). The dollar floor that goes with it is not schema: `app_settings.job_contract_floor_cents_v1` (`value_num`, cents), dev-written from the Pipeline card.

Additive and idempotent (`ADD COLUMN IF NOT EXISTS`); no CREATE TABLE, so no read-only-block calls; `jobs_ledger`'s existing RLS governs writes.

Apply order: **push before the client deploy** — the nudge hook selects the three columns by name; against the old schema that select errors and the card and Needs You item go quiet (safe, but blank) until the push lands.

`src/types/database.ts` carries the three columns by hand (Row / Insert / Update, the v2.3345 pattern); the next `gen-types` run reorders them.
