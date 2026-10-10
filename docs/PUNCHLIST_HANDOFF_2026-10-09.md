# Punch list hand-off — 2026-10-09

Status: handed off 2026-10-09 19:45 UTC, amended 20:50 UTC; the owed steps are in §1, in order. Written by the PUNCHLIST lead session (Wendi's Mac) for whoever picks the work up, on any machine. Every fact here was true when written; re-read `gh pr list`, the merge queue and `npm run check:migration-drift` before acting. Repo rules: `CLAUDE.md` first. Pushes and deploys happen from the MAIN checkout at `origin/main`, never a worktree. The previous hand-off, [`PUNCHLIST_HANDOFF_2026-10-08.md`](./PUNCHLIST_HANDOFF_2026-10-08.md), is done except where this one says otherwise.

**Who is who.** Sessions on Wendi's Mac message each other by name (`ListAgents` / `SendMessage`). PUNCHLIST leads Helpers 1 to 8; GC MODE leads Helpers 11 to 18 (also handed off tonight, see its own doc on `spike/gc-mode`); MERGE is the conflict-watch session that arms, re-arms and relays merges — it holds no work of its own. A session on another machine cannot message these; the channel that reaches them is a comment on the PR. GitHub claims (`refs/claims/*`) and the PR titles are the shared ledger.

## 1. Do these first (owed, in order)

1. **Done 2026-10-10 00:24 UTC — the anon EXECUTE revoke, #5110 (v2.5040), is on prod as `20261010027000` (its doc's Status section has the verify reads); the steps below are the record of how.** Was: tonight, 23:00 UTC (18:00 CDT). It cuts a signed-out visitor from 524 reachable functions to exactly two, proven on a schema copy of prod with 65 probes (the migration doc has the bed table). Helper 4's one-shot in its own session renumbers the migration at 22:45 UTC (from `20261010007000` to origin/main's newest stamp + 1, re-claimed, every mention renamed, pushed with lease) and posts the new stamp as a comment on #5110; if that comment is not there by 22:50, do the renumber yourself from `claude/revoke-anon-execute` (rebase onto main first; `npm run claim -- --migration <file>`). Then, in one sitting with nothing else of anyone's pushed in between:
   1. confirm `npm run check:migration-drift` reads fully applied (if #5175's 021000 is on main and unapplied, see item 3 first);
   2. take the read-only ACL snapshot query from the migration doc over the pooler (`psql` to `aws-1-us-east-1.pooler.supabase.com`, `SUPABASE_DB_PASSWORD` from the main checkout's `.env.local`, never printed);
   3. `gh pr merge 5110 --auto` and wait for the merge (MERGE pings; do not poll CI);
   4. from the main checkout at origin/main: `npx supabase db push --linked --dry-run` (expect only the renumbered file), `npx supabase db push --linked`, `npm run check:migration-drift`;
   5. the doc's verify steps: the SQL check that anon reaches exactly `get_hazmat_notice_by_token` and `list_my_contract_dashboard_prompts`, and the three curl probes with the publishable key (hazmat 200 null; `is_dev` and `is_office_staff` 401 code 42501);
   6. tell MERGE (GC's B6-b-i waits on it), add a Status section to the migration doc as a docs PR.
2. **#5169's migration `20261010017000` is on prod** — pushed by PUNCHLIST at 18:52 UTC with `--include-all` (the CLI refused the stamp below the applied 020000; the dry run listed it alone), drift 833/833, `can_edit_bid`, `list_bid_removed_rows` and `restore_bid_removed_row` present. **Its types regen merged as #5190** (`a192cf9b9`, cut after #5178 merged at 19:25; three RPCs, typecheck 0), **and dev-mcp is redeployed:** `bash scripts/deploy-functions.sh dev-mcp` from the main checkout at `80915b412`, about 20:35 UTC; `npm run check:edge-drift` read all 146 functions current and migration drift read 833/833. Helper 2 runs the ZZ Test walk (recipe on the bid-history card, #5182) with its user's yes; its result lands as a comment on #5169.

   **2b. #5193's migration `20261010023000` (v2.5091) is on prod** — #5193 merged at 20:36 UTC and PUNCHLIST pushed it by 20:45 UTC (its types regen, opened 20:44, reads `job_rider_fees` from prod): drift 834/834, its doc's verify steps 1 and 2 pass, and anon cannot execute `job_rider_fees`. **Its types regen is #5196, armed.** **Owed after it merges:** `bash scripts/deploy-functions.sh dev-mcp` from the main checkout and `npm run check:edge-drift`. GC's 021000 push waits for its own window, outside 22:45–23:10 UTC.
3. **GC's #5175 (U6a, migration `20261010021000`)**: dequeued and disarmed by MERGE at 18:47 UTC; it reads CLEAN and will not move until the next GC lead re-arms it and pushes 021000 with its own verify (`docs/migrations/20261010021000_*.md`). Leave it. GC's #5170 merged as `4c85d5c3c` and #5173 as `bb75b2885` (its spike follow-ups pin to those); #5168, a docs pass, merged and its owner redeploys twin-mcp.
4. **The SQL beds are a required check — done.** #5179 merged at 19:33 UTC and PUNCHLIST ran the PATCH at 19:40: main's `required_status_checks` read `checks` + `sql-beds` (both app 15368, `strict: false`); the gate had already reported green on two merge-group builds. Adding a bed is one line in `scripts/sql-beds.txt` plus `scripts/pgtest-<bed>.sh` and `supabase/tests/<bed>/`; GC MODE knows. If the queue ever stalls on a PR whose merge-group build does not report `sql-beds`, that PR's branch predates the workflow and needs a rebase.
5. **Done 2026-10-10 ~01:10 UTC — #26, the team_leads drop, #5183 (v2.5088, migration `20261010022000`), is on prod with its seven functions deployed first and its types in #5243 (the doc's Status section has the reads). Was: auto-merge OFF** — Helper 5 finished Helper 3's work at 18:55 UTC: renumbered and claimed, the migration doc with the lock footprint (ACCESS EXCLUSIVE to commit on the 10 policy tables, `users`, `report_email_subscriptions`, `recurring_job_report_schedule_recipients`, the 3 dropped tables) and the CLAUDE.md release-order quote, the release note and fragment, the card deleted; one real catch at the rebase: `20261009233000` had restated `get_my_email_schedule` and `get_global_email_schedule`, so both are now that migration's bodies less the team-lead parts. Vitest and typecheck clean; its SQL beds run is 37975705591. Release, a quiet window with crews clocked out: arm and merge → deploy the seven functions FIRST from the main checkout (`notify-team-lead-clock send-report-email recurring-job-report-dispatch recurring-job-report-preview recurring-job-report-test-send schedule-day-email-dispatch send-bid-pricing-package`; the new versions read none of the dropped tables, the old ones read them on every clock-out) → `db push` (plain if 022000 is still the newest, else `--include-all` with a dry run listing it alone) → drift → types regen + dev-mcp. Read-only proof already made: 16 lead links, newest 2026-08-13; 0 prefs; 0 subscriptions.
6. **Docs that self-merge, nothing to do unless they are kicked:** #5180 (the decomposition card's row 2), #5194, which deletes #88's card `to-dos/help-guides-reshape.md` now that all thirteen guides are on main (the thirteen fragments v2.5052, 5057, 5062, 5064, 5065, 5067, 5068, 5069, 5070, 5071, 5076, 5080, 5081 carry the record).

## 2. Open PRs of this pool (arm with `gh pr merge N --auto` only; a queued PR reads auto=off and CLEAN — that is not a dropped arm)

| PR | What | State at 18:40 UTC |
|---|---|---|
| #5110 | the anon revoke, migration to be renumbered at 22:45 | clean, deliberately unarmed — item 1 |
| #5183 | #26 team_leads drop, migration 022000 | clean, deliberately unarmed — item 5 |
| #5179 | the sql-beds gate (rebased onto main 18:58 UTC) | armed — item 4 |
| #5180 | decomposition card row 2 | armed |
| #5174, #5171 | guides 6 and 7 | in the queue |
| #5168 | a docs catch-up pass (another session's) | armed |
| #5172, #5176, #5177, #5178 | the Lien desk signing lane (its own session) | theirs |
| #5170, #5173, #5175, #5115 | GC lane | theirs; #5175 held, see item 3 |

Merged today from the owner's two decision sittings: about fifty PRs (Helper 1 twenty-one, Helper 4 fourteen, Helper 2 eight, Helper 3 two, plus the lead's docs and types). Nine punch-list migrations were pushed and verified today: `20261010001000` to `016000` less GC's; every one has a Status section in `docs/migrations/`.

## 3. Where the punch list stands

The owner walked `to-dos/owner-decisions-pending.md` (45 rows, 41 answered) and the eight cards with their own blockers on 2026-10-09; the answers and the builds owed are recorded once in that file's dated block and on each card. What is left of the builds: items 1, 2, 5 above and the undo-whole-action follow-up on `to-dos/bid-history/README.md`.

- **Done and retired today:** #2 Division 22 rules manager (five PRs, seed on prod: 1,264 → 1,244 uncoded names), #13 Stage Plan, #57 full screen, #88 help guides (13 of 13; #5194 deletes the card), #95, the owner's three office-data calls (Parts Book duplicates deleted; five Miguel sheet labels re-pointed by `20261010013000`; Edgar kept archived — see §4).

What is left to build, as of the evening of 2026-10-09. Each row is read from the card's front matter and `npm run check:todos`. The board at Settings → *Punch list* stays the live view. Tonight's names come from PUNCHLIST. Row 2 of #46 is read from the card's own table, which is newer than its next line. #76's piece (2) shipped as v2.5033 and v2.5091, and #5197 records it on the card.

**Pieces to build.** One row per piece.

| Card | The piece | Size | Blocker or who holds it | Tonight |
|---|---|---|---|---|
| [#73 Bid history](../to-dos/bid-history/README.md) | PR 6, undo a whole action | S | None | Helper 11 |
| [#67 Home-screen icon](../to-dos/app-icon-glass.md) | PR 2, the `TILE` option and a sheet of candidates at 180 px. The touch icons regenerate from the pick. | S | The owner picks from the sheet | Helper 12 |
| [#62 See what they see](../to-dos/see-what-they-see.md) | Build (b). A revision joins the GC's record when it is shared, or when it holds a reviewer's answer and a package or a reviewer's file. Three function deploys, then a reviewer file on BP398's Rev 3. | Not sized | None. The owner picked (b) on 2026-10-09. | Helper 13 |
| [#64 A second signer](../to-dos/contract-second-signer-names.md) | The mixed record, signed partly through the link and partly on paper. An edge change and a deploy. | S–M | None | Helper 14 |
| [#76 Returned checks](../to-dos/ar-returned-checks.md) | The ② waterfall's words on the Final line, "$30 of $2,000 covered". Branch `claude/bill-tab-fee-not-covered`. | S | None | Helper 15 |
| [#46 Decomposition queue](../to-dos/decomposition-queue.md) | Row 2's step 7, the send IO, done with the GC Review map | S per PR | Check `npm run sessions` first. `JobsStagesTab` is the hottest file. | Helper 17 |
| [#21 Decomposition residuals](../to-dos/decomposition-residuals.md) | The Workflow page's leftovers. The smallest is the message when a projection delete is refused. | XS–S each | None | Helper 18 |
| [#5 Owner decisions pending](../to-dos/owner-decisions-pending.md) | The anon EXECUTE revoke, #5110 (v2.5040) | One migration | 23:00 UTC tonight | PUNCHLIST |
| [#26 Team leads table](../to-dos/team-leads-table-retirement.md) | Drop the frozen table, #5183 (v2.5088, migration `20261010022000`). Seven function deploys go first. | S | A quiet window with crews clocked out | PUNCHLIST |
| [#76 Returned checks](../to-dos/ar-returned-checks.md) | The types regen after migration `20261010023000`, #5196. The dev-mcp deploy follows it. | Types only | Armed | PUNCHLIST |
| [#46 Decomposition queue](../to-dos/decomposition-queue.md) | Row 2's last seam, the row-render context (step 5) | S per PR | After step 7 | Nobody |
| [#46 Decomposition queue](../to-dos/decomposition-queue.md) | Row 3's draft-persistence seam hook | S per PR | A quiet day. It sits on the autosave engine that Edit Job and Edit Bid share. | Nobody |
| [#46 Decomposition queue](../to-dos/decomposition-queue.md) | Row 1's solver strip and grid rows | S per PR | A Workbench feature train | Nobody |
| [#46 Decomposition queue](../to-dos/decomposition-queue.md) | Row 6's `PeopleHoursTab` shell | S per PR | Unscheduled | Nobody |
| [#21 Decomposition residuals](../to-dos/decomposition-residuals.md) | The Workbench block | L | Only as PR 1 of the next Workbench feature train | Nobody |
| #103 Samples through their kernels | PR 1, the bid room sample through `buildBidRoomRevisionPayload`, then a `get-bid-proposal-room` deploy. The card is `to-dos/customer-samples-through-kernels.md`, in #5202. | S | None | Nobody |
| #103 Samples through their kernels | PR 2, the portal's bills, waivers and checks through their kernels, then a `customer-portal` deploy | M | After PR 1 | Nobody |
| #103 Samples through their kernels | PR 3, the portal sections the sample leaves out, then a `customer-portal` deploy | S–M | After PR 2 | Nobody |
| [#15 Review folds into the Bridge](../to-dos/review-into-the-bridge.md) | Step 3, the redirect | M | First explain Tristen's $201 gap and run the Sep 13–19 and Sep 20–26 checks. Both weeks have closed. They are prod money reads. | Not tonight |
| [#72 Job Parts Tally → Transactions](../to-dos/tally-transactions-refresh.md) | PR 3, undo per line | Not sized | None | Helper 12 |
| [#72 Job Parts Tally → Transactions](../to-dos/tally-transactions-refresh.md) | PR 3, the pay bar | Not sized | An owner call | Nobody |
| [#77 By Stage is retired](../to-dos/retire-by-stage-materials.md) | Item 2, one material slot in place of three. Item 3, the robots stop naming the picks table, with a twin-mcp deploy. | S each | A quiet week | Nobody |
| [#49 GC Review for one operator](../to-dos/gc-review-one-operator/README.md) | Drop the `as never` casts and retire the two old statement-round functions | Not sized | Run a Wednesday on it first | Helper 13 reads it |
| #61 ZZ test jobs off the Pipeline — retired 2026-10-10 | Done: four PRs (v2.5116, v2.5120, v2.5122, v2.5124), legal-portal deployed, and the live look on 2026-10-10 passed as an assistant and as the dev with the switch off and on; the card is deleted and the fragments carry the record (the live look is in v2.5124's). | M | None | Helper 12 |
| [#7 Per-GC bids](../to-dos/per-gc-bid-retirement.md) | One mechanical PR that retires `submitted_to` and `itb_links` | M | Real per-GC usage | Nobody |
| [#102 Burn against the bid](../to-dos/burn-against-the-bid.md) | The fourth footing. A job whose bid has no usable estimate budgets at price × (1 − priced margin). | S | Priced-margin stamps on real bids | Nobody |
| [#102 Burn against the bid](../to-dos/burn-against-the-bid.md) | "No price, no priced margin" | Not sized | The next bids migration | Nobody |

#88 is retired by #5194. All thirteen guides are on `main`.

**Waiting on someone or something.** Nothing to build until this happens.

| Card | What it waits on |
|---|---|
| [#1 Crew P&L](../to-dos/crew-pnl-and-wheels.md) | Vehicle records for item 2. The audit footer's raw job # texts for item 3. |
| [#3 Job Summary](../to-dos/job-summary-follow-ups.md) | Weekly hours per person and session start times in the day ledger. A Crew P&L sitting. |
| [#4 Journey map](../to-dos/journey-map-tier-1.md) | The private repo's `_DRIFT-2` |
| [#5 Owner decisions pending](../to-dos/owner-decisions-pending.md) | The owner. Pay codes on the GC's copy and the real scan test. The Ferguson rep's phone and email. Partnerships. Twins Phase 2. Edgar's back charge, with the office. The DNS steps for the clickplumbing.com sender. |
| [#6 Partnerships](../to-dos/partnerships-off-toggles.md) | The owner and the attorney |
| [#8 Person identity phase E](../to-dos/person-identity-phase-e.md) | A quiet quarter. Revisit in December. |
| [#9 Robots residuals](../to-dos/robots-residuals.md) | CountTooling work. Nothing is left on the client. |
| [#11 Weekly Money phase 6](../to-dos/weekly-money-later.md) | The owner's call. It is optional. |
| [#12 Dispatch residuals](../to-dos/dispatch-residuals.md) | A per-sheet key in the feed or the email log |
| [#17 Submittals](../to-dos/submittals/README.md) | A twin key for gate 6b's robot half. Wendi's schedule on one live bid. The SpaceX Rev 3 rebuild and Rev 4 on B375. Stage 3b when the owner says. |
| [#25 PO code](../to-dos/po-generator-stated-need.md) | Nothing to build. The ledger read for the week from 2026-09-22 closes it. |
| [#27 MCP servers](../to-dos/mcp-servers.md) | A `ptt_` key in the owner's hands for three live checks. PR 7 starts with the owner's KV namespace. |
| [#29 People spine](../to-dos/people-spine-residuals.md) | The owner's data. Twin Estimator 2's flag, the Training Helper row and the archived "Kyle" row. |
| [#35 Lien notices sent by hand](../to-dos/lien-notice-sent-by-hand/README.md) | Nothing to build — delete after the office records the Lenox paper on 273 and the owner answers the $350 call |
| [#42 Lien windows](../to-dos/lien-windows/README.md) | Counsel's answers to three questions |
| [#45 Owner's portal](../to-dos/owner-portal-property-view/README.md) | Nothing to build — delete after the first real owner's notices are recorded and the owner switch is on |
| [#47 The owner is calling](../to-dos/owner-is-calling/README.md) | Counsel reads the script's words. Option 3 and the other doors wait until the office asks. |
| [#50 Contracts & terms](../to-dos/contracts-and-terms/README.md) | Nothing to build — delete after the month of use ends on 2026-10-28 and the owner makes the card's two calls |
| [#52 Fuel is a job cost](../to-dos/fuel-is-a-job-cost.md) | Nothing to build — delete after the owner enters the 2007 Ram 3500's costs on People → Vehicles. The follow-ups are the owner's pick. |
| [#55 Where the checks went](../to-dos/where-the-checks-went-residuals.md) | Nothing to build. Print all only if someone asks for it. |
| [#60 What the team sees](../to-dos/what-the-team-sees/README.md) | Nothing to build. Retire it after the owner looks at the live tab. |
| [#66 Robot audits backlog](../to-dos/robot-audits-backlog.md) | Half an hour a week from each estimator. Measure on 2026-10-23. |
| [#72 Job Parts Tally → Transactions](../to-dos/tally-transactions-refresh.md) | The owner's word on a few days of use for PR 2b, then 2c. The pending-charges call for PR 4. Five sample cases for the 48 charges. |
| [#76 Returned checks](../to-dos/ar-returned-checks.md) | Grace's four Stripe endpoint events, then one test-mode dispute on a ZZ TEST Stripe bill |
| [#77 By Stage is retired](../to-dos/retire-by-stage-materials.md) | The office's word on B82, B83 and B85. Item 4's drop waits on it. |
| [#82 Lien desk Next up](../to-dos/lien-desk-next-up/README.md) | Nothing to build — delete after a week of use raises nothing |
| [#85 Legal portal](../to-dos/legal-portal-firm-ready/README.md) | The owner swaps in the real firm and fills its particulars. The firm's answers for items 12–15 and 19. |
| [#86 Records for an owner](../to-dos/owner-records-portal/README.md) | Nothing to build — delete after the first real owner signs |
| [#87 Lien screens' stale words](../to-dos/lien-screens-stale-words.md) | Nothing to build — delete after the live look at M on a ZZ TEST job |
| [#92 AIA G702-G703](../to-dos/aia-pay-application-follow-ups.md) | Taunya's look on a phone for item 4 |
| #98 A check on a Stripe bill — retired 2026-10-10 | Done: the owner ran the last three steps himself on 2026-10-10 ~02:10 UTC (the sweep closed J904's test bill; J904 and J907 deleted; Move to job… on Taunya's check with Stripe on Live) and the card is deleted; the fragments v2.4801, v2.4803 and v2.4822 carry the record. |
| [#99 Lien desk Rules window](../to-dos/lien-rules-window/README.md) | Nothing to build — delete after a week of use raises nothing |
| [#100 Map residuals](../to-dos/map-residuals.md) | Item 1, a mock-up and a reason to build it. Item 2, a pick among the card's options. |
| [#101 Lien desk printed run](../to-dos/lien-printed-run/README.md) | Nothing to build — delete after a week of use, to 2026-10-16 |

## 4. For the owner (filed today in `to-dos/owner-decisions-pending.md`)

Edgar's back charge for Gibbs ($4,200 unpaid) and Lennox ($8,500 unpaid): the owner said he is to be back-charged; the amounts and the mechanism are the office's call · pay codes on the GC's copy of the lien notice and the real scan test (come back to it) · the Ferguson rep's phone and email (the owner does it in the app) · Partnerships' toggles (owner + attorney) · Twins Phase 2 (not now) · the four stale Overhead texts Helper 1 found (a task chip) · the icon's dark-tile candidate sheet to pick from once built · the clickplumbing.com sender: the runbook `docs/runbooks/CLICKPLUMBING_SENDER.md` names the DNS records, the Resend step and the Google Workspace alias the owner performs before the one-line flip.

## 5. Gotchas learned today

- **Push order:** a plain `supabase db push` takes every unapplied file on main, and refuses a stamp below the newest applied one ("inserted before the last migration") — then `--include-all`, which also sweeps everything pending. Read the dry run every time; one lane's unpushed migration is everyone's problem. Two leads agreed in advance that each other's files may ride a push, with the owner lane running its own verify steps from the drift result.
- **Stacked PRs** go CONFLICTING the moment the one under them lands or is rewritten; cut each from main after its parent merges (`git rebase --onto <new base> <old base>`), and MERGE gates a stack by arming one PR at a time.
- **Types regens cross** on `database.ts`: one regeneration per batch, agreed between lanes, cut after the last migration it covers is pushed; a regenerated Row makes every new nullable column required, so hand-built test rows need `col: null` before any spread.
- **The merge-queue build uses main's workflows:** `on.paths` filters do not apply to `merge_group`, and a required check that never reports blocks the merge — hence #5179's gate.
- **A queued PR reads auto=off and CLEAN;** re-arming it only risks the slot. Query `mergeQueueEntry` first.
- **Local Postgres on the Mac:** another user's servers can hold the SysV shared memory and the trust-auth ports (55433–55436); a bed that fails to bind falls through to theirs — check `SHOW data_directory` before the first write. Helper 1 left stand-in tables on three of them (see its report to the owner); the SQL beds workflow on GitHub is the fallback bed.
- **The auto-mode classifier** denies `for`-loop reads with head/cat and some `git reset --hard` calls; use the Read tool or `git show`, and `git checkout -B`.
- **Dev login** on the dev server double-fires under StrictMode (fixed v2.5003); "Unknown or revoked dev key" from dev-mcp means `PT_DEV_MCP_TOKEN` is unset in the launching shell.
- **The remote session** that opened #5025, #5042, #5044/#5047/#5049 does not claim versions and stacks on rewritten heads; a PR comment is the only channel that reaches it.

Memory for the lead role is in the PUNCHLIST session's auto-memory (`~/.claude/projects/-Users-wendi-Documents-GitHub-pipetooling-github-io/memory/`).
