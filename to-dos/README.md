# To-dos

Projects that were designed, discussed, or partly built but cannot be finished right away. Any editor — a person or an agent session — can pick one up cold.

Each to-do is one folder or file here. It must leave enough behind that the next session does not have to re-derive the decision:

- **The ask, in the owner's words** — what was wanted and why.
- **The decision** — which option was picked, what was rejected, and any open questions.
- **The mock-up or spec** — kept here (an `.html` next to the `.md`), not only on a chat link.
- **Where it plugs in** — the files, kernels, tables, and RPCs already involved, with what exists versus what is new.
- **The plan** — an ordered PR train, smallest shippable first, with what each PR touches.
- **How to verify** — the live-test recipe, test data or dummy accounts, and any gotchas hit along the way.
- **State** — the front-matter `status`, `group`, `size`, `blocker` and `next` fields (see *One source, two views* below); a `## Where it stands` section when the state needs more than a line.

When you pick one up: put your branch name in the front-matter `status`, drop a session card in `.claude/sessions/active/` (see [`docs/SESSIONS.md`](../docs/SESSIONS.md)), and follow the repo's usual conventions — claim a version with `npm run claim`, ship a release note and a `docs/recent-features/` fragment per PR, guides with features. When it ships, delete the to-do and let the release notes and docs carry the record.

When a plan doc or a release-notes fragment defers something, add it here (one file, or a line in an existing file) and leave a one-line pointer in the source — each fact has one home.

## To add, change or retire a to-do

The board is **a view of this folder**. You change what is on it by changing the folder, in a
PR like any other.

1. **Add** — write `to-dos/<slug>.md` (or `to-dos/<slug>/README.md` when it has more than one
   file) opening with the front-matter block below, with the next free `number:` (`npm run
   check:todos` prints it; a retired to-do's number is never refilled, so "#16" always means the
   same work). **Change** — edit that front matter (`status`,
   `next`, `group`, …) and the prose under it. **Retire** — delete the file or folder; the release
   notes and `docs/recent-features/` carry the record from then on.
2. **A mock-up is a file beside the to-do** — `mockup.html`, `before-after-pr2.html`, any `.html`
   in the folder (for a flat to-do, a top-level page named after it:
   `<slug>-earned-revenue.html`). Nothing declares it: the board's links line lists every such
   file on the next build. An artifact link written anywhere in the
   prose (`*Office Days* — https://claude.ai/artifact/…`) is picked up the same way. **A to-do
   with no `.html` beside it reads *waiting on a mock-up*** on the board (and the board has a
   toggle for just those rows); when the work changes no screen — a live test, a refactor, a
   retirement — say so with `mockup: not required — <why>` and the row reads that instead.
3. **Check** — `npm run check:todos` says whether every to-do parses, cites shipped versions
   only, and renders. It runs in CI on every PR. Nothing is generated into the repo: the
   board is rendered from this folder at build time (`todoBoardPlugin` in `vite.config.ts`).
4. **Deploy** — the merge deploys the client, and the board on `/punch-list` shows your change
   with it. There is no separate publish step, and no generated file to commit — which is why
   two to-do PRs no longer conflict with each other (v2.3623).

Front matter cites **shipped** versions only — the check refuses a `v2.NNNN` with no
`docs/recent-features/` fragment, because planned numbers are what a claim race renumbers.

**The punch list** — the index as a board, **in the app**: gear menu → *Punch list*
(`/punch-list`, dev + master). Every open to-do by readiness, each row opening with its number (the handle to use in a note
or a request), with a size, a blocker and a next step per row, a Do / Later / Drop pick, and a
links line — every mock-up saved beside the to-do
(served as pages at `/to-dos/…`), every artifact its prose links, each cited version's docs
fragment, and the to-do's history (every PR that touched it). Shipped work is not on it; the
release notes carry that record.

The board's rows are rendered from this folder at build time (`todoBoardPlugin` in
`vite.config.ts`, the `virtual:punch-list` module); the mock-ups reach the app through a
build step beside it (`todoMockupsPlugin`). So the board is exactly what is on `main`, and
**a merged PR is the whole process** — there is nothing to publish afterwards. (Until
v2.3558 the board was a hand-published artifact only one account could refresh; from
v2.3558 to v2.3622 it was a committed module and an index table in this file, which every
to-do PR conflicted on whenever main moved; both are gone.)

## One source, one view

