---
name: "Money in: this week, and what last week still owes"
number: 191
group: close
status: BUILT 2026-10-26 — PR 1 #6249 v2.5926 (the kernel), PR 2 #6258 v2.5937 (the reads, get-stripe-payouts deployed), PR 3 v2.5955 (the bar and its pen); read live as the dev and the sample assistant before each merge
summary: >
  One slim, expandable bar under the Dashboard's four Financials cards for the money coming in —
  closed by default (one line: Came in · Still expected · Last week still out, a red pill when a
  check came back), pressed open: what landed this week, what is still on its way (checks in hand,
  deposits pending at Mercury, their word, their pace, Stripe and its next payout), and what last
  week expected that never came — so assistant Taunya can answer "what is coming in this week and
  what has not yet come in from last week" without stitching together Banking, the AR deposits
  window and the Jobs board. Pressing a chip records the day they now say, as the promise it is.
next: the owner plays with it on the Dashboard, then this folder is deleted.
size: M (three PRs; the planned PRs 3 and 4 shipped as one)
blocker: the owner's look.
ver: v2.5926 · 5937 · 5955
opinion: your call — it is built and live; the first look is yours
---

# Money in: this week, and what last week still owes

## The ask

The owner, 2026-10-26:

> "since we can see mercury and stripe from the app would it be possible to build on an assistants, controllers, and devs dashboard a feature that could show cheques that have not been deposited yet but are pending and if they fail as well as stripe and what is set to be paid out? this would better allow assistant taunya to answer the question she often gets from Master Malachi 'what is coming in this week and what has not yet come in from last week'. I would like to expose this just below these boxes on their dashboards"

"These boxes" are the four Financials cards (Accounts Receivable · Accounts Payable · Not Billed Out
· Overhead): `DashboardFinancialsSection`, mounted in the pinned row's `interstitial` slot
(`src/pages/Dashboard.tsx:1438`), shown to dev, master_technician, assistant and controller
(`showFinancials`, `Dashboard.tsx:1060`), and mounted a second time on the Dispatch Mode home
(`src/components/dispatchMode/DispatchModeHome.tsx:148`).

And on the first drawing, the same day: *"this takes up a lot of room, I would like a small bar
that is expandable."* So the feature is a **one-line bar, closed by default**.

And on the lane drawing that followed, the same day: *"I don't like how this part looks, maybe
it's how the titles blend in with the names, maybe we should do a timeline instead."* So pressing
the bar opens a **week line**: days across, every payment a chip on the day it landed or should
land, the kind a small tag on the chip — never a bold section title beside a bold payer name.

And on the week line, the same day: *"I like this! can we also make it easy to update the date we
expect things as new information comes in?"* So the line is also **the pen**: pressing a chip sets
the day they now say, saved as the promise it already is in this app.

## What the bar answers

**Closed — the default — it is one row** under the cards, in the cards' own quiet language:
`Money in · ✓ Came in $16.0k · 2 · Still expected $60.8k · 10 · Last week still out $18.4k · 3`,
with a red `1 RETURNED` pill as the only loud thing, and only when something failed. It remembers
being left open, per device.

**Pressed, it opens to one week line.** Last week's leftovers are the amber first column; the days
run Monday to Friday with a quiet weekend cell; every payment is a chip on its day, the kind a
small tag on the chip. As the week runs, chips flip in place — green ✓ the day the money lands,
red the day it comes back — and anything still open Sunday night slides into next week's amber
column. The chips:

1. **Last week's column** — what last week expected that never landed, each with its reason:
   a returned check (red), a promise now past, a payer past their own pace. This is the half the
   office has no screen for today: the forecast's "Past expected" bucket is *everything* past,
   with no one-week window, and nothing joins expected bills to the payments that landed.
2. **Landed** (green ✓, on the day `jobs_ledger_payments.paid_on` says): a Stripe payment, a check
   deposit that posted at Mercury, a wire.
3. **Expected** — the rest of the week's money, each chip on the day its own read gives:
   - **The drawer shelf, above the line** — recorded payments with no `mercury_transaction_id`
     whose type reads as a check (`isCheckPayment`): typed in, not yet driven to the bank, so they
     have **no day yet**.
   - **At the bank** — `mercury_transactions` rows with `status = 'pending'` (deposited, not yet
     posted), on the day they should clear (~`CHECK_CLEAR_DAYS` = 7). **If one fails it goes red
     on its day** with the bank's reason (`mercuryBankReturn`) and a door to the Returned checks
     pane.
   - **They say it's sent** — open paid claims (`list_paid_claims`, `claimOpen`): "check mailed
     Thursday", on the day the mail should land (`MAILED_CHECK_DAYS`), with what it covers.
   - **Their word** — promises (`list_job_promised_pay_dates`) on their promised day, with the
     open amount they cover.
   - **Pace chips** — bills whose expected day (`billedExpectedPayModel`, or the Collect pile's
     per-bill `expectedYmd`) falls this week with no word and no paper: dashed, tagged *a guess*.
   - **Stripe** — open Stripe invoices (`stripe_invoice_status`) on their expected day, and the
     payout chip on **the day the next payout lands** (the new read, below) — drawn, never summed,
     since it is landed card money reaching the bank.

