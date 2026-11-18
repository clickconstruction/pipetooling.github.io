---
name: "Before we start: what has to be true before a stage begins, and who said so"
number: 382
group: gated
status: asked 2026-11-17 · first draft drawn and rendered the same day · the owner is refining it · nothing built, and nothing is built before he says build
summary: >
  For each stage the office writes a short list of things that must be true before the crew goes. The
  office follows up with the customer until each one has a yes, and a stage with every yes reads Clear to
  start. Each bullet keeps who said yes, how and when, apart from what our own people saw. Every day the
  customer gives for ready is kept, so a moved day is on the record. The site's stages sit on one line of
  time on the Development page, with a go or no-go day that tells the office when to call. Any bullet can
  be shown on the GC's own page, behind the job's switches, for them to confirm themselves.
next: The owner's refinements to this draft and his seven calls. Then PR 1, the rules alone.
size: L as a train of eight (S · S · M · M · S · M · S · S)
blocker: The owner's refinements. This is a first draft, drawn to be changed.
opinion: build — the windows, the GC's page and the stage checklist's editor all exist, and the one thing none of them holds is whether the site will be ready and who said so
---

# Before we start (#382)

The mock-up is [mockup.html](mockup.html). Every screen on it is drawn by one script from one list of
made-up stages, so the band, the chart, a row and an open stage are counted from the same bullets. It was
rendered with Playwright at desk and phone width, in light and dark, before it was shown. Every site,
customer, person, job, date and figure on it is made up.

This is a first draft. The owner asked to build the mock-up and the plan together and refine them.

## The ask, in the owner's words

> Right now built into the app in bids there is a GC mode where we can manage a schedule. Can you get
> familiar with this and then help me think about what it would take to add a schedule for a development
> where we would coordinate with the GC based on our schedule? This would be something we may not expose
> to them and we may keep to ourselves. But there are parts that we could expose to them.

> What I was thinking was something along the lines of we set a number of criteria that if met we can
> start a stage. And we get to write those as bullet points basically. This would allow the office to
> follow up with the customer to confirm that a stage is ready for us to start.

> If we're going to make this we should have the option to show it on the GC portal.

## What was found first

- **GC mode's schedule** (`/gc`, `src/lib/gc/schedule/`) is built for when the company is the GC: bars,
  links, moves with a reason, a portal where each trade answers its dates. Every table hangs off a GC
  project, and a line needs a scope item and a trade package. Its ideas carry over. Its tables do not.
- **The Stage Plan** is the sub-side piece: `job_stage_windows` holds our window for a job's stage line,
  typed on Jobs → Subs, with the GC's asked dates and our answer. A line has `stage_kind` and the
  `shared_with_gc` eye, and the job has `gc_shares_stage_dates`.
- **The GC's page** (`/portal`, the `customer-portal` and `submit-portal-request` functions,
  `PortalStagesCard.tsx`, `_shared/gcStages.ts`) already shows *Where the job is* as a numbered list with
  no name and no money, and lets the GC ask for other dates on the next stage.
- **The stage checklist** (`stage_checklist_templates`, `stage_checklist_answers`,
  `src/lib/jobs/stageChecklist*.ts`) is the finish-side twin: the office writes questions per stage kind,
  adds some for one job, skips one with a reason, and the crew answers at the stage.
- **Nothing holds** the day the customer says the site will be ready, what must be true first, how much
  notice we need, or a site-wide view of the stages ahead.

## The decision, as drafted

- **A bullet** has words and says who it waits on, them or us. A bullet on them is Open, Told yes or
  Seen. A bullet on us is Open or Done. Told yes keeps who said it, how and the day. Seen keeps who saw
  it, the day and a photo when there is one. A bullet can go back to Open, and every change is kept.
- **A stage** reads Clear to start when no bullet is Open, and says whether that is on their word or
  seen. A stage with no list reads as it does today.
- **Their days.** Each day they give for ready is a line: the day, who said it, how and when. A new day
  never erases an old one.
