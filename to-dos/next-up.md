---
name: "Next up: the recommended order (hand-off)"
group: ready
status: >
  written 2026-09-17 after the ten-item train shipped (v2.3516–v2.3530) · re-drawn from the
  board later the same day: two of the first six shipped (Submittals 5b v2.3528, Job accounts
  PR 1b v2.3553), the five rows the owner picked *Do* lead in the board's order, Day book
  (picked *Later*) closes, and the ready rows that appeared since are in between
summary: >
  The order to build the ready rows on the punch list, why, and where each one's plan and
  before/after mock-up live in this folder — so whoever picks this up cold starts from the
  same page.
next: Build 1 → 10 below, one PR each, live-tested; re-draw this table whenever the board changes, delete it when it is empty.
size: a pointer
blocker: None. Each item's own file names its owner decisions; none block its first PR.
ver: pointer 09-17
pointer: true
---

# Next up — the recommended order, and where everything is

Written 2026-09-17 for whoever continues, and re-drawn the same evening from the board as it
stands at v2.3562. Everything referenced is in this repo; nothing you need lives only in a chat.
Read [`../CLAUDE.md`](../CLAUDE.md) first (migrations, versions, release notes, guides, help),
then [`README.md`](./README.md) in this folder (how a to-do is laid out and why feature PRs must
not edit the generated index or punch list — batch to-do edits into one docs PR at the end).

The first five are the rows the owner marked **Do** on the punch list (2026-09-17), in the
board's order; the one he marked **Later** (Day book) closes the table. Between them, the rest
follow the order the earlier hand-off set, with the rows that became ready since slotted where
their size and dependencies put them. The picks are live on the board — re-read them before
starting, and re-draw this table when they move.

| Order | Build | Why now | Plan | Before / after mock-up |
|---|---|---|---|---|
| 1 | **Customer Waiting — the `tel:` sweep** (~35 hand-rolled links, five sanitizers → `CallPhoneButton` + `phoneContact.ts`) | Picked *Do*. A mechanical sweep merges alone from fresh `main` while nothing else is open on Customers, Prospects, the Bids call queue or People — the queue is quiet now | [`customer-waiting-residuals.md`](./customer-waiting-residuals.md) § Follow-ups the build noted | not required — no screen changes |
| 2 | **Email reports, one modal — PR 1** | Picked *Do*. The owner liked the mock-up on 2026-09-16; PR 1 is the same whichever option he picks; client-only | [`email-reports-one-modal/README.md`](./email-reports-one-modal/README.md) | [`email-reports-one-modal/before-after-pr1.html`](./email-reports-one-modal/before-after-pr1.html) |
| 3 | **Pipeline load speed — PR 1** (stop the Mercury loader on a tab that never renders it; key the list effects on a stable id) | Picked *Do*. Small, and the tail drops from 5.5 s to about 2.5 s. Run `measure.js` before and after; both numbers go in the fragment. Touches `Jobs.tsx` / `JobsListCacheContext.tsx`, not the tab file, so it runs beside the decomposition train | [`pipeline-load-speed/README.md`](./pipeline-load-speed/README.md) | not required — the screen stays the same |
| 4 | **Job accounts on the Bid Board — PR 2** (strip steps 11–12 *Job opened* / *Job accounts* in a new Won phase, the proxy rule, the `accounts` door) | Picked *Do*. PR 1a shipped v2.3520, PR 1b v2.3553; the strip is the last piece of the plan | [`bid-board-job-accounts/README.md`](./bid-board-job-accounts/README.md) § The plan | [`bid-board-job-accounts/mockup.html`](./bid-board-job-accounts/mockup.html) (the strip artboard) |
| 5 | **Job Summary — the earned-revenue kernel** | Picked *Do*. Unblocked; the last unbuilt item there that needs no ledger field | [`job-summary-follow-ups.md`](./job-summary-follow-ups.md) | [`job-summary-follow-ups-earned-revenue.html`](./job-summary-follow-ups-earned-revenue.html) |
| 6 | **Price requests — PR 3** (status chip, pasted quote link, Call) | Finishes what the estimator sees; PRs 1–2 shipped v2.3495 / v2.3526. Fold in the `linkHostLabel('')` bug below | [`price-requests-loop/README.md`](./price-requests-loop/README.md) § The plan | [`price-requests-loop/before-after-pr3.html`](./price-requests-loop/before-after-pr3.html) |
| 7 | **Price requests — PR 4** (*Price with robot · N quotes in*, the Needs You card) | Follows 6 | same | [`price-requests-loop/before-after-pr4.html`](./price-requests-loop/before-after-pr4.html) |
| 8 | **Sub payments — PR 2** (the trace on the sub portal, one edge function), then **PR 3** (*Move to job…* on Edit Job → Payments received, one migration) | PR 1 shipped v2.3562 with its migration pushed; without PR 2 a sub can watch a payment vanish from their portal with no line saying where it went | [`sub-payment-move-remove/README.md`](./sub-payment-move-remove/README.md) | [`sub-payment-move-remove/before-after.html`](./sub-payment-move-remove/before-after.html) |
| 9 | **Supply houses aging — build B** (the per-cell *of which on a job account* sum, the toggle on the Accounts payable bar), then the May follow-ups in the same sitting | The owner chose B on 2026-09-17; size S, no blocker | [`supply-house-job-account-aging.md`](./supply-house-job-account-aging.md) | [`supply-house-job-account-aging-before-after.html`](./supply-house-job-account-aging-before-after.html) |
| 10 | **Day book — PR 1b** (the send functions stamp `sent_by_user_id` so invoice sends attribute), then PRs 3–7 in the file's order | Picked *Later*. PRs 1–2 shipped v2.3542 with the migration pushed; 1b is the smallest piece and unblocks every *Sent N bills* line | [`day-book/README.md`](./day-book/README.md) § The plan | [`day-book/mockup.html`](./day-book/mockup.html) |

