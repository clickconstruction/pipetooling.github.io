# Parallel-session coordination (advisory ledger)

---
file: docs/SESSIONS.md
type: Process / Tooling
purpose: How concurrent Claude sessions (and humans) coordinate version numbers, migrations, and surfaces through the gitignored .claude/sessions/ ledger — claim scripts, session cards, staleness rules.
audience: AI agents, developers
last_updated: 2026-08-03
---

## The problem this solves

Every PR ships a changelog pair (before the 2026-08-20 fragments cutover: prepends to two shared files; since then: one `docs/recent-features/v2.NNNN.md` + one `src/content/releaseNotes/v2.NNNN.ts` fragment each), so two sessions working at once race for the next `v2.NNN`: renumber cascades mid-rebase, drift-test failures, and commit titles on `main` that permanently disagree with the file contents (it happened three PRs in a row on 2026-08-03). Migration timestamps have collided the same way.

**The fix is a shared ledger outside git.** All local sessions run on one machine against one repo, so claims live in the MAIN checkout's gitignored **`.claude/sessions/`** — visible to every session instantly, no commits, no merges, no conflicts on the ledger itself. Worktrees resolve to the same directory automatically (`git rev-parse --git-common-dir`).

**Advisory, not enforced.** Nothing breaks if a session ignores the ledger — you just fall back to today's race. Claims fix the *renumbering*; since the fragments cutover each PR's entries are new files named by the claimed version, so the old always-conflicting docs rebase is gone entirely — two sessions only collide if they claim (or hand-pick) the same number.

## Quickstart for a session shipping a PR

1. **Claim your version** right before writing docs entries (not at branch time):

   ```bash
   npm run claim
   ```

   Prints and reserves the next free `v2.NNN` (atomic file creation — two sessions can never win the same number). Use that number to name your two fragment files (`docs/recent-features/v2.NNNN.md` + `src/content/releaseNotes/v2.NNNN.ts`) and in your commit/PR title. Add a hint: `npm run claim -- dispatch schedule editing`.

2. **Creating a migration?** Register the filename so parallel sessions dodge your stamp:

   ```bash
   npm run claim -- --migration supabase/migrations/<version>_<slug>.sql
   ```

   Errors if another session (or main) already holds that version — pick a later stamp.

3. **Drop a session card** when starting a work stream: `.claude/sessions/active/<branch-slug>.md` (template below). Update it if your scope changes; delete it when your PR merges.

4. **Before reworking a hot surface** (Bids, Jobs, Settings, the docs heads), skim the other cards:

   ```bash
   npm run sessions
   ```

   Version claims prevent number races, but only cards prevent two sessions redesigning the same component simultaneously.

## What the scripts do

- `npm run claim` — fetches `origin/main`, reads the TRUE newest version **from the file contents** (never trust commit titles — rebases leave them stale), sweeps claims already merged onto main, then claims `max(main, outstanding) + 1` by creating `.claude/sessions/claims/v2.NNNN.json` with the `wx` flag (loser of a simultaneous race auto-retries with the next number).
- `npm run claim -- --release v2.NNN` — give a number back (abandoned work). Merged claims release themselves; you rarely need this.
- `npm run sessions` — the at-a-glance board: main's newest version, outstanding claims, active session cards, staleness flags.

## Staleness rules (advisory)

- A claim **at or below** main's newest version auto-releases on the next `npm run claim` — its number is burned either way. **A released claim is NOT proof your PR merged**: another session's PR can take the same number while yours sits open (it happened to the PR that shipped this very ledger). Merge status comes from `gh pr view <n>` or finding your files on main — never from the ledger. In particular, never `git rebase --skip` a commit as "already merged" without `git ls-tree origin/main <one-of-its-files>` first.
- A claim outstanding **>24h** is flagged STALE — if no open PR references it, treat the number as free (release it with `--release`).
- A session card untouched **>3 days** is flagged — probably a finished session that forgot to clean up; delete it.
- Claim numbers may merge out of order (a later claim's PR can land first). That's fine — entries in the docs files stay newest-version-first regardless of merge order, and the drift test only pins the newest heading to the newest release note.

## Session card template

```markdown
# <branch-name>
- **Working on:** one line — surface + goal
- **Claimed:** v2.NNNN (and migration versions, if any)
- **Touching:** files/surfaces where collisions would hurt
- **Started:** YYYY-MM-DD
```

## If you automate the merge wait ("shepherds")

A long-running script that watches a PR, renumbers it when a version race
lands, and re-pushes is tempting under contention. One was written on
2026-08-03; it corrupted the changelog twice in an afternoon. The rules below
are what it got wrong, and they apply to any agent or human doing this by hand.

- **Claim, never derive.** `npm run claim` allocates atomically. A script that
  computes `newest + 1` from its own snapshot will hand the same number to two
  PRs — that is exactly how v2.1368 was issued twice. (The first shepherd also
  grepped `v2\.[0-9]*` over a whole file and matched the literal `v2.NNN` in a
  code comment, producing "v2.1". Anchor to the structured field and reject a
  result that isn't strictly greater than the current version.)
- **Rebase; never `reset --hard` + `git apply`.** Rebasing gives git the real
  merge base, so a collision surfaces as a *conflict*. Rebuilding a branch from
  a patch throws that base away and turns the collision into a silent
  overwrite: that is how a merged PR's release-note entry disappeared while
  both PRs reported success.
- **Assert the outcome, not the PR state.** `MERGED` is a fact about GitHub. The
  post-condition worth checking is that your entry's text and your code marker
  are on `origin/main`, and that `npm test` still passes there.
- **Separate watching from mutating.** A loop that force-pushes unattended
  multiplies a bad computation across the branch, the PR title, and the
  changelog before anyone sees it. Report, then apply deliberately.
- **Prefer fewer, larger merge windows.** Under heavy contention, folding
  related tweaks into one PR beats shepherding a stack of three.

The guards in [`releaseNotes.ts`](../src/lib/releaseNotes.ts) (duplicate
headings, release notes with no `RECENT_FEATURES.md` entry) now fail `npm test`
when this class of damage reaches the files. Since v2.1373 they enforce a hard
zero — the historical cases are repaired and the allowlists are empty, so any
failure is damage from a live PR. Restore the missing entry; don't widen the list.

## Limitations

- **Local sessions only.** A cloud session (claude.ai/code) doesn't share this filesystem. Fallback there: open a draft PR early with the claimed version in its title, and check `gh pr list` before picking a number.
- **Humans race too.** The scripts work the same from a human shell — same ledger.
- The pure allocation/parsing logic lives in [`src/lib/sessionClaims.ts`](../src/lib/sessionClaims.ts) (unit-tested); the scripts ([`claim-version.ts`](../scripts/claim-version.ts), [`sessions-status.ts`](../scripts/sessions-status.ts)) are thin IO run via `vite-node`.
