---
name: "The schedule's PR 7c: the call list (G-115), measured and cut in two"
rows: SCHEDULE_REAL_BUILD.md, The PRs in order, 7; mockups/schedule-pr7.md, call 5 and *When it is cut*; GANTT_FEATURES.md G-115 (by company as a call list) and G-13 (one company)
branch: the plan on spike/schedule-pr7c-plan (from origin/spike/gc-mode at cf6b09fc5); the code from origin/main
status: amendment 2026-10-08 by Helper 11, the Schedule lane, at the lead's ask. The lead picked way 1, two cuts, the same day. Nothing is built yet.
---

# The schedule's PR 7c: the call list, measured and cut in two

## Why an amendment

`schedule-pr7.md` cut PR 7 in three and gave 7c "`gcCallList.ts`, `GcCallList`, `PeopleRows` and `theirWork`". The lift's own tools say it needs more. Measured with `lift-extract.cjs` on the spike at cf6b09fc5, and a `tsc` of what it writes against `main` at e0cfd470e:

- The call list reads Follow up's people model, the counts and a customer-send kernel. None of them is on main.
- Its rows' **Call**, **Follow up** and **Work the list** open the Follow up sheet. Main has the sheet's kernel (`followUpSheet.ts`, Building's U2) and no sheet.

## The measurement

### The kernels: five files, about 1,500 lines, 89 declarations

`lift-extract.cjs` closes on these five, with the shapes below placed:

| On main | From the spike | Declarations | Exported | Whose |
|---|---|---|---|---|
| `src/lib/gc/schedule/callList.ts` | `gcCallList.ts` | 38 | 14 | the Schedule lane |
| `src/lib/gc/schedule/counts.ts` | `gcCounts.ts`, in part | 28 | 9 | the Schedule lane (the counts, G-146) |
| `src/lib/gc/projectPeople.ts` | `gcProjectPeople.ts`, in part | 15 | 6 | the Board lane (Follow up by person) |
| `src/lib/gc/customerSend.ts` | `gcCustomerSend.ts`, in part | 5 | 3 | the Board lane (Get started, B6) |
| `src/lib/gc/followUpSheet.ts`, appended | `gcFollowUpSheet.ts`, in part | 3 | 1 | the sheet's kernel, lifted by U2 |

What moves, by name (each with the private helpers it needs from its own file):

- `gcCallList`: all of it but `callListCallActions`, which returns the prototype's reducer actions and stays on the spike.
- `gcCounts`: `CALL_LIST_SAYS`, `crewCalls`, `unconfirmedDates`, `unconfirmedStarts`, `barReasons`, `scheduleReasons`, `uninsuredReasons`, `REASON_GROUPS` and `reasonGroup`. The last two are for `PeopleRows` (7c-ii).
- `gcProjectPeople`: `projectPeople`, `projectFollowPeople`, `customerAsPerson`, `ProjectPerson`, `PersonReason` and `PeopleTone`.
- `gcCustomerSend`: `contractWaitingOn`, `customerReminderLate` and `customerSentWords`.
- `gcFollowUpSheet`: `followUpPeople`.

### The shapes: 16 gaps

The `tsc` of the five files on main gives 16 errors.

- 13 are fields main's trimmed shapes do not carry yet:
  - `CustomerSend`, the whole shape;
  - `GcState.customerSends`;
  - `GcCustomer.phone`, `.email` and `.contacts`;
  - `Partner.contacts` and `.won`.
- 2 are the append's own: `followUpSheet.ts` already imports `PortalLang`, so the appended part reads it from there.
- 1 follows from the missing `CustomerSend`.

Each field comes word for word, appended to the latest lift's list for its shape. `testState.ts` is regenerated with `LIFTS` plus the 7c-i config. Without the config the same run reproduces main's file byte for byte.

### The tests: 10 move, 14 stay

`gcCallList.test.ts` has 24. These 10 read only the moved kernels and the made-up data, and move:

- has everyone whose answer moves the chart, worst first
- puts every reason under the name: the bars, what holds them, and what Follow up already has on this job
- leaves off whoever has nothing to answer: the city, our own crew, finished trades, a decision not holding work yet
- a reason about a bar carries the bar, so pressing it opens that bar
- has no list on a job not being built
- a kind the list does not know goes to the trade doing the bar, worded as the chart words it
- G-77’s paperwork names the trade's papers, and the hold it folds in still reaches its own owner
- a late wait under a submittal or an RFI still reaches its owner: the delivery is Cool Breeze’s though RFI-003 has the bar
- asks while it is coming, and reads late once it passed with nobody on the log
- this job’s Follow up items first, then one item for each reason from the schedule, ticked when red or amber

The 14 that stay play the prototype's reducer (the told dates, a call's answer, the drafted message) or read the sheet. `GcCallList.render.test.tsx` has 8; 7c-ii moves the ones that render the list alone.

