---
name: "Returned checks: the pieces left after the train"
number: 76
group: close
status: >
  The returned-check train shipped 2026-10-01 — v2.4313 (a check that came back cannot pay a bill) ·
  v2.4320 (the case opens itself, one notice per case) · v2.4325 (work the case in Accounts Receivable) ·
  v2.4328 (the payer remembers) · v2.4330 (the unconditional waits for a check to clear) · v2.4333
  (Bill Customer's line, the clears-about note). All four pieces the plan set aside have shipped: (4) as
  punch list #83 row 5 (v2.4564), (3) as v2.4902, (1) as v2.4950 (Stripe disputes and failed bank
  debits; `check:edge-drift` read all 146 functions current at 20:35 UTC on 2026-10-09, so stripe-webhook
  and ar-returned-checks are deployed) and (2) as v2.5033 (*Add the $30 fee to bill N*, migration
  20261010003000 on prod 2026-10-09) with v2.5091 (the fee survives the revenue rewrites, migration
  20261010023000 on prod 2026-10-09, types #5196) and v2.5102 (the Bill tab no longer reads the fee as covering
  the next unbilled line, client only). Left: two live steps for (1), the office's and the owner's.
summary: >
  Every check the bank sends back is now a case on top of To match, told to the office once,
  taken off every job in one press, closed when the new check lands. Four things were set aside
  on purpose and kept here so they were not lost; all four have shipped, and two live steps for the
  Stripe cases are what keeps the card open.
next: >
  Ready to pick up on any computer where the owner's Chrome is signed in to the app and to Stripe:
  § Pick up below is the whole brief. Step 1, subscribe the webhook endpoint (test and live) to
  `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed` and
  `payment_intent.payment_failed`. Step 2, one test-mode dispute on a ZZ TEST Stripe bill (the case
  opens, the notice goes out, Put the bill back). Delete this card once both are done.
flagged: true
size: XS (two live steps, no code; a docs-only PR at the end)
blocker: A signed-in Stripe Dashboard in the Chrome the extension drives — the 2026-11-09 pick-up met the Dashboard's sign-in page and entered nothing; a Dashboard setting and one test dispute; the brief is written, nothing is left to decide.
ver: v2.4902 · 4950 · 5033 · 5091 · 5102
opinion: your call — the code is done; the two live steps are the office's and the owner's.
mockup: not required — each piece copies the case and its words, which exist
---

# Returned checks: the pieces left after the train

The plan, the two critiques and the twelve boards: *Returned checks — #76 mock-up* — https://claude.ai/artifact/9qbiCTmbaXnfPVKhFULoCN. The first drawing stays beside this card (`ar-returned-checks-before-after.html`). The release notes and `docs/recent-features/` v2.4313–v2.4333 carry what shipped. The combined-replacement follow-up — the new check inside a bigger payment, found live 2026-10-26 on Southern Post's $13,680 — shipped as v2.5891; its drawing is `ar-returned-checks-combined-replacement.html`.

## The pieces

1. **Stripe chargebacks and failed bank debits.** Shipped v2.4950: `stripe-webhook` opens a case on the bill (`ar_stripe_cases`, `record_ar_stripe_case`). It shows as *card disputed* until Stripe decides, *dispute lost* with **Put the bill back** (`put_back_lost_dispute_bill`) once the customer wins, or *bank payment failed* for an ACH debit. v2.6775 (migration `20261109023000`) fills the case's payment on a later dispute event when the first one beat the `invoice.paid` payment row, so the lost case draws its press.
2. **A returned-check fee.** Shipped v2.5033: *Add the $30 fee to bill N* on a Came back case (`add_ar_return_case_fee`, `list_ar_return_case_fees`, the bill's `fee_lines`, the case's `fee_*` columns; the kernel `src/lib/jobs/arReturnCaseFee.ts`). v2.5091 keeps the fee in the job's total when Edit Job, Add discount, a tip or Collect Payment rewrites the revenue (`job_rider_fees`). v2.5102 keeps it off the ② waterfall: the fee is its bill's own line, so it covers no unbilled line (`dollarCoverageForSegments`). Set aside on purpose: a Stripe bill takes no fee, a check that paid no bill by name gets no press, § 3.506(c) is on the hover and not checked, and the GC billing job's revenue reset (`gc_owner_billing_revenue`) still drops a fee — the GC crew's change.
   - **The cap**: $30 is a ceiling — Tex. Bus. & Com. Code § 3.506(b), *"may charge the drawer or indorser a maximum processing fee of $30"*, as amended by H.B. 2793 (82nd Leg., R.S., ch. 333, eff. Sept. 1, 2011; enrolled text at capitol.texas.gov/tlodocs/82R/billtext/html/HB02793F.htm); no later amendment to (b) found (read 2026-10-09).
3. **A check recorded by hand and never deposited.** Shipped v2.4902: an *unbanked* case under Came back (`ar_unbanked_check_cases`, `open_ar_unbanked_check_cases`, ten days, floor Jul 1 2026); eight opened quietly on the push.
4. **The older customer-release queue.** Shipped as punch list #83 row 5 (v2.4564): the Dashboard queue and the Bill Customer strip wait for a check to clear. A release with no bill-line snapshot still reads the job's total paid on the strip; none of the live conditional releases is one (2026-10-08).

## Where it plugs in

- The case: `mercury_transaction_ar_returned` (source bank · hand · rejected), `list_ar_return_cases`, `open_ar_rejected_check_cases` (20261001230000); the pane `src/components/jobs/ar/ArReturnCasePane.tsx`, kernel `src/lib/jobs/arReturnCase.ts`; the notice `supabase/functions/_shared/arReturnCaseNotify.ts`.
- Clearing: `src/lib/jobs/checkClearing.ts`.

