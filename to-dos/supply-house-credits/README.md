# Supply house credits — returns and credit memos

Status: **shipping 2026-09-16** as v2.3500 → v2.3501 → v2.3502 (migration `20260916120000`, pushed right after its merge) → v2.3503, in that order, from `claude/app-review-docs-27dda1` (built on `claude/determined-goldwasser-8d11e4`, renumbered from the unclaimed v2.3490–v2.3493) · all gates green, step 1 live-verified inert, the form walked live on real data · PR 5 (pairing) deliberately deferred · delete this to-do once v2.3503 is live-tested

---

## The ask, in the owner's words

> "Tanya would like to be able to enter negative amounts into supply houses for refunds. How should we track refunds? Is this the best and right way to do it?"

Taunya tried to enter a Reece return of `−888.10` against purchase order `Return`, with the credit memo scanned and linked on Drive. The form refused it: *Value must be greater than or equal to 0.*

## The decision

Record a return as **its own document with a negative amount**, marked as a credit, in `supply_house_invoices`. Not as an edit to the original invoice, and not in a new table.

**Rejected, and why:**

- **Just allow negatives.** A form that accepts any negative cannot tell a credit memo from a mistyped invoice, and a slipped minus moves a job's cost by twice the amount with nothing on screen to catch it.
- **Lower the original invoice's amount** (the "agreed write-down" pattern used on the billing side). The original is often already paid, the credit arrives as its own numbered paper with its own Drive link, and netting destroys the history of buying $2,400 and returning $888.
- **A separate `supply_house_credits` table.** Every reader would have to learn a second source, and the two allocation paths would be duplicated. Against the grain: this repo puts a discriminator on the existing table (`jobs_ledger_fixtures.line_kind`, `person_offsets.type`).

**Storage:** negative amount **plus** a `document_kind` discriminator. This is the discount-line pattern (v2.3252) and it is chosen for the same stated reason: the readers that sum blindly stay correct without learning the kind. It also has the safer failure mode — a reader we miss nets a credit correctly, whereas with a positive amount plus a kind, a missed reader would count a credit as **cost**, wrong by double and in the wrong direction.

## The mock-up

[`mockup.html`](./mockup.html) in this folder. Also published at https://claude.ai/artifact/2FCXfs4dAJvUgdyGA4VGg3 (version 2 is current; version 1 is the first draft, kept for the record of what the reader sweep changed).

---

## The one rule the whole train applies

> **An "owed" number counts invoices only. A credit is carried in its own field beside it, never inside a bucket, a balance, or an exposure.**
>
> **A "cost" number nets.** Job cost, bid cost and week-close spend all take the credit, because the job really did cost less.

Almost every change below is a mechanical application of those two sentences. Where a site disagrees with them today, it is because the database constraint `amount >= 0` made the distinction unnecessary.

## Why the order matters

Every sibling money stream in this codebase is sign-hardened: card charges take an absolute value everywhere, customer payments filter to amounts above zero, payroll remaining and the collections balance are floored at zero. **Supply house invoices are the only stream with no guard anywhere** — because the CHECK constraint did that work.

So the constraint is the gate, and it opens **last**. PRs 1 and 2 land while no negative row can exist, which makes them provably inert on live data.

---

## Where it plugs in

Verified against the working tree on 2026-09-15. Everything here was read, not inferred.

### Schema as it stands

```
supply_house_invoices
  amount numeric(10,2) NOT NULL
  CONSTRAINT supply_house_invoices_amount_check CHECK (amount >= 0)   ← the gate
  invoice_number, invoice_date, due_date, is_paid, paid_at,
  purchase_order_number, link, on_job_account, supply_house_id

supply_house_invoice_job_allocations (invoice_id, job_id, pct)   ← PERCENT, not dollars
supply_house_invoice_bid_allocations (invoice_id, bid_id, pct)
mercury_transaction_supply_house_invoice_links (tx, invoice)     ← existence only, no amount
```

- **Allocations are percentages.** A job's share is `amount × pct / 100`, so a negative amount credits the right job with no allocation change at all.
- **No constraint or trigger** requires allocations to sum to the amount. The 100% ceiling is enforced only by the merge/migrate RPCs.
- **Live shape:** 466 invoices, 425 with job allocations, every one summing to exactly 100%, at most 2 jobs per invoice.
- **One writer only:** `src/components/SupplyHousesTab.tsx` (insert, update, delete). No edge function and no SQL function writes this table.

### Needs no change — the arithmetic is already right

