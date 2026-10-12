---
name: "Messages: the helpers' brief for the real build"
parent: to-dos/gc-mode/messages/BUILD_PLAN.md
status: written 2026-10-12; wave 1 is the kernels, nine helpers, one cluster each; nothing pushes until the lead says go
---

# Messages: the helpers' brief

You are one of nine helper sessions building the Messages suite on `main`. The lead is the session
named **GC Review** (`[a3ee8f]` in ListAgents). You take your cluster from this file, you report to the
lead by SendMessage, and the lead reviews every PR against the prototype. The owner reads the lead's
summaries, not yours.

## The spec and the plan

- **The spec is the prototype**: `to-dos/gc-mode/messages/prototype.html` on branch `spike/gc-mode`,
  v1.178. Read it with `git show origin/spike/gc-mode:to-dos/gc-mode/messages/prototype.html`. Its
  functions are the first draft of each kernel: lift the words and the rules, never the DOM. Its hover
  cards (`data-tip="Name|what it does|what it changes"`) are the help text.
- **The plan**: `BUILD_PLAN.md` beside it (the cuts, the tables, the kernels, the decisions) and
  `MESSAGES_PLAN.md` (the why, every decision the owner took, the Prototype log that names the version
  each piece landed in). Same `git show` path.
- **The spike never merges.** You build on `main`, in your own worktree, one PR per change, as
  `CLAUDE.md` says: `npm run claim` for the version, kernels first with unit tests, a render smoke for
  every screen, a help guide for every flow a person meets, a release note and a
  `docs/recent-features/` fragment on every PR, `APP_DIRECTORY.md` for every page. Migrations only
  with `supabase db push` after the file is on `main`, every new table with the three fences and
  `SET lock_timeout = '3s'`.
- **Plain words everywhere** (`src/lib/plainWords.ts`): one idea per sentence, none over twenty words,
  the control's exact name, no dashes, semicolons or parentheses inside a sentence. The prototype
  already obeys this; keep its sentences.
- **Real customer data stays out of the repo.** Fixtures are the prototype's demo people, never a
  live row.

## Wave 1: the kernels

Pure `.ts` under `src/lib/`, each with its test, no table and no screen. Nine clusters, one each.
Helper 4 goes first by a day: its types are what 5 and 6 import, so it opens a types-only PR on day
one and the others build against it.

