---
name: "Accounts Receivable: a returned check is a case, not a chip"
number: 76
group: ready
status: asked 2026-10-01 · read against 18 months of prod (7 real returns, 2 open today) · drawn as before / after · not built
summary: >
  The app notices a check the bank returned only while a job still carries it (the email, the
  Needs You card, the Pipeline badge and Unlink and remove, punch list #40). A return that is
  not on a job tells no one, nothing tracks the replacement check, taking the money off is a
  trip to each job, and a bill reads settled the moment a check is applied, days before the
  check can still come back. The proposal: tell the office on every return, take it off the
  job from Accounts Receivable, a Returned lane that holds each bounce as four steps until a
  replacement is matched, a "check clearing" chip that the unconditional lien waiver waits
  for, and the bounce on the customer's pay history.
next: >
  PR 1 tell the office on every return, applied or not (the Needs You card and the webhook's
  notice); PR 2 Take it off the job from Accounts Receivable, with the consequences read back;
  PR 3 the Returned lane (a migration: the case's state and the replacement's link); PR 4 the
  clearing chip and the waiver's wait, after the owner's call; PR 5 the bounce on the pay
  history.
size: S (PR 1) · S–M (PR 2) · M (PR 3, a migration) · M (PR 4) · S (PR 5)
blocker: None for PRs 1–3. PR 4 waits on the owner's call on the clearing window (and counsel's view on holding the unconditional waiver). The returned-check fee is an owner call of its own.
opinion: build PRs 1 and 2 first — small, and they close the hole Loberg's check fell through on 2026-10-01
---

# Accounts Receivable: a returned check is a case, not a chip

## The ask, in the owner's words

> "In jobs stages, please take a look at accounts receivable, is there enough functionality to identify when a check has posted and been reversed? what about if we apply it to an account and then it gets reversed? I think we should add functionality to offer this, what could it look like?" — 2026-10-01

Then, shown the answer and a first drawing: *"save it to the punchlist."*

## What is true today

Mercury reports a returned check by flipping the original deposit to `status = failed` with the bank's words in `raw.reasonForFailure`. Prod, read 2026-10-01: every real return in 18 months took that shape — seven check deposits that posted and then failed (Insufficient funds ×3, Stop payment ×3, Refer to maker ×1), each 3 to 6 days after posting. No separate reversal debit exists in the bank table, so the rule `mercuryBankReturn` (posted, then failed, money in) misses nothing.

| The check | What the app does |
|---|---|
| Posted, then returned, **never on a job** | It leaves To match and reads *returned by the bank* under All. **Nobody is told.** |
| **On a job** when it is returned | Email and push to the office (`mercury-webhook`), the Dashboard's Needs You card, the red *check returned* badge on the Pipeline row, ⚠ on the payment in Edit Job → ③ Payments received, where **Unlink and remove** takes it off the job and marks the deposit returned (punch list #40: v2.3784, v2.3795, v2.3804, v2.3806; the trail line v2.4277). |

## The gaps

1. **A return that is not on a job tells no one.** Loberg's $5,622.49 was applied to #650 on 9/29, taken off on 9/30 and returned by the bank on 10/1 (Stop payment). No payment carried it by then, so no notice, no card, no badge. `mercury_bank_return_notices` holds zero rows: the notice has never fired in prod.
2. **Nothing tracks what happens next.** Dudley's $8,000 was replaced three days later. Poolcorp's $3,125 bounced twice before the third check held. Southern Post's $13,680 has had no replacement for eight days. The app has no "bounced, waiting on a new check" state and no link from a bounced deposit to the one that replaced it.
3. **Taking it off is a trip to each job.** Accounts Receivable shows where a returned deposit was applied and offers no action; a deposit split across three jobs is three visits to Edit Job.
4. **A bill reads settled the moment a check is applied.** 57 of the last 71 check payments (90 days) were applied inside the six days in which every real return happened. `billSettled` (`src/lib/jobs/lienWaiverCell.ts`) is "the payments cover the bill", so the lien waiver flow (v2.4274–v2.4285) offers the **unconditional** waiver on a check that can still come back — and an unconditional waiver holds whether or not the check does.
5. **A check recorded by hand cannot be flagged.** About 77 check payments in the last 90 days carry no bank link.
6. **The customer's record forgets.** The pay-history words on a Billed row (`BilledReliabilityLine`) do not count a bounce.
7. Known and small: `count_mercury_transactions_for_bank_payments` still counts an unmatched failed deposit; the Banking page's 90-day sync writes the status and sends no notice.

## The decision (the first drawing, then the second pass)

Mock-up: `ar-returned-checks-before-after.html` — before, after, the second pass and the open calls.

- **Tell the office on every return.** The same card and the same notice, with words for a check that is not on a job: *The bank returned Loberg's $5,622.49 check (Stop payment). It is not on a job. It was on #650 until 9/30.*
- **Take it off the job from Accounts Receivable.** One press on the returned deposit covers every job it was split across. The consequences are read back first: the job's paid figure, the bill going back to Billed, the lien notice that can now be drafted, a waiver that already went out.
- **The Returned lane.** Each bounce is four steps — *Came back · Off the job · Customer told · Replaced* — open until a replacement deposit is matched or someone says it is not coming.
- **Check clearing.** For a set number of days after a check deposit is applied, the paid figure wears *check clearing · until Oct 6* and the waiver cell reads *Unconditional · when the check clears*.
- **The bounce on the pay history**: *1 check returned · Sep 2026*.