- `get_invoice_amounts_for_jobs` — `SUM(i.amount * a.pct / 100)`, raw signed, no `abs`, no filter. This is what makes the job side free.
- `get_invoice_allocation_lines_for_jobs` — same, per line.
- Every consumer of those two: Job Summary, the Parts ledger, the job window, People → Review, the cost timeline, Projects job history.
- `partner_job_cost_buckets` → `post_partner_profit_share`. A credit genuinely lowers materials cost, so the split it feeds is genuinely higher. Correct, not a bug. Worth one line in the docs fragment so nobody is surprised.
- `keep_job_baseline`. A credit entered before billing correctly lowers the frozen materials figure; one entered after does not retro-change it, which is already true of any late invoice.

---

## PR 1 — Teach the readers about a sign, while none can exist

Client and edge functions. **No migration.** Cannot change a live number today, and that is the point.

### 1a · `src/lib/supplyHouseAging.ts`

- `SupplyHouseAgingRow` gains `creditsOpen: number` (stored negative) alongside `buckets` and `total`.
- `SupplyHouseAgingMatrix` gains `creditsTotal: number` and `netTotal: number`. `grandTotal` keeps meaning **owed**.
- In `buildSupplyHouseAgingMatrix`, branch before bucketing:
  - `amount < 0` → `row.creditsOpen += amount`, `creditsTotal += amount`. It never touches `buckets`, `total` or `missingDueDateCount`.
  - otherwise → exactly today's path.
- Row filter becomes `r.total > EPSILON || r.creditsOpen < -EPSILON`, so a house stays listed on either kind of paper. **This is the fault that hides a genuinely late balance.**
- Sort stays `b.total - a.total`, so the biggest real exposure stays on top rather than being reordered by credits.
- `countSupplyHousesPastDue60` and `supplyHouseAgingPhoneNote` need **no edit** — they read `buckets`, which are now invoice-only by construction. Add tests pinning that.

### 1b · `src/components/SupplyHousesTab.tsx`

- New **Credits open** column in the aging table plus its footer total, and a **Net** column. Bucket cells keep `amount > 0.005`, which is now always correct.
- Phone bar: guard the division. Today it is `Math.max(3, (x.v / row.total) * 100)`, and `row.total` can be exactly 0 for a credits-only house. Render the bar only when `row.total > EPSILON`.
- Per-house `outstanding` in `loadSupplyHouseSummary` keeps netting credits — that is the true balance with the house. Label it so it reads as a balance, not as unpaid invoices.

### 1c · `src/lib/dashboardFinancials.ts` → `buildApBucket`

- `if (amount <= EPSILON) continue` currently **discards credits entirely**, so a credit would not even reduce the payables total, with no excluded-count to explain it.
- Change to `if (Math.abs(amount) <= EPSILON) continue`, let the amount into `supplyTotal`, and push the item with sublabel `'Supply credit'` when negative so the drill-down explains the total.

### 1d · `src/lib/materials/jobAccountsFlow.ts`

- Accumulate credits into a new `suppliersCredits` instead of `suppliersOwed`; `owedBuckets` and `owedOnJobAccount` take invoices only.
- `classifyJobAccount` then keeps today's exact behaviour, so a job with a real unpaid invoice never falls out of `owe_suppliers` because of a credit.
- `held`, `holdingTotal` and `holdingOnJobAccount` need no edit once `suppliersOwed` is invoice-only.
- `unallocatedTotal`: count credits in a separate `unallocatedCredits` so an unallocated credit cannot shrink the "dollars missing from the rows" alarm.
- Surface `suppliersCredits` on the row and in the tiles in `src/components/materials/MaterialsJobAccountsTab.tsx`.

### 1e · `src/lib/fetchJobMaterialsCostSnapshot.ts`

- `supplyInvoiceTotal` keeps netting. **Do not change it** — this is the job's cost and it should fall.
- `jobAccountSplitFromLines` is an **exposure**, not a cost: count invoices only, so `billTabJobAccountNote` in `src/lib/supplyHouseJobAccountsLedger.ts` keeps showing the warning instead of hiding it when a credit nets the flagged total below its `> 0.005` gate.
- These two deliberately diverge. Say so in a comment, or someone will "fix" it later.

### 1f · `src/lib/moneyfillWeekClose.ts`

- `gapDollars: Math.max(0, …)` floors an unallocated credit to `$0`, so the week-close queue reads "1 supply invoice · $0" and the reviewer closes the week.
- Use the magnitude of the unallocated portion so the credit reports its real size.

### 1g · `supabase/functions/weekly-money-email-dispatch/render.ts` — **redeploy**

- `money()` formats with `Math.abs` and no sign, so a negative money-out prints as money out.
- Give each formatter its own prefix and its own `Math.abs`:
  - `money` → `${n < 0 ? '−' : ''}$…`
  - `signed` → `${n < 0 ? '−' : '+'}$…` (it currently wraps `money`, which would double the minus once `money` preserves it)

