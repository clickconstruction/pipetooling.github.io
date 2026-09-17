---
name: "Next up: the recommended order (hand-off)"
group: ready
status: written 2026-09-17 after the ten-item train shipped (v2.3516–v2.3530) · six items drawn, none started
summary: >
  The order to build the next six ready items, why, and where each one's plan and before/after
  mock-up live in this folder — so whoever picks this up cold starts from the same page.
next: Build 1 → 6 below, one PR each, live-tested, then delete this file.
size: a pointer
blocker: None. Each item's own file names its owner decisions; none block its first PR.
ver: pointer 09-17
pointer: true
---

# Next up — the recommended order, and where everything is

Written 2026-09-17 for whoever continues. Everything referenced is in this repo; nothing you need
lives only in a chat. Read [`../CLAUDE.md`](../CLAUDE.md) first (migrations, versions, release notes,
guides, help), then [`README.md`](./README.md) in this folder (how a to-do is laid out and why
feature PRs must not edit the generated index or punch list — batch to-do edits into one docs PR
at the end).

| Order | Build | Why now | Plan | Before / after mock-up |
|---|---|---|---|---|
| 1 | **Submittals 5b** — the reviewer-file drop zone and *entered by* | The owner set the order 5a → 5b → 6b → 6c on 2026-09-16; 5a shipped as v2.3528 with its live gate passed on BP398 | [`submittals/STAGES-5-6-BUILD.md`](./submittals/STAGES-5-6-BUILD.md) § PR 5b (+ [`submittals/README.md`](./submittals/README.md)) | [`submittals/before-after-5b.html`](./submittals/before-after-5b.html) |
| 2 | **Email reports, one modal — PR 1** | The owner liked the mock-up on 2026-09-16; PR 1 is the same whichever option he picks; client-only | [`email-reports-one-modal/README.md`](./email-reports-one-modal/README.md) | [`email-reports-one-modal/before-after-pr1.html`](./email-reports-one-modal/before-after-pr1.html) |
| 3 | **Price requests — PR 3** (status chip, pasted quote link, Call) | Finishes what the estimator sees; PRs 1–2 shipped v2.3495 / v2.3526 | [`price-requests-loop/README.md`](./price-requests-loop/README.md) § The plan | [`price-requests-loop/before-after-pr3.html`](./price-requests-loop/before-after-pr3.html) |
| 4 | **Price requests — PR 4** (*Price with robot · N quotes in*, the Needs You card) | Follows 3 | same | [`price-requests-loop/before-after-pr4.html`](./price-requests-loop/before-after-pr4.html) |
| 5 | **Job accounts on the Bid Board — PR 1b** (the lens, one email per house) | Decisions taken 2026-09-14; PR 1a shipped v2.3520 | [`bid-board-job-accounts/README.md`](./bid-board-job-accounts/README.md) | [`bid-board-job-accounts/before-after-pr1b.html`](./bid-board-job-accounts/before-after-pr1b.html) |
| 6 | **Job Summary — the earned-revenue kernel** | Unblocked; the last unbuilt item there that needs no ledger field | [`job-summary-follow-ups.md`](./job-summary-follow-ups.md) | [`job-summary-follow-ups-earned-revenue.html`](./job-summary-follow-ups-earned-revenue.html) |

Each mock-up page carries the screen path, what changes, and every assumption the drawing made —
read the assumptions before building; they are the places the plan was ambiguous. The same boards
are on an editable design canvas (a claude.ai artifact, private to its owner; ask if you want it),
but the repo copies are complete.

## Three things the drawings turned up

- **Price requests PR 4's button goes on the Price requests panel header**, where the approved
  mock-up draws it, not on the bid flow strip (the README's wording allowed either).
- **The Job accounts mock-up contradicts itself on Pondhill** (Ferguson ticked in the row artboard,
  still waiting in the lens). The stored pair follows the lens; pick one when building 1b.
- **A small real bug for PR 3 to fold in:** `BidPriceRequestsTable.tsx` calls `linkHostLabel(url ?? '')`
  on a hand-sent row with no link, and `new URL('')` makes it print the literal word *link* in the
  row's meta line (*link · sent outside*). Guard on `url` before calling.

## How the last train was run (copy it)

One branch per item off fresh `main` → `npm run claim` for the version → build with kernel tests
(+ a render smoke where wiring matters) → typecheck, lint, `node scripts/theme-tokenize.mjs --check src`,
`npm run check:timezone` → a live walk on the dev server → release note + `docs/recent-features/`
fragment + guide → PR → `gh pr merge N --auto` (re-arm after every push; the queue sets the strategy).
After a migration PR merges: `supabase db push` from a checkout at `main` (dry run first), deploy any
edge function, regenerate types as its own `chore(types)` PR. Leave `to-dos/` alone in feature PRs;
record statuses in one docs PR when the train is done and run `npm run check:todo-drift -- --fix`.

Not on this list on purpose: the Customer Waiting `tel:` sweep (59 hand-rolled links, five
sanitizers — needs its own look), the Stages / Pricing decomposition (another session is running that
train, one map region per PR), and everything in *Needs an owner decision*.