**The second pass — is this the best we can do?** What changed from the first drawing:

- **The lane draws only while a case is open.** Four returns in six months does not earn a standing third list (#74's second pass cut one for the same reason). With nothing open, Accounts Receivable looks as it does today; closed cases stay findable under All by their trail line.
- **"Customer told" is not a new store.** It is the *They said…* payment promise the Pipeline already keeps (`promisedPayDates`): a date the customer named for the new check. The step is done when a promise newer than the bounce exists.
- **"Replaced" is suggested, not typed.** A later deposit from the same payer for the same amount is offered as the replacement (it would have paired Dudley's and Poolcorp's). Applying that deposit to the same bill closes the case by itself.
- **No auto-removal.** The bank's word still never takes money off a job without a person: v2.3784's rule stands. The lane only makes the press one step away.
- **Cut:** a customer-facing "your check was returned" email (the office calls; the words are theirs), and a returned-checks report (the lane and All are the report at this volume).

## Open calls (the owner's)

1. **The clearing window.** Hold the unconditional waiver until a check has cleared — for how many days? Drawn at 7 (every real return came back inside 6). The cost: a GC who wants the unconditional the day they pay waits a week. Counsel's view on this one.
2. **A returned-check fee.** Offer a fee line on the bill when a check bounces? Texas caps the fee; the amount has not been verified here.
3. **Who is told about a return that is not on a job** — the *Payment made* stream's people (as today for one on a job), or everyone who can open Accounts Receivable.

## Where it plugs in

- The rule and the words: `supabase/functions/_shared/bankReturnedDeposits.ts` (`mercuryBankReturn`, `bankReturnNoticeLine`, `buildBankReturnNoticeEmail`), re-exported by `src/lib/jobs/bankReturnedDeposits.ts`. The webhook: `supabase/functions/mercury-webhook` (`notifyBankReturn`, the once-ledger `mercury_bank_return_notices`).
- The card and the badge: `src/hooks/useBankReturnedPaymentsNudge.ts`, `src/lib/dashboardNeedsYou.ts` (`returned-check`), `JobsStagesTab` (`bankReturnedByJob`).
- Accounts Receivable: `src/components/jobs/BankPaymentsModal.tsx` (the list engine drops a returned deposit from To match; the right pane's applied breakdown from `list_ar_allocations_for_mercury_transaction`), `src/components/jobs/ar/ArDepositRow.tsx`, `ArDepositHeader.tsx`, `src/lib/jobs/arDepositRowState.ts`, `arDepositTrail.ts` (`list_ar_deposit_trails`). Map: `docs/AR_PAYMENT_MODALS_ARCHITECTURE.md`.
- Taking it off: `remove_jobs_ledger_payment_and_reconcile` (`20260924020000`) — the reconcile, the `removed` event with `bank_failed: <reason>`, the upsert into `mercury_transaction_ar_returned`. PR 2 calls it once per payment the deposit carries.
- The case's state (new in PR 3): `mercury_transaction_ar_returned` holds only `returned`, `updated_at`, `updated_by`. The lane needs the replacement's deposit id and a closed reason with who and when — new columns there or a small table beside it.
- Settled and clearing (PR 4): `billSettled` and `lienWaiverCellForBill` in `src/lib/jobs/lienWaiverCell.ts`, `pickLienWaiverForBill` in `src/lib/jobsDocuments/lienWaiverRelease.ts`, the GC's room (`_shared/portalWaivers.ts`, which already says *when your check clears*).
- The pay history (PR 5): `BilledReliabilityLine` and its kernel.

## The plan

1. **PR 1 — tell the office on every return.** The nudge reads returned deposits with no live payment too (a window of days, dismissed per deposit); the webhook's notice fires for them with the not-on-a-job words; `count_mercury_transactions_for_bank_payments` stops counting a failed deposit. Client, one function redeploy, one small migration for the count.
2. **PR 2 — Take it off the job from Accounts Receivable.** The returned deposit's pane lists each payment it carries with a kernel-built read-back and one button; the Pipeline badge and the card re-read after it.
3. **PR 3 — the Returned lane.** The migration for the case's state; the lane tab while a case is open; the four steps; the replacement suggestion; *Not coming* with a reason.
4. **PR 4 — check clearing** (after the owner's call): a kernel beside `billSettled`, the chip wherever a paid figure shows, the waiver cell's wait, the guide.
5. **PR 5 — the bounce on the pay history.**

Later, not planned: a returned deposit that matches a hand-recorded check by customer and amount offers to link the two (gap 5).

## How to verify

- Read-only against prod: Southern Post $13,680 (posted 9/18, failed 9/23, taken off #878 on 9/24) and Loberg $5,622.49 (posted 9/28, off #650 on 9/30, failed 10/1) are the two open cases; Dudley and Poolcorp are the two replaced ones.
- A live write needs a deposit that fails. Mercury cannot be made to bounce a check, so PRs 1–3 are walked on a ZZ test job with a `mercury_transactions` row whose status is set to `failed` by a dev (a manual-upload row, removed afterwards), and the webhook is exercised with a replayed payload.
