---
name: "GC Review for one operator: the assistant drives, the account man is the source"
number: 49
group: waiting
status: steps 1–7 shipped v2.3950 / v2.3954 / v2.3957 / v2.3959 / v2.3960 / v2.3961 / v2.3971 / v2.3976 / v2.3985 · migrations applied and the three functions deployed 2026-09-28 · follow-ons v2.3991 / v2.4012 / v2.4016 / v2.4097 · the casts and the old per-sender functions still in place 2026-09-29
summary: >
  The weekly statement round was built for the account man opening the app. Only the assistant
  works GC Review; when the knowledge is his, she phones him and types the answer in. So the
  screen handed each GC to someone who never picked it up. Rebuild it around the person at the
  keyboard: one worklist (Check · Send · Word per GC, grouped by who to ask), the account man's
  word recorded as his with who entered it, a call sheet for one call per account man, check and
  send from the row, broken promises in red, and the prompts re-aimed at the office.
next: Run a Wednesday on it. Then drop the `as never` casts in `gcWordAskIo.ts` / `statementRoundEmailClient.ts` (the types have the new tables), retire `get_statement_round_for_user` / `get_my_statement_round`, and retire this to-do.
size: S–M · M · M · S–M · S · M · L
blocker: none — it needs a week of use.
ver: v2.3950 · v2.3954 · v2.3957 · v2.3959 · v2.3960 · v2.3961 · v2.3971 · v2.3976 · v2.3985 · v2.4262
opinion: built; apply the deploys and watch one Wednesday before retiring the old per-sender database functions.
---

# GC Review for one operator

Mock-ups: [`before-after.html`](./before-after.html) and, for step 7, [`ask-by-link-page.html`](./ask-by-link-page.html) — the real page rendered with sample data (names from the app, amounts illustrative).

## The ask

Owner, 2026-09-27: "what I am discovering is only assistants drive this screen and even when it's a master that has the knowledge the assistant calls the master and enters it herself." On the mock-up: "build it all I love it".

## What was wrong

- **Start round**, the 📬 Pipeline card, the Dashboard row and the morning email all went to the GC's assigned sender (`summarizeStatementRound` → `readyForUser`, `get_statement_round_for_user`). An assistant certifying Malachi's GCs had no next step on screen.
- A mark records one person, `acted_by` (RLS pins it to `auth.uid()`). The account man's read was filed as the assistant's on every pill, tally, board and email.
- An app-sent statement's reply-to is whoever pressed Send.
- The "pays by" chip stays green after the date passes.

## The decision

The assistant is the operator for every GC; the account man is the source, not a user. Defaults taken with the owner's go-ahead on the mock-up:

1. GC replies go to the account man, with the assistant copied.
2. The assistant answers for the round being done; the account man for his word being current.
3. "No change" may be recorded once, then a fresh sentence is required.
4. Step 7 (ask by link, no call) — **built**: owner, 2026-09-28, "the call is a cost".

Kept: a statement never goes out unchecked; the app never emails a GC on its own; one mark per GC per week.

## The train

| # | Ships | State |
|---|---|---|
| 1 | The worklist in place of the rounds panel; the sender card retired; one mark holds the statement and the word (`mergeRoundMarkWrite`) | shipped v2.3950 |
| 2 | Whose word — `gc_statement_round_marks` keeps the source beside who entered it; the form asks; every display reads it | shipped v2.3954 (migration) + v2.3957 (client) |
| 3 | The call sheet — one account man's GCs, answers inline, one save, printable; `payPromiseStatus` | shipped v2.3959 |
| 4 | Check & send… from the checklist, "Replies go to" (`send-gc-statement-email`, `_shared/gcStatementReplyTo.ts`). The mock-up's row opening in place was built as the checklist window chaining into the draft — the two windows hold the job links, the activity drop-downs and the CC / schedule controls the row could not. | shipped v2.3961 |
| 5 | Broken promises — a passed pay-by date with money open turns red and sorts first (`payPromise.ts`) | shipped v2.3960 |
| 6a | Pipeline cards office-wide; Start round retired; `?round=1&gc=` opens the call sheet | shipped v2.3971 |
| 6b | Dashboard row and morning email read an office-wide week (`get_statement_week_for_office`, `renderOfficeWeek.ts`) | shipped v2.3976 |
| 7 | Ask by link — a no-login page the account man answers from his phone; the office reads and saves (`gc-word-ask`, `/ask`) | shipped v2.3985 |

## Where it plugs in

- `src/components/jobs/JobsGcReviewModal.tsx` (map: `docs/GC_REVIEW_MODAL_ARCHITECTURE.md`), `GcWorklistPanel.tsx`, `GcStatementMarkSentForm.tsx`
- Kernels: `src/lib/jobs/gcWorklist.ts`, `gcStatementRounds.ts`, `temperatureBoard.ts`, `gcReviewCertification.ts`; IO `src/lib/gcStatementRoundIo.ts`
- Tables: `gc_statement_round_marks`, `gc_review_certifications`, `customers.statement_sender_user_id`, `statement_round_email_requests`
- Server: `get_statement_round_for_user`, edge `statement-round-email-dispatch`, `send-gc-statement-email`
- Prompts: `PipelineMoneyOpportunities.tsx`, `usePipelineMoneyOpportunities.ts`, `dashboardNeedsYou.ts`, `useStatementRoundNudge.ts`

## Where it stands

Everything is live as of 2026-09-28: the four migrations of that day are applied, `gc-word-ask`, `send-gc-statement-email` and `statement-round-email-dispatch` are deployed and answer, and a dead link answers 404 with the office's words. Checked in the app on real data, read-only: the week's list, the call sheet ("Stamps Malachi's word — entered by …"), the Ask by link dialog, and Print unpaid invoices (RMC- Dudley Mason, 21 pages). A word has since been saved and undone live twice (v2.3991 on a one-bill GC, v2.4012 on a four-bill GC), so the mark write is exercised; still not exercised on real data, because each writes: minting a link, his answers, a send with Replies go to. Follow-ons on the same surfaces since the train: the word's pay date goes onto the GC's bills as a payment promise (v2.3991) and shows for GCs under the line too (v2.4012); the call sheet lists the bills behind each total and says where Save answers writes (v2.4016); the groups are headed "Account Man <name>" (v2.4097 — the regrouping the owner asked for the same day is #54, `gc-worklist-by-account-man.md`). The statement email's To, CC and Replies go to became one header read like an email, with one menu that leads with the GC's contact people (v2.4262, 2026-09-30; the before/after is `statement-email-to-cc-before-after.html` beside this file). The `as never` casts in `gcWordAskIo.ts` / `statementRoundEmailClient.ts` are still there (2026-09-29), and the old per-sender functions are still called — `get_statement_round_for_user` by `statement-round-email-dispatch`, `get_my_statement_round` by `statementRoundEmailClient.ts`.

## How to verify

`/dev-login?as=1&to=/jobs?tab=stages&gcReview=1`. Signed in as someone who is not the account man: every GC over $10,000 has a row with a live next step. Record a word, then send from the app — the row keeps both. Undo clears both.
