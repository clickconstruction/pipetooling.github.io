# Cost batches (agent-safe cost reallocation)

---
file: docs/COST_BATCHES.md
type: Feature reference + agent writing convention
purpose: The audited, reversible entrypoint for moving job cost around — bank-transaction allocations, supply-house invoice allocations, clock sessions, ESTIMATE other-charges, thread notes — as one batch with a before-image undo. Schema, the two RPCs, the cost_agent role, and the convention any agent or dev follows when using it.
audience: Developers, AI Agents
last_updated: 2026-09-09
---

## What this is

Job cost in the app comes from six streams (team labor from clock sessions, sub-labor sheets, bank-transaction allocations, supply-house invoice allocations, tally parts, other job charges). Correcting where that cost sits — after a catch-all job was used for months, after an owner decides a period's costs belong to a different draw — used to be raw SQL from an agent session: invisible intent, an undo that lived in a CSV, nothing in the app saying what moved or why.

**Cost batches** are the HR-files pattern (`docs/HR_FILES.md`, v2.2232) applied to job cost. Shipped in v2.3196, migration `20260909161532_cost_batches.sql`.

| Layer | Table / function | Mutability | What it is |
|---|---|---|---|
| **Batches** | `cost_batches` | Written only by the RPCs; dev read-only | One row per applied batch: label, reason, source, author, op count, summary, `reverted_at` |
| **Operations** | `cost_batch_ops` | Written only by the RPCs; dev read-only | One row per op with `target` (as requested), `before_image`, `after_image` — **the before-image is the undo** |
| **Apply** | `cost_batch_apply(p jsonb, p_dry_run boolean = true)` | SECURITY DEFINER | Validates and applies a whole batch in one transaction; dry run by default |
| **Revert** | `cost_batch_revert(p_batch_id uuid, p_reason text)` | SECURITY DEFINER | Restores every before-image in reverse order, once |
| **Role** | `cost_agent` | LOGIN, no password in git | SELECT on the planning tables + EXECUTE on the two RPCs; no direct write anywhere |

## The five operations — and nothing else

| `op` | Fields | What it does | Guard |
|---|---|---|---|
| `allocate` | `tx_id`, `job_id`, `amount` (> 0, dollars), `note?`, `from_job_id?` | Allocates a bank transaction to a job. With `from_job_id`, first removes that job's allocation of the same transaction (recorded as `before_image.replaced`). Upserts on (transaction, job). Stored with the transaction's sign. | The allocation set on a transaction can never exceed the transaction |
| `supply_repoint` | `invoice_id`, `from_job_id`, `to_job_id` | Moves a supply-house invoice allocation to another job | Refuses if the target already holds an allocation of that invoice ("merge by hand") |
| `clock_repoint` | `session_id`, `to_job_id` | Moves a clock session to another job; the app's crew-day sync trigger follows | Never onto a bid; bid time is refused |
| `other_charge` | `job_id`, `description`, `amount` (≥ 0) | Adds an Other job charge | **Description must start with `ESTIMATE`** — the only way an estimate enters a job from a batch |
| `thread_note` | `job_id`, `body` (≤ 2000) | A note on the job's thread, written as the batch's `author_user_id` | Batch needs `author_user_id` |

Out of reach by construction: every payments table, deletes other than the allocation being replaced, any table not named above. An unknown `op` fails the whole batch.

## Payload

```json
{
  "label": "Trace ledger rev b — HCP 583 into Rough In",
  "reason": "Owner decision 2026-09-09: everything on the catch-all job moves to the rough-in draw.",
  "source_ref": "Trace-Cost-Ledger_App-Allocation_DRYRUN_v3_2026-09-09.md",
  "author_label": "Cost agent",
  "author_user_id": "<users.id the thread notes are written as>",
  "ops": [
    { "op": "allocate", "tx_id": "<mercury_transactions.id>", "job_id": "<jobs_ledger.id>", "amount": 124.90,
      "note": "Trace ledger rev b 2026-09-09", "from_job_id": "<the catch-all job>" },
    { "op": "supply_repoint", "invoice_id": "<supply_house_invoices.id>", "from_job_id": "…", "to_job_id": "…" },
    { "op": "clock_repoint", "session_id": "<clock_sessions.id>", "to_job_id": "…" },
    { "op": "other_charge", "job_id": "…", "description": "ESTIMATE — mobilization crews Feb–Mar 2026; replace with payroll", "amount": 22857.14 },
    { "op": "thread_note", "job_id": "…", "body": "2026-09-09 — cost batch: 371 charges moved here from HCP 583 …" }
  ]
}
```

