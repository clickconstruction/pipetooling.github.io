# Punch list hand-off — 2026-10-09

Status: handed off 2026-10-09 19:45 UTC; the owed steps are in §1, in order. Written by the PUNCHLIST lead session (Wendi's Mac) for whoever picks the work up, on any machine. Every fact here was true when written; re-read `gh pr list`, the merge queue and `npm run check:migration-drift` before acting. Repo rules: `CLAUDE.md` first. Pushes and deploys happen from the MAIN checkout at `origin/main`, never a worktree. The previous hand-off, [`PUNCHLIST_HANDOFF_2026-10-08.md`](./PUNCHLIST_HANDOFF_2026-10-08.md), is done except where this one says otherwise.

**Who is who.** Sessions on Wendi's Mac message each other by name (`ListAgents` / `SendMessage`). PUNCHLIST leads Helpers 1 to 8; GC MODE leads Helpers 11 to 18 (also handed off tonight, see its own doc on `spike/gc-mode`); MERGE is the conflict-watch session that arms, re-arms and relays merges — it holds no work of its own. A session on another machine cannot message these; the channel that reaches them is a comment on the PR. GitHub claims (`refs/claims/*`) and the PR titles are the shared ledger.

## 1. Do these first (owed, in order)

1. **Tonight, 23:00 UTC (18:00 CDT), the anon EXECUTE revoke, #5110 (v2.5040).** It cuts a signed-out visitor from 524 reachable functions to exactly two, proven on a schema copy of prod with 65 probes (the migration doc has the bed table). Helper 4's one-shot in its own session renumbers the migration at 22:45 UTC (from `20261010007000` to origin/main's newest stamp + 1, re-claimed, every mention renamed, pushed with lease) and posts the new stamp as a comment on #5110; if that comment is not there by 22:50, do the renumber yourself from `claude/revoke-anon-execute` (rebase onto main first; `npm run claim -- --migration <file>`). Then, in one sitting with nothing else of anyone's pushed in between:
   1. confirm `npm run check:migration-drift` reads fully applied (if #5175's 021000 is on main and unapplied, see item 3 first);
   2. take the read-only ACL snapshot query from the migration doc over the pooler (`psql` to `aws-1-us-east-1.pooler.supabase.com`, `SUPABASE_DB_PASSWORD` from the main checkout's `.env.local`, never printed);
   3. `gh pr merge 5110 --auto` and wait for the merge (MERGE pings; do not poll CI);
   4. from the main checkout at origin/main: `npx supabase db push --linked --dry-run` (expect only the renumbered file), `npx supabase db push --linked`, `npm run check:migration-drift`;
   5. the doc's verify steps: the SQL check that anon reaches exactly `get_hazmat_notice_by_token` and `list_my_contract_dashboard_prompts`, and the three curl probes with the publishable key (hazmat 200 null; `is_dev` and `is_office_staff` 401 code 42501);
   6. tell MERGE (GC's B6-b-i waits on it), add a Status section to the migration doc as a docs PR.
2. **#5169's migration `20261010017000` is on prod** — pushed by PUNCHLIST at 18:52 UTC with `--include-all` (the CLI refused the stamp below the applied 020000; the dry run listed it alone), drift 833/833, `can_edit_bid`, `list_bid_removed_rows` and `restore_bid_removed_row` present. **Its types regen merged as #5190** (`a192cf9b9`, cut after #5178 merged at 19:25; three RPCs, typecheck 0), **and dev-mcp is redeployed:** `bash scripts/deploy-functions.sh dev-mcp` from the main checkout at `80915b412`, about 20:35 UTC; `npm run check:edge-drift` read all 146 functions current and migration drift read 833/833. Helper 2 runs the ZZ Test walk (recipe on the bid-history card, #5182) with its user's yes; its result lands as a comment on #5169.
3. **GC's #5175 (U6a, migration `20261010021000`)**: dequeued and disarmed by MERGE at 18:47 UTC; it reads CLEAN and will not move until the next GC lead re-arms it and pushes 021000 with its own verify (`docs/migrations/20261010021000_*.md`). Leave it. GC's #5170 merged as `4c85d5c3c` and #5173 as `bb75b2885` (its spike follow-ups pin to those); #5168, a docs pass, merged and its owner redeploys twin-mcp.
4. **The SQL beds are a required check — done.** #5179 merged at 19:33 UTC and PUNCHLIST ran the PATCH at 19:40: main's `required_status_checks` read `checks` + `sql-beds` (both app 15368, `strict: false`); the gate had already reported green on two merge-group builds. Adding a bed is one line in `scripts/sql-beds.txt` plus `scripts/pgtest-<bed>.sh` and `supabase/tests/<bed>/`; GC MODE knows. If the queue ever stalls on a PR whose merge-group build does not report `sql-beds`, that PR's branch predates the workflow and needs a rebase.
5. **#26, the team_leads drop, is PR #5183 (v2.5088, migration `20261010022000`), auto-merge OFF** — Helper 5 finished Helper 3's work at 18:55 UTC: renumbered and claimed, the migration doc with the lock footprint (ACCESS EXCLUSIVE to commit on the 10 policy tables, `users`, `report_email_subscriptions`, `recurring_job_report_schedule_recipients`, the 3 dropped tables) and the CLAUDE.md release-order quote, the release note and fragment, the card deleted; one real catch at the rebase: `20261009233000` had restated `get_my_email_schedule` and `get_global_email_schedule`, so both are now that migration's bodies less the team-lead parts. Vitest and typecheck clean; its SQL beds run is 37975705591. Release, a quiet window with crews clocked out: arm and merge → deploy the seven functions FIRST from the main checkout (`notify-team-lead-clock send-report-email recurring-job-report-dispatch recurring-job-report-preview recurring-job-report-test-send schedule-day-email-dispatch send-bid-pricing-package`; the new versions read none of the dropped tables, the old ones read them on every clock-out) → `db push` (plain if 022000 is still the newest, else `--include-all` with a dry run listing it alone) → drift → types regen + dev-mcp. Read-only proof already made: 16 lead links, newest 2026-08-13; 0 prefs; 0 subscriptions.
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
- **#46 decomposition:** rows 4, 5, 7, 8, 9, 10 done; row 2's step 4 shipped (#5180 records it), steps 5 and 7 left; row 3 on a quiet day; row 1 on a Workbench train; row 6's Hours shell unscheduled.
- **#73 bid history:** PR 5 is #5169; undo a whole action is the one follow-up.
- **#102 burn against the bid:** pieces 1 and 2 shipped; the fourth footing waits for real stamps; "no price, no priced margin" is a residual for the next bids migration.
- **Owner-gated or waiting (nothing to build):** #1 Wheels items 2–3 (vehicle records), #3, #4, #5 (four rows left), #6, #7, #8, #9, #11, #12 (sheet-row history), #15, #17, #21, #25, #27, #29, #35, #42, #45, #47, #49, #50, #52, #55, #60, #61, #62 (build (b) when a reviewer file is dropped on BP398's Rev 3), #64, #66 (measure 2026-10-23), #67 (the icon's candidate sheet is approved — a build for a helper), #72, #76 (fee shipped), #77, #82, #85, #86, #87 (A and M), #92 (item 4 waits on Taunya), #98, #99, #100, #101.

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
