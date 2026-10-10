# Punch list hand-off — 2026-10-10

Status: handed off 2026-10-10 ~07:20 UTC by the PUNCHLIST lead session on Todd's Mac (the session that ran the 2026-10-09 evening pool, Helpers 11–19). Every fact here was true when written; re-read `gh pr list`, the merge queue and `npm run check:migration-drift` before acting. Repo rules: `CLAUDE.md` first. Pushes and deploys ran from the MAIN checkout at `origin/main` (it is on `main` now; it had been parked on an old branch). The previous hand-off, [`PUNCHLIST_HANDOFF_2026-10-09.md`](./PUNCHLIST_HANDOFF_2026-10-09.md), is done in full (its items 1, 2, 4 and 5 carry their done lines); its §3 map is superseded by the cards.

## 1. Owed now (small)

1. **The 062000 live walk** on a ZZ TEST job (`docs/migrations/20261010062000_case_fee_back_on_bill_delete.md`, "Live, on a ZZ TEST job"): Helper 11 was running it at hand-off; its result lands as a comment on #5283 or in this doc's next amendment. Nothing else is owed on prod: migration drift 852/852, edge drift clean for everything the import walk proved (see §4).
2. **Two docs PRs in the queue:** #5294 (types after 062000 and GC's 063000 — gc 7 may take it over as it did #5243) and #5295 (062000's Status). Nothing to do unless they are kicked.
3. **#5288** (card #104's notes) merged; **#5282** (bid-history card roll-up) merged.

## 2. What the pool shipped (2026-10-09 20:50 UTC → 2026-10-10 07:10 UTC)

52 PRs from Helpers 11–19 plus the lead, all merged or queued; four migrations pushed and verified by PUNCHLIST (027000 the anon revoke, 022000 the team_leads drop, 044000 the trip-charge rider, 062000 the case fee back on delete), each with a Status section in `docs/migrations/`. By card:

- **#73 bid history:** PR 6 Undo a whole action (v2.5098), the 16-step ZZ Test walk passed live (#5254), two fixes from the walk (v2.5130 book pick re-read, v2.5132 no Undo on an authorless action). Left: the labor autosave.
- **#61 ZZ test jobs hidden:** four PRs (v2.5116, v2.5120, v2.5122, v2.5124), live-verified as an assistant and a dev; card retired. Left on purpose: ZZ bids in header search; a dev's notifications and tasks feeds.
- **#67 app icon:** the owner picked B (yellow tile, heavier ink); v2.5117 regenerated the icons; left: re-add on a phone and photograph.
- **#64 second signer:** the mixed record (v2.5101), walked live on J1064; card retired. **#104** (new): Copy link re-stamped a PDF-emailed row — fixed client-side (v2.5119) and in send-job-contract (v2.5145, deployed); left: a live check, a hand-out trace only if wanted.
- **#76 returned checks:** card corrected (the fee shipped v2.5033/v2.5091), the waterfall wording (v2.5102). **#105** (new): a deleted bill gives its fee back (v2.5144, migration 062000) and Split keeps a trip charge (v2.5140); left: the write-down cap and three XS items ("After #5255").
- **Trip charge** (no card, the owner's brief): v2.5129, migration 044000 — a turnaway trip charge is a rider on its own bill; no job had ever carried one.
- **#72 Tally:** undo per line (v2.5107) and the pay bar for payroll-access roles, sends to a person only (v2.5118). **#49:** the casts dropped (v2.5106); (b)/(c) wait for a Wednesday of use (zero marks or asks since 09-28). **#46 row 2:** steps 7 and 9 (v2.5099, v2.5109); steps 10 and the dedupe left. **#21:** the three Workflow leftovers (v2.5094, v2.5103, v2.5108); the WorkflowStageCard stays by decision. **#88** retired (13 of 13). **#98** retired (the owner ran its steps; J904 and J907 deleted through the app 05:30 UTC). **#103** (new): the samples built through their kernels, PRs 1, 2 and 4 (v2.5105, v2.5110, v2.5112); PR 3 left. **#26** done (v2.5088). **#5** the anon revoke done (v2.5040).
- **CI:** the SQL beds pull their images from a mirror first (#5214) and the bed change filter diffs from the merge base (#5223).

## 3. Owner decisions taken tonight (recorded on the cards)

Import undo removes what the action added, reversibly; #5183 released once crews clocked out; the ZZ walk by a helper; #98 done by him; icon B; the pay bar marks only sends to a person; #49 waits for use; #61 built; the trip-charge fix built; J904/J907 deleted on his word; Twin Estimator 2 flagged `is_digital_twin` (05:2x UTC, one row); #105 gap 1 and #104's guard built tonight on "keep going".

## 4. Gotchas learned tonight

- **Review threads block the queue:** main requires every review thread resolved; an inline finding leaves a green, armed PR BLOCKED with no queue entry until the thread is resolved (an hour lost). Reviewer posts one top-level comment; authors resolve threads after fixing.
- **The drift fallback is blind:** when `check:edge-drift` prints "could not read the deployed source", its list is a date guess (53 named, 8 real). Walk imports from each named `index.ts` through `_shared/` and deploy only bundles that hold a file `git log -- supabase/functions/_shared` shows changed. Never deploy another lane's `gc-*` on that signal.
- **Deploy with Docker up:** the CLI bundles through a Docker container when Docker runs (the beds start it) and fails on the mount; pass `--use-api`.
- **The push script regenerates types** and may show another lane's pending additions; one regen owner per batch — hand the PR to GC's keeper or discard, never two.
- **Stamp races:** GC minted 042000 while a helper was writing a 042000; always claim from `refs/claims/migration-*` plus open PRs before naming a file.
- **A stacked docs PR** carries its base's commits with new SHAs; rebase `--onto` after the base lands.
- **The hourly cron fires only when the session is idle;** a busy night skips it — write the sentence by hand on the hour.

## 5. Sessions

Helpers 13, 15, 16, 17, 18 and 19 ended around 23:3x UTC; their worktrees (`.claude/worktrees/punchlist-agent-helper-*`) hold nothing unpushed (Helper 17's step 9 was pushed as #5237 by the lead). Helpers 11, 12 and 14 were alive at hand-off, holding. MERGE and GC MODE run their own lanes; GC's keeper (gc 7) owns the combined types PRs. Memory for the lead role is in this session's auto-memory (`~/.claude/projects/-Users-todd-Documents-GitHub-pipetooling-github-io/memory/`, the `docs-punch-list-arc`, `review-threads-block-the-queue`, `supabase-cli-in-worktrees` and `three-line-briefs` notes).
