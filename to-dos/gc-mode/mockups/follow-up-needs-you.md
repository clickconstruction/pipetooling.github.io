---
name: "Follow up on the Dashboard: the companies to call about a quote, as one Needs you line"
rows: door-2-board.md, better way 3; the prototype's gcNeedsYou (Board, the owner 2026-10-04: "make them match")
branch: the plan on spike/follow-up-needs-you-plan (from origin/spike/gc-mode at cb8a18e58); the PR from origin/main after door 2, no migration
status: plan 2026-10-08 by Helper 6 at the lead's ask. Nothing cut or claimed. Two calls for the lead.
---

# Follow up on the Dashboard

## What it is

Door 2 gives the office a **Follow up** pill on `/gc` with a count: the companies to call about a
quote. The prototype also put that count on the Dashboard's **Needs you**, so the chasing comes to
the person (the owner, 2026-10-04). Its words then: *make them match*. The pill, the board's rows
and Needs you say one number.

**One Needs you line**, for the GC office team:

```
GC projects                                                              3
3 companies to call about a quote
Alamo Concrete is 2 days past the day it gave for its quote. Pecan Valley Electric
has not opened the ask. And 1 more. Next: call them from Follow up.        [ Follow up ]
```

- **The count** is `followUpsToCall`, the pill's own number: the asks still open whose reason is a
  passed promise, a promise due today, an ask unopened past three days, or the plans with no day.
  Asks with a promise not yet due wait and are not counted, as on the pill.
- **Red** when a promise passed or an ask sat unopened past three days. **Amber** otherwise.
- **The detail** gives the first two reasons in the pill's order, *And N more*, then *Next*.
- **Follow up** opens `/gc` on the Follow up view (`?view=followUp`, a new deep link).
- **No line** when nothing waits, as every Needs you line works.

All words pass `plainWordsFailures` (checked 2026-10-08). The company names are the records'.

## Where the number comes from, without loading the board

The Dashboard must not load the whole board. That is about twenty queries, and it runs on every
Dashboard visit for five roles. `followUps` needs only a slice:

| Table | Columns |
|---|---|
| `gc_projects` | stage, bid due, lost on |
| `projects` | the name |
| `gc_trade_packages` | id, project, trade, ours, and the award once B6 adds it |
| `gc_invites` | not declined: id, trade, company, status, asked on |
| `gc_company_contacts` | those asks' promised days |
| `gc_quotes` | those asks |
| `gc_companies` | their names |

That is six reads, under door 1's and door 2's policies.

- **`loadFollowUpNeedsState()`**, in a new io file, maps them with the Board's own mappers
  (`inviteFromRows`, `stageOf`) into the part of `GcState` that `followUps` reads.
- **`followUps`** narrows its parameter from `GcState` to `Pick<GcState, 'projects' | 'partners' |
  'today'>`. This is an addition, in the Board's file, with Helper 2's OK, and no caller changes.
- **`gcFollowUpNeeds(state)`**, in a new kernel `src/lib/gc/followUpNeeds.ts`, returns `{ count,
  late, title, detail } | null`. Its test pins two things on the board's fixture:
  - its count equals `followUpsToCall`;
  - the board state and the slice give the same answer.
- **`useGcFollowUpNeeds(enabled)`**, a hook beside `useUnpricedWorkOrders`, loads the kernel and the
  io with a dynamic import, so the Dashboard's main chunk does not grow (the 6 MiB PWA cap, v2.4695).
  It reads once on the Dashboard's load, and again on focus, as the Dashboard's other counts do.

## The Dashboard

- **`dashboardNeedsYou.ts`:**
  - the key `gc-follow-up` at rank 40, the revenue-chasing tier, where the prototype had it;
  - the inputs `gcFollowUpEnabled` and `gcFollowUp`;
  - the item, kicker **GC projects**, figure the count, action **Follow up**.
- **`DashboardPinnedQuickRow.tsx`** passes `gcFollowUpEnabled = !hideBanners && canOpenGcProjects(role)`
  (call A), and routes the action to `/gc?view=followUp`.
- **`GcProjects.tsx`** reads `?view=board|partners|followUp` once for its first view. Trade portals is
  not reachable that way except by a dev.

## Two calls for the lead

**A. Who gets the line.**

- *My default:* the GC office team, the same people who see the pill. The count is the team's.
- *The other way:* only each project's project manager (`gc_projects.project_manager_user_id`) and
  the devs. That is quieter for the controller. But no project names its project manager yet, so the
  line would show to nobody until they do.

**B. Companies to call now, people to call when B2b lands.**

- *My default:* the asks to call, the pill's number, now.
- When the Board's B2b lifts `allPeople` (people owed an answer, a paper, a waiver), the line counts
  people instead, as the prototype did. The pill and the board's rows move in the same PR, so the
  three still match.

## The PR

**Files:**

- `src/lib/gc/followUpNeeds.ts` and its test;
- the io file;
- the hook;
- `followUp.ts`' narrowed parameter;
- `dashboardNeedsYou.ts` and its test, with rank, words, severity and no line at zero;
- `DashboardPinnedQuickRow.tsx`;
- `GcProjects.tsx`'s `?view=`;
- the guide `follow-up-on-a-quote-from-a-trade-partner` gains one line, *The Dashboard's Needs you
  shows the same count*;
- a release note and its fragment.

No migration and no types.

**Checks:**

- the tests;
- a render case of the Dashboard's line with the hook mocked;
- typecheck;
- **the main chunk's size before and after.** The kernel stays out of it, so no change is expected.
- on 5306, View as the sample estimator: the Dashboard shows the line with the test project's asks,
  and **Follow up** lands on the view.

## Is this the best we can do?

Three ways it could be better:

1. **One count read, not six queries per visit.** A `SECURITY INVOKER` view or function could return
   the open asks with their promise and company in one round trip, under the same policies. It
   would need a migration, and the kernel's reasons said again in SQL. That is drift between two
   copies of the rule, so the slice of reads is safer until the count is slow.
2. **Say whose call it is.** The line could name the asker (`gc_invites.invited_by`), so the person
   who asked sees their own companies first. That needs no new data.
3. **One tap from the line to the call.** **Follow up** could open the first company's call sheet
   (`partnerReach`, `telHref`) instead of the list. That saves a step, but skips the list's other
   reasons. Better as a second button, *Call Alamo Concrete*, once a tester asks for it.

## Status

Planned 2026-10-08 by Helper 6. Read:

- main's `followUp.ts`, `tradeViews.ts`' `followUpsToCall`, and `boardRows.ts`' mappers;
- `dashboardNeedsYou.ts` and `DashboardPinnedQuickRow.tsx`, the unpriced work orders pattern;
- the prototype's `gcNeedsYou.ts` and `useGcFollowUpNeeds.ts`.

Waiting on calls A and B, door 2 on main, and Helper 2's OK on the narrowed `followUps` parameter.