Every chip is a door: a drawer check and a pending deposit open the AR deposits window
(`/accounts-receivable`), a failed one opens its return case, a promise or pace chip opens the
job, the Stripe chips open Banking. The line computes nothing new about *how much is owed* —
amounts come from the same bill truth the cards above it already read.

**The pen.** Pressing a chip opens a small form — the day they now say (quick picks for this week
and next Monday), who said it, how, an optional note — saved with the writes the app already has:
`add_job_payment_promise` / `set_job_promised_pay_date`, the Payment Chase's own verbs
(`src/lib/jobs/paymentChaseIo.ts`; `SetPromisedPayDateModal` is the precedent, and the Collect
sheet's `collectOutcome.ts` already maps a call's answer to these writes). A *pace* chip becomes
**their word** on the new day; a *word* chip re-promised appends to the append-only
`job_payment_promises`, so the payer's slip history (`promiseSlipByCustomer`) and the Collect
desk's miss count stay honest. A bank, drawer or Stripe chip takes no pen — those days come from
the bank, the deposit run or Stripe, and the form says so. Nothing new in the database.

**Fail-soft, per source** (the Lien desk's rule, v2.5533): each read that fails marks its own group
"couldn't read" and the strip draws the rest — Stripe being down must not blank the checks.

## Decisions for the owner

1. **Does a promise count as "expected this week"?** Recommended: yes, as its own "Their word"
   group — Taunya's answer to Malachi is better with "Barton Creek said Friday" in it than
   without. A paid claim ("check mailed Thursday") likewise, as "They say it's sent".
2. **Do pace-only rows belong?** A payer with no word and no paper, just their usual speed, is a
   guess. Recommended: yes, as dashed chips tagged *a guess* on their pace day, so nobody reads a
   guess as a fact.
3. **When does the week start?** The forecast kernel buckets Sunday–Saturday
   (`forecastWeekStart`); the Weekly Money Movement report and `moneyfillWeekClose` run
   Monday–Sunday. Recommended: **Monday** — Malachi asks on Mondays, and "last week" should mean
   the week that just closed.
4. **Who sees it?** The ask names assistants, controllers and devs. The Financials row above it
   also shows to master_technician (`showFinancials`). Recommended: reuse `showFinancials`
   unchanged — then Malachi's own dashboard answers his question before he asks it. If exactly the
   three roles asked, the gate is one line (`role === 'dev' || isAssistantLike(role)`). Either
   way no technician, estimator, primary or sub ever sees it — the dollars question answers
   itself.
5. **Does it also show on the Dispatch Mode home**, the second Financials mount? Recommended: yes
   — same gate, one extra line.
6. **How much does the pen ask?** A bare date is one tap; the Payment Chase wants who said it and
   how. Recommended: the quick form with defaults (the payer's usual contact, phone) — two taps
   when the defaults hold, and the chase record stays whole. Dragging a chip across days can come
   later as desktop sugar (touch drag needs its own sensor); the press is the pen.

## Where it plugs in

### Exists already (the survey, 2026-10-26)

| Strip piece | What exists |
|---|---|
| Came in this week | `jobs_ledger_payments` (`paid_on`, `payment_type`, `note`, `invoice_id`, `mercury_transaction_id`); a Stripe payment is a row with `note = 'Stripe'` written by `mark_invoice_paid_from_stripe` |
| Checks in hand | RPC `list_unlinked_payments_for_bank_payments()` (unlinked, non-Stripe, ≤180d, limit 500) filtered by `isCheckPayment` (`src/lib/jobs/checkClearing.ts`); the 10-days-stale tail already has cases (`ar_unbanked_check_cases`, hourly cron) |
| Pending / failed at the bank | `mercury_transactions` rows (`status` 'pending' / 'sent' / 'failed', `posted_at`, `kind`, `raw.reasonForFailure`), kept current by `mercury-webhook` + `sync-mercury-transactions`; RLS SELECT already allows dev, master_technician, assistant, controller; the return rule is `mercuryBankReturn` / `list_ar_return_cases` |
| Their word / they say it's sent | `job_payment_promises` (kind 'promise' / 'paid_claim'), `list_job_promised_pay_dates`, `list_paid_claims` + `claimOpen` / `landedSince` (`src/lib/jobs/paidClaims.ts`) |
| By their usual pace | `billedExpectedPayModel` + `get_billed_customer_pay_speeds` (`src/lib/jobs/billedExpectedPay.ts`); weekly buckets in `buildBilledPaymentForecast` (`billedPaymentForecast.ts`); the Collect pile's per-bill `expectedYmd` with the better payer/GC/segment pace (`src/lib/bridge/collect/collectPile.ts`, and `collectBillsFromAr` already eats the dashboard's `FinancialItem`s) |
| Stripe invoices | `jobs_ledger_invoices.stripe_invoice_status` / `hosted_invoice_url`, synced by `stripe-webhook` |
| The week | `weekUtcBounds` (Mon–Sun Central, `src/lib/moneyfillWeekClose.ts`), `todayYmdInAppTz` |
| The mount | `DashboardFinancialsSection` + the `interstitial` slot; card anatomy to copy is in that file (grid `repeat(auto-fit, minmax(220px,1fr))`, short-k totals, 0.75rem faint detail lines) |

### New

- **`get-stripe-payouts` edge function** — nothing anywhere reads Stripe payouts today: no call to
  `/v1/payouts` or `/v1/balance`, `stripe-webhook` ignores `payout.*`, no table stores them. The
  function calls both with `stripeApiKeyForMode` (`_shared/stripeSecrets.ts`) and returns the next
  payout (amount, arrival day) plus the pending balance. Gate it to the strip's own roles —
  **not** a copy of `get-mercury-account-balances`' gate, which refuses assistants.
- **A pending-deposits read** — the AR window's RPC filters `posted_at IS NOT NULL`, so nothing in
  the app reads pending money in today. RLS already lets the strip's roles read the table, so this
  is a narrow client read (or a small RPC if we'd rather name the rule once): positive amounts,
  status pending, plus failed ones this week.
- **The kernel** — `src/lib/moneyInWeek.ts` (pure, tested): the carried-from-last-week rule
  (expected day in last week's window, and no payment landed on the job since — `landedSince`'s
  idea), the three lanes, the groups, every row with its door.
- **The loader + hook** — `src/lib/moneyInWeekLoad.ts` + `src/hooks/useMoneyInWeek.ts`, fail-soft
  per source; nothing loads pay speeds or promises at card level today (the AR drill-down loads
  them only on open).
- **The strip** — `src/components/DashboardMoneyInStrip.tsx`, mounted right after
  `DashboardFinancialsSection` in the `interstitial` slot.

## The PR train (smallest first)

Each PR claims its version (`npm run claim`), ships its release note + `docs/recent-features/`
fragment, and merges alone (`gh pr merge --auto`).

1. **PR 1 — the kernel.** `src/lib/moneyInWeek.ts` + `moneyInWeek.test.ts`: typed inputs (payments
   in the window, unlinked check payments, Mercury pending/failed rows, promises, claims, per-bill
   expected days, Stripe invoice statuses + payout, todayYmd) → `{ carried, cameIn, expected }`
   with typed, dated rows (the week line groups them by day; the drawer rows carry no day) and
   doors. Reuses `isCheckPayment`, `instrumentWord`, `mercuryBankReturn`,
   `claimOpen`, `billedExpectedPayModel` / `buildCollectPile`. No io, no component.
2. **PR 2 — the reads.** The `get-stripe-payouts` function (+ its `docs/EDGE_FUNCTIONS.md` section
   and TOC line; deployed with `supabase functions deploy get-stripe-payouts` after merge), the
   pending-deposits read, `moneyInWeekLoad.ts`, `useMoneyInWeek.ts`. Every source fails soft.
3. **PR 3 — the bar.** `DashboardMoneyInStrip.tsx` under the cards (per decisions 4–5): closed by
   default to the one-line bar, pressed open to the week line (drawn by day from the kernel's
   dated rows, the drawer shelf above it), the open/closed choice remembered per device
   (localStorage, like the drill-downs' collapsed sections); a render smoke, the help guide
   in `src/content/help/` ("see what money is coming in this week"), the
   `PROJECT_DOCUMENTATION.md` line. PR 3 ships the line read-only — the doors go to the real
   windows (AR deposits, the job, Banking, Returned checks); the pen is PR 4.
4. **PR 4 — the pen.** The chip form (per decision 6) writing the existing promise verbs through
   `paymentChaseIo.ts`, the kind flip (pace → their word) with the "was Thu, by pace" tag, the
   no-pen message on bank/drawer/Stripe chips, a render smoke and the guide's pen section.
   Nothing new in the database.

## How to verify

- **PR 1:** `npm test` — the kernel's cases: a check recorded Friday shows in hand Monday; a
  deposit that posts moves the row from pending to came-in; a failed deposit goes red with the
  bank's reason; a promise due Friday sits in Their word; last week's unlanded expected carries; a
  payment landing clears its carried row; a Stripe source error blanks only the Stripe group.
- **PR 2:** deploy, then `npm run check:edge-drift` is clean; call `get-stripe-payouts` as the dev
  and as the sample assistant (the live-test recipe's dev-login mint) — both get the payout,
  a technician is refused.
- **PR 4, live on prod (the ZZ TEST recipe):** press a pace chip on the ZZ TEST job, set Friday
  with a note — the chip turns their-word on Friday with the moved tag, `job_payment_promises`
  gains the appended row, and the Payment Chase and the Collect sheet both show it; move it again
  — the first promise stays in the ledger and the slip counts. A bank chip's form says where its
  day comes from and offers no save.
- **PR 3, live on prod (the ZZ TEST recipe):** record a check payment on the ZZ TEST job → it
  shows under Checks in hand with its door to `/accounts-receivable`; compare Came in against the
  Banking page's week and the strip's pending rows against Banking's pending rows; compare the
  payout tile against the Stripe dashboard (the owner's or Grace's glance); `view_as` the sample
  assistant and the sample controller — strip renders, payout tile included; delete the ZZ row
  after. The strip's totals must foot to the windows it doors into — any gap is a bug in the strip,
  not the windows.

## Gotchas the survey found

- **`payment_type` is free text** — eight spellings of three things live in prod (null, Cheque,
  Check, checkDeposit…). Only ever read it through `instrumentWord` / `isCheckPayment`.
- **Stripe-recorded payments are excluded from the unlinked list on purpose** (`note = 'Stripe'`
  never links to a deposit) — don't count them as checks in hand, and don't expect them to match
  a Mercury deposit; the payout tile is how Stripe money's arrival is seen.
- **A Stripe ACH in flight is invisible** — nothing handles `payment_intent.processing`, so a
  paying invoice reads `open` until `invoice.paid`. The payout tile covers the gap partially;
  handling `processing` is a possible follow-up, not part of this strip.
- **Stripe dispute/debit cases may not be firing in prod** — to-do #76's two live steps (Grace
  subscribes the webhook to `charge.dispute.*` + `payment_intent.payment_failed`, then one test
  dispute) are still owed. The strip's bank-side returns work regardless.
- **The AR deposits RPC hides pending rows** (`posted_at IS NOT NULL`) — that's why the strip
  needs its own pending read; don't widen the AR RPC, the window's matching assumes posted money.
- **`get-mercury-account-balances` refuses assistants** (mirrors `is_banking_staff()`) — the strip
  never calls it; don't copy its gate onto `get-stripe-payouts`.
- A deposited check isn't cleared — `CHECK_CLEAR_DAYS = 7`; the pending row says when it clears,
  and the came-in row only appears when the deposit posts.

## Where it stands

Built and live 2026-10-26, the six decisions taken as recommended (a promise and a paid claim
count as expected; a pace guess shows, dashed and tagged *a guess*; weeks run Monday to Sunday;
the cards' own gate, so the master sees it too; the Dispatch Mode home carries it, since the bar is
mounted inside the Financials section; the pen is the quick form). Three PRs, not four: the bar
and its pen shipped together as PR 3 to save a merge cycle on a night the CI queue was slow.

What changed from the mock-up after reading prod data live:

- **Nearly every open bill is a hosted Stripe invoice**, so the mock-up's separate *Stripe invoice
  open* tag drew guesses solid and hid the pace. A bill with no promise is a *Pace · a guess* chip,
  dashed, with *Stripe invoice · sent Fri* under the name (v2.5937).
- **The pen is the Payment Chase's own sheet**, *Write down their word*, opened from a word or pace
  chip with the mock-up's quick days and a line saying where the day stands. It keeps the sheet's
  *They say they paid…* side and its record of every date named (v2.5955).
- **The kernel was re-read against the mock-up** and two double counts were fixed before any UI
  shipped: a check typed in this week counted in both *Came in* and the drawer, and a Stripe
  payout pending at Mercury would have counted beside the Stripe payments (v2.5937).

Verified: the mock-up's whole week reproduces its numbers to the dollar in the kernel's tests;
every read answered 200 as the dev and as the sample assistant through View as, with the same
three figures for both; `get-stripe-payouts` answered live (no payout in flight that evening).
**Not verified live: the pen's save.** No ZZ test job has an open bill, and a test promise on a
real customer's job would count against them in the Payment Chase. The save is the same
`add_job_payment_promise` the Payment Chase writes daily, exercised in the sheet's smoke; the
first real press is the office's.
