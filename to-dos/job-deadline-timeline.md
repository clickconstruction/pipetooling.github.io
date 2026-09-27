---
name: One timeline per job — the demand letter on the strip, whose move it is, two more doors
number: 32
group: ready
status: asked 2026-09-22 · the view itself was built the next day under #37 (v2.3761 · v2.3768 · v2.3781, retired) and grew first days under #42 (v2.3815) · mock-up drawn 2026-09-27 (`job-deadline-timeline.html`), the owner took it as drawn · PR 1 shipped v2.3877 (the demand letter as a step, whose move under each node, the Waiting-on line; the Lien window draws the letter) · left: the two doors (PR 2 Collections row, PR 3 History tab), and the desk + Timeline tab reading the letters
summary: >
  **One timeline per job**: the owner asked for a single view where a person sees, in date
  order, every deadline the job carries, whose move it is, and which paper goes out next. The
  Chapter 53 half exists since 2026-09-23 — `lienTimeline.ts` and the strip on the Lien desk
  panes, the Lien window and the Timeline tab (one row per job, Print the grid): last work, a
  § 53.056 notice per month, § 53.057 retainage, § 53.052 affidavit, § 53.055 service, the
  § 53.101 hold, the § 53.158 suit (watched from the Dashboard) and the release, with a *Next on
  the path* line and, since v2.3815, when each window opens. What the ask named and the strip
  does not carry: the **demand letter** (sent, its named deadline, the reply we wait on —
  `job_demand_letters`, watched only as a Needs You card), an explicit **whose move** reading
  (ours · the GC's · the owner's · the county's — today it is implied by each step's words), and
  the doors from the **Collections** row and the job's **History** tab.
next: >
  PR 2 — the Collections row's ⋯ menu gets *Timeline*, opening the strip in the sheet the Lien window
  uses, with the job's demand letters (the lens already loads them). PR 3 — the History tab shows the
  mini row and the Waiting-on line above the events, with *Open the timeline ›*. Then the Lien desk
  pane and the Timeline tab read `job_demand_letters` so their strips carry the node too.
size: S
blocker: None — the drawing was taken as drawn 2026-09-27.
ver: v2.3761 · 3768 · 3781 · 3815 · 3877
mockup: has
opinion: build — the view is done under #37; the demand letter is the one dated paper still living off the strip, and it is a step, not a screen.
---

# One timeline per job — every deadline, whose move it is, what goes out next

Asked 2026-09-22: *is there a view where a user can see a timeline of the deadlines where someone needs to respond or they need to send out the next type of document or letter or notice per job?* There was not, that day. The rule for building it: **a mock-up comes first, followed by the prompt "is this the best you can do"**, and only then the code.

## What exists now (re-read 2026-09-26)

Counsel's memo of 2026-09-22 asked for the same thing from the other side (*"Timeline — run it separately on every job"*), and #37 built it the next day:

- **The strip** (v2.3761, `lienTimeline.ts` + `LienTimelineStrip`): one job's Chapter 53 path on a rail — `last_work`, one `notice` per unpaid work month (§ 53.056, residential a month earlier), `retainage` (§ 53.057, dated from the contract-end date since v2.3753 / v2.3786), `affidavit` (§ 53.052), `serve` (§ 53.055, five days after filing), `hold` (§ 53.101, the owner's 10 % for 30 days past completion), `suit` (§ 53.158, one year, counsel named 90 days out), `release` (paid → file it; released → the clock stopped). Today's marker sits between past and pending; a *Next on the path* line says the one next thing. Row layout on the desk, list on a phone, mini in a table.
- **The book** (v2.3768): the Lien desk's Timeline tab — every job on the grid, a GC filter, due / later / dead lenses, *Print the grid* for counsel.
- **The tail** (v2.3781): the suit year is watched from the Dashboard (`lien-suit-year` card); the Lien window's header shows the strip; the Legal desk and the firm's portal say when a lien dies.
- **First days** (v2.3815, #42): each step carries when its window opens, and a Steps · Windows switch draws the calendar bars.

So of the eight points the ask listed, seven are on the strip. Doors that exist: the Lien window, the Lien desk pane and its Timeline tab, the Dashboard card.

## What is left

1. ~~**The demand letter as a step.**~~ **Shipped v2.3877** — `demand` step kind in `lienTimeline.ts`, the newest sent letter placed by its reply-by day; the Lien window passes its letters. `job_demand_letters` (v2.2640) records the letter, its amount and lines, and a named deadline; `demandLettersOverdue` feeds a Needs You card when the deadline passes with money open. Nothing on the strip shows *sent Sep 14 · reply by Sep 28 · 6 days* or *overdue · the fee clock runs*. One step kind, one reader, the letter's row as its door.
2. ~~**Whose move, said outright.**~~ **Shipped v2.3877** — `move` on every step, the pill on the strip, `waitingOn` beside Next on the path. Each step's words implied it (*copy to owner and GC*, *the owner holds 10 %*, *counsel now*) but nothing labels a node ours · the GC's · the owner's · the county's, and nothing answers *what are we waiting on, and from whom* as a second line beside *Next on the path*.
3. **Two doors.** The Collections row (Jobs → the collections lens) and the job window's History tab have no way to the strip; a person chasing money reads the demand letter and the lien path in two places.

## Doors

Built: the Lien window, the Lien desk pane, the Timeline tab, the Dashboard's suit card. To add: the Collections row (⋯ → *Timeline*) and the History tab (the strip above the events).

## Mock-up

Drawn 2026-09-27 as [`job-deadline-timeline.html`](job-deadline-timeline.html) (two jobs, the phone, the doors, the rule table); the owner took it as drawn, with one truth fix in the code: § 53.055 serve is *ours* (we mail the copies), not the county's. Draw it before building — on the strip that exists, not a new page. Two real jobs (one commercial job mid-notice; J867, which carries the live-tested demand letter of v2.3445), the phone width included. Then the question — *is this the best you can do* — and the answer changes the drawing before it changes the code. Keep the drawing in this folder when it exists (`job-deadline-timeline.html` beside this file, the way #37 kept its three).