- **The go or no-go day** is our window's first day less the notice we need. The notice is one number
  per site, and a stage can have its own.
- **Never a block.** A stage that is not clear can still be scheduled. The app warns.
- **The GC's page** shows a bullet only on a job whose sharing switch is on, with a second switch for
  this, and only where the bullet's eye is on. Their press is a Told yes by their name, on the portal,
  with the time. It never shows a bullet without the eye, what we saw, a note, a name, a trip or a cost.
- **One editor.** Before we start is a second list on the stage checklist's editor.

Rejected in the second pass: a yes or no per bullet (cannot tell their word from what we saw); a stage
that cannot be scheduled until clear (one open bullet stops the team); one field for their ready day (a
moved day erases the record); the whole list on the GC's page; a chart of bars and links (we do not run
the site); the office typing every answer; a new editor.

## Where it plugs in

Exists today: `job_stage_windows` and Jobs → Subs; `jobs_ledger_fixtures.shared_with_gc` and
`jobs_ledger.gc_shares_stage_dates`; the portal and its two functions; the stage checklist's tables,
editor, sheet, Pipeline mark and signature; the Development page and its looks; the site's GC contact
(`src/lib/developments/gcContact.ts`); Messages' composer; Dispatch's inbox, which already takes a stage
check from the crew (#245); trips (#379), whose *asked by* and *turned around* this feeds.

New: a kernel for a bullet's standing, Clear to start, the go or no-go day and what the GC's page may
show; tables for the bullets' marks, their days and the notice; the sheet on a stage; the Schedule look;
To confirm and Ask them; the portal's card and its two presses; Is it as told on the phone.

## The plan

| PR | What it brings | Touches | Owed after |
|---|---|---|---|
| 1 | The rules alone | A pure kernel and its tests | Nothing |
| 2 | The table: bullets, marks, their days, the notice | One migration with the four fences, its doc, the types | db push |
| 3 | The list on a stage: the chip, the sheet, the company's lists, the Stage Plan row | Job window, Documents, Jobs → Subs, a guide | Nothing |
| 4 | The Schedule look: the band, the chart, the Pipeline mark | Development page | Nothing |
| 5 | To confirm and Ask them, and the Needs you line | The look, Messages' composer, the Dashboard | Nothing |
| 6 | The GC's page: shared bullets, Yes ready and Not yet, See it as the GC | The portal, two edge functions, a switch on the job | Function deploy |
| 7 | On arrival and the warnings: Is it as told, Not as told to Dispatch, the tie to a trip | Job Mode, Dispatch, trips | Nothing |
| 8 | The dev seat verbs and a printed sheet to send with a bid | dev-mcp, a print page | Function deploy |

## The owner's calls

| # | The call | The default in this draft |
|---|---|---|
| 1 | Is their word enough to read Clear to start, or must we see it? | Their word clears it, and the stage says which |
| 2 | How much notice do we need? | One number per site, 10 days far and 2 near; a stage can have its own |
| 3 | Does the Schedule look stand beside Trips, or hold it? | Its own look, with planned trips as a lane |
| 4 | Which stages take a list? | Any stage line; the company's lists are for Rough In, Top Out and Trim Set |
| 5 | On the GC's page, does their press count as Told yes? | Yes, with their name and the time |
| 6 | Does the GC's page show the notice we need and the answer-by day? | Yes |
| 7 | Who writes bullets? | Whoever writes stage checklist items today |

## How to verify

- The kernel: unit tests on a bullet's standing, Clear to start on their word and seen, the go or no-go
  day across a month end, a moved day, and what the GC's page may show with each switch off.
- The screens: render smokes, then a live walk on a ZZ development with seeded stages, at desk and phone
  width, light and dark, as the office, a superintendent and a crew member, and the portal as a ZZ GC.
- No real site's names or figures go in a test, a comment or a PR.

## Where it stands

A first draft, drawn to be refined with the owner. Nothing is built.