### 1h · `supabase/functions/paid-job-email/render.ts` — **redeploy**

This one is sharper than it first looked. Charge events are built as `delta: -amount` and payments as `delta: amount`, and the month group splits on the **sign**: `e.delta > 0` is a payment. A credit memo of `−888.10` becomes `delta: +888.10`, so today it would render **as a customer payment, on a green row, in the payments group**.

- Add `kind: 'charge' | 'payment'` to `TimelineRowEvent`, set it in both builder loops.
- Filter on `kind`, not on the sign, in the payments/charges split and in the green row background.
- A credit then stays a charge with a positive delta, and `signedMoney` already renders `+$888.10`, which reads correctly against the job.

### PR 1 tests and proof

- New unit tests with **negative fixtures** for: the aging matrix (house stays listed, buckets untouched, nudge count unchanged), `buildApBucket`, `jobAccountsFlow` classification, `jobAccountSplitFromLines`, `supplyInvoicesQueueCount`, both email renderers.
- Each test must **fail without the fix** — check that before committing.
- Live proof: dev-login, open Materials → Supply Houses, Materials → Job Accounts, the dashboard payables drill-down. **Every figure must be identical to before.** Screenshot the aging grand total before and after.

---

## PR 2 — Close the two edges a credit should never reach

Client only. No migration.

- **`src/pages/Workflow.tsx` → `addInvoiceToStep`** and **`src/lib/projectsForecastStageLineItems.ts` → `addInvoiceToStep`** copy `inv.amount` into `workflow_step_line_items.amount` and build a memo string from it. That second table never learns the sign came from a credit, and the FK is `ON DELETE SET NULL`, so the copied negative outlives the invoice. **Refuse a credit here**, with a reason on screen.
- **`src/components/MercuryTransactionInvoiceLinkModal.tsx`** — linking a card charge to a credit both excludes the charge from parts cost and applies the negative allocation, hitting the job twice the same way. **Refuse the link**, with a reason. The picker already compares against `Math.abs(transaction.amount)`, so a credit can never match anyway; make the refusal explicit rather than leaving it as unmatched clutter.

Both are refusals with a sentence, never silent filters.

---

## PR 3 — The migration and the gate

Migration only, plus the types regen. **Nothing user-facing.** Push it before the form ships, so there is no window where picking Credit fails against an old database.

Claim the stamp first: `npm run claim -- --migration supabase/migrations/<version>_supply_house_document_kind.sql`, numbering from `origin/main`'s newest (currently `20260916015805_bid_submittal_rooms.sql`).

```sql
SET lock_timeout = '3s';

ALTER TABLE public.supply_house_invoices
  ADD COLUMN IF NOT EXISTS document_kind text NOT NULL DEFAULT 'invoice';

COMMENT ON COLUMN public.supply_house_invoices.document_kind IS
  'invoice (default) or credit. A credit is a credit memo the house issued — a return or a price correction — and its amount is stored negative so every reader that sums amount x pct stays correct without learning the kind.';

ALTER TABLE public.supply_house_invoices
  DROP CONSTRAINT IF EXISTS supply_house_invoices_document_kind_check;
ALTER TABLE public.supply_house_invoices
  ADD CONSTRAINT supply_house_invoices_document_kind_check
  CHECK (document_kind IN ('invoice', 'credit'));

-- The gate. An invoice keeps exactly today's rule; only a credit may be negative.
ALTER TABLE public.supply_house_invoices
  DROP CONSTRAINT IF EXISTS supply_house_invoices_amount_check;
ALTER TABLE public.supply_house_invoices
  ADD CONSTRAINT supply_house_invoices_amount_check
  CHECK (
    (document_kind = 'invoice' AND amount >= 0) OR
    (document_kind = 'credit'  AND amount <  0)
  );
```

Notes:
- Additive and idempotent. The default makes all 466 existing rows invoices, including the one row at `$0.00`, which still passes `amount >= 0`.
- No `CREATE TABLE`, so the read-only write-block calls are **not** required here.
- The old client never sends `document_kind` and cannot produce a negative, so it keeps working after the push.
- After the push: `npm run gen-types:linked`, then `npm run check:migration-drift` (run it from a worktree with `export SUPABASE_ACCESS_TOKEN=$(grep '^SUPABASE_MGMT_TOKEN=' .env.local | cut -d= -f2-)`).
- Docs fragment required: `docs/migrations/<version>_supply_house_document_kind.md`.

---

## PR 4 — The form

Client only, lands after the migration is pushed.

### Kernel · `src/lib/materials/supplyHouseInvoiceForm.ts`

