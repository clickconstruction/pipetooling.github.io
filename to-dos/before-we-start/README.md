---
name: "Before we start: what has to be true before a stage begins, and who said so"
number: 382
group: gated
status: asked 2026-11-17 · second draft drawn and rendered the same day, after the owner asked whether the first was the best we can do · the owner is refining it · nothing built, and nothing is built before he says build
summary: >
  For each stage the office writes a short list of things that must be true before the crew goes. The app
  tells the office who to call and what to ask, one ask per person across every stage, and keeps every
  ask. A yes always says how we know it: their word, their photo, or we saw it. Our own bullets read the
  order log, the trip and the permit. The decision to send the crew is a press, Go or Hold, with a name on
  it. Every day the customer gives for ready is kept and the days they moved are added up. Any bullet can
  show on the GC's own page, behind the job's switches, where one press answers the list and a Go shows
  them the crew is confirmed.
next: The owner's refinements to this draft and his eight calls. Then PR 1, the rules alone.
size: L as a train of nine (S · S · M · M · S · S · M · S · S)
blocker: The owner's refinements. This is a second draft, drawn to be changed.
opinion: build — the windows, the GC's page and the stage checklist's editor all exist, and the one thing none of them holds is whether the site will be ready and who said so
---

# Before we start (#382)

The mock-up is [mockup.html](mockup.html). Every screen on it is drawn by one script from one list of
made-up stages, so the band, the chart, a row and an open stage are counted from the same bullets. It was
rendered with Playwright at desk and phone width, in light and dark, before it was shown. Every site,
customer, person, job, date and figure on it is made up.

This is the second draft. The owner asked to build the mock-up and the plan together and refine them, then asked of the first draft: *I like the basis of this but is this the best we can do*.

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

- **A bullet on them** is Open or Yes. A Yes says how we know: their word, their photo, or we saw it. It
  keeps who said it, how and the day, and it can go back to Open with every change kept. A bullet can ask
  for a photo, and then their word alone leaves it Open. Every ask is kept: the day, how, and whether
  they answered.
- **A bullet on us** is read from the app where the app knows: material from the order log, the crew from
  the trip, the permit. Nobody ticks it, and its line opens the place that fixes it. A bullet the app
  cannot read is ticked by hand.
- **Who to call** is the office's first screen: the open bullets by person, across every stage, with one
  ask per person.
- **Their days.** Each day they give for ready is a line: the day, who said it, how and when. A new day
  never erases an old one, and the days they moved are added up per stage and for the site.
- **The go or no-go day** is our window's first day less the notice we need. The notice is one number
  per site, and a stage can have its own.
- **Go or Hold** is a press. Go keeps who decided, when and what was open; a Go with a bullet open is a
  Go on a promise, with a last check the day before the crew leaves. Hold moves our window and writes
  the GC's notice for the office to send.
- **Never a block.** A crew can be scheduled with no Go. The app warns.
- **The GC's page** shows a bullet only on a job whose sharing switch is on, with a second switch for
  this, and only where the bullet's eye is on. One press answers the open bullets, a photo can go with
  it, and after our Go the page reads crew confirmed. It never shows our own bullets, what we saw, a
  note, a name, a trip, a cost, a day they gave before or the days they moved.
- **One editor.** Before we start is a second list on the stage checklist's editor. Each stage kind
  offers a starter list once, and a No on a job offers its bullet to the company's list. Nothing is
  added without a press.

## Is this the best we can do: what the second draft changed

| The first draft | Why it was not the best | The second draft |
|---|---|---|
| A chart first, then a list by stage | The office thinks in calls; two stages meant two texts to one man | Who to call: one row and one ask per person |
| Open, Told yes, Seen | On a far site nobody of ours sees anything before the trip | Yes and how we know; a bullet can ask for a photo |
| The office ticks our own bullets | The app already knows when material lands and whether a trip is planned | Our bullets read the app |
| A go or no-go day with nothing on it | The costly moment was a crew sent on a phone call, with no name on the decision | Go or Hold is a press; Hold writes the GC's notice |
| An ask goes out and is forgotten | Follow-up is the job; asked twice with no answer is a fact | Every ask is kept |
| Moved days drawn as diamonds | Nobody added them up | Days they moved, per stage and for the site |
| The GC ticks each bullet | A superintendent will not tick six boxes and got nothing back | One press from the text's link, a photo, and crew confirmed |
| An empty editor per stage kind | The stage checklist shipped empty and no list was written | A starter list, and a No offers its bullet |

