# Money that arrives with no bill to match (tips, overpayments, remainders)

Status: **PR 1 SHIPPED 2026-09-16 (v2.3496 + v2.3499) and live-tested on the real $50 · PR 2 not started · 2 small decisions open**

Mock-up: *Where the tip goes* — https://claude.ai/artifact/BhvMmduuHGaUExmYJcLxTP

## What shipped, and what is left

**PR 1 is done.** v2.3496 (PR #3244) built the offer strip, the `arTipOffer` kernel and the `record_job_tip_from_deposit` RPC; the migration is pushed (drift clean **589/589**). v2.3499 (PR #3246) regenerated types and fixed the one bug the live pass found — the strip stayed on screen until a reload, because the tip path refreshed the caller's jobs but not the modal's own deposit list.

**Live-tested on the real money, 2026-09-16.** Elaine Giesber's $50 is recorded on job 960: revenue 1805.70 → **1855.70**, `payments_made` matching, a job-level payment dated 2026-09-11 noted *"Tip — paid over the bills on this deposit"*, job still `paid`. The deposit's remainder is exactly **0.0000** and it has left *To match*. **No invoice on 960 reads overpaid** — each still shows paid equal to its amount, which is the J728 shape avoided. Three activity rows were written: `fixture_added` *"Specific work added: Tip"*, `field_edited` *"Job total changed to $1,855.70"* (a jobs_ledger trigger, one more than the two the plan predicted), and `payment_added`.

**Left:**
- **PR 2** — the reason-coded close-out for money that genuinely belongs to no job (bank interest, a vendor refund, an owner deposit). Not started. Design notes below under *Recommended shape*.
- Two small decisions below: whether a tip line should print on a customer's bill, and PR 2's reason list. Controller's exclusion from Accounts Receivable is noted there too.
- Taunya's deposit is still **unlabeled in Banking** — labelling it *Income* books the $1,855.70 in the P&L and is independent of everything here.

---

## The ask, in Taunya's words

> "I need to be able to assign access payments (tips) to the office J000"

("access" is dictation for *excess*.) The trigger is live on prod right now: Accounts Receivable shows **1 deposit to match · $50.00 unapplied** — Elaine Giesber, `checkDeposit` $1,855.70 posted 2026-09-11, with three bills applied ($650.00 + $483.20 + $672.50 = $1,805.70). The customer paid $50 over. Nothing in the app will take that $50, so the deposit nags forever.

---

## Short answer: no, J000 is not the right destination — and the app will not let her do it anyway

### It cannot be done today

`apply_mercury_bank_payment_allocations` ([`supabase/migrations/20260813234538_ar_stripe_hosted_allocations.sql:218-250`](../../supabase/migrations/20260813234538_ar_stripe_hosted_allocations.sql)) rejects a `job_id` allocation twice over for J000:

- `IF v_job.status <> 'billed' THEN RETURN 'Job must be in Billed status'` — J000's status is **paid**.
- `v_rem := revenue - payments_made` then `IF v_amt > v_rem + 0.0001 THEN RETURN 'Amount exceeds remaining on job'` — J000's revenue is **$0.00**, so its headroom is $0.

To make the literal ask work, someone would have to hold J000 in `billed` status forever and give it fake revenue that grows with every tip. That is a standing lie in the ledger.

### It would be wrong even if it worked

J000 is not a spare placeholder. It is the **canonical Office job**, and it is load-bearing:

| Fact about J000 | Value |
|---|---|
| Identity | `hcp_number` `000`, "Click Office / Office", id `e9c41b08-2774-4c97-8763-752a36d2dbd1` |
| Configured as | `app_settings.overhead_office_job_ledger_id_v1` (plus RPC `get_jobs_ledger_office()` as a fallback resolver) |
| Clock sessions on it | 785 |
| Hours on it | 3,195.3, from 2026-03-17 to 2026-09-15 |
| Revenue / payments today | $0.00 / none |

It is the anchor for office clock time, the standing office schedule blocks (`ensure_office_schedule_blocks`), overhead labor math, and Moneyfill's `→ Office` button. It is an **expense absorber**. Several surfaces exclude it on purpose: Crew P&L never credits it, and the paid-profit chart drops it explicitly because its −$96k stretched the axes flat.

It is also **below the Job Summary number floor** (`DEFAULT_MIN_HCP_EXCLUSIVE = 500`, [`src/lib/jobSummaryHcpFilter.ts:26`](../../src/lib/jobSummaryHcpFilter.ts)). Money parked on `000` is invisible on Job Summary by default.

### And it would not book the income anyway

Nothing in this app treats a payment as revenue. Job Summary's revenue is contract × percent complete ([`src/lib/jobs/jobSummaryLedgerView.ts:424-430`](../../src/lib/jobs/jobSummaryLedgerView.ts)); Crew P&L credits `job.revenue`. `payments_made` appears in neither. A tip recorded only as a payment is **collected cash that is income nowhere**.

Income reaches the P&L on the **Banking** side, through the accounting label. Last 12 months of deposits:

| Label | Deposits | Dollars |
|---|---|---|
| Internal Transfers | 1,003 | $4,059,556.52 |
| **Income** | **392** | **$1,701,841.13** |
| (unlabeled) | 76 | $278,975.29 |

Taunya's Elaine Giesber deposit is currently **unlabeled**, so right now the whole $1,855.70 — not just the $50 — is missing from the P&L. That is fixable today with no code (see "Do this now").

---

## What the app already does with a tip, and why it is the better shape

There is already a tip convention, and it is the opposite of J000: **a tip becomes a line on the bill of the job that earned it.**

[`src/lib/customers/hcpTipsSweep.ts`](../../src/lib/customers/hcpTipsSweep.ts) — `TIP_LINE_NAME = 'Tip (HCP)'`. For each HouseCall Pro row with a tip, [`BackfillHcpPaymentsModal.tsx:242-250`](../../src/components/customers/BackfillHcpPaymentsModal.tsx) inserts a `jobs_ledger_fixtures` line at the tip amount **and** a matching `jobs_ledger_payments` row.

Nine of these are on prod, all noted "Tip recorded in HouseCall Pro":

| Job | Date | Tip |
|---|---|---|
| J728 | 2026-04-21 | $73.00 |
| J617 | 2026-03-18 | $28.00 |
| J584 | 2026-02-23 | $10.00 |
| J561 | 2026-02-05 | $163.80 |
| J382 | 2025-11-24 | $23.75 |
| J357 | 2025-11-12 | $109.50 |
| J343 | 2025-11-02 | $37.00 |
| J284 | 2025-09-27 | $40.25 |
| J252 | 2025-09-13 | $50.93 |

Verified: the line raises the job's revenue. J728 reads revenue $803.00 against a fixtures sum of $803.00 — the $730 of work plus the $73 tip. The tip is real revenue, on the right job, visible to Job Summary and Crew P&L, and attributable to the crew who earned it.

**One rough edge to avoid repeating.** On eight of the nine, the bill was resized to include the tip and everything agrees — J561 reads revenue $1,801.80, invoice $1,801.80, paid $1,801.80. **J728 is the outlier**: revenue went to $803.00 but the invoice stayed at $730.00, and $803.00 was applied against it, so that one bill reads overpaid by exactly the tip.

All nine tip payments carry an `invoice_id`, even though today's sweep code inserts the payment with none ([`BackfillHcpPaymentsModal.tsx:248-255`](../../src/components/customers/BackfillHcpPaymentsModal.tsx)) — so something linked them afterwards, most likely the payment-to-bill matching flow. Cause unconfirmed; it does not need to be resolved to build PR 1, but PR 1 should record the tip payment at **job level** (`invoice_id` NULL) and not resize any existing bill, which avoids the J728 shape entirely.

### The real gap

The convention exists but **only the HouseCall Pro importer can use it**. There is no door in Accounts Receivable for a human to say "this $50 is a tip on J960." That is the whole of Taunya's problem.

---

## Scale: rare, but the machinery around it is loud

Read-only against prod, 2026-09-15:

- Deposits in the last 12 months that are **partly applied with a remainder left: 1**. It is this $50.
- Deposits never touched: 1,473. Fully applied: 125.
- Invoices paid more than their amount: 7, $15,328.90 excess. Five of the seven are **exactly twice the bill** — those look like duplicate payments, a separate data question, not tips. The other two are J857 and J728's $73 tip.
- Jobs paid more than revenue: 5, $1,820.90 — same duplicate-looking pattern.
- Tips ever passed to a technician through `person_offsets`: **0**.

So this is a small, real, recurring case. The fix should be small too. It is worth doing because a single unmatched deposit nags on the Dashboard banner, the pinned quick row, Quickfill, and the `ar-deposits` Needs You card until it is resolved, and the only two existing exits are wrong: apply it to a bill (there is no bill) or mark it **returned** (a claim that the money bounced, which is false).

---

## Recommended shape

**PR 1 — "This is a tip" in Accounts Receivable.** Extend the existing convention to a human door instead of inventing a new destination.

When a deposit has a remainder and the payer is matched to a job, offer a third line kind beside *Billed line* and *Payment received*: **Tip / extra**. Picking it and naming the job:

1. inserts a `Tip` line item on that job (same shape as `Tip (HCP)`, named so both read alike),
2. raises the job's revenue by the tip,
3. records a **job-level** payment (`invoice_id` NULL) for the remainder against the deposit.

**The door is an offer strip, not a toggle** (mock-up approved 2026-09-15). The strip appears in the allocations area only while a remainder is left, names the job and the exact difference, and carries one primary button — *Add a $50.00 Tip line* — beside a quieter *Pick another job*. The tip then lists in the Applied breakdown alongside the bills, the meter completes, and the footer sentence gains one clause. The existing *Billed line* / *Payment received* toggle is untouched.

**Two controls fall away** (owner's simplification, 2026-09-15: *"add the option to add a line item called tip to a job to make up for the difference"*). The tip is by definition the difference, so there is no amount to type — default it to the whole remainder and let it be edited only if someone needs to. And when every bill the deposit paid sits on one job, as in Taunya's case where all three are job 960, there is nothing to pick either. The common case is one button: **Add a $50.00 Tip line to 960**. The job picker appears only when a deposit spans more than one job.

**Do not introduce a new `line_kind`.** `jobs_ledger_fixtures.line_kind` is NOT NULL, defaults to `work`, and its CHECK admits only `work` and `discount`. Thirty-six files branch on it, so a third kind risks tips being dropped from bills, Stripe items and revenue by any reader that tests for `work`. The tip line is an ordinary `work` row named `Tip`, exactly as the HCP sweep writes it. If tips ever need to be reported on separately, solve that then, on the name or a dedicated column.

The deposit's `remaining_available` goes to zero and it leaves the queue on its own — no new exit rule, no sidecar, no flag. The money becomes revenue on the job that earned it and shows up in Job Summary and Crew P&L.

**PR 2 — a reason for money that is genuinely not a job's.** Bank interest, a vendor refund, an owner deposit: these are not tips and have no job. Model it on the existing precedent, `mercury_transaction_ar_returned` + `set_mercury_transaction_ar_returned` — a per-deposit sidecar recording a **reason**, who, and when, which drops the row from the queue while Banking's label carries the accounting. Deliberately second: it is a "make the nag go away" button, so it needs the tip case taken off it first, and it should name the reason on the row rather than hide it.

### Rejected, and why

| Option | Why not |
|---|---|
| Allocate to J000 | Blocked by the RPC twice; needs fake revenue and a permanent `billed` status; pollutes the overhead anchor; invisible under the number floor; books no income |
| A new "Tips" job | Same problems as J000 minus the overhead pollution, and it detaches the tip from the crew who earned it |
| Mark the deposit returned | Asserts the money bounced. False |
| Agreed write-down on the bill | `apply_agreed_write_down_to_billed_invoice` refuses `p_new_amount < v_applied` — the path cannot absorb money received beyond a bill, by design |
| Leave it | The deposit nags on four surfaces forever, and the income stays unbooked |

---

## Where it plugs in

### The write path

**PR 1 needs its own RPC — do not widen `apply_mercury_bank_payment_allocations`.** That function is 378 lines of layered guards, and both of its job-branch guards legitimately block a tip. Taunya's own case proves it: job 960 is *Elaine Giesber-Installations Pcv & Lavatory Sink*, status **paid**, revenue $1,805.70, `payments_made` $1,805.70, headroom **$0**. A tip is not a payment against a bill, so it should not have to pretend to be one.

Propose instead a narrow `record_job_tip_from_deposit(p_mercury_transaction_id, p_job_id, p_amount, p_note)` doing all three writes in one transaction — insert the tip line, raise `jobs_ledger.revenue`, insert the job-level payment carrying `mercury_transaction_id` — capped at the deposit's remainder by the same `abs(amount) - Σ payments` rule. The existing allocation RPC stays untouched.

**Copy `apply_job_discount` almost line for line.** It is the same operation with the opposite sign and it already ships: gate on `auth.uid()` plus roles `dev · master_technician · assistant · controller` and `can_read_job_activity(job)`, take `max(sequence_order) + 1`, insert the fixture, then **recompute** revenue as *named rows × price + un-voided hazmat fees* and write it to `jobs_ledger.revenue` (recompute, never `revenue + amount`), log a `job_activity_events` row with `financial: true`, and return `{ok, fixture_id, revenue}`. The tip version differs in three places: `line_unit_price` is positive, `line_kind` stays at its `work` default, and one extra insert adds the `jobs_ledger_payments` row with `mercury_transaction_id` set. Atomicity is the reason this is an RPC rather than three client writes: a half-failure would leave a tip line with no payment, or a payment with no line, and the HCP sweep's own try/catch-and-report shape shows what that costs.

Worth knowing: job 960 is a **click-number** job (`hcp_number` empty). Per the v2.2893 note those pass `jobSummaryHcpFilter` regardless of the floor, so the tip will be visible on Job Summary. A tip on a low-numbered HCP job would not be.

### Existing surfaces to change or reuse

- `src/components/jobs/BankPaymentsModal.tsx` — the modal; the line-kind pill toggle is at `:1762-1793`, submit at `:1059-1061`, the ⋯ menu that already holds Mark returned at `:1205-1208`.
- `src/lib/jobs/arApplySentence.ts:70-77` — the footer sentence that today ends "$50.00 of the deposit stays unapplied." It must learn to say what the tip will do.
- `src/lib/jobs/arAllocationProgress.ts`, `arDepositRowState.ts` — the remaining meter and the row state; a tip line counts toward `allocatedNow`.
- `src/lib/customers/hcpTipsSweep.ts` — `TIP_LINE_NAME`; share the constant so hand-entered and imported tips read alike and the sweep's `name ilike 'tip%'` re-run detection keeps working.
- `src/lib/jobs/arDepositCustomerMatch.ts` — already names the payer; it supplies the candidate job.

New in PR 2 only: one sidecar table + one RPC, modelled line for line on `mercury_transaction_ar_returned` / `set_mercury_transaction_ar_returned` (baseline), plus the `> 0.0005` visibility clause in **both** `list_mercury_transactions_for_bank_payments` and `count_mercury_transactions_for_bank_payments`.

Docs and guides that ship with it: a `docs/recent-features/v2.NNNN.md` fragment, a `src/content/releaseNotes/v2.NNNN.ts` note, a `docs/migrations/` fragment for PR 2's migration, and an update to the help guide that covers matching deposits.

---

## Build plan for PR 1 (code)

One PR: one migration, one kernel, one small component, two one-line edits. No table changes, no new column, no new `line_kind`, and — see below — no new activity event type either.

### What the database already does for us

Tracing the triggers on both tables settles how small the RPC can be. Inserting the tip line and the payment sets off, with no help from us:

| Trigger | On | What it does for the tip |
|---|---|---|
| `jobs_ledger_fixtures_to_activity_ins` | fixtures | Writes a `fixture_added` event reading **"Specific work added: Tip"**. It skips only `line_kind = 'discount'`, so a `work` row is covered. |
| `jobs_ledger_payments_recompute_pm` | payments | Recomputes `jobs_ledger.payments_made` from the rows. Never write that column by hand. |
| `jobs_ledger_payments_to_activity_ins` | payments | Writes the `payment_added` event. |
| `read_only_block_stmt` | both | Blocks training-mode users even through a SECURITY DEFINER RPC. Nothing to add. |
| `enqueue_payment_made_email_ai` | payments | Queues a `paid_job_email_queue` row, kind `payment`. **Recipients are three staff user ids, not the customer** — so a tip sends an internal notice, not a message to Elaine. Expected, but say so in the release note. |

Two consequences. **Do not write a custom `tip_added` event** — the trigger pair already records both halves, and skipping it means `src/lib/jobActivityEvent.ts` is not touched at all. That file's `eventRenderMeta` looks the type up with no fallback, so a new type there would have meant editing the union, the render map and its test; all of that disappears. And **do not touch `payments_made`** anywhere.

The job's `status` also needs no attention: a tip raises revenue and payments by the same amount, so coverage cannot change. Leave it alone rather than copying the allocation RPC's status flip.

### The migration

`supabase/migrations/<stamp>_record_job_tip_from_deposit.sql`, numbered from `origin/main`'s newest file, registered with `npm run claim -- --migration <file>`, opening with `SET lock_timeout = '3s';`.

It creates one function, `record_job_tip_from_deposit(p_mercury_transaction_id uuid, p_job_id uuid, p_amount numeric, p_note text default null) returns jsonb`, SECURITY DEFINER, `search_path = public`. Copy `apply_job_discount` for the body and `apply_mercury_bank_payment_allocations` for the gates:

1. `auth.uid()` not null, else raise.
2. Role in `dev · master_technician · assistant · primary` — **the allocation RPC's set, not the discount RPC's**, so nobody gains a capability they lack in Accounts Receivable today. Controller is deliberately excluded because controller cannot apply a deposit today either; see the open question below.
3. Job access: the same six-way OR the allocation RPC uses (`master_user_id` = caller, `is_dev()`, role `primary`, either direction of `master_assistants`, `assistants_share_master`). A tip must not reach a job the caller could not already allocate to.
4. `SELECT … FROM mercury_transactions WHERE id = p_mercury_transaction_id FOR UPDATE` — the lock matters, two people adding a tip at once would otherwise both pass the cap check.
5. Cap: `v_cap := abs(mt.amount) - coalesce((select sum(amount) from jobs_ledger_payments where mercury_transaction_id = p_mercury_transaction_id), 0)`. Require `p_amount > 0` and `p_amount <= v_cap + 0.0001`, matching the allocation RPC's tolerance.
6. Insert the fixture: `name 'Tip'`, `count 1`, `sequence_order = max+1`, `line_unit_price = +p_amount`, `invoice_id null`, `line_kind` left at its `work` default.
7. **Recompute** revenue exactly as `apply_job_discount` does — named rows × price plus un-voided hazmat fees — and write it. Never `revenue + p_amount`; the recompute is what keeps the column honest.
8. Insert the payment: `job_id`, `amount`, `sequence_order = max+1`, `paid_on` = the deposit's posted Chicago day, `invoice_id null`, `payment_type`, `reference_number = mt.mercury_id`, `mercury_transaction_id`, and a note naming it a tip.
9. Return `{ok, fixture_id, payment_id, revenue, remaining_after}`.

Docs fragment: `docs/migrations/<stamp>_record_job_tip_from_deposit.md`.

### The client

- **`src/lib/jobs/arTipOffer.ts`** (new, pure, the only place the rule lives). Given the deposit's `remaining_available`, the rows from `list_ar_allocations_for_mercury_transaction`, and the matched payer, it returns whether to offer, the single job when every applied row shares one `job_id`, the amount (the whole remainder), the button label and the strip's sentence. It returns no offer when the remainder is at or under `AR_BANK_REMAINING_EPS`, when the deposit is flagged returned, or when nothing has been applied yet — a deposit nobody has touched is not a tip, it is unmatched.
- **`src/components/jobs/ar/ArTipOffer.tsx`** (new, presentational, beside the existing `ArDepositHeader.tsx`). Renders the strip: the sentence, *Pick another job*, and the primary button. Theme tokens only.
- **`src/components/jobs/BankPaymentsModal.tsx`**. Render the strip above the Allocations label. Its handler calls the RPC, then `await onApplied()` to refresh the deposit and its breakdown, and shows a toast. Wrap the press in `useConfirmDialog` (`src/contexts/ConfirmDialogContext.tsx`), the way Quickfill's Reject does (v2.3242), because undoing means removing the payment *and* deleting the Tip line in two different places. Handle a missing RPC with `isMissingRpcError` from `src/lib/customers/customersListBundle.ts` and say plainly that the change has not reached the database yet.
- **`src/lib/jobs/arApplySentence.ts`**. One clause on the waiting text: *"pick a bill, link a recorded payment, or add it as a tip."* Its existing test needs the new expectation.

### Tests

Kernel tests on `arTipOffer` carry the behavior: one job across all rows offers that job; two jobs offers the picker instead; a zero or sub-epsilon remainder offers nothing; an untouched deposit offers nothing; a returned deposit offers nothing; the amount always equals the remainder. Update `arApplySentence.test.ts` for the new clause. A render smoke on the modal is optional — the kernel is where the rule lives.

### Order of work, and the deploy window

Client and migration ship in the same PR. After merge, run `bash scripts/db-push.sh`, then `npm run gen-types:linked` as its own small commit. Between the merge and the push the button exists and the function does not, which is why the `isMissingRpcError` branch is not optional. The window is minutes and the action is rare, so this is acceptable rather than worth gating behind a flag.

Also ship with the PR: the `docs/recent-features/v2.NNNN.md` fragment, the matching `src/content/releaseNotes/v2.NNNN.ts`, and an update to the help guide covering deposit matching. Claim the version with `npm run claim` right before writing those.

### Small choices left inside the build

- **Controller.** Excluded above because controller cannot apply a deposit today. If Robert expects the controller to work Accounts Receivable at all, that is a separate and larger role change, not something to slip in here.
- **The tip's wording on the line.** `Tip` reads well beside the imported `Tip (HCP)`. Keeping them distinguishable is useful; making them identical is also defensible.
- **The mock-up's second panel** shows the state after the button is pressed, since the button applies immediately rather than staging an allocation line. Its footer sentence should read as applied rather than pending.

---

## How to verify

Live, signed in, on the real deposit — but **do not apply anything on a real deposit until the owner has answered decision 1 below**, because the tip line changes a real job's revenue.

1. Open Jobs → Accounts Receivable. The Elaine Giesber deposit reads *Remaining $50.00*.
2. Add a line, pick **Tip / extra**, choose job 960 (*Elaine Giesber-Installations Pcv & Lavatory Sink*).
3. The footer sentence names the tip and the job; the meter reads *Fully allocated ✓*.
4. Apply. Job 960 gains a `Tip` line; its revenue rises $1,805.70 → $1,855.70; a job-level payment appears in Edit Job → Payments received with no bill attached, and the job stays `paid`.
5. The deposit leaves the To-match list; the Dashboard banner and the `ar-deposits` Needs You card drop by one.
6. Job Summary shows job 960's revenue up $50 with no matching cost, so its margin rises. That is correct and expected for a tip, and matches how the nine HCP tips already read.
7. Re-run nothing on the HCP sweep — confirm its `name ilike 'tip%'` detection still reads the hand-entered line as already present.

Unit coverage belongs in the kernels: the tip planner, the footer sentence, and the remaining meter.

---

## Open decisions — these are Robert's, not ours

1. ~~**Does a tip belong to the company or to the technician who earned it?**~~ **ANSWERED 2026-09-15: a tip is company revenue**, matching how all nine HCP tips are already recorded and the fact that no tip has ever reached a person through `person_offsets`. The tip line is revenue on the job, not a pass-through. PR 1 is unblocked.
2. **Should a tip line appear on the customer's bill?** The HCP sweep puts it in `jobs_ledger_fixtures`, which is what bills list. A tip the customer already chose to pay probably should not be re-printed on a bill they may see again. This may mean a tip line that is revenue but excluded from bill presentation.
3. **PR 2's reason list.** Which reasons the office may pick, and whether a closed-out remainder still needs an accounting label before it can be dismissed.

---

## Do this now, with no code

Taunya's deposit is **unlabeled** in Banking, so the whole $1,855.70 is missing from the P&L. Labeling it **Income** on Banking → Accounting books the money, including the $50, today. That is independent of everything above and does not resolve the AR nag.

---

## Noticed while investigating, unrelated to this to-do

`count_mercury_transactions_for_bank_payments` filters `AND t.duplicate_of_transaction_id is null`; `list_mercury_transactions_for_bank_payments` has no such clause. Where duplicate transactions exist, the "To match · N" badge and the listed rows can disagree. Worth its own one-line fix.