The file already backs this form with 26 tests. Add:

```ts
export type SupplyDocumentKind = 'invoice' | 'credit'

/** What the database stores, from the kind and what the office typed. Credits go negative here and nowhere else. */
export function signedAmountForSave(kind: SupplyDocumentKind, typed: string): number | null

/** What the box shows for a stored row — always a positive magnitude. */
export function typedAmountFromStored(amount: number): string

/** null when fine, otherwise the sentence to show. */
export function amountProblem(kind: SupplyDocumentKind, typed: string): string | null

/** Every label that follows the document: title, number, date, status caption, open/applied, save button. */
export function documentWords(kind: SupplyDocumentKind): SupplyDocumentWords

/** "Takes $888.10 off what we owe Reece, and $888.10 off J878's parts cost." */
export function creditEffectSentence(args: {
  amountTyped: string
  houseName: string
  jobLabel: string | null
}): string

/** The kind a stored row reads as, for the edit path. */
export function documentKindFromRow(row: { document_kind?: string | null; amount: number }): SupplyDocumentKind
```

`documentKindFromRow` falls back to the sign when the column is absent. With the migration pushed first this should never fire, so treat it as belt and braces — and as the thing that keeps the edit path honest if a row is ever written by hand.

**Pre-flight, already run against prod on 2026-09-15:** all 466 existing rows satisfy the new constraint under the `'invoice'` default, and the lowest amount on file is `$0.00`. Adding a `NOT NULL` column with a constant default does not rewrite the table on this Postgres version, so the `lock_timeout` should never be reached.

### Form · `src/components/SupplyHousesTab.tsx`

- New first section **What the paper is**, above *From the invoice*: a two-way segmented control, Invoice or Credit, with the hint *"A credit memo, a return, or a price correction the house issued."*
- The amount input **keeps `min={0}`** and stays positive. The sign comes only from `signedAmountForSave`. Show `− $` as the adornment when Credit is picked.
- Replace the save guard at the `parseFloat` check with `amountProblem(kind, invoiceAmount)`.
- Send `document_kind` in the insert and update payloads.
- Labels from `documentWords`: *Credit #*, *Credit date*, *Applying it*, *Open — still on the account* / *Applied on*, *Save credit*, and the dialog title *Add credit* / *Edit credit*.
- Render `creditEffectSentence` above the footer whenever Credit is picked.
- The invoice table and the per-house list mark a credit row so it does not read as an invoice.

### PR 4 tests and proof

- Kernel tests for every new function, including a credit with a blank or zero amount, and `documentKindFromRow` with the column missing.
- A render smoke that picking Credit relabels the form and that saving sends a negative.
- **Live test on prod data**, which is the one that matters: enter Taunya's real Reece credit for `888.10` on J878, save it, then check the credit lands on Reece's balance, on the Credits open column, and on J878's parts cost. Then check the aging table still lists every house it did before.

---

## PR 5 — Which invoice a credit credits

Later, and only if the office reaches for it. A nullable self-reference plus showing the pairing on both documents. The prod data argues for it: one live row has both document numbers typed into a single field to hold the pairing.

---

## Open owner decisions

Only the first changes what gets built.

1. **Does an open credit reduce what the aging table says we owe?** Its own column, as drawn, or netted into the buckets. *Recommended: its own column. A credit has a size but not an age, and netting is what makes the sixty-day number lie.*
2. **What does "paid" mean on a credit?** *Recommended: read it as applied, default it to open, label it that way.*
3. **Must a credit always name a job?** *Recommended: allow it with no job, but say on the form that no job gets money back.*
4. **Who may enter one?** *Recommended: the same people who may enter invoices. Narrowing it would put Taunya through someone else to do her own job.*

## Gotchas hit while planning

- The screenshot Taunya sent shows the **pre-v2.3476 form**, so build against the current source, not that image.
- The workarounds already on prod: one Reece row with two document numbers netted into a single amount, one Hughes row zeroed out, one National Wholesale row with the return noted in the purchase-order text and the amount left positive.
- A **card refund is not this feature.** Lowe's, Home Depot and O'Reilly are pay-at-the-counter, have no invoices, and their refunds already arrive in the bank feed. Entering one here would credit the job twice.

## Adjacent, deliberately not in this train

Card refunds allocated to jobs are **added** to job cost rather than taken off, because `summarizeCardChargeAllocations` in `src/lib/jobs/cardChargeAllocationFilter.ts` takes `Math.abs` of every row. 46 such allocations worth about $2,494 are on jobs today (Lowe's $917, O'Reilly $768, Home Depot $436, plus small ones). Different channel, different fix, its own change.