Rejected in the first pass, and still rejected: a stage that cannot be scheduled until clear; one field
for their ready day; the whole list on the GC's page; a chart of bars and links (we do not run the
site); a new editor.

## Where it plugs in

Exists today: `job_stage_windows` and Jobs → Subs; `jobs_ledger_fixtures.shared_with_gc` and
`jobs_ledger.gc_shares_stage_dates`; the portal and its two functions; the stage checklist's tables,
editor, sheet, Pipeline mark and signature; the Development page and its looks; the site's GC contact
(`src/lib/developments/gcContact.ts`); Messages' composer; Dispatch's inbox, which already takes a stage
check from the crew (#245); trips (#379), whose *asked by* and *turned around* this feeds.

New: a kernel for a yes and how we know, our bullets read from the app, the go or no-go day, Go and
Hold, who to call and what the GC's page may show; tables for the marks, the asks, their days, the
decisions and the notice; the sheet on a stage; who to call and Ask them; the decision; the chart; the
portal's card; Is it as told on the phone. The order log's dates (`src/lib/submittals/procurementLog.ts`)
and the trip record feed the bullets on us.

## The plan

| PR | What it brings | Touches | Owed after |
|---|---|---|---|
| 1 | The rules alone: yes and how we know, a photo asked, our bullets read, the go or no-go day, Go and Hold, who to call, what the GC's page may show | A pure kernel and its tests | Nothing |
| 2 | The table: bullets, marks, asks, their days, decisions, the notice | One migration with the four fences, its doc, the types | db push |
| 3 | The list on a stage: the chip, the sheet, our bullets reading the app, the lists with a starter | Job window, Documents, Jobs → Subs, a guide | Nothing |
| 4 | Who to call and Ask them: one ask per person, every ask kept, the Needs you line | Development page, Messages' composer, the Dashboard | Nothing |
| 5 | Go or hold: the decision, the last check, the hold notice | The stage, the Stage Plan's window, the order log's dates | Nothing |
| 6 | The chart and the days they moved, and the Pipeline mark | Development page, a print page | Nothing |
| 7 | The GC's page: one press, a photo, crew confirmed, See it as the GC | The portal, two edge functions, a switch on the job | Function deploy |
| 8 | On arrival and learning: Is it as told, Not as told to Dispatch, the tie to a trip, a No offered to the company's list, the warnings | Job Mode, Dispatch, trips | Nothing |
| 9 | The dev seat verbs and a sheet to send with a bid | dev-mcp, a print page | Function deploy |

## The owner's calls

| # | The call | The default in this draft |
|---|---|---|
| 1 | Is their word enough for a yes? | Yes, unless the bullet asks for a photo; the yes always says how we know |
| 2 | How much notice do we need? | One number per site, 10 days far and 2 near; a stage can have its own |
| 3 | Who may press Go? | The office, and the job's superintendent; the name is kept |
| 4 | Does a hold tell the GC by itself? | No; it writes the notice and the office sends it |
| 5 | Do the ask and their page say a wasted trip is billed? | Off until the owner writes the sentence; then it shows on both |
| 6 | Does the GC see the days they moved? | No; that stays ours, and prints for us |
| 7 | Does the Schedule look stand beside Trips, or hold it? | Its own look, with planned trips as a lane |
| 8 | Do starter lists ship? | Offered once per stage kind, never added without a press |

## How to verify

- The kernel: unit tests on a yes by word, by photo and seen, a bullet that asks for a photo, a bullet
  read from the app, the go or no-go day across a month end, the days they moved, a Go on a promise, and
  what the GC's page may show with each switch off.
- The screens: render smokes, then a live walk on a ZZ development with seeded stages, at desk and phone
  width, light and dark, as the office, a superintendent and a crew member, and the portal as a ZZ GC.
- No real site's names or figures go in a test, a comment or a PR.

## Where it stands

A second draft, drawn to be refined with the owner. Nothing is built.