Each mock-up page carries the screen path, what changes, and every assumption the drawing made —
read the assumptions before building; they are the places the plan was ambiguous. The same boards
are on an editable design canvas (a claude.ai artifact, private to its owner; ask if you want it),
but the repo copies are complete.

## Shipped off the first draft of this list

- **Submittals 5b** (the reviewer-file drop zone, *entered by*) — v2.3528; 6b and 6c followed
  (v2.3551), so the Submittals row is live gates only now.
- **Job accounts on the Bid Board, PR 1b** (the lens, one email per house) — v2.3553.

## Three things the drawings turned up

- **Price requests PR 4's button goes on the Price requests panel header**, where the approved
  mock-up draws it, not on the bid flow strip (the README's wording allowed either).
- **The Job accounts mock-up contradicts itself on Pondhill** (Ferguson ticked in the row artboard,
  still waiting in the lens). 1b followed the lens; PR 2's strip step 12 should read the same row.
- **A small real bug for PR 3 to fold in:** `BidPriceRequestsTable.tsx` calls `linkHostLabel(url ?? '')`
  on a hand-sent row with no link, and `new URL('')` makes it print the literal word *link* in the
  row's meta line (*link · sent outside*). Guard on `url` before calling. Still there at v2.3562.

## How the last train was run (copy it)

One branch per item off fresh `main` → `npm run claim` for the version → build with kernel tests
(+ a render smoke where wiring matters) → typecheck, lint, `node scripts/theme-tokenize.mjs --check src`,
`npm run check:timezone` → a live walk on the dev server → release note + `docs/recent-features/`
fragment + guide → PR → `gh pr merge N --auto` (re-arm after every push; the queue sets the strategy).
After a migration PR merges: `supabase db push` from a checkout at `main` (dry run first), deploy any
edge function, regenerate types as its own `chore(types)` PR. Leave `to-dos/` alone in feature PRs;
record statuses in one docs PR when the train is done and run `npm run check:todo-drift -- --fix`.

Not on this list on purpose: the Stages / Pricing decomposition (another session is running that
train, one map region per PR); Submittals (live gates that need a twin key, Wendi on a live bid and
the SpaceX Rev 3 rebuild); Signing it on paper (PRs 2–6 wait on the owner's approval of the design
and Taunya's answer on *terms*); the Texas lien rules PR 2 (the owner picks where the § door lives);
and everything in *Needs an owner decision*.