## Where it stands

2026-11-08: the owner asked for the two live steps to run from another computer, so the brief below was written onto the card instead of walking them here. Nothing was pressed in Stripe or in the app; the webhook endpoint still listens for the events the Ops line of `docs/EDGE_FUNCTIONS.md` named before v2.4950, and no dispute case has ever opened on prod.

2026-11-09: picked up in the Chrome the owner handed the session. The Dashboard answered `/test/webhooks` with its sign-in page (email, password, Google, Passkey, SSO), and the one Chrome the extension reaches carried no Stripe session (the app's own session came from the pane magic link, not the owner's sign-in). Per the rule above nothing was entered, and both steps are held: step 1 (the events, both modes) and step 2 (the test-mode dispute) wait for a Chrome window that is signed in to the Stripe Dashboard, where the session shows the endpoint's event list before saving and asks the owner once per endpoint. The brief below stands unchanged.

## Pick up

The two steps, for a session on a computer where the owner's Chrome is signed in to the app (as the owner) and to the Stripe Dashboard. Use Claude in Chrome in a tab of your own; never act in another tab. Drop a session card in `.claude/sessions/active/` (`docs/SESSIONS.md`) and remove it when done. Screenshots to your scratchpad, the key ones named in the report and on this card.

**The rules.** On a test account or reversible, every press. In the Dashboard touch only the webhook endpoint's event list (adding events is reversible) and the test-mode dispute on the ZZ TEST bill; never a live-mode charge, refund, payout, customer or setting. If the Dashboard asks for a sign-in, a code or a password, stop that step, enter nothing, and say so. In the app, write only on ZZ TEST rows whose customer contact is the owner's own number and email, so what the bill sends reaches him and nobody else. The repo is public: no customer or private name, no prod figure, no Stripe id in anything committed.

**Step 1 — the events (Dashboard, both modes).** Developers → Webhooks. The endpoint is the one whose URL ends in `/functions/v1/stripe-webhook` (the Ops line of `stripe-webhook` in `docs/EDGE_FUNCTIONS.md`). Test mode and live mode keep separate endpoint lists, so the step is done twice: open the endpoint, screenshot its events as they are, press the events' edit control, add `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed` and `payment_intent.payment_failed`, save, screenshot the list again. Change nothing else on the endpoint: not its URL, its API version, its description or its signing secret. If the endpoint is not visible to the owner's Stripe user, stop here, do step 2 as far as it goes without the events (the bill and the payment; the case cannot open), and say so. If the before list reads other events than the Ops line names, amend that line in the same PR.

**Step 2 — one dispute (test mode only).**

1. In the app, a ZZ TEST job whose customer contact is the owner's own number and email. Open Bill Customer, the Stripe tab, and switch the mode toggle to **test** (dev users only; the per-browser pref `pipetooling-billing-stripe-mode-pref`, see *Stripe integration (test/live mode)* in `docs/BILLING_FLOWS.md`). Create the bill. The row carries `stripe_mode = 'test'`; a test event can touch no live row.
2. Pay it: **Send Email invoice from Stripe** goes to whoever pressed Send on a test-mode bill, never the customer, and carries the Pay now link to `/pay/<id>`; or open the hosted invoice from the Stripe tab. Pay with Stripe's dispute test card, **4000 0000 0000 0259** (any future expiry, any CVC, any ZIP): the charge succeeds and Stripe opens a dispute on it at once. Screenshot the paid page.
3. Watch the webhook: `invoice.paid` marks the bill paid, then `charge.dispute.created` opens the case. In the app, Accounts Receivable (the bank payments modal) → **Came back**: a **card disputed** row on the ZZ TEST bill, the story, the stake and *Answer the dispute in Stripe by …* with **Open the dispute in Stripe**. The Dashboard's **Needs you** card counts it. If no case opens within a minute, read the endpoint's delivery log in the Dashboard and the `stripe-webhook` logs; the hourly `ar-returned-checks` tells the office of a case the webhook could not.
4. The notice: one email and one push to the office through `sendReturnCaseNotice` (*A card dispute opened · ZZ TEST · $N*). Screenshot the email as it arrived.
5. Lose the dispute, so Put the bill back has something to do: in the Dashboard, test mode, open the dispute and counter it with the additional-information text `losing_evidence` and submit. Stripe closes a test-mode dispute at once as lost on that text (`winning_evidence` wins it). `charge.dispute.closed` arrives, the case turns **dispute lost** (*The $N is gone*), and the office is told a second time.
6. **Put the bill back**: in the case's pane, read the read-back (the payment comes off the job with a *removed* line in its history, the bill drops its Stripe link and returns to Ready to Bill, a paid job goes back to Billed, the case closes as *put_back*), press once, and confirm each of the four on the job. Stripe is not called; its invoice stays paid in test mode, which is fine.
7. Leave the ZZ TEST job as the step left it (the bill back on Ready to Bill) and say so in the report.

**Done looks like.** Both steps clean: delete this card and the two drawings beside it, and add the Closed line in `to-dos/README.md` in the style of the others (the dated walk, what each step showed, the screenshot names in git history at the deleting commit). Otherwise the `next` field and this section say which step is done and what remains, dated. One docs-only PR (`gh pr create`, `gh pr merge --auto`; no version claim), `npm run check:todos` passing, named in the wrap-up as waiting for the one press on Auto-fix. The report: one line per screenshot name, one line per defect.