### The rows and the sheet

- `GcCallList.tsx` is 105 lines. `PeopleRows` is about 117 lines of `GcPeoplePill.tsx`.
- `PeopleRows` takes `onFollowUp` and needs it. **Call** dials, then opens the sheet on *What did they say?*. **Follow up** opens it on a draft. **Work the list** opens it from the first person.
- `GcFollowUpSheet.tsx` is 505 lines on the spike. It is the Board's Follow up by person, and it records the calls and the promises.

## The two cuts

The lead's way 1, 2026-10-08. The lane's order: 7b, 7c-i, PR 8 (moves, which testers need first), then 7c-ii.

**7c-i: the call list's kernels, with no caller.** The way 7a went.

- The five files above, word for word, placed by `lift-extract.cjs` with `schedule-pr7c-i.lift.json`.
- The shapes, and `testState.ts` regenerated.
- The 10 tests, on main's test state.
- `projectPeople.ts`, `customerSend.ts` and the `followUpSheet.ts` append are the Board lane's files. They land where the Board lane will extend them, so there is one copy and it is theirs. Helper 12 is asked for the nod on the names.
- *Check:* `lift-same.cjs` reads every declaration and test the same. The generator writes main's test state with the config, and without it reproduces it byte for byte. `npm test` passes.
- *The spike's follow-up:* each spike file re-exports from main (`lift-reexport.cjs`), the moved tests are deleted, and the config is pinned and joins `LIFTS`, since it carries types.

**7c-ii: the call list in the window.** After PR 8.

- `GcCallList.tsx`, and `PeopleRows` in a file of its own on main (the name is the Board lane's to give).
- Word for word, with one known difference: `onFollowUp` is optional on both. Unset, **Call** only dials, and neither **Follow up** nor **Work the list** is drawn.
- The window passes the chart its `callList`: `callList(state, project, holds)` on a job being built, as the spike's tab does. **Their work** shows that company's bars (the window's company, G-13). A line about a bar opens it.
- `GcBarCaller`, the opened bar's company, joins the bar's card with **Call** only.
- *Check:* the render tests that draw the list alone move. A line about a bar opens its card, **Their work** filters the chart to the company, **Call** is a `tel:` link, and there is no **Follow up** or **Work the list**.
- When the Board lane lifts the sheet, the window passes `onFollowUp`, and the known difference goes.

## Is this the best we can do?

1. **One PR for 7c, the kernels and the window together.** One review instead of two, but about 2,000 lines. The kernels' half is checked by script and the window's by a person. *Not picked:* since 7a, a lift with no caller merges alone.
2. **Lift the Follow up sheet in 7c-ii**, so **Follow up** and **Work the list** work from the first day. *Not picked:* the sheet is the Board's Follow up by person and records calls and promises. It belongs in the Board lane's plan, and the call list takes it once it is there.
3. **Build the call list over main's Follow up** (B2's `followUps`, over the asks) instead of lifting `projectPeople`. *Not picked:* it would make a second list of who to call, different from the spike's, and the spike is the spec. Lifting `projectPeople` once, into the Board lane's file, keeps one copy.

## Status

Amendment 2026-10-08 by Helper 11 at the lead's ask, from the measurement on the spike at cf6b09fc5 and main at e0cfd470e. The lead picked way 1. Helper 12's nod on the Board lane's file names is asked. Nothing is built yet.