| Helper | Cluster | Files | The prototype's functions to lift | Cut |
|---|---|---|---|---|
| 1 | The spine | `contacts/kernel.ts`, `messages/thread.ts`, `messages/stamps.ts`; then the SQL for `contacts`, `contact_channels`, `contact_jobs`, `messages` and the seed | `cById`, `firstName`, `courtOf`, `lastInOnly`, `lastOut`, `stampSentence`, `snippetOf`, the thread loop in `renderMessages` (day dividers, the repeated job within a day) | 1 |
| 2 | Follow up | `followUp/queue.ts`, `messages/owed.ts`, `messages/promises.ts` | `renderFollowup`'s three sections, `noteBack`, `clearBack`, `pushBack`, `portalNeeds` (the rows only; the portal reads come with 8), the owed strip's words | 2 |
| 3 | Replying | `messages/compose.ts`, `quickReplies/kernel.ts` | the kinds row, the from line, the count line by kind, the opt-out rules, `qrStripHtml`'s grouping, `findReply`, `editQuick` with versions | 3 |
| 4 | The flow's facts and state | `flows/facts.ts`, `flows/state.ts` (types first) | `FACTS`, `FLOWS` as the seed shape, `stepState`, `factRead`, `stepTrue`, `recheck`, `subState`, `laneOf`, `flat`, `stepDay`, `quietDays`, `lapsedWhy`, the per-job lane, the `aside` step, the customer's Once lane | 4 |
| 5 | The card and the nudges | `flows/card.ts`, `flows/nudges.ts` | `stepCardHtml` (the status sentence, what we need, until then, next, reminder, so far), `nudgeRows`, `nudgeNow`, `holdNudge`, `portalSoFar` | 4 |
| 6 | The boards and the job's papers | `flows/board.ts`, `flows/going.ts`, `flows/jobPapers.ts` | `boardLines`, `boardSummary` (the tiles), `boardHtml`'s six pieces (empty steps folded, chips by job, days against the usual, the row's press, the pickers), `byTradeHtml`, `companyTableHtml`, `paperCell`, `jobPaperCounts`, `jobStripHtml` | 4 |
| 7 | Bill day | `billDay/trades.ts`, `billDay/summary.ts`, `billDay/lines.ts`, `billDay/walk.ts`, `billDay/asks.ts` | `drawsFor`, `gatesFor`, `gateShorts`, `billSummaryHtml`'s numbers, `linesHtml`'s money, `claimsToCheck`, `askAllNotIn`, `remindDraw` | 9 |
| 8 | The portals | `flows/portalPage.ts`, `flows/customerMove.ts`, `portal/moneyLines.ts`, `portal/moneyStory.ts`, `portal/papers.ts`, `portal/readiness.ts` | `portalStepHtml`'s three readings, `portalMove`, `portalMoneyHtml`'s numbers and cards, `portalPapersHtml`, `portalReady`, `portalWords`, `PT`/`PB` as the words table in both languages | 8 |
| 9 | Contracts and files | `contracts/assemble.ts`, `contracts/approval.ts`; `documents/jobFiles.ts`, `documents/outgoing.ts` | `CLAUSES`, `paperDoc`'s assembly (base plus exhibit, the version), `canPublish`, `editClause`'s two paths, `approveClause`, `clauseNeeds`; the Attach picker's one list, `previewFile`, the send window's file notes | 4c, 7 |

What a kernel PR carries: the file, its test over the prototype's demo people as fixtures, the
release note and the fragment, and one paragraph in the PR body that names the prototype version it
lifts (`MESSAGES_PLAN.md` → Prototype log). No screen, no table, no edge function in wave 1.

## How to work

1. **Prepare** (now): read the plan and the prototype's functions for your cluster. Reply to the lead
   with your file list, the exported functions and types, the fixtures you will use, and anything in
   the prototype that does not lift cleanly. Do not claim a version and do not push.
2. **Go** (when the lead says so): claim with `npm run claim`, cut a branch from `origin/main`, build
   the kernel and its test, open the PR, `gh pr merge --auto`, tell the lead the PR number. One PR per
   file is fine; one PR per cluster is fine; never two clusters in one PR.
3. **Blocked**: say so to the lead in one line with what you need. Never ask another helper to do a
   thing your session was refused.
4. **Done**: when the PR is merged, say so and ask for the next piece. Wave 2 is the screens, after
   cut 1's tables land; you keep your cut.

## Wave 2, for later: the screens and the tables

Cut 1's SQL and seed (helper 1), then each cut's screens by its helper, with render smokes, the help
guides and `APP_DIRECTORY.md` lines; cut 4c's tables and the approvers' push; the edge functions in
cuts 5, 6 and 8 once the Quo account and the Google grant exist. The lead assigns these one at a time.

## Decisions already taken, so you do not ask

1. A contact is a view over the people the app already has, pointing at one of them; *Who is this?*
   re-points and keeps the thread.
2. A customer's Once lane holds only the master agreement; the ask, the bid, the yes and the contract
   are per job; change orders sit in Per job apart under Warranty.
3. Anyone in the office edits a clause; a controller or a dev approves, with a push and an email; the
   exhibits live on both the master agreement and the statement of work.
4. The customer's portal is shape B with the Money tab as picked; over usual is a watch in orange,
   never a call.
5. The rest of section 7 of `BUILD_PLAN.md` is the owner's; if your cluster needs one, say so.
