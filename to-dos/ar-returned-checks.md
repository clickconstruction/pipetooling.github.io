---
name: "Accounts Receivable: a returned check is a case, not a chip"
number: 76
group: ready
status: asked 2026-10-01 · read against 19 months of prod (8 real returns, 2 open today) · second pass planned and drawn 2026-10-01 · owner said build it all · PR 1 v2.4313 (stop the leaks) · PR 2 v2.4320 (the case opens itself, one notice per case) · PR 3 v2.4325 (work the case in Accounts Receivable) · PR 4 v2.4328 (the payer remembers) · PR 5 next on claude/returned-checks-pr5
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
  PR 5 the unconditional waiver waits 7 days for a check to clear.
size: S (PR 1) · M (PR 2, a migration + a cron function) · M (PR 3) · S (PR 4) · M (PR 5)
blocker: None. The owner took the drawn defaults on 2026-10-01 — 7 days for the waiver, the Payment made list hears every return, no fee for now.
opinion: build in order; PR 1 closes the hole Loberg's check fell through on 2026-10-01
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

Mock-up: `ar-returned-checks-before-after.html` — before, after, the second pass and the open calls. The build plan's own pass (plan, two critiques, twelve boards): *Returned checks — #76 mock-up* — https://claude.ai/artifact/9qbiCTmbaXnfPVKhFULoCN

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

## The plan (second pass, 2026-10-01)

The first draft was eight PRs with a four-step lane and a clearing chip on every paid figure. Cut back because returns are rare (eight in nineteen months) and the cost is in the misses: Southern Post's $13,680 for eight days, Peter Garza's $2,700 for fourteen months, Sal Iannotti's $600 now.

1. **PR 1 — stop the leaks** (v2.4313). A returned check cannot be applied, in the window or the database (a trigger on `jobs_ledger_payments`). The count leaves it out. Unlink and remove on a bounced check stops saying the money is available again.
2. **PR 2 — the case opens itself** (v2.4320). `mercury_transaction_ar_returned` grows into the case (opened, source bank / hand / rejected, reason, replaced by, closed with a reason, who and when). A trigger on `mercury_transactions` opens one whenever any writer marks a check failed with a return, so the Banking page's Sync can no longer flip one silently. The rule also takes a bank's return reason with no posting date (Peter Garza, Jul 2025). A rejected, never-posted check opens a case only when a recorded payment matches it and it is not deposited again within 5 days (a nightly sweep). One notice per case, on a job or not, to the Payment made list. A hand mark asks whether the bank returned it or it is not a customer's payment (a $119.56 Texas Mutual check was hidden with Mark returned). Historical returns are backfilled; those with a same-payer, same-amount deposit after them close as replaced.
3. **PR 3 — work the case in Accounts Receivable** (v2.4325). Came back sits on top of To match until the case closes. The pane says what happened, what it costs (the job's balance again, its lien notice) and one next step: take it off every job (read back first, one press), get a new check (*They said…*), or deposit a rejected check again. The new check is suggested when it lands; Settled another way and Not coming close it. The Pipeline says *N checks came back*.
4. **PR 4 — the payer remembers** (v2.4328; the Bill Customer line on the canvas is not built). *2 checks came back · Apr* on the Billed row's pay history and the deposit row.
5. **PR 5 — the unconditional waiver waits for the check to clear**, 7 days after a check posts.

Later, not planned: Stripe disputes and failed bank debits, a returned-check fee line, a check recorded by hand and never deposited.

## How to verify

- Read-only against prod: Southern Post $13,680 (posted 9/18, failed 9/23, taken off #878 on 9/24) and Loberg $5,622.49 (posted 9/28, off #650 on 9/30, failed 10/1) are the two open cases; Dudley and Poolcorp are the two replaced ones.
- A live write needs a deposit that fails. Mercury cannot be made to bounce a check, so PRs 1–3 are walked on a ZZ test job with a `mercury_transactions` row whose status is set to `failed` by a dev (a manual-upload row, removed afterwards), and the webhook is exercised with a replayed payload.
