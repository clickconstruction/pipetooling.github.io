---
name: "Render smokes: settle before asserting — one helper, one rule"
number: 39
group: ready
status: PR 1 shipped v2.3852 (`settle()` / `renderSettled()`, the rule in the harness header and `docs/AI_CONTEXT.md`, the three one-off fixes re-expressed through it) · left: PR 2, the sweep
summary: >
  Three `*.render.test.tsx` files went red in six days on branches that never touched them,
  each for the same reason: the test asserted or clicked straight after `render()` /
  `findByTestId`, before the component's mount effects, Suspense retries, or seeding effects
  had settled. Each was fixed alone with a different idiom. The second one ejected two
  unrelated PRs from the merge queue. This to-do turns the pattern into one helper in the
  render harness, one written rule, and a sweep of the ~220 render smokes that read state
  straight after the first paint.
next: >
  PR 1 — a `settle()` (or `renderSettled()`) helper in `src/test/renderSmokeMocks.tsx` that
  flushes pending effects and waits for a caller-named loaded marker, with the rule written
  in the harness header and one line in `docs/AI_CONTEXT.md`. PR 2 — grep the render smokes
  for a `fireEvent` / `getBy*` on the line after `render(` or `findByTestId(`, convert the
  ones that read effect-fed state, and prove each with two full-suite runs.
size: S
blocker: None.
ver: v2.3551 · v2.3852
mockup: not required — a test harness change; no screen changes
---

# Render smokes: settle before asserting

## What keeps happening

Three render tests failed in six days, all on a loaded machine or a busy merge queue, all on
branches that did not touch the component under test, all passing alone or on a re-run:

| When | Test | Symptom | Fix | Cost |
|---|---|---|---|---|
| 2026-09-17 | `BankPaymentsModal.closeOut.render.test.tsx` | `expected '' to be 'vendor_refund'` — the select read before the seeding effect landed | v2.3551 (PR #3322): `openWithSuggestedReason()` waits for the strip **and** for the select to hold a value | three red runs on unrelated PRs, one of them docs-only |
| 2026-09-22 | `MaterialsPoGeneratorTab.render.test.tsx` | the box never opened — the editors' mount-effect reset landed *after* the click's `setOpen(true)` | PR #3575: `await act(async () => {})` to flush pending effects, then `waitFor` the box | **ejected #3565 and #3568 from the merge queue** |
| 2026-09-23 | `JobWindowModal.render.test.tsx` (T5-05, the History tab) | the lazy pane's Suspense reveal queued behind the Job pane's first-load cascade; on a Mac at load average in the hundreds, past `waitFor`'s 1 s | PR #3634 (open, planned v2.3771): await the same loaded markers the sibling tests use before clicking | a local "regression" that was not one |

Same shape each time: `renderWithProviders` resolves its mocks outside `act`, so the moment a
`findBy*` on a container resolves, the component has painted **once** — with its effects,
Suspense retries and seeded state still pending. A synchronous read or click on the next line
races that work. It wins on an idle machine and CI most days, and loses under a full suite,
a busy queue, or a Mac running two helpers at 100 % CPU.

Three fixes used three idioms (`waitFor` on a value; `act(async () => {})` then `waitFor`;
await a loaded marker). All correct; none shared. Nothing in `src/test/renderSmokeMocks.tsx`
offers the pattern, and no doc states the rule — it lives in one file's header comment
(v2.3551) and in session memory.

## The fix

**PR 1 — the helper and the rule.** In `src/test/renderSmokeMocks.tsx`:

- a `settle()` that does `await act(async () => {})` (the #3575 flush), and
- a `renderSettled(ui, { loaded })` that renders, flushes, then `await`s the caller's loaded
  marker (a `findByRole` / `findByDisplayValue` / a predicate on a value) and returns the
  render result — so "wait for the *state*, not the *container*" is the easy path.

Write the rule in the harness header and as one line in `docs/AI_CONTEXT.md` next to the
render-smoke sentence: *assert on something the data load produces; never read or click on
the line after `render()` or after a `findBy*` on a container.* Do not widen any assertion
or any `waitFor` timeout — wall time on a loaded machine measures load, not code.

**PR 2 — the sweep.** Grep `src/**/*.render.test.tsx` for a `fireEvent.` / `getBy*(` /
`.value` / `.disabled` read on the line after `render(` or `await screen.findByTestId(`.
Convert only the ones that read effect-fed state (a seeded select, a lazily revealed pane,
a box whose open flag an effect resets); leave the ones that read static markup. Mechanical
sweeps merge alone (CLAUDE.md) — cut from fresh `main`, merge when the queue is quiet.
Count the hits first and put the number in the fragment.

Not in scope: a lint rule. The pattern is a line-pair heuristic, and the sweep plus the
helper make the rule the default without a false-positive fight.

## How to verify

- PR 1: the three fixed files above re-expressed through the helper stay green; `npm test`
  in full twice back to back (the condition the flake needs), not just the touched files.
- PR 2: the same two full runs, plus a run with the machine deliberately loaded
  (`uptime` load average noted in the fragment) — a single-file run is exactly the condition
  under which every one of these passed.
- Before calling any render failure a regression: run it alone with `-t`, check `uptime`,
  measure CPU across the window (`process.cpuUsage()`), not wall time. Kill-137 exits from
  vitest under load are the OS, not the test.