The return value is the summary: `{ batch_id, dry_run, op_count, by_job: { <job_id>: { allocated, supply, clock_sessions, other_charges, notes } }, ops: [ { seq, op, before, after } ] }`. On a dry run `batch_id` is `null`.

The client-side mirror of these rules is `src/lib/costBatches/costBatchPayload.ts` (`validateCostBatchPayload`, `summarizeCostBatchOps`, `buildCostBatchPayload`) — reject a bad payload before the round-trip, and summarise a plan the way the function will.

## Dry run is the default, and it is the real code path

`p_dry_run = true` performs every write, builds the summary, then raises a private SQLSTATE that unwinds the writes inside the function and returns the summary. A dry run therefore exercises exactly the validation and the exact rows the real apply will touch; if the dry run returns, the apply will succeed on the same data. Call with `p_dry_run = false` to keep the writes and get a `batch_id`.

## Revert

`cost_batch_revert(batch_id, reason)` walks the ops in reverse: deletes what an `allocate` inserted (or restores the prior amount and note), re-inserts the allocation it replaced, points supply invoices and clock sessions back, deletes the ESTIMATE other-charge and the batch's own thread notes, marks every op and the batch reverted, and leaves one note per touched job ("Cost batch "…" reverted <date> — <reason>"). A batch reverts exactly once; a second call errors.

## Access model — read before touching

- Both RPCs gate the caller: a signed-in user must be a **dev** (`is_dev()`); a database-role caller (`auth.uid()` is NULL — `cost_agent`, `postgres`) is allowed. EXECUTE is granted to `authenticated` (the gate is inside) and to `cost_agent`; revoked from `anon` and PUBLIC.
- `cost_batches` / `cost_batch_ops` have SELECT policies for devs and for `cost_agent`, and **no INSERT/UPDATE/DELETE policies** — rows are written only by the definer functions.
- Read-only (training) mode: the standard statement/row blocks fire inside SECURITY DEFINER, so a read-only dev cannot apply or revert.
- Digital twins: the write fences on the underlying tables do not bind a definer function, so the dev gate is what keeps a twin out — twins are never devs.
- `cost_agent` is created **without a password**; set one out-of-band and keep it only in `.env.local` as `COST_AGENT_DB_PASSWORD`:

  ```sql
  ALTER ROLE cost_agent WITH LOGIN PASSWORD '<generated>';
  ```

## The convention (the load-bearing part)

1. **Plan in the open.** Write the plan as a file a human can read (the dry-run CSV/markdown pattern: every row with its current allocation, proposed target, basis, action). Put its name in `source_ref`.
2. **Dry-run first, every time.** Compare the returned `by_job` to the plan's own totals (`summarizeCostBatchOps`). They must match to the cent before `p_dry_run = false`.
3. **Real dollars move; estimates are labelled.** An `allocate` moves money that actually left the bank. An `other_charge` is the only vehicle for a number that did not, and its description says `ESTIMATE` first, then what it is, then what would replace it ("replace with payroll").
4. **Note every touched job** with a `thread_note` in the same batch: what moved, from where, which plan, and "no estimates in this batch" when that is true. The note is what the next person sees.
5. **Never a second basis for the same cost.** If a person's time is measured by clock sessions in a period, their bank pay for that period is not allocated (and vice versa).
6. **Revert, don't patch.** If a batch was wrong, revert it and apply a corrected batch. The audit trail then reads as two decisions, not a hand edit.

## Agent connection cookbook

- Connect as `cost_agent` via the session pooler (the direct host resolves flakily from the office machine):

  ```bash
  PGPASSWORD="$COST_AGENT_DB_PASSWORD" psql \
    "host=aws-1-us-east-1.pooler.supabase.com port=5432 dbname=postgres \
     user=cost_agent.yewfzhbofbbyvkvtaatw sslmode=require"
  ```

- Large payloads: build the JSON in a script, write it to a `.sql` file as `SELECT public.cost_batch_apply($J$<json>$J$::jsonb, true);`, run `psql -f`. Inline-quoted JSON breaks on apostrophes.
- Audit: `select id, label, applied_at, reverted_at, op_count, summary->'by_job' from cost_batches order by applied_at desc;` and `select seq, op_type, before_image, after_image from cost_batch_ops where batch_id = … order by seq;`.

## Not yet built

A dev screen listing batches with a revert button (Banking is the natural home). Until then devs read the two tables and call the RPCs from SQL; agents use the role.
