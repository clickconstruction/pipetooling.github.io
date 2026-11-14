---
name: "The job window on a phone"
number: 355
group: waiting
status: asked 2026-11-14 · measured on the dev server at 375 px the same day · drawn three ways · waiting on the owner's seven picks before the first PR
summary: >
  The owner opened a job on his iPhone and did not like how it reads: the tab row wraps onto two
  lines, the top is eight small icons, and the Job tab runs six and a half screens before the bar.
  Measured at 375 px, the only presses a thumb lands on without care are the bar's three and Paint a
  map; everything else is 20 to 31 px. Three directions, each built on the last: A tidies the top
  (one tab strip that scrolls, a title with a quiet line, three named 44 px presses with the rest
  under More, money and job accounts folded to one line each); B puts the job on one screen in the
  order a phone needs (Where, Who, Now, the thread) with the rest folded under counted headings;
  C gives the phone its own window shaped by role, with the role's three tabs and the role's main
  press on the bar. Seven questions for the owner where the directions differ.
next: The owner's seven picks (in the mock-up and below). Then A as one PR, with its release note, fragment and the guide's phone section rewritten.
size: L as a train (S for A · M for B · L for C); the first step is S
blocker: The owner's picks.
opinion: build A now — one day, nothing below the top moves, and it answers his first complaint; then B, which is the one that makes the window easy to follow
mockup: job-window-phone-directions.html
---

# The job window on a phone (#355)

## The ask, in the owner's words

2026-11-14, from a screenshot of the job window on his iPhone: "I don't love a lot of things,
including how the top line wraps into two and throughout it it's not easy to follow and the
buttons aren't easy to press."

## What the phone draws today, measured

Measured on the dev server at the 375 × 812 preset on 2026-11-14, on the ZZ test job, signed in
as the dev. The window is `JobWindowModal` with `DetailJobModal` in pane mode as its Job tab
(`docs/JOBS_MODALS_ARCHITECTURE.md`).

| Part | Measured | The trouble |
|---|---|---|
| The tab row | Seven pills, the `?` and the `✕`, on two lines, 78 px tall; each pill 26 px tall | The second line is the first thing he named |
| The title block | 100 px: the name, the kind chip, the status chip; under it the number pill, *money story →* and six icons, then two more icons on a third line | Eight presses of 20 to 31 px, none named |
| The Job tab | 4,350 px before the bar, six and a half screens; the activity feed scrolls inside the scroll | Not easy to follow |
| Presses a thumb lands on | The bar's three (48 px), Paint a map (40 px), the photo tile | Everything else is under 32 px |

The order on the Job tab today: title and icons, the address, the painted maps, the photos strip,
the customer with phone and email pills, three money tiles, the job accounts chips, the scheduled
block, the target, Their journey, Where it stands, Questions on this job, the activity feed with
its filters and composer, the two dates, the status rail, plans and papers, the team, start and
last work, reports, schedule and recorded time, the costs card, specific work, job total, payments,
invoices.

## What each part is for on a phone

| Part | Who reads it, and for what | Order | The press that matters |
|---|---|---|---|
| The tab strip | Everyone: which part of the job. The office moves between Job, Edit and Bill; a crew lead between Job, Materials and Documents | The frame | The tab, 40 px; the ✕ |
| Name, number, status | Everyone: the right job, and where it stands | 1 | None |
| The address and the painted map | The crew lead: where to drive and park. The office: which house | 2 (crew) · 3 (office) | Directions, the map row |
| The customer | The crew lead: who to call at the gate. The office: who to text or email | 3 (crew) · 2 (office) | Call · Text · Email |
| The next block, the target, the Pipeline line | Everyone: what is happening now, what the job waits on | 4 | Set a target |
| Where it stands and the thread | The office: has the customer answered, what went out last | 5 (office) · folded (crew) | Note · Text · Email |
| Today's work: the open stage, its checklist, plans, materials on site | The crew lead: what to do and what is on site | 4 (crew) · folded (office) | The checklist, Materials on site |
| Money tiles and job accounts | The office, rarely on a phone; the Bill tab holds the work | Folded | One line that opens Bill |
| Photos, Questions, Activity, Their journey | Everyone, when looking for something | Folded, with counts | The fold |
| Plans and papers, team, dates, reports, costs, specific work, payments, invoices | The desk's reads; a reference on a phone | Folded, last | The fold |
| The bar | The one press this person needs now | Always on screen | The office: the next verb. The crew: Arrived or Leaving |

## The three directions

The mock-up (`job-window-phone-directions.html`) draws the window as it is today and the three,
each a scrolling 375 px phone. Every name, address and number on it is invented.

**A · Tidy the top** (one PR, the smallest step). The seven tabs run on one line that scrolls
sideways, 40 px tall, the active one kept in view, the `?` and `✕` pinned at the right. The title
is the name and the status; the number, the customer and the kind read as a quiet line under it,
as the desk's title row already does (v2.6539). The eight icons become three named 44 px presses,
Calendar, Share and More ⋯, where More opens a sheet naming every other door (money story, the
supply house, the paid email, send as a task, write up a change, edit). The three money tiles and
the job accounts chips fold to one line each. Nothing below moves; the bar is as today.

