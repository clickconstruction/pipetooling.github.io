# Punch list hand-off — 2026-10-08

Status: handed off 2026-10-08 20:30 UTC; the owed steps are in §1, newest state first. The shareable copy with the same content is the Claude Doc https://claude.ai/code/artifact/4ca876fc-e0e8-4171-83cb-e526b47a95f6.

Written by the "Punchlist" lead session for whoever picks the work up. Every fact here was true at the time written; re-read `gh pr list`, the merge queue and the migration ledger before acting. Repo rules: `CLAUDE.md` first. Pushes and deploys happen from the MAIN checkout at `origin/main`, never a worktree. The helper sessions (Helpers 10 and 11, Claude Desktop) are told to hold; messages to them by name still work while they are open.

## 1. Do these first (owed, in order)

1. **Run tonight's migration batch yourself — GC spike has also stopped and handed it over (19:15 UTC).** After **23:00 UTC** (6 pm Central, crews clocked out), from the MAIN checkout detached at `origin/main` with `.env.local`:
   1. `npx supabase db push --linked --dry-run` and read the list. Expect `20261009130000_billing_only_jobs` (GC's — takes trigger locks on `clock_sessions`, `job_schedule_blocks`, `jobs_ledger_team_members` behind `lock_timeout 3s`; if it fails on the timeout, retry a few minutes later) plus ours as merged: `20261009090000_latest_bid_cell_history` (merged), `20261009110000_put_back_bid_change` (#5016, merged 19:23), `20261009170000_reject_clock_session` (merged), and `20261009180000` (row-cap paging, #5022, if merged by then — it was renumbered from 160000, so 160000 is nobody's now); and `20261009120000_gc_save_daily_log` only if Helper 4's #5003 merged. Anything else on the list: stop and find its owner.
   2. `bash scripts/db-push.sh` (push + gen-types + dev-mcp catalog + drift check).
   3. The five verify steps in `docs/migrations/20261009130000_billing_only_jobs.md` (note: `gc_projects`' key is `project_id`).
   4. A types PR on a `claude/types-…` branch with `src/types/database.ts` and `supabase/functions/dev-mcp/catalog.ts`, `gh pr merge N --auto`; redeploy `dev-mcp` after it merges.
   5. Message **Helper 5** "130000 applied, types PR #N" so BO-2 can cut. The GC lane's own hand-off is in `to-dos/gc-mode/PLAN_2026-10-07.md` → Status → "Handoff, evening 2026-10-08"; leave a Status line there only if you are the next GC lead, otherwise message whoever takes "GC spike".
   Then confirm with `npm run check:migration-drift` (expect fully applied).
2. **After those are on prod:**
   - Tell **Helper 11** → it walks *Past values* and *Put back* live on ZZ Test, then cuts the types + dev-mcp catalog regen.
   - Tell **Helper 10** → it regenerates types and drops the reject fallback (one PR).
   - Redeploy `dev-mcp` after each catalog regen merges: `bash scripts/deploy-functions.sh dev-mcp` from the main checkout, then `npm run check:edge-drift` (expect all current).
3. **Stripe dashboard (Grace):** add `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`, `payment_intent.payment_failed` to the webhook endpoint, test and live. The webhook is already deployed. Then someone raises a **test-mode dispute on a ZZ TEST Stripe bill** and checks: the case under Accounts Receivable → *Came back*, the notice, *Put the bill back* (v2.4950, `to-dos/ar-returned-checks.md`).
4. **Two yes/no answers Grace owes, then one small build each:**
   - *May a bid's editors see its removed rows (to Put them back)?* My reading of the owner's calls: yes. Build: a bid-scoped read of the archive's removed rows for the bid's seventeen tables, never widening the archive's dev-only read; goes at the top of Bid history PR 5 (Helper 11 has the design).
   - *#95 close-out:* the finished commit `9a1ea96ad` sits on `claude/close-95-job-address-pin` in worktree `helper-14-91db03` (Helper 14's session ended). It lacks only "The first night" numbers from the precinct nightly (cron.job 51 `court-precinct-nightly`, first run 06:20 UTC 10-08) — a read-only count from `address_geocodes` / `customer_addresses` since 06:00 UTC. Either read them and add the section to `docs/recent-features/v2.4790.md`, or land it with "first night: not read". Rebase onto main (owner-decisions-pending.md conflicts — keep every row), title `docs(to-dos): #95 retired`, no version.

## 2. Open PRs of this pool (arm with `gh pr merge N --auto` only; re-arm after any push; dequeue an UNMERGEABLE entry via GraphQL `dequeuePullRequest`)

| PR | What | State |
|---|---|---|
| #5022 | Bid history — `list_bid_history` paged past the 1,000-row cap (v2.4963, mig 180000) | armed |
| #5020 | Decomposition row 6 — manual-draft editor hook + window | armed |

#5016 (Put back) merged 19:23 UTC.

Everything else the pool opened has merged (≈45 PRs over 2026-10-07/08).

## 3. Where each punch-list row stands

- **#91 Help guides freshness** — retired. **#93, #94, #22, #19, #10** — retired. **#95** — close-out pending (above).
- **#73 Bid history** — capture, 0a/0b/0c, the race fix, PR 2 (History window) and PR 3 (Past values) on main; PR 4 merged; the row-cap fix armed (#5022); **PR 5** (action captions + the removed-rows read) not started. All four owner calls are answered (every estimator sees every change · keep three years · editors may Put back · builder picks default columns; adopt → the pane follows and shows both). Card: `to-dos/bid-history/README.md`.
- **#29 People spine** — code done; card `gated` on the owner (Twin Estimator 2 flag, Training Helper row, duplicate "Kyle" row → Combine…).
- **#46 Decomposition queue** — rows 4, 5, 7, 9, 10 done; row 8 at step 9 (`useTeamSummaryData`); row 6's listed cuts done with #5020 (the `PeopleHoursTab` shell stays unscheduled); rows 2, 3 wait for quiet files. **Owed: one docs PR rolling up the card's front-matter `next:`** (it still says row 10's hooks are left) — do it after #5020 lands so no cell edit goes DIRTY.
- **#64, #86, #92, #76, #55, #35, #45, #50, #52, #99** — at owner-gated or first-real-use stops; nothing to build.
- **#26 team_leads drop** — wants a quiet release (two tables, policies, RPCs, an edge-function cut); not started.

## 4. Owner questions filed today in `to-dos/owner-decisions-pending.md`

GC-payer nudge (#94) · AIA bill tie (#92) · rough map pins (#95) · payment-trace remove line + three #22 policy calls · unchecked GC statements can be sent (#91) · returned-check fee (#76) · multi-assignee sub-labor split in Review (#46 row 8) · pair a supply-house credit to its invoice (#19) · Edgar fold + five labels (#10) · the duplicate "Kyle" row.

## 5. Gotchas learned this run

- The merge queue **squashes**, so stacked PRs go DIRTY on every landing: cut each PR from main; one PR at a time edits a to-do card.
- `db push` applies **every** pending file — read the dry-run list for stamps that are not yours; one lane's held migration holds everyone's.
- `check:edge-drift` walks the whole import bundle: a `_shared/` edit makes every importer "behind"; redeploy them after merge.
- A plain `supabase functions deploy` turns verify_jwt ON unless `config.toml` has the function's `verify_jwt = false` block (the 2026-10-06 cron outage).
- `gen types` from an unlinked worktree: `--project-id yewfzhbofbbyvkvtaatw --schema public,graphql_public`, or copy the main checkout's `supabase/.temp` in and use `--linked`.
- CI's tsc heap cap is now 10 GB (#5011); locally run `node --max-old-space-size=12288 node_modules/typescript/bin/tsc -b`.
- Helper sessions can end with finished commits unpushed — they live in `.claude/worktrees/helper-NN-*` and the shared object store; cherry-pick onto main, re-test, open, arm.
- The dev-mcp connector key reads "Unknown or revoked"; `https://mcp.clicktooling.com/dev` with `PT_DEV_MCP_TOKEN` still answers read-only. Read-only `psql` counts against prod worked from this session (`SUPABASE_DB_PASSWORD` in `.env.local`, `set default_transaction_read_only = on`).
- GC spike reports an unexplained Central-time checkout rebasing GC branches under this git identity — not any Punchlist session.

Memory for the lead role: `~/.claude/projects/-Users-Grace-Documents-GitHub-pipetooling-github-io/memory/punchlist-lead-2026-10-07.md`.
