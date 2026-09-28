---
name: "GC Review for one operator: the assistant drives, the account man is the source"
number: 49
group: ready
status: steps 1–5 and 6a shipped v2.3950 / v2.3954 / v2.3957 / v2.3959 / v2.3960 / v2.3961 / v2.3971 · migration 20260928032427 waits on db push · `send-gc-statement-email` waits on a deploy · step 6b on the train · step 7 waits on an owner call
summary: >
  The weekly statement round was built for the account man opening the app. Only the assistant
  works GC Review; when the knowledge is his, she phones him and types the answer in. So the
  screen handed each GC to someone who never picked it up. Rebuild it around the person at the
  keyboard: one worklist (Check · Send · Word per GC, grouped by who to ask), the account man's
  word recorded as his with who entered it, a call sheet for one call per account man, check and
  send from the row, broken promises in red, and the prompts re-aimed at the office.
next: Apply migration 20260928032427 (`bash scripts/db-push.sh`), deploy `send-gc-statement-email` (`bash scripts/deploy-functions.sh send-gc-statement-email`), then step 6b — the Dashboard row and the morning email read an office-wide week.
size: S–M · M · M · S–M · S · M · L
blocker: none for steps 2–6. Step 7 needs the owner's answer — is the phone call a cost or the point?
ver: v2.3950 · v2.3954 · v2.3957 · v2.3959 · v2.3960 · v2.3961 · v2.3971
opinion: build 1–6 in order; hold 7 until the call sheet has run a few weeks.
---

# GC Review for one operator

Mock-up: [`before-after.html`](./before-after.html) (names from the app, amounts illustrative).

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
4. Step 7 (ask by link, no call) — **open**.

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
| 6b | Dashboard row and morning email read an office-wide week (a new database function, `statement-round-email-dispatch`) | next |
| 7 | Ask without a call — a tokened page the account man answers from his phone | owner call |

## Where it plugs in

- `src/components/jobs/JobsGcReviewModal.tsx` (map: `docs/GC_REVIEW_MODAL_ARCHITECTURE.md`), `GcWorklistPanel.tsx`, `GcStatementMarkSentForm.tsx`
- Kernels: `src/lib/jobs/gcWorklist.ts`, `gcStatementRounds.ts`, `temperatureBoard.ts`, `gcReviewCertification.ts`; IO `src/lib/gcStatementRoundIo.ts`
- Tables: `gc_statement_round_marks`, `gc_review_certifications`, `customers.statement_sender_user_id`, `statement_round_email_requests`
- Server: `get_statement_round_for_user`, edge `statement-round-email-dispatch`, `send-gc-statement-email`
- Prompts: `PipelineMoneyOpportunities.tsx`, `usePipelineMoneyOpportunities.ts`, `dashboardNeedsYou.ts`, `useStatementRoundNudge.ts`

## How to verify

`/dev-login?as=1&to=/jobs?tab=stages&gcReview=1`. Signed in as someone who is not the account man: every GC over $10,000 has a row with a live next step. Record a word, then send from the app — the row keeps both. Undo clears both.
