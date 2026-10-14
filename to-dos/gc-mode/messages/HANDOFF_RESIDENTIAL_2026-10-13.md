# Hand-off: the residential Messages build (customer communication)

*Written 2026-10-13, about 22:45 CT, by the coordinating session ("customer-comunication") at the owner's ask. Everything here is on `spike/gc-mode` under `to-dos/gc-mode/messages/` unless a path says otherwise. Read this file, then `RESIDENTIAL_BUILD_PLAN.md`, then `BUILD_HELPERS.md`. The prototype and the mockups are for reference; the plan is the brief.*

**Closed 2026-10-13, evening: the build shipped.** The plan's *Status* and its §4 carry every PR by cut, its §3 every migration, its §7 what the owner still decides and its §9 what waits until the build is live; this file keeps how the build was run and what bit. The walk on prod is `LIVE_WALK_2026-10-14.md`.

**2026-10-13, about 04:00 UTC, the lead moved** to a session on the owner's other Mac ("cc"). The helpers there were fresh sessions the owner numbered 1 to 10 (helper 10 because two picked 6), each taking the old helper of its number's piece; the two branches committed on the first Mac and never pushed were rebuilt there (R0's SQL as #5593, `stepsByFlow` as #5596). The first Mac's sessions stayed live after the hand-off and kept acting on their standing orders (they rebased #5559, #5497, #5568 and #5586 and renumbered two stamps), so a push you did not make was probably theirs.

## 1. What this is, in one paragraph

The owner wants the plumbing company's own customers on the Messages spine so a tech texts a customer from the job with no misspelling and a customer's reply shows on every active job of theirs. A customer told him "communication from the office has been non existent". The design is `customer-messages-prototype.html` (eight screens, v0.8) and `customer-messages-integrations-mockups.html` (seventeen before-and-after cards, v0.2, with the owner's picks stamped: sixteen Add, history No). The code plan is `RESIDENTIAL_BUILD_PLAN.md`: nine cuts R0 to R9 on top of the GC Messages build's wave 2, its §5 setting the plan's count beside what shipped. Ten helper sessions built it under two leads, from 2026-10-12, about 20:40 CT, to the evening of 2026-10-13.

## 2. How to run this now

1. **Walk it on prod** with `LIVE_WALK_2026-10-14.md`, row by row, as the roles it names.
2. **Migrations**: `supabase db push` after the file is on `main`, from a checkout with `.env.local` (copy it from a sibling worktree; the memory file "env-local-file-is-fine-to-use"). Review the landed file first and run `npm run check:migration-drift` after. A stamp older than prod's newest goes with `--include-all` through `scripts/db-push.sh`. The one left is #5673's `20261014180000`, pushed before `quo-send` is deployed.
3. **Edge functions**: deploy what a PR's fragment names and read `npm run check:edge-drift`. A change to the edge copy of the kernels (`scripts/edge-kernels.mjs`) asks for a redeploy of every function that imports it.
4. **Keep the plan current.** A correction goes into `RESIDENTIAL_BUILD_PLAN.md` the same hour; it is the one place the next person reads.

## 3. The working loop (how the helpers were run)

- A brief names the files, the exports, the tests, the docs, and what not to touch. The helper answers with a **prepare note** of five lines: the tables and columns it found, anything in the plan that does not match main, and its calls. The lead answers each call with yes or a correction and says **go**. The helper builds, breaks two pins on purpose, runs the narrow typecheck, lint, the eight `check:*` scripts and theme, opens the PR with `gh pr merge --auto`, and sends the number.
- One PR per change; kernel and test first; screens in their own PR; the fragment and release note in every PR; `npm run claim` for versions and migration stamps, never a hand-picked number.
- A PR that stacks on another session's open PR opens as a **draft against main carrying the parent's commits, not armed**; when the parent lands the helper rebases onto main, marks ready and arms. (Armed, the queue could land the parent's work under the child's title.)
- Files are owned: one helper per file at a time. Where two needed the same file the second stacked on the first's branch.
- A new Glossary or `ACCESS_CONTROL.md` fact about Messages goes on its own line, never appended to a long paragraph (five PRs were kicked from the queue on it, #5565 three times); a docs pass reconciles them once (#5637, #5674, #5683).
- Models: the lead on Fable 5.1 at high; helpers on Opus 5.5 at xhigh; max only for migrations.

## 4. Every PR

The plan's §4 lists every PR by cut, and its *Status* the ones still in the queue at the close. The table that stood here was the state at the hand-off, before any had merged.

## 5. Each helper's piece

Every piece landed or is in the queue; the plan's §4 names each PR. Nothing is left to assign (§8).

## 6. Migrations

The plan's §3 holds every migration, all on prod but #5673's `20261014180000` (§2).

## 7. Decisions made this session (the owner's, and the lead's in his place)

The owner's: orange is the customer's in the job window; the quick replies are the GC strip and editor with blanks, a phone mark and Spanish; two boxes and one inbox (team@ against office@ still open); Messages in the header with a New lane (mockup A); sixteen integrations Add and history No; candidates and subs as kinds; Job activity inside a person's thread behind a switch.

The lead's, each reversible and recorded in the plan: a lead's home is Messages, not the Prospects deck, with **Add to Prospects** as a press (decision 8 for the owner); R8 · 2 reports and photos is **parked** because a field report keeps no photos on main (decision 9 for the owner); the office close stays 5 PM and is a setting; after hours a reply goes to nobody with the app's one answer and waits for the morning; the bill reminder's day stays stamped from the expected-pay model though the reminder is off; Billed and Paid loop one round per bill; the residential text steps are read from the words until `messages.quick_reply_id`; `FLOW_KINDS` follows the widened check with the test reading the newest defining migration; the "add-on" is a **line on an estimate** (add-on is Estimates' option kind); the push is a new body on the existing `messages-notify`, not a new function; late bills alone count on the badge; a STOP is per box.

What is still the owner's is the plan's §7, *Still open for the owner*; what was built to the lean is the same section's first list; what waits until live is its §9.

## 8. What is left

Nothing to assign. The plan's §7 *Still open for the owner* and §9 *After live* are the two lists, and the walk is `LIVE_WALK_2026-10-14.md`.

## 9. Files

- `to-dos/gc-mode/messages/RESIDENTIAL_BUILD_PLAN.md` — the plan in its closing state: Status, every PR by cut, every migration, the owner's open calls and After live.
- `to-dos/gc-mode/messages/LIVE_WALK_2026-10-14.md` — the walk on prod, by role.
- `to-dos/gc-mode/messages/customer-messages-prototype.html` — v0.8, eight screens; tab 6 is its log.
- `to-dos/gc-mode/messages/customer-messages-integrations-mockups.html` — v0.2, the seventeen cards with the owner's picks stamped.
- `to-dos/gc-mode/messages/MESSAGES_PLAN.md` → *Residential customers and the Messages page* — the decisions in the plan's voice.
- `to-dos/gc-mode/messages/BUILD_PLAN.md` and `BUILD_HELPERS.md` — the GC build's plan and the helpers' rules; this build uses both.
- A trajectory chart, `customer-communication-trajectory.html`, was sent to the owner from the scratchpad and is not in the repo; its DATA block is a hand-kept list and is stale as of #5575.
- The GC Review lead's session ("GC Review") runs wave 2; its helpers are "GC Reviews helper 1" to "9". Cut 10 (#5522, #5524, #5532, GC Reviews helper 7) is the job activity side of R1 and uses the prototype's orange.

## 10. Things that bit, so you do not repeat them

- `git checkout <ref> -- .` in a worktree stages another branch's files; undo with `git restore --source=HEAD --staged --worktree -- <paths>`; the classifier refuses `git reset --hard`.
- The helpers' prepare notes corrected the plan nine times (tables that did not exist, functions with other names, a column that was a policy key). Trust the note over the plan and fold the correction in.
- Six PRs editing one Glossary line is a rebase chain; hold the clause when the line is busy, consolidate once.
- `plainWordsFailures` refuses `·` as glue and parentheses, so phone numbers are hyphenated and the mockups' `·` phrases became sentences or parts.
- A stacked PR opened armed can land its parent's work under its own title. Open stacked PRs as drafts, arm after the rebase.
- The merge queue's ruleset timed groups out at 30 minutes (`check_response_timeout_minutes`) while a merge-group run waited 31 to 58 for a runner, so groups were thrown out as `checks_timed_out` until the owner raised it to 90; `ci.yml` had no concurrency rule, so every superseded push held a runner (#5604 adds one; merge-group runs are never cancelled).
- A queued branch refuses every push: dequeue over GraphQL (`dequeuePullRequest(input:{id}){clientMutationId}`), push, re-arm, and the entry loses its place either way.
- A stacked PR rebases onto `main` with `--onto origin/main <the parent's old commit>`, read from the child's own history, never the parent's new head: the queue squashes the parent, and the stack was rebased under its helpers twice.
- A docs pass across files other sessions are editing goes best as a replay of exact old-to-new phrases, so a line another PR moved fails loudly instead of being written over (#5683).
