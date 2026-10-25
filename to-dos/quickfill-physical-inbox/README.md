---
name: "Quickfill Physical inbox: a card that decides, not a list that lingers"
number: 158
group: close
status: built 2026-10-24 as v2.5815 · 5818 · 5821 · 5825 · left: the one-time sort on the live deck (the README's steps), then the owner's look
summary: >
  Quickfill's Physical inbox station asks "Can I get to the bottom of the pile?" and gives the
  assistant one free box to type what is still in the tray. Its history is 123 marks since April
  with the same seven words retyped each morning, a count that climbed from 1 to 7 and never
  reached zero, and a Mark that refuses an empty box. In GTD's words the card takes a status,
  never a decision. Three redraws: A the clarify deck (each paper typed once, one press per paper
  from GTD's own answers, the count the undecided paper with its age, a Comes back press that
  turns a monthly kind into a repeating Checklist task); B the list with dates; C retire the
  station into the Assistant Dailys row, the header's doors and the Checklist. The pick is A.
next: The office makes the four routines with Comes back and files the three projects (Where it stands), then the owner's look, then delete the folder.
size: M
blocker: none
ver: v2.5815 · 5818 · 5821 · 5825
opinion: built as A, the owner's yes of 2026-10-24 (build it all); the default door is a Checklist task, one constant to change
---

# Quickfill Physical inbox: a card that decides, not a list that lingers (#158)

## The ask

From the owner's session of 2026-10-24, with a screenshot of the station in Roller view and its
**Mark history — Physical inbox** window open: *"just like some of the other quickfill sections,
I do not think the physical inbox (referring to a box on the assistant's desk) is properly
serving its purpose. The system is based on the David Allen GTD method but is not well
subscribed to. Looking at the contents lingering in the inbox what could or should I do with
this card?"*

The owner is reviewing the stations one at a time this weekend. Three sister proposals opened the same
day beside this one and are not repeated here: the **Mark history** window redrawn as a trend
(the shape every station's history will take, this one included), the **Texts** station read
from the Messages page instead of a free box, and the **Email** station fed by the Gmail reader's
live label counts and ages. Where this proposal says *the history*, it means the count and the
facts this card hands that redraw.

## Today

The station ([`QuickfillPhysicalInboxSection.tsx`](../../src/components/quickfill/QuickfillPhysicalInboxSection.tsx),
banner in [`sectionBanners.ts`](../../src/lib/quickfill/sectionBanners.ts)) draws:

- the banner *Can I get to the bottom of the pile?* and the line *0 open · last look 23h ago · Taunya*;
- the header's three doors beside the words *Is my physical inbox clear? - For items that can't
  be quickly cleared, have you added a task? Use these buttons, same as the header.* They open
  the dispatch request, the estimator request and the Checklist's Task window, empty;
- the heading **Still in physical inbox** over one free box;
- **Mark Physical inbox up to date!**, which writes the box as the mark's note.

Three facts about the card, from the code and the history:

1. **The count is the number of lines typed this visit.** `useReportQuickfillSectionMetric`
   is fed the box's line count, so the station reads *0 open* on arrival beside a seven-line
   note, the Roller's *N left with work* never counts it, and the only honest number is the
   `outstanding_count` the mark snapshots at the moment of marking.
2. **The Mark refuses an empty box** (*List what is still in your physical inbox before marking
   complete*). An empty tray, GTD's goal state, is the one state the card cannot record.
3. **The history is a status, not a decision.** 123 marks from April 16 to October 23, one
   assistant on all but two days. The first mark's note was *toll bills*. From June 12 to
   August 13 the note was the one word *same* on 38 straight marks. From August 19 the list grew
   to the seven standing words of the owner's screenshot, *tolls · insurance cards ·
   certificates · renewals · extra phones · lawsuit stuff · demand letters*, retyped each morning
   in a different order. The count went 1 → 7 and never reached 0 at a mark. In the whole run
   perhaps ten notes name an actual paper: a license letter to sign, a lien waiver to notarize,
   a medgas application, OSSF certificates, a returned certified letter. Those are inbox items.
   The seven words are not.

## What GTD says an inbox is

An inbox is a place things land before anyone has decided about them. Its one rule is that
everything in it gets **clarified**: what is it, is it actionable, and if so what is the very
next physical action. A paper that takes two minutes is done on the spot and never recorded. The
rest leaves the inbox by exactly one door: **trash**, **reference** (file it, and know where),
**a next action** on a trusted list with an owner, **waiting for** someone with a date to check,
or **someday**. The inbox goes to zero because every item has been decided, not because every
item is finished. A list of what is still in the inbox is, in GTD's terms, the failure mode: the
items are being looked at and put back.

The station's original hint had this right (*for items that can't be quickly cleared, have you
added a task?*). The box undid it. A box labelled *Still in physical inbox* invites a status,
and a status with no door takes root.

## What is in the pile and where each thing already lives in the app

The seven words are four kinds of paper that arrive every month, and three projects that never
got a next action. None is an inbox item. Each already has, or nearly has, a home:

| In the note | What it is | Where it lives in the app today | The GTD answer |
|---|---|---|---|
| tolls | a bill that arrives every few weeks per truck | nowhere. The bank sorting sees the payment as a transaction. A vehicle carries a weekly insurance and registration cost but no toll | a routine: *Pay and sort the toll bills · every Friday · the assistant* |
| insurance cards | the carrier's new cards, one per truck, each renewal | People → Vehicles: the insurance **plan** with its `renewal_date`, the per-truck periods; `vehicle_maintenance_tasks` already tie a Checklist task to a truck | a routine on the plan's renewal: *Put the new cards in every truck*, one vehicle task per truck |
| renewals | vehicle registrations coming due | People → Vehicles holds a registration **cost** per truck and no registration **day** | a routine on the 1st, *Registrations due this month*; and a follow-up to-do to give a truck a registration day so Vehicle check-ins and Needs you can say it |
| certificates | licenses and certificates: the company's, a tech's TDLR, medgas, OSSF, an electrical license | a **sub's** COI, W-9 and license carry `expires_at` and an amber/red badge on People → Subs. The company's own and the techs' have no dated home. Settings → Company documents is a list of links | a routine on the 1st, *Licenses and certificates due in 60 days*, owned by the owner; and a follow-up to-do for a dated document of our own |
| extra phones | handsets in a drawer, and company lines | Settings → Phone and texts → **Company phone seats** holds the lines. The handsets are a drawer | one task with a day, or Someday |
| lawsuit stuff | paper on a collections suit | the **Legal desk**: the matter, its documents, its planned steps (v2.5800) and the firm's portal | File it to the matter's documents; the next step is a planned step on the desk |
| demand letters | returned mail and green cards on a demand letter | the **Lien desk**: `job_demand_letters` with `sent_method` and `tracking_number`, the Needs you line `demand-deadline` | File it on the letter's record |

Earlier in the history: *certified mail* sat in the note every day of May and June; the lien
run's labels file, Docsmit mailing and `mail_pieces` are where certified mail is tracked today.
*Registrations* carried the note through July. The box has always held the things that had no
home, which is the clearest sign that the fix is homes, not a better box.

**The one-time sort.** Whichever card is picked, twenty minutes of setup empties the box: four
repeating Checklist tasks with an owner and a day, the lawsuit paper filed to its matter, the
demand letters' mail recorded on their letters, one task for the phones. The card's job after
that is to keep the tray empty and say so honestly.

## The mock-up

[`mockup.html`](./mockup.html), served at `/to-dos/quickfill-physical-inbox/mockup.html`. The
presses on A work: a paper leaves on any press, the count and the oldest age follow, Comes back
adds a routine under the deck, the Mark button names the count. Every paper, name and truck is
made up (Marisol the assistant, Hartline Mutual, Ridgeway Builders, Cedar Bend Holdings, Pruett
& Vance).

## Options

### A · The clarify deck (the pick)

The station becomes GTD's inbox step. The banner reads *Has every paper in the tray been
decided?* Under it, one line to add a paper (*A paper that will take more than two minutes…*),
then one card per paper: what it is, the day it came and its age, who typed it, and a row of
presses:

- **Done** · **Trash** · **File it ▾** (where: a desk, a drawer, the cabinet) · **Task** (the
  header's Task window, the title filled in, an owner and a day picked there) · **Ask ▾**
  (dispatch or estimating, the request window with the title filled in) · **Waiting for ▾**
  (whom, until when) · **Someday** · **Comes back ▾** (make it a routine: the Task window with
  repeat set, so the kind stops arriving in the tray).
- A paper leaves the deck on any press, and the press is kept as its outcome.
- **Waiting for** and **Someday** are two folds under the deck, out of the count, with their own
  presses (Done, Nudge, Still here). The Checklist has neither list; the deck provides both.
- **The tray's routines** lists the repeating tasks made from here with their owner and next day,
  so the seven words have a visible home on the card they used to haunt.
- **The metric** is the undecided papers. **The Mark** means *I looked, N are undecided*, and an
  empty deck marks as *tray clear*. No note is typed; the deck is the note.
- **The history** gets an honest *Open items* column with no table change, since the mark
  snapshots the metric as it always has. The mark can also write the oldest age and the day's
  decisions (*2 tasks · 1 filed · 1 routine*), facts the Mark history redraw draws in its own
  shape. A mark with zero undecided is a green day.
- **On a phone** the round draws the same station: one card per paper with its presses on one or
  two rows, the add line at 16 px, and *Looked · 5 undecided · next →* as the Mark.
- **Cost:** M. One small table, one kernel, the section rewritten, the three windows taught to
  open with a title and hand back the id they made. Two PRs.

Is this the best we can do? Every press is a decision; nothing on the card takes a status. Two-
minute papers are never typed, GTD's own rule, and once the routines exist most marks read
*0 undecided*, which is the goal. The risk is typing a kind again (*tolls*), which makes the deck
into B; the intro line, the Comes back press and the one-time sort stand against it. Left out on
purpose: guessing a routine from repeated titles, a photo of the paper, a Todo Tooling bridge.

### B · The list with dates

The last mark's note is split into lines and pre-filled, each with the day it first appeared in
the history and a ✕; each line gets a Task door; the header reads *7 still here · oldest 191 d*.
No table: the ages come from walking the mark events back.

- **Metric:** the lines carried. **Mark:** the same as today, with the list carried instead of
  retyped. **History:** the same, plus the oldest age. **Phone:** a list of lines.
- **Cost:** S. One kernel over the events the window already loads, the box redrawn as lines.

Is this the best we can do? No. It keeps the premise that the box holds kinds, and a kind never
leaves. Every line reads *since August* in red and nothing on the card says what to press. There
is no Waiting for and no Someday, and an empty tray still cannot be marked. It is the two months
of *same*, drawn nicer.

### C · Retire the station

GTD does not need the inbox in software. The tray is the capture tool; the app needs the tasks.
The Assistant Dailys station already has a *physical inbox* duty box, the header has the three
doors on every page, and the Checklist's Review board shows every open task by person with its
age. Remove the station, reword the Dailys item (*Physical inbox: every paper decided, tasks made
for the rest*), set the four routines up by hand once.

- **Metric:** none. **Mark:** a Dailys tick. **History:** gone. **Phone:** a Dailys row.
- **Cost:** XS. One component, one registry entry, one banner, one Dailys item.

Is this the best we can do? No, unless the owner never wants paper in the app. The six months of
history is the only record the office has that the tray is not being processed, and this
proposal exists because the owner could read it. C keeps the doors and the routines and throws the
record away: a tick says the tray was looked at, never what was in it or how old it was, and the
Checklist shows tasks, not undecided paper. A is C plus one table.

## Decisions for the owner

1. **Which card:** A, B or C. The recommendation is A.
2. **Where a decided paper lands by default.** Three doors are possible and the deck can show
   all three; the question is which one is first:
   - **a Checklist task** (the assistant's trusted list; on Today, My Inbox and the Review board;
     pushes to a phone; a repeating one is a routine). The recommendation.
   - **a request** (dispatch or estimating), when the field or the estimator owns the paper.
   - **the owner's own GTD inbox** in Todo Tooling, when the paper is the owner's (a letter to sign, the
     lawsuit). The app has no Todo Tooling connection today; the cheap version is a Checklist
     task assigned to the owner, which already reaches their phone. A real hand-off is a new connection
     and a to-do of its own, if the owner wants one.
3. **The four routines' owners and days:** toll bills (weekly, the assistant?), insurance cards
   (on the plan's renewal, the assistant), registrations (the 1st, the assistant), licenses and
   certificates (the 1st, 60 days ahead, the owner?). These are made with the Task window today,
   with or without the card.
4. **Two follow-up to-dos, or not:** a registration day on a truck, and a dated document for the
   company's own licenses and certificates, so Needs you can say *due in 30 days* instead of a
   routine remembering to look.
5. **The Dailys' physical inbox box and this station:** one thing or two. Under A the Dailys
   item can go, or stay as the morning tick while the station holds the papers.

## Where it plugs in

- **The station:** [`QuickfillPhysicalInboxSection.tsx`](../../src/components/quickfill/QuickfillPhysicalInboxSection.tsx)
  rewritten as the deck. The banner in [`sectionBanners.ts`](../../src/lib/quickfill/sectionBanners.ts)
  becomes *Has every paper in the tray been decided?* The station leaves
  `QUICKFILL_NOTE_FIRST_SECTIONS` in [`round.ts`](../../src/lib/quickfill/round.ts), since the
  Mark no longer needs a note, so the round's *needs a note* word and the Roller's *Mark inside*
  go and the strip's own Looked button marks it.
- **The table (new):** `office_inbox_papers`: id, title, detail, came_on, created_by, created_at,
  state (`open` · `waiting` · `someday` · `closed`), outcome (`done` · `trash` · `filed` · `task`
  · `request` · `waiting` · `someday` · `routine`), outcome_detail (where filed, whom waiting
  for), follow_up_on, outcome_at, outcome_by, checklist_item_id, dispatch_request_id,
  estimator_request_id. One additive migration with `lock_timeout`, RLS for the office roles
  that see Quickfill, and the three block calls at the end. `docs/migrations/<version>_office_inbox_papers.md`.
- **The kernel (new):** `lib/quickfill/physicalInbox.ts` + tests: the undecided count and the
  oldest age, the age chip's thresholds (an undecided paper is amber at 2 days and red at 7, in
  the [`ageState.ts`](../../src/lib/ageState.ts) convention with its own named constants), the
  words line, the Mark's auto-note (*0 undecided · 2 tasks · 1 filed*), the routines rows.
- **The metric:** `useReportQuickfillSectionMetric('physical-inbox', undecidedCount)`, so the
  wrapper's count, the Roller's *left with work*, the round's row and the mark's snapshot all
  read the same number.
- **The three windows:** [`ChecklistAddModal`](../../src/components/ChecklistAddModal.tsx),
  [`DispatchTaskModal`](../../src/components/DispatchTaskModal.tsx) and
  [`EstimatorTaskModal`](../../src/components/EstimatorTaskModal.tsx) open through their
  contexts with no arguments today. Each context's `open` grows an optional `{ title, onCreated }`
  so the deck fills the title and links the paper to what was made. `Comes back` opens the Task
  window with the When control on *repeat*.
- **The routines block:** the Checklist items whose paper has outcome `routine`, with the next
  open instance's date, read the way `ChecklistComingUpSection` reads coming-up rows.
- **The history:** [`QuickfillSectionMarkHistoryModal.tsx`](../../src/components/quickfill/QuickfillSectionMarkHistoryModal.tsx)
  is unchanged by this card; the redraw proposed beside it owns the shape. This card changes
  only what the mark writes: an honest `outstanding_count` and a short auto-note.
- **Words:** the guide *run the office day with Quickfill* gains the station's new paragraph,
  and a short guide *clear the physical inbox* (plain words, `plainWords.ts`). `GLOSSARY.md`
  Quickfill, `QUICKFILL_ARCHITECTURE.md` station bullet, `PROJECT_DOCUMENTATION.md`.
- **Under B** nothing new on the server: the kernel reads the events the window already loads.
- **Under C** one removal: the registry entry in `Quickfill.tsx`, the component, the banner, the
  `QUICKFILL_NOTE_FIRST_SECTIONS` entry, the guide's sentences, and the Dailys item's words in
  `app_settings.quickfill_assistant_dailys_items` (dev-edited in place).

## The plan

1. **PR 1, this folder** (docs only).
2. **The one-time sort** (no code): the four routines made with the Task window, the lawsuit
   paper filed to its matter, the demand letters' mail recorded, one task for the phones. The
   owner or the assistant, twenty minutes.
3. **PR 2, A's table and deck** (one version): the migration, the kernel and tests, the section,
   the metric, the banner, the round's note-first change, the three windows' `{ title, onCreated }`,
   the guide, the release note and fragment.
4. **PR 3, A's folds and routines** (one version): Waiting for and Someday, the routines block,
   the Mark's auto-note, the docs lines, this README to *built*.

## How to verify

Quickfill → Physical inbox as the dev or an assistant, on a ZZ test paper only. Add a paper and
watch the count and the Roller's *left with work* move at once. Press Task and check the Task
window opens with the title and the saved task appears under the paper's outcome. Press Comes
back, pick a day, and check the routine lists under the deck with its next date. Press Waiting
for and check the fold's count and that the station's count drops. Mark with the deck empty and
read *tray clear* in the history with a zero. On the phone preset, one paper is one card and the
presses wrap to two rows with no sideways scroll. Nothing marked on prod from a test press.

## The decision

The owner's answer of 2026-10-24, on all four Quickfill proposals at once: *"I like your
suggestions, build it all."* So **A** was built as drawn, in four PRs: v2.5815 the table and the
kernel, v2.5818 the deck (Done · Trash · File it · Task · Ask), v2.5821 the folds (Waiting for,
Someday), v2.5825 Comes back, the tray's routines and the mark's note.

- **Where a decided paper lands by default** was not picked, so the build takes the
  recommendation: a **Checklist task**, the door drawn first and filled. It is one constant,
  `PHYSICAL_INBOX_DEFAULT_DOOR` in `lib/quickfill/physicalInbox.ts`. `'request'` puts Ask first.
  The owner's own Todo Tooling inbox has no connection from the app; until one is built, a Task
  with the owner picked as the assignee is the stand-in.
- **The one-time sort** is data, not code, and it is the office's to do: each routine is a real
  repeating task for a teammate, and the build's session was not allowed to create one on prod.
  The steps are under *Where it stands*. The Checklist repeats by weekday or by days after done,
  not by day of the month, so a monthly look is *30 days after done*.
- **Not built here**: a registration day on a truck and a dated home for the company's own
  licenses and certificates. Each would be its own to-do.

## Where it stands

Built 2026-10-24 as v2.5815 · 5818 · 5821 · 5825, checked live as the dev on ZZ test papers only;
the deck was left empty. Left: the one-time sort below, the owner's look, then delete the folder.

**The one-time sort**, five minutes on the live deck, for the owner or the assistant who keeps the
tray. Each line is typed once and pressed once.

1. Type *Toll bills*, press **Comes back**, pick *Weekly on…* Friday, assign the assistant, press
   **Send**.
2. Type *Insurance cards*, press **Comes back**, pick *days after it's done* 30, start Monday.
   The plans renew in January and trucks join plans in between, so a monthly look fits.
3. Type *Registration renewals*, the same way, 30 days after done.
4. Type *License and certificate renewals*, the same way, 30 days after done.
5. Type *Lawsuit papers* with **Came** set to Aug 17 and press **File it**, the Legal desk.
6. Type *Demand letters* with **Came** set to Oct 23 and press **File it**, the Lien desk.
7. Type *Extra phones* with **Came** set to Aug 17, then **Task** or **Someday**.

The four routines then list under the deck as the tray's routines, and the station's count
starts honest.
