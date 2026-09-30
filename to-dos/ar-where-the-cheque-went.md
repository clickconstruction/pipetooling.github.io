---
name: "Accounts Receivable: where did that cheque go?"
number: 74
group: ready
status: asked 2026-09-30 · drawn twice against 30 days of prod · prototype beside it · PR 1 (the search) v2.4273 open · PR 2 (the trail) v2.4277 open on feat/ar-deposit-trail, its migration 20260930230000 to push once it merges
summary: >
  The office searched Accounts Receivable for a $6,077.51 cheque and got "no match": it had
  been applied the day before, so it had left To match, the only list the search read. The
  Southern Post cheque beside it had bounced while paying a bill (punch list #40 built the
  returned-check card, notice and badge from that one). Two drafts and a second pass landed
  on: no new list and no new card — every deposit row says one more line (applied, moved,
  taken off, returned, who, when), the search looks in All when To match has nothing, and
  All reads by last action under day headings for the last 30 days.
next: >
  PR 2 the trail line on every deposit row (one read RPC over payments + the deleted-records
  archive + the history's actors; kernel arDepositTrail.ts); PR 3 All ordered by last action;
  PR 4 who applied it — find the path that applies payments with no signed-in user (13 of 38
  rows this month) and say "the app" there.
size: S (PR 1) · M (PR 2, a migration) · S (PR 3) · S–M (PR 4)
blocker: None. The removal-dating fix PR 2 leans on shipped as v2.4269.
opinion: build in order; PR 4 last, once the unsigned path is named.
---

## The ask, in the owner's words

"There was a 6,077.51 deposit and we're not seeing it in accounts receivable, can you help me see if it was already applied?" — then, on the Southern Post cheque: "that cheque failed. Perhaps we should improve the accounts receivable page so a user can see the cheques they've assigned in the last 30 days?" — then "make a mockup… is this the best we can do?", a second pass, and "I like it, build it."

## The decision

The first draft was a third list, *Applied · 30 days*. The first revision added an answer card, a *Needs a look* strip and per-cheque cards. The second pass, read against the code, cut all of it: the strip's first rule shipped on 9/24 as the returned-check Needs You card (v2.3795–3806), its second rule is To match itself, and the cards duplicate the selected-row pane. What is left is two changes to the rows we have — the mock-up `ar-where-the-cheque-went-before-after.html` holds both drafts, the critiques and the revised design; `ar-where-the-cheque-went-prototype.html` is the working model with the three calls as switches. The calls, taken as the prototype's defaults: All by last action; the trail on To match rows too; "the app" on rows nobody signed.

## Where it plugs in

- Modal `src/components/jobs/BankPaymentsModal.tsx`; row `src/components/jobs/ar/ArDepositRow.tsx`; row state `src/lib/jobs/arDepositRowState.ts`; the list RPC `list_mercury_transactions_for_bank_payments` (`consumed`, `remaining_available`, `returned`); the bills a deposit paid `list_ar_allocations_for_mercury_transaction`; bank returns `src/lib/jobs/bankReturnedDeposits.ts`.
- New in PR 1: `src/lib/jobs/arDepositSearch.ts`. New in PR 2: an RPC keyed by deposit ids over `jobs_ledger_payments`, `deleted_records_archive` (removals, with `deleted_at` / `deleted_by`) and `job_activity_events` (the adder's actor); a kernel that turns them into one sentence.

## How to verify

Live as the dev on `/accounts-receivable`. PR 1: type `6,077.51` on To match → the Lober’s row under *Nothing to match · found in All*. PR 2: the Loberg $5,622.49 row in To match reads *was on #650 ATI Schertz · taken off 9/30 by Taunya*; the Southern Post row under All reads its bounce and return. Thirteen rows this month have a history row with no actor; PR 4 names the path before adding a column.
