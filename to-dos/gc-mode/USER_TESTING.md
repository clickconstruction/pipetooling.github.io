---
name: "GC mode: what the testers tell us"
parent: to-dos/gc-mode/PLAN_2026-10-07.md
status: started 2026-10-07 by Helper 7 at the lead's ask · empty until the first door opens (door 1, New project, day 1)
summary: >
  Every note a tester gives about GC mode on prod lands here, with the day it came, the lane it
  belongs to and where it stands. Each morning Helper 7 routes the night's new notes to a helper by
  name and sends the lead the list; the lead decides what jumps the queue.
---

# GC mode: what the testers tell us

**How a note gets here:** a tester tells Grace or the lead, and one of them relays it to Helper 7,
who adds the row. The tester never writes this file.

## What the app records: New here?

*New here?* on GC projects (v2.4838, PR #4863) writes a row to `ui_nav_clicks` when the walk opens
and when it closes. `control` is `gc_new_here`. `target` is `opened?by=first-visit&of=10` or
`opened?by=button&of=10` when it opens, and `closed?stop=<the last stop reached>&of=10` when it
closes. The morning triage reads the night's walks with this, read only, against prod:

```sql
-- Each tester's walks since yesterday morning, devs left out.
select u.name, n.role, n.target, n.occurred_at at time zone 'America/Chicago' as at
from public.ui_nav_clicks n
join public.users u on u.id = n.user_id
where n.control = 'gc_new_here'
  and n.role <> 'dev'
  and n.occurred_at > now() - interval '1 day'
order by u.name, n.occurred_at;

-- Where walks stop, all time: a pile-up on one stop is the stop to rewrite.
select split_part(split_part(n.target, 'stop=', 2), '&', 1)::int as stop, count(*)
from public.ui_nav_clicks n
where n.control = 'gc_new_here' and n.target like 'closed?%' and n.role <> 'dev'
group by 1
order by 1;
```

A walk that opened and has no close means the tester left the page or closed the tab mid-walk. The
ten stops, in order: the switch, New project, a project's card, its Drive line, The plans, A new
set of plans came in, Questions about the plans, the gaps, the scope book, New here?
(`src/lib/gc/tour.ts`). A row lands in *The notes* only when a stop count says something a helper
can act on, for example "4 of 6 left at stop 4".

## How a row reads

- **Date**: the day the tester said it, as `2026-10-08`.
- **Tester**: who said it, by first name.
- **Lane**: Schedule, Board, Portal, Building, Owner Billing, New project, or Doors (who can open
  what). *Not sure* until the morning triage names one.
- **Note**: what the tester said, as close to their words as the relay allows, and the page it was on.
- **State**: one of the states below.
- **Helper**: who has it, by name (Helper 1 to Helper 7), from the morning triage on.

## The states

- **New**: in the file, not yet routed.
- **Routed**: the morning triage gave it to a helper and the lead has the list.
- **Building**: the helper has a PR open. Its number goes in the note.
- **Live**: the fix is on prod.
- **Checked**: the tester saw the fix and said it works.
- **Owner's call**: it changes what GC mode does, so it waits on the owner.
- **Not a change**: it works as meant. The note says why, in a sentence the tester could read.

## The notes

| Date | Tester | Lane | Note | State | Helper |
|---|---|---|---|---|---|
| 2026-10-08 | Grace | Board | The Project Board's progress ring on `/bids/gc` (the spike): at 100% the check should sit above the number, not under it. Three mock-ups; Grace picked a large hollow outlined check drawn over the count, which dims behind it. Built in `GcProgressRing.tsx` on the spike, walked at desk and 375; the Board lane carries it when the ring lifts to main. | Live (on the spike) | lead |

## Notes sent

The note the lead posts to testers each evening: what is new on prod that day, in plain words
(`src/lib/plainWords.ts`), under 150 words, with the guides' share links
(`https://clicktooling.com/g/<slug>/`, which open the guide in the app; `/help/<slug>` has no route
and lands on the home page). Replies come to the lead or Grace and land in *The notes* above.

### 2026-10-07, evening: GC mode opens (door 1)

Drafted by Helper 6 for the lead to read to Grace. 129 words without the links; every line passes
`plainWordsFailures`. Send the *New here?* line only if #4863 is on prod by then. Otherwise drop it
and add it to the next evening's note.

> GC mode is open for the office and estimators. On the Bids page, press GC beside the trades. Press Trades to go back.
>
> What you can do today, with a guide for each:
>
> - Start a GC project from its plans: https://clicktooling.com/g/start-a-gc-project/
> - Put a new set of plans on a project: https://clicktooling.com/g/issue-a-new-set-of-plans/
> - Read the plans of a project: https://clicktooling.com/g/read-the-plans-of-a-gc-project/
> - Ask the architect about the plans: https://clicktooling.com/g/ask-the-architect-about-the-plans/
> - Keep the scope book: https://clicktooling.com/g/use-the-scope-book/
>
> The first time you open GC projects, New here? walks you through the page.
>
> Leave the project named "GC test project, delete me" alone. We use it for our own checks.
>
> Found something odd or confusing? Reply to this note. Say what you pressed and what you saw. We log each reply and tell you when it is fixed.

### Door 2 day: the Board opens

Drafted by Helper 6 on 2026-10-08, to send the evening door 2 is live (`mockups/door-2-board.md`).
129 words without the links; every line passes `plainWordsFailures`. The Ask window line holds until
the office may send the emails. The Portal's sender (P3) is live, but only a dev sends through it
(`GC_TRADE_EMAIL_TEAM` in `src/lib/gc/access.ts`). The send widens to the office team at the
portal's door (`PORTAL_REAL_BUILD.md`, item 12), on the owner's yes for a real trade. Turning the
Ask window's tick on by default (Helper 16's PR after the three test emails) does not change this
line, since only a dev sees the tick. The evening the send widens, that evening's note says *The Ask
window emails each company it asks.*

> GC projects now shows the Project Board above the list of projects. It puts every GC project in its stage, with the days left before our bid is due.
>
> New today, with a guide for each:
>
> - Read the board: https://clicktooling.com/g/see-where-every-gc-project-stands/
> - Add a trade partner: https://clicktooling.com/g/add-a-trade-partner/
> - Approve a company that is new to us: https://clicktooling.com/g/approve-a-company-new-to-us/
> - Ask companies to quote a trade: https://clicktooling.com/g/ask-trade-partners-for-a-quote/
> - Follow up on a quote: https://clicktooling.com/g/follow-up-on-a-quote-from-a-trade-partner/
> - Open a company's window: https://clicktooling.com/g/look-up-a-trade-partner/
> - Compare quotes and carry one: https://clicktooling.com/g/compare-quotes-and-carry-one/
>
> For now the Ask window saves each ask but emails nobody. Call or email the company yourself.
>
> Leave the project named "GC test project, delete me" alone. We use it for our own checks.
>
> Found something odd or confusing? Reply to this note. Say what you pressed and what you saw.

## The morning triage

Each morning Helper 7 reads every *New* row, names a lane and a helper for each, sets it *Routed*,
and sends the lead one list: the helper, the rows, and any that look like the owner's call. A note
that blocks a tester from going on is at the top of the list.

## Status

Started 2026-10-07. No notes yet.
