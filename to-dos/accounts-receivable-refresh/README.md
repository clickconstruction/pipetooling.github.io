# Accounts Receivable refresh — Option A, same two rooms, better furniture

Status: **in progress** · PR 1 v2.3379 (#3108) header summary, ⋯ menu, deposit-row state chips · PR 2 v2.3380 the deposit header, remaining meter, memo fold, allocation rows · PR 3 v2.3381 matches as a list · PR 4 v2.3382 the footer sentence + Apply & next · **all four built 2026-09-13; delete this folder once the last PR merges** · branch `feat/ar-refresh-pr*` · mock-up: [`mockup.html`](./mockup.html) (both options drawn with the modal's real states; also a Claude artifact, 2026-09-13)

## The ask, in the owner's words

> This is a modal within the app. I don't think it looks as good as it could, but it does function quite well. Would you be able to help me propose a refresh on what that could look like?

Then, on the proposal: "build it."

## The reading

The modal ([`BankPaymentsModal.tsx`](../../src/components/jobs/BankPaymentsModal.tsx), 2,497 lines) already reads who paid you (`arDepositCustomerMatch.ts`), sweeps exact matches (`arExactMatchSweep.ts`), suggests two-bill combos (`arPayerBillCombos.ts`) and guards against counting a hand-recorded check twice (`arLinkCollision.ts`). The screen hid all of it: the chrome explained instead of summarising; deposit rows carried no state; the right pane led with Posted · Kind and an oversized optional memo; allocations did not read as rows; Apply did not say what it would do.

## The decision

Option A — keep the list-left, deposit-right muscle memory; move the summary into the header, put state on every row, let the matches lead the right pane, make each allocation a ledger line, and say in the footer what Apply does. Plus one thing from Option B: **Apply & next**. Rejected: Option B (the queue) as the primary layout — better on a phone and for clearing top-down, worse for scanning the pile, which is the first thing the office does; noted as the honest alternative if the Monday-morning person works straight down.

Every behaviour is kept: payer matching, the sweep and its review panel, the combo suggestion, the link guard, Mark returned, the dev Mercury filter, the Stripe-hosted confirmation, the Stripe auto-close Retry panel. Nothing new is computed except a row-state label from data already on the row.

## The train

1. **Header and list** (v2.3379): summary strip, `ArHeaderMenu` (Mark · Mercury filter), To match · All, `ArDepositRow` with `arDepositRowState.ts` chips, `KindBadgePill` lifted out.
2. **Deposit header and allocations**: payer-first header with amount · kind · date · memo, the remaining meter, memo folded to "Add a note", allocation rows (kind · target · amount · ×) with "+ Split across another bill". Extracts `ArDepositHeader`, `ArAllocationRows`.
3. **Matches and the guard**: the payer chips become a bill list (exact match first, Stripe tag on the row, the combo as one row that fills two lines); the "already recorded" steer becomes the amber card. Extracts `ArPayerMatches`.
4. **The footer**: the sentence, Apply with the amount, Apply & next (select the next To-match deposit after a successful apply).

Each PR: `npm run claim`, release note + `docs/recent-features/` fragment, guide *match bank deposits to the bills they pay* kept true, theme tokens only, one PR at a time (never stacked — a restyle of a 2,497-line component is where regressions hide).

## How to verify

- Dev: `npx vite --port 5199 --strictPort` from the worktree, `http://localhost:5199/dev-login?as=1&to=/accounts-receivable` (the page mounts the modal always-open over the billed rows). Read-only: never press Apply against prod.
- Render suites: `BankPaymentsModal.render.test.tsx` (summary, chip, sweep), `…Combo.render.test.tsx` (the 2-bill chip fills two lines), `…LinkGuard.render.test.tsx` (steer → Payment received with the amount locked). They find controls by role and text, so a restyle that keeps the words keeps them green.
- Kernel: `arDepositRowState.test.ts`.

## Residue

- The sweep review overlay and the Stripe Retry panel keep their old styling until a later pass.
- The Mercury filter modal (dev) is untouched.