Each to-do carries **front matter** with the fields a reader triages on. The punch list (the
app's `/punch-list` page) is **rendered from it** at build time — nothing is edited by hand:

```yaml
---
name: Put a GC on notice          # the row name on the board
number: 16                        # the row's handle (#16) — given once, never reused; take the next free one (check:todos prints it)
group: close                      # ready | close | gated | waiting | residual
status: built 2026-09-15 · left: the first real run on a TEST GC
summary: >                        # one paragraph: what this is
  One modal that sends the § 53.056 notice to every owner on every job with a failing GC…
next: The first real run on a TEST GC, then delete the folder.
size: XS
blocker: A live run.
ver: v2.3469 · 3470 · 3482 · 3479
opinion: your call — the code is done; the first run is yours   # optional — a reviewer's build / later / drop / your call, then one sentence; the board shows it as a column
pointer: true                     # optional — a standing list, not an open item
mockup: not required — a live test   # optional — the board says this instead of "waiting on a mock-up"
---
```

Everything else in the file stays prose: the ask in the owner's words, the decision, the mock-up,
where it plugs in, the PR train, the verify recipe, and a `## Where it stands` section where the
state needs more than a line. Only the triage fields are structured.

```bash
npm run check:todos
```

verifies the sources (it runs in CI on every PR); the build renders the board from them, so the
view can never fall behind its source and there is no generated file to conflict on. **Save
hand-off work as a to-do file, never as a board row**: a row is a handful of fields, and one
shared file would rebuild the parallel-session conflict that the release-notes and
`docs/recent-features/` fragment cutovers were created to solve.

The open to-dos, grouped and ordered by readiness, are the board itself: gear menu → *Punch list*
(`/punch-list`). On GitHub, this folder's listing is the index.

Closed 2026-09-22 by owner decision (folder deleted; the two mock-ups live in git history at the deleting commit): `test-reports` (#14) — the feature itself shipped 2026-09-11 (v2.3296–v2.3331; dial B off by default) and its one residual, retiring plumbingtooling.com after a month of no visits, is **off**: the owner keeps the external app up as a standing fallback, so the Stages door, the modal's *Open in Plumbing Tooling* footer button and the family-strip entry stay. Two of its owner questions were never asked again and close with it (whether filing a Test report should also satisfy the clock-out field report; whether a FAIL always needs a human Send on dial B — the code says yes).

Closed 2026-09-17 (folder deleted; the mock-up lives in git history at the deleting commit): `estimate-options-approve-several` — all three PRs shipped the same day (v2.3554 the kernels, the column and the four functions; v2.3555 the customer page; v2.3556 the office builder and the record); the three owner calls and the owed message to Taunya moved to `owner-decisions-pending.md`.

Closed on the 2026-09-14 sweep (files deleted): `demand-letter-itemized` (all five PRs built the same day — v2.3425 the statement of account, v2.3429 Exhibit A, v2.3433 the legal lines, v2.3436 Email with the PDF, v2.3437 the invoice on the § 53.056 notice; the law table and the mock-ups live in git history at the deleting commit, the release notes and `docs/recent-features/` carry the record; the attorney questions moved to `owner-decisions-pending.md`); `sub-sheet-job-link-followups` (v2.3435 — the number fallbacks, the two `_by_hcp_numbers` RPCs and the `varchar(10)` cap are gone; every sheet reads its job by `job_ledger_id`); `bill-truth-shadow-beacon` (done in v2.3218, #2930 — the beacon, the legacy sums and `billTruthShadow.ts` are gone); `supply-house-directory` (all six PRs v2.3166–v2.3173 plus the 2026-09-10 close-out v2.3243 / v2.3244; the two mock-ups live in git history at the deleting commit).

Closed since the 2026-09-05 sweep (files deleted): `accounts-receivable-refresh` (all four PRs merged 2026-09-13, v2.3379–v2.3382 — the release notes and `docs/recent-features/` carry the record; the mock-up lived in the folder and in the artifact); `contract-forms-publish-authored` (Direct Deposit 2026-09-06; the four lien waivers + the pay-row picker v2.3062 on 2026-09-07); `deploy-backlog` (checked 2026-09-06 from a linked checkout — 470/470 migrations applied, 104/104 functions current after one `_shared` importer, `get-bid-proposal-room`, was redeployed); `error-message-follow-ups` (v2.2861 shipped Retry + the online listener and fixed the week-grid bid branch); `rfq-apply-picks-to-bid-costs` (Rung G had already shipped as v2.2655 — the sweep missed it; its residuals live in `docs/SUPPLY_HOUSE_RFQ_PLAN.md` → Deferred).

Closed on the 2026-09-14 evening sweep (folders deleted; mock-ups live in git history at the deleting commit): `pipeline-on-a-map` (v2.3396–v2.3399, all on main) and `lien-desk` (v2.3405 / v2.3410 / v2.3412 merged, both migrations in the 570/570 push). The Lien desk's six owner decisions were taken as proposed on 2026-09-14; its residual work continues in `owner-of-record-prompts.md` and `gc-on-notice/`.

Closed 2026-09-15 (folder deleted; the mock-ups live in git history at the deleting commit): `owner-of-record-prompts` — PRs 1–3 shipped v2.3447 / v2.3452 / v2.3450 (+ v2.3455 and v2.3456 from the live pass) and live-tested the same night on real jobs (J650, J878, J273, J775, a throwaway J1023); the nightly auto-save switch is off until the first sitting proves the roll. Residual: Bill Customer cannot open on a job with no customer row (a pre-existing billing rule, 42 of 62 open GC jobs), so Moment 3 only fires on GC jobs with a customer; the list and the desk cover the rest. `gc-on-notice/` is next and no longer blocked on owners.

Not duplicated here, by design: `docs/twins/HANDOFF.md` → "Open threads, prioritized" (the robots program, updated daily) and the private journey-map repo's `_DRIFT-2` (security findings).