**B · The job on one screen** (a second PR on A). The Job tab under 640 px reads Where (the
address with a Directions press, the painted map, the street view folded), Who (the customer with
Call, Text and Email as three 44 px presses), Now (the next block, the target, the Pipeline row's
own line), then the thread (Where it stands, the customer's newest word, Note, Text, Email). The
rest folds under headings with counts: Photos, Questions, Activity, Money, Plans and papers, Work
and time, Their journey. With every fold closed the scroll ends near 1,100 px. The desk is
untouched.

**C · The role's window** (its own component, three or four PRs). A `JobWindowPhone` drawn from a
kernel that shapes it by role. The strip holds the three tabs the role uses and a More ▾ sheet:
the office Job · Edit · Bill · More; a master tech on the crew Job · Materials · Documents · More.
The crew lead's Job tab is Where, Who, Today's work (the open stage, its checklist, the plans,
materials on site), then Questions, Photos, Notes and reports, and no money. The office's Job tab
is B's. The bar's main press is the role's: a viewer on the crew gets Arrived or Leaving big, then
Report and Note, with Status under More ▾.

## The questions for the owner

Where the directions differ. The pick after each is the drawing's own.

1. **The tab strip.** Every tab on one line that scrolls sideways (A, B), or the role's three and a
   More ▾ (C)? *One line that scrolls, the ? and ✕ pinned.*
2. **The icon row.** Which doors earn a named press on the row, with the rest behind More ⋯?
   *Calendar and Share.*
3. **The body's order.** Today's order with the top tidied (A), or Where · Who · Now · the thread
   first with the rest folded (B)? *B, as the second PR.*
4. **Money on a phone.** One line that opens the Bill tab, or the three tiles and the accounts
   chips as today? *One line each.*
5. **The bar.** The same Status ▾ · verb · Note for everyone, or the role's main press? *The same
   bar for now; the role's bar comes with C.*
6. **The kind chip.** Does *Kind not set* stay in the phone's title, or move to the quiet line?
   *The quiet line.*
7. **The first step.** A alone, as one PR? *Yes.*

## Where it plugs in

- `src/components/jobs/JobWindowModal.tsx`: the phone's tab strip (`tabButtonStyle`, the
  `.job-window-tabs` media rule that wraps it, v2.3231) and the `?` and `✕` on it. A has the strip
  scroll (`overflowX: auto`, the active tab scrolled into view on change) with the two pins outside
  the scroll. The desk's title row (`!phone`) already reads name · status · quiet line; the phone
  gets the same row under the strip, with the pane's own title hidden (`paneTitleHidden`).
- `src/components/jobs/DetailJobModal.tsx`: the action row (dossier D5, the eight presses with
  `data-navtrack="job-window"`, which the press row keeps), the phone-pane tiles and
  `JobAccountsStrip` in the top band (D7). A folds the tiles and the strip to one line each under
  `phonePane`. B reorders the top band and folds the body under `phonePane`.
- `src/lib/jobs/jobWindowBar.ts`: `jobWindowTiles` stays; A adds a kernel for the one-line money
  words (*Job total $56,000 · nothing billed*) and the press row (which doors are named, which go
  under More, by role). C adds the role's tabs and the role's bar there.
- `src/components/jobs/JobWindowActionBar.tsx`: unchanged by A and B; C's crew bar is
  `crewJobWindowBar` already drawn for the plain window (punch list #189).
- The guide `src/content/help/job-window-tabs.md`, *On a phone: the bar at the bottom*, is
  rewritten with A; `src/lib/jobs/jobWindowLegend.ts`'s phone row names the press row.
- No table, migration or edge function in any of the three.

## The plan

1. **A** (S): the strip, the title with its quiet line, the press row with More ⋯, money and job
   accounts as one line each; a kernel for the press row's doors and the money line with tests; a
   render smoke at 375 px; the guide's phone section; release note and fragment.
2. **B** (M): the phone's top band in Where · Who · Now · the thread order, the folds with counts
   remembered per device (`localStorage`, as the Pipeline's Overview does); a kernel for the fold
   list and its counts; the guide.
3. **C** (L), only if the owner wants it: `JobWindowPhone`, the role kernel for tabs and bar, the
   crew lead's Today's work.

## How to verify

Open any job from the Pipeline at the 375 px preset (Jobs → Pipeline, Mobile cards on), or on a
phone: the tab row is one line, the `✕` is at the top right, every press on the title block is
44 px tall, and the Job tab's first screen reads name, status, the address, the customer. The
ZZ test job `ZZ TEST Riders Walk` has stages, a checklist, plans and an activity feed to scroll.
Then the same window on a desk at 760 px, unchanged.
