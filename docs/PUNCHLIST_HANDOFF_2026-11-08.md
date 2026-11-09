# Punch list hand-off — 2026-11-08

Status: written 2026-11-09 00:30 UTC (the evening of 2026-11-08 in Austin) by the coordinating session that ran the day's punch-list pool, for whoever picks the work up on any machine. Every fact here was read from `origin/main`, GitHub and prod at that hour. The cards themselves are the source of each item's state; this page holds only what lives on no card: what is owed now, what is open, and who is working on it.

**How the day ran.** The owner asked for every Ready-to-build card but #46, then every card with builder-side work left, then answered nine owner picks. One session per card, at most eight at once (eighteen at once ran the Mac out of memory; the typecheck now queues machine-wide since v2.6736, so the cap is about the sessions, not the checks). The Fable usage limit stopped four sessions late in the evening; they now run on Opus 5.5. About 55 PRs merged between 19:00 and 00:10 UTC.

## 1. Owed now, in order

1. **Five edge functions wait on #285's migration.** Thirteen were behind main at 00:20 UTC. Six were deployed by their own sessions, and the coordinating session deployed five more from `origin/main` at 00:47 UTC (`customer-portal`, `gc-trade-portal`, `messages-nudge-dispatch`, `photo-save`, `quo-send`), each answering an OPTIONS probe with 200. Left, held back on purpose: #285 PR 1 (#7343, v2.6714) merged at about 00:40 with `20261108200000_file_index_reach`, which was not in prod's ledger at 00:45 (main 1,179 files, prod 1,178), and these five carry its code:

   | Function | Behind for |
   |---|---|
   | `dev-mcp` | v2.6713 (#287), v2.6714 (#285), v2.6715 (#289), v2.6731 |
   | `drive-link` | the shared kernel copy, and v2.6714 |
   | `file-index-sweep`, `hr-evidence-drive`, `plan-set-files` | v2.6714 |

   Push the migration first, then deploy the five, then read `npm run check:edge-drift` clean. #285's session was asked to do both. After `dev-mcp` is up, #287's and #289's live checks on a ZZ TEST person can run (their cards say how).

2. **Migrations to push right after their PRs merge**, from a clean checkout of main, each with its Applied line:

   | PR | Card | Migration |
   |---|---|---|
   | #7370 | #209 leftover 4 | `20261109010000_on_site_job_summary` |
   | #7375 | #205 PR 4 | `20261108220804_gc_trade_files_note`, then `gc-trade-portal` and `submit-gc-trade-portal` |
   | #7376 | #207 the press | `20261108224500_answered_from_own_mailbox` |
   | #7384, #7377 | #263 B and C | `20261108223000_my_email_sent_side`, then `gmail-mine` |
   | #7343 (merged), #7344 | #285 PRs 1 and 2 | `20261108200000_file_index_reach` (owed now, item 1), then `20261108220000_case_search_files` with PR 2, each followed by `dev-mcp`, `file-index-sweep`, `hr-evidence-drive` |
   | #7346, #7347, #7348 | #288 PRs 1 to 3 | `20261108210000_shared_documents`, `…230000_matter_document_counsel_only`, `…233000_matter_document_read_by_section`, then `dev-mcp`, `legal-portal` |
   | #7386 to #7400 | #188 PRs 2 to 10 | `20261109001000` to `20261109006000`, the `dev_gates_*` set, then `paid-job-email`, `import-manual-transactions`, `manage-manual-account` |

   Every one is stamped above the newest applied version except #7321's below.

3. **#7321 (v2.6697, #171 decision 2, a line marked settlement only)** came from an earlier session outside this pool. It reads armed and DIRTY: it needs main merged in, and its migration `20261108123000_legal_claim_line_settlement_only` sits below the applied max, so its push takes `--include-all`. Then `legal-portal`.

4. **Types**: #7395 (`chore(types)` after `20261108234500`) is open. After the pushes in item 2, one more `chore(types)` from a prod regen covers them; open none while an open one's files already match.

## 2. Open PRs of this pool

Arm with `gh pr merge N --auto` only. A queued PR reads auto off and CLEAN; that is not a dropped arm. A stacked PR is armed only once its parent lands and GitHub retargets it to main.

| PR | Card | What | Waits on |
|---|---|---|---|
| #7344 · #7345 | #285 | the search union, the backfill verb | PR 1 (#7343) merged; 2 and 3 are drafts to ready in order |
| #7346 · #7347 · #7348 | #288 | one documents table (the owner's pick of 2026-11-08), counsel-only, the section reads | #287 has merged, so PR 1 can be readied and its server version bumped |
| #7367 · #7370 | #209 | the Short press, the summary past 5,000 rows | PR 3 armed; PR 4 on it |
| #7373 · #7375 · #7379 · #7380 | #205 | the stages fold, the files list, the thread, Word to every trade | PR 3 armed; the rest stacked |
| #7376 | #207 | the Answered from my own mailbox press | its checks; the session is resuming on Opus 5.5 |
| #7384 · #7377 | #263 | the Sent side, the guess reads the conversation | the queue |
| #7386 to #7400 | #188 | dev gates PRs 2 to 10 | in order; the session is still working |
| #7390 | #176 | the card's decisions recorded | draft until #7382 and #7385's fragments are on main (both merged 00:07) |
| #7378 | #123 · #192 · #217 | the owner's picks written onto the cards | the queue |
| #7396 | #280 | the card's after figures | the queue |
| #7395 | — | types after `20261108234500` | the queue |

## 3. The sessions

Started from this coordinating session; reach each with `SendMessage` to its id. A note from one is its report, not proof: read the PR before saying it is done.

| Card | Session id | Where it stands |
|---|---|---|
| #188 dev gates | `local_9f38557d-b4b5-47ac-aebd-eb57edecc78e` | working, PRs 2 to 10 open |
| #207 mailbox | `local_0e9e1681-9af5-4f2c-80f1-02b7451514aa` | told to deploy `gmail-sync` and see #7376 through |
| #263 My email doors | `local_11d5fdb3-4d12-430a-8d9d-cb4dabfe2724` | B and C in the queue; push and deploy after |
| #285 file text | `local_6822bdc5-8c08-4a70-aaf2-5d331219ae36` | stack of three; the beds caught and fixed a vector-parameter defect |
| #288 matter documents | `local_6c403fd2-0c9d-43bf-a57b-765cfa2dcd19` | waiting to ready PR 1 now #287 is in |
| #209 materials | `local_023fb113-2dab-484e-94b9-9ab5faa7d4c8` | arms PR 4 when PR 3 lands, then the push |
| #205 trade portal | `local_8a98019e-e014-4db7-afd8-2ea0eaf94571` | PR 3 armed; deploys owed after each merge |
| #176 Quickfill | `local_3735b115-5baf-40c8-abe5-3f9b88d0237e` | readies #7390 now both PRs merged |
| #287, #289 | `local_76d2f927-…`, `local_d36aa0f7-…` | merged; the `dev-mcp` and `gmail-mine` deploys and live checks are item 1 |

The rest of the day's sessions (#111, #119, #125, #129, #150, #153, #171, #173, #174, #189, #212, #234, #257, #280, #281, #283, #284, #286, the picks record, the typecheck lock) finished their work. Auto-archive on a closed PR is on for the account, so their worktrees go back as their PRs close.

## 4. What the owner did today

- **Picks**: #123 Done and Billed ask (Billed flipped to Asks on prod, read back); #153 build the Remove press (shipped v2.6749); #176 Jobs Billing into Complete, Dailys kept as is, no portion but oldest first, the round is the office's (shipped v2.6750, v2.6754); #188 every recommendation as written; #192 keep the drawn thresholds; #217 deferred, the card stays; #288 the shared documents table.
- **Presses in his Chrome**: #185's Google review link saved; #159's `gmail.metadata` scope authorized and Mail the app counts switched on with bids@, team@, Taunya, Grace and Wendi; #27's twin-key checks (both `ptt_`), both test keys revoked.
- **Open with him**: #240 the cheaper-AI question, answered on its card with a recommendation to keep the built pair; the Auto-fix press on each PR a session opened with `gh`.

## 5. What is left on the board after the open PRs land

The cards hold it. In short: the owner's looks and walks on what shipped (most Close out rows), the people's reads (Brian Herber on #120 and #122, counsel on #42, #144 and #231, the firm on #85, Grace on #230, Taunya on #222 and #277, Wendi on #223), the cards waiting on time (#130 Dec 7, #190 Nov 17, #66 Nov 19, #187 Jan 25), and #46, untouched by the owner's choice. `npm run shortlist` prints the board as it stands.
