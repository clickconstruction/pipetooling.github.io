---
name: "Before we start: what has to be true before a stage begins, who said so, and who decided to go"
number: 382
group: close
status: asked 2026-11-17 · drawn twice, then built as a working spike the owner clicked through and shaped the same day · he approved all of it and asked for it to be built in another session · the build began 2026-11-19 on Grace's word · the train of eleven is built: PR 1, values in place (v2.7985), PR 2, the rules (v2.7992), PR 3, the table (v2.7997), PR 4, the list on a stage (v2.8003), PR 5, the Schedule look (v2.8006), PR 6, Ask them (v2.8010), PR 7, Go or hold (v2.8012), PR 8, our bullets read the app (v2.8015), PR 9, the GC's page (v2.8018), PR 10, on arrival (v2.8110) and PR 11, the line of time (v2.8111) · PR 10 and PR 11 audited 2026-11-20, five faults fixed in four PRs (#9167, #9168, #9170, #9174) · left: the dev seat's verb
summary: >
  For each stage the office writes a short list of things that must be true before the crew goes. It is a
  checklist, and the same checklist in every seat: the office ticks what the customer told it, the GC ticks
  on their own page, the crew confirms on arrival. Each stage says where it stands in one sentence with one
  press, and carries a ready bar of small check boxes with a percent. A yes always says how we know it:
  their word, their photo, or we saw it. The decision to send the crew is a press, Go or Hold, with a name
  on it. Every day the customer gives for ready is kept and the days they moved are added up. The owner
  approved the design as a working spike, and named one of its ideas for the whole app: values in place.
next: The dev seat's verb, once the seat has room and the owner says what it reads. Every call stands on its default until the owner flips it.
size: L as a train of eleven (S · S · S · M · M · S · S · S · M · S · S)
blocker: none for the screens. The dev seat's verb waits for room under the seat's upload limit. The calls left each have a default.
opinion: build — the owner used it and said he likes all of it; the windows, the GC's page and the stage checklist's editor already exist, and the one thing none of them holds is whether the site will be ready and who said so
---

# Before we start (#382)

**The mock-up is the spike itself.** [mockup.html](mockup.html) is the working page the owner approved,
built into one file with nothing to run. Open it and press things: three seats over one store kept in
the browser (the office, the GC's page, the crew's phone), a *Today is* stepper to watch a deadline
arrive, and *Start over*. Every site, customer, person, job, date and figure in it is made up.

**The spike's code is on branch `spike/before-we-start`**, pushed and not meant to merge:

| File | What it is |
|---|---|
| `src/lib/startChecks/startChecks.ts` | The rules, pure. This is the kernel the build starts from. |
| `src/spike/beforeWeStart/BeforeWeStartSpike.tsx` | The page: the three seats and every piece drawn. |
| `src/spike/beforeWeStart/spikeStore.ts` | The made-up site and the presses, kept in `localStorage`. |
| `src/App.tsx` | One public route, `/spike/before-we-start`. |

To run it: check the branch out, `npm run dev`, open `/spike/before-we-start`.

## The ask, in the owner's words

> Right now built into the app in bids there is a GC mode where we can manage a schedule. Can you get
> familiar with this and then help me think about what it would take to add a schedule for a development
> where we would coordinate with the GC based on our schedule? This would be something we may not expose
> to them and we may keep to ourselves. But there are parts that we could expose to them.

> What I was thinking was something along the lines of we set a number of criteria that if met we can
> start a stage. And we get to write those as bullet points basically. This would allow the office to
> follow up with the customer to confirm that a stage is ready for us to start.

> If we're going to make this we should have the option to show it on the GC portal.

After two drawn drafts: *This is better. It just doesn't feel intuitive yet. So why don't we build this
all as a spike?* Then, using the spike:

> I don't like how in this section the things that need to be done blend together too much. Maybe we
> should make a dulled section of criteria met and a still open section of criteria unmet.

> Dates that can change and words that can change are not underlined and clarified as changeable. And as
> a result, when I look at the sentences they all blend together, instead of me being able to scan and
> see specific dates and times that are the values that are changing.

> What if we made the checkboxes a little smaller, and showed a green line below them and yellow or red
> line below the empty boxes. So visually someone could see a bar that is, for example, 83% ready if
> there are six checkboxes, and only five are marked ready. Every bullet should count equally towards a
> percent.

> I like everything you've made and the specs and the visuals and the idea. Please save everything to a
> punch list card so we can build all of it by another user in a different session.

## What was found first

- **GC mode's schedule** (`/gc`, `src/lib/gc/schedule/`) is built for when the company is the GC: bars,
  links, moves with a reason, a portal where each trade answers its dates. Every table hangs off a GC
  project. Its ideas carry over. Its tables do not.
- **The Stage Plan** is the sub-side piece: `job_stage_windows` holds our window for a job's stage line,
  typed on Jobs → Subs. A line has `stage_kind` and the `shared_with_gc` eye, and the job has
  `gc_shares_stage_dates`.
- **The GC's page** (`/portal`, the `customer-portal` and `submit-portal-request` functions,
  `PortalStagesCard.tsx`, `_shared/gcStages.ts`) already shows *Where the job is* with no name and no
  money, and lets the GC ask for other dates on the next stage.
- **The stage checklist** (`stage_checklist_templates`, `stage_checklist_answers`,
  `src/lib/jobs/stageChecklist*.ts`) is the finish-side twin: questions per stage kind, more for one job,
  the crew answers at the stage.
- **Nothing holds** the day the customer says the site will be ready, what must be true first, how much
  notice we need, or a site-wide view of the stages ahead.

## The idea, in one line

It is a checklist, the same checklist in every seat, and each stage says where it stands in one sentence
with one press.

## What the owner approved

Each part below is in the mock-up. The words in **bold** are the words on the screen.

### 1. The office's home

On the Development page, as a **Schedule** look, and as a line on the Dashboard's Needs you.

- **A banner on top.** *Ray owes us 6 answers on 2 stages.* with **Ask Ray about all 6**. Under it: who
  the contact is, and how many days they have moved on this site.
- **One card per stage ahead**, sorted by trouble: red, then amber, green, grey, and by first day inside
  a colour. Each card has a coloured dot, the stage's name, our window, the ready bar, one sentence, and
  one press.
- **The one press is whatever comes next**: Ask the contact, Go or hold, Move our start, Write the list,
  or the door to our own thing that is not ready.
- **A line of time** behind a link, **Show it on a line of time**: a bar per stage in its colour, a
  diamond on the day they say ready, a hollow diamond on a day they gave before, a dotted line on the day
  we decide, and the days they moved in red.

### 2. Where a stage stands

`stageStanding` in the kernel answers these in order, and the first that fits is the stage's sentence:

| The case | Colour | The sentence, by example | The press |
|---|---|---|---|
| No list written | grey | Nobody has written what must be true before this stage. | Write the list |
| The crew said No on arrival | red | Luis got there Nov 17 and it was not as told: (the bullet) | Open the stage |
| Go, nothing open | green | Crew confirmed for Tue Dec 8. Dana pressed Go Nov 12. | none |
| Go with something open | amber | Dana pressed Go Nov 21 with 1 thing open. Last check Sun Nov 29. | Ask, or our door |
| Their day is after ours | red | Ray says ready Dec 12. We planned to start Tue Dec 8. | Move our start |
| Nothing open, no decision | green | Nothing is open. Press Go to confirm the crew for Tue Dec 1. | Go |
| Only ours is open | amber, red once the day to decide comes | Ray is done. 1 thing of ours is not ready. We decide by … | Our door, then Go or hold |
| Theirs is open, the day has come | red | Waiting on Ray for 2 things. We decide today. | Go or hold |
| Theirs is open, inside 14 days | amber | Waiting on Ray for 1 thing. We decide by Sat Nov 21, in 4 days. | Ask, or Go or hold once asked in the last two days |
| Theirs is open, further out | grey | 4 things open. Nothing to do until Dec 19. | none |

### 3. The ready bar

- Small check boxes in a row beside the stage's name, one per bullet. Ready ones first, then a No, then
  the open ones.
- A line under the whole row: **green** under the ready boxes, **amber** under the open ones, **red**
  under the open ones when the stage itself is red, and red under a No.
- A percent after it: **83% ready** for 5 of 6. **Every bullet counts equally.** It reads 100% only when
  every bullet has a yes, so it rounds down and never rounds up to ready. It turns green at 100%.
- A ready box is a green check. An open box is empty. A red cross is only for a real No, the crew saying
  on site that it was not as told.
- Resting the cursor on the row, or pressing it on a phone, lists **What it takes to start (the stage)**:
  the count and the percent, the open bullets first with where each stands, then the ones with a yes,
  dulled.
- The GC's page carries the same bar for what we need from them only, so the office and the GC can see
  different percents for one stage. The office's counts our own bullets too.

### 4. The open stage

- **Four short lines, one fact each**, the label on the left and the values in a column. Not a sentence:
  the owner rejected one sentence holding five facts.

  | Label | Values |
  |---|---|
  | We start | our first day **to** our last day, both changeable |
  | (who) says ready | their day, changeable; *N days after our start* in red when it is; *first said (day), so it has moved N days* |
  | Notice we need | the days of notice, changeable |
  | We decide by | the day, worked out, and *in N days* |

- A line under them says which values are which: **Underlined** values change where they sit, **Bold**
  values are worked out.
- When their day is after ours, one press under the lines: **Move our start to (day), three days after
  theirs**.
- **Two lists, by standing.** **Still open · N** on top at full strength. **Has a yes · N** below,
  dulled. Ticking a bullet drops it into the dulled list. Each row carries a small tag for whose it is:
  *from (contact)* or *ours · read from the app*.
- **A bullet on them** is a box to tick. One tap records *(contact), told us, today*. Its line then reads
  who, how and the day, each changeable. An open bullet's line says when we asked and the day they say
  it will be true, changeable. A quiet **⋯** on the row opens: **How do we know?** (their word, their
  photo, we saw it), **Ask for a photo**, **Shows on the GC's page**, **Take off the list**.
- **A bullet that asks for a photo** is not a yes on their word alone. It stays open, says *Still needs
  a photo*, and offers **They sent a photo** and **We saw it** right there.
- **A bullet on us** is ticked by nobody. It shows what the app read and the door that fixes it.
- **Add a bullet**, in plain words, *from them* or *ours*.
- **A stage with no list** offers a starter list once: **Use the four** or **Write my own**.
- The bottom of the stage: **Ask (contact) about N**, and **Go or hold**. The person's name goes on the
  decision.

### 5. Values in place

The owner named this as something he wants across the app. It is the first PR of the train, alone.

- **Every value is drawn apart from the words.** A date, a count, a name or an amount is never plain
  text inside a line.
- **Two looks, two meanings.** Underlined and tinted means a person can change it: press it and it
  becomes its own field right there, with **Keep** and **Cancel**; Enter keeps, Escape cancels. Plain
  bold means the app works it out, and it updates by itself.
- **One fact per line**, the label on the left, the values in a column, so the eye can run down the
  values alone.
- **No detour.** No *Change a date* link, no edit window for a value already on the screen.

In the spike the kernel marks a value inside a sentence as `⟦kind|text⟧` (`val`, `sentenceParts`,
`CHANGEABLE_VALUES`) and the page draws it (`Sentence`, `Change`). The words to ask for it elsewhere:
*give this screen values in place*.

Built as PR 1 (v2.7985): `src/components/valuesInPlace/ValuesInPlace.tsx` draws it (`ChangeableValue`,
`WorkedOutValue`, `ValueSentence`, `ValueLines`, `ValuesLegend`, `ValuesInPlaceOff`) and
`src/lib/valuesInPlace.ts` holds the pure half. The build marks a value as `⟪kind|text⟫`, since the spike's
brackets already mark a paper's gaps on the Lien desk. The rule is in `CLAUDE.md` → Working conventions.

### 6. Ask them

- One ask per person, across every stage it covers, written from the open bullets. A bullet that asks
  for a photo says so in the ask.
- The office reads it and changes any word. Nothing goes out by itself.
- **Every ask is kept**: the day and how. An open bullet shows when it was last asked and that there is
  no answer yet.

### 7. Go or hold

- **Go** sends the crew for the first day. With something open it is a **go on their promise**, and it
  comes back to the office the day before the crew leaves. It keeps who pressed it, when, and what was
  open. **Take the Go back** undoes it.
- **Hold** keeps the crew home and moves our start to a day the office picks. It writes the note for the
  contact, and the office sends it.
- Nothing is ever blocked. A crew can be scheduled with no Go. The app says so.

### 8. The GC's page

- **Off by default.** It needs the job's sharing switch, which exists today, and a second switch on the
  job: **Show what we need before each stage**. Then each bullet's eye. Bullets on them start shown,
  bullets on us start hidden.
- **Still needed from you · N** on top: each open bullet is its own white box with a large tick box, and
  the box turns green when ticked. **Nothing is ticked for them.** A link, **All of these are ready**,
  ticks them all. One press sends: **Yes, N are ready**.
- **I am adding a photo** goes with a yes. A bullet that needs one says so.
- **Not ready yet? It will be ready (day)** sends a day. It is kept beside the days they gave before.
- **Already settled · N** below a rule, small and grey, with how we know each one.
- After our Go, with nothing open, the stage reads **Crew confirmed for (day)**. That firm date is what
  they get for answering.
- Their press is a yes on their word, by name, with the time. With a photo it is a yes with their photo.
- The page never shows our own bullets, what we saw, a note, a name, a trip, a cost, a day they gave
  before, or the days they moved.
- The page stays light when the app is dark, as every customer-facing page does.

### 9. The crew's phone

- The first clock-in on the stage asks **Is it as told?** and lists only the bullets nobody of ours has
  seen. **Yes, all as told** turns each into a yes we saw.
- A **No** on a bullet opens it again, turns the stage red in the office with who told us it was ready,
  and tells Dispatch. The crew is clocked in either way and is never stopped.
- A No is what a wasted trip is billed with: it ties to the trip record (#379), whose *turned around*
  and *asked by* it feeds.

## The rules, and the tests they need

`src/lib/startChecks/startChecks.ts` on the spike branch, pure, no screen:

| Function | What it says |
|---|---|
| `bulletIsYes`, `waitsOnPhoto` | A yes that stands; their word is in and a photo is still asked for |
| `readiness` | Yes, total and the percent, rounded down, 100 only when all are yes |
| `openBullets`, `openOnThem`, `openOnUs` | What is open, and whose |
| `goNoGoDay`, `lastCheckDay` | Our first day less the notice; the day before the crew leaves |
| `theirDay`, `movedDays`, `startClash` | Their newest day, how far it has moved, whether it is after ours |
| `stageStanding` | The colour, the sentence with its values marked, and the next press |
| `stagesToAsk`, `askText`, `holdText` | Who to ask now, the ask, and the hold note |
| `sharedBullets` | What the GC's page may show |
| `val`, `sentenceParts`, `plainSentence` | A value inside a sentence |

Tests to write with the lift: a yes by word, by photo and seen; a bullet that asks for a photo; a bullet
read from the app; the percent at 0 of 4, 5 of 6, 199 of 200 and all; the day to decide across a month
end; the days they moved with one, two and three days; every row of the standing table; the ask across
two stages; what the GC's page may show with each switch off.

## What is pretend in the spike, and what the build makes real

| In the spike | In the build |
|---|---|
| One made-up site in the browser's storage | Tables, read and written under RLS |
| A bullet on us flips when its door is pressed | It reads the order log's dates (`src/lib/submittals/procurementLog.ts`), the planned trip (#379) and the permit |
| The ask is copied, and the office says how it sent it | Messages' composer sends the text or email, and the send is the kept ask |
| A photo is a tick box | A real photo: the GC's upload on the portal, or one of ours, filed as the stage checklist files its photos |
| The three seats are tabs on one page | The office in the app, the GC on `/portal`, the crew in Job Mode |
| The person is always one name | The signed-in person |
| A No reaches Dispatch as a line of text | A stage check to Dispatch, as #245 already sends one |

## Where it plugs in

Exists today: `job_stage_windows` and Jobs → Subs; `jobs_ledger_fixtures.shared_with_gc` and
`jobs_ledger.gc_shares_stage_dates`; the portal and its two functions; the stage checklist's tables,
editor, sheet, Pipeline mark and signature; the Development page and its looks; the site's GC contact
(`src/lib/developments/gcContact.ts`); Messages' composer; Dispatch's inbox; trips (#379).

New: the shared values-in-place piece; the kernel; tables for the bullets, their marks, the asks, their
days, the decisions, the arrivals and the notice; the Schedule look; the stage's list; Ask them; Go or
hold; the portal's card; Is it as told in Job Mode.

The company's lists per stage kind go on the stage checklist's editor as a second list, **Before we
start** beside **At the stage**, so there is one place to write lists.

## The plan

Eleven small pull requests, each alone, each with its release note, fragment and guide words.

| PR | What it brings | Touches | Owed after |
|---|---|---|---|
| 1 | **Values in place**, the shared piece: a changeable value and a worked-out value, and the rule written where the conventions live | A shared component, its render test, the conventions | Nothing |
| 2 | **The rules**, lifted from the spike's kernel, with the tests above | A pure kernel and its tests | Nothing |
| 3 | **The table**: bullets, marks, asks, their days, decisions, arrivals, the notice | One migration with the four fences, its doc, the types | db push |
| 4 | **The list on a stage**: the four lines, the two lists, the bullet rows, the starter, the company's lists | Job window, Documents, Jobs → Subs, a guide | Nothing |
| 5 | **The Schedule look**: the banner, the cards, the ready bar and its list, the sentences | Development page | Nothing |
| 6 | **Ask them**, every ask kept, and the Needs you line | The look, Messages' composer, the Dashboard | Nothing |
| 7 | **Go or hold**, the last check, the hold note | The stage, the Stage Plan's window | Nothing |
| 8 | **Our bullets read the app**: the order log, the trip, the permit | The kernel's readers | Nothing |
| 9 | **The GC's page**: the two switches, still needed and already settled, the photo, crew confirmed | The portal, two edge functions, a switch on the job | Function deploy |
| 10 | **On arrival**: Is it as told, a No to Dispatch, the tie to a trip, a No offered to the company's list | Job Mode, Dispatch, trips | Nothing |
| 11 | **The line of time**, the days they moved on paper, the dev seat's verbs | Development page, a print page, dev-mcp | Function deploy |

The first seven give the office the whole loop with nothing shown to the GC.

## Decided by the owner, 2026-11-17

- Build it, all of it, from this card, in another session.
- A stage's bullets are split into what is still open and a dulled list of what is met, in every seat.
- Values in place: changeable values underlined and changed where they sit, worked-out values bold.
- The stage's dates are four short lines, not one sentence.
- The ready bar: small check boxes over a line, green under ready, amber or red under open, with a
  percent, and a list on hover.
- Every bullet counts equally toward the percent.
- It can show on the GC's page, as an option.

## Calls still open, each with its default

| # | The call | The default |
|---|---|---|
| 1 | Is their word enough for a yes? | Yes, unless the bullet asks for a photo |
| 2 | How much notice do we need? | One number per site, 10 days far and 2 near; changeable in place |
| 3 | Who may press Go? | The office, and the job's superintendent; the name is kept |
| 4 | Does a hold tell the GC by itself? | No; it writes the note and the office sends it |
| 5 | Do the ask and their page say a wasted trip is billed? | Off until the owner writes the sentence |
| 6 | Does the GC see the days they moved? | No; that stays ours |
| 7 | Does the Schedule look stand beside Trips, or hold it? | Its own look |
| 8 | Is an open box empty, or a cross? | Empty; a red cross is only a real No |
| 9 | Which stages take a list? | Any stage line; the company's lists are for Rough In, Top Out and Trim Set |

## How the design got here

Two drawn drafts came before the spike. The second answered the owner's *is this the best we can do*
with eight changes: who to call by person, a yes that says how we know, our bullets read from the app,
Go or hold as a press, every ask kept, the days they moved added up, one press on the GC's page with
crew confirmed back, and lists that start from a starter. The spike then replaced a design of parts
with one idea, a checklist in every seat, and the owner's own six changes above shaped it.

Rejected along the way, and still rejected: a stage that cannot be scheduled until clear; one field for
their ready day; the whole list on the GC's page; a chart of bars and links as the first screen; a new
editor for the lists; one sentence holding five facts; a tick box pre-ticked for the GC.

## How to verify

- The kernel: the unit tests listed under the rules.
- The screens: render smokes, then a live walk on a ZZ development with seeded stages, at desk and phone
  width, light and dark, as the office, a superintendent and a crew member, and the portal as a ZZ GC.
- Walk the mock-up beside the build: every press in [mockup.html](mockup.html) should have its twin.
- No real site's names or figures go in a test, a comment or a PR.

## How the mock-up is made

`mockup.html` is a production build of the spike's page with React bundled in. To rebuild it from the
spike branch: a throwaway folder in the worktree with an `index.html`, a `main.tsx` that renders
`BeforeWeStartSpike` over a small stylesheet of the app's colour tokens, and a vite config beside it
(`inlineDynamicImports`, one script, one stylesheet); then fold the script and the stylesheet into one
HTML file. It was walked with Playwright from the file, every seat, at desk and phone width, with no
script error and no page overflow.

## Where it stands

Approved by the owner as a working spike. The build began on 2026-11-19, on Grace's word, in its own session, and
all eleven PRs were on main by 2026-11-21.

- **PR 1, values in place: built** (v2.7985). The shared piece, its tests, its looks and the convention. No
  screen uses it yet. It holds what [#399](../values-in-place/README.md) asked of it.
- **PR 2, the rules: built** (v2.7992). `src/lib/startChecks/startChecks.ts` with the tests listed above. One
  row was added to the standing table: a stage line with a list and no days of ours reads *We have not planned
  our days for this stage.* with **Plan our days**, since a line has no window until the office plans it.
- **PR 3, the table: built** (v2.7997). `20261120033820_start_checks.sql`: eight tables, three gates that name
  who, one door for Go and Hold, and a read of our days for the desk. Its bed runs in the SQL beds workflow.
- **PR 4, the list on a stage: built** (v2.8003). The job window's Documents tab has **Before we start**, and
  Jobs → Subs has a door to it. Three things wait for their own PRs: **Ask them** (6), **Go or hold** (7) and the
  eye (9). A bullet of ours was ticked by hand alone until PR 8.
- **PR 5, the Schedule look: built** (v2.8006). The Development page's last look: the banner, one card a stage
  ahead sorted by trouble, the ready bar with its list, and the stage's sentence. The banner's ask press is PR 6.
- **PR 6, Ask them: built** (v2.8010). One ask across every stage it covers, opened filled in the customer's box
  in Messages and sent only there, every ask kept, and the office's Needs you line. The message goes to the job's GC
  or customer as Messages holds them, which may not be the person the bid names as the GC's contact.
- **PR 7, Go or hold: built** (v2.8012). The decision with a name on it, a go on their promise that comes back for a
  last check, a Hold that moves our window and writes the note the office sends, and the Go taken back. With it the
  office has the whole loop, and nothing is shown to the GC.
- **PR 8, our bullets read the app: built** (v2.8015). A bullet of ours says where it is read from, changed in
  place: a hand tick, the order log, Trips or the city's permits. Two limits. Nothing in the app records our own
  permit for a job, so the permit is read from the city's feed at the job's address and only in the cities we read.
  Each read runs under the reader's own row security, so a superintendent can read a bullet open that the office
  reads ready: a read every desk seat sees alike needs a definer read on the server, and is not built.
- **PR 9, the GC's page: built** (v2.8018). Off on every job until the office turns on the job's own switch,
  beside the sharing switch, and then each bullet's eye. Their page lists what is still needed, takes a tick, a
  photo or a day, and reads **Crew confirmed** after our Go with nothing open. The page has no person's name, so
  a yes from it carries the customer's.
- **PR 10, on arrival: built** (v2.8110). The crew's card **Is it as told?** leads the job's details in Job Mode. A
  migration with two definer functions, `start_check_arrival_state` and `start_check_arrive`, holds it, and its bed
  runs with the tables' bed. A No reaches Dispatch as a stage check with **Open the list**, and the office is offered
  the bullet for the company's list. Built on four defaults, each the owner's to flip:
  - It is a standing card in Job Mode, not a question at the clock-in. Job Mode does not know which stage a person
    is on, so the database asks about the stage whose days of ours have come.
  - A stage with no days of ours is not asked about.
  - The bullet's press is the word **No**, as in the mock-up.
  - A read that fails is silent and tries again by itself when the signal is back.

  Three things it leaves: the trip's own record is not fed by a No (the arrival keeps its trip), the office's sentence
  does not name who told us (Dispatch's line does), and the superintendent's Go still has no screen.
- **PR 11, the line of time: built** (v2.8111). **Show it on a line of time** opens over the Schedule look's cards:
  a bar a stage in its colour, a diamond on each day they gave, the days they moved in red on the row itself, and
  today as a red line named in the legend. On a phone each stage's name sits over its line. **Print the days they
  gave**, for whoever may set the notice, prints the office's sheet of every day each stage was given and each move,
  marked as ours and not sent. The link sits over the cards and not under them as in the mock-up, so a site with
  many stages still shows it. The dev seat's verb is not built. #8996 and card 315's seat PRs are on main, dev-mcp
  has 7.7 KB of room under its 4.5 MB ceiling with PR 10's types in its catalog (2026-11-21), and what the verb
  reads is the owner's call. Its version note goes in `docs/dev-mcp/SERVER_NOTES.md`.
- **Found on the walk against prod** (2026-11-20, a ZZ Test job, the office and a sample superintendent). Notes for
  Grace, none of them built:
  - A superintendent is on a job's desk and may press Go by the table's rules (call 3). No screen reaches them yet:
    the job window's Documents tab and the Development page do not open for that role. Job Mode's superintendent
    card is the natural home, beside PR 10.
  - The Schedule look's banner still offers Ask right after an ask is kept. The stage's own card moves on to Go or
    hold.
  - Two jobs on one part of a site read alike on the Schedule look, since a card names the part and not the job.
  - The Needs you line takes its contact job by job. A site whose GC is named only on the development reads *The
    customer owes us…* there, while the Schedule look names the GC.
- **Next:** the dev seat's verb, once the seat has room and the owner says what it reads.
- **Built on the defaults.** Each of the nine calls above is built on its default until the owner flips it.

## The audit

Taunya asked for it on 2026-11-20: PR 10 (#9123, v2.8110) and PR 11 (#9131, v2.8111) had been read by nobody but
the session that built them. A second session read both diffs whole against this card and against the code they
call into: the tables' migration, the trips tables, the stage check's road to Dispatch, the push function and the
rules in `startChecks.ts`. PRs 1 to 9 are not in it.

Five faults were found, fixed in four small PRs. Nobody met one: production held one arrival, on a ZZ test
job, and no real job has a list.

### Found, each with its fix

Most serious first. Each PR carries its release note, its fragment and a test that fails on the old code. All four
were armed for the merge queue on 2026-11-20. #9167 is a migration and is pushed right after its merge.

| # | The fault | The case that shows it | Where | Fixed in |
|---|---|---|---|---|
| 1 | **A second answer replaced a No.** `start_check_arrive` took a lock *to hold two arrivals apart* and never looked for the first arrival. | Two of ours reach a site with the card open. Hector says **No** on the slab. Luis, on the older card, presses **Yes, all as told**. The slab was still on the list to look at, so it became a yes we saw in Luis's name on a second arrival. The office reads the newest arrival: the red and the No were gone, and Dispatch's line was the only trace. | `supabase/migrations/20261120100000_start_check_arrive.sql:129` | #9167, a migration alone. The door refuses a second answer by name: *Hector Helper already answered for this stage.* |
| 2 | **A card no press could answer.** A refused send left the card as it was. It read again only when the signal came back or the page returned to the front. | The second of two people at a site, every time: someone answered first, each press is refused the same way, and the card stays. The same after the office changes a bullet. | `src/components/jobMode/JobModeArrivalCheck.tsx:86` | #9168. A refused send reads again, so the card shows the list as it is now or leaves. |
| 3 | **The card left when a later read failed.** A read that failed set the card to nothing, the first read or not. | A person presses two Nos, the phone goes to the pocket, and it comes back to the front with no signal. The card and its Nos are gone until the signal returns. | `src/components/jobMode/JobModeArrivalCheck.tsx:34` | #9168, with fault 2. A later read that fails keeps the card that is up. |
| 4 | **A wrong number on the line of time.** *moved N days* was hung before a row's first mark whenever its last mark was past 70% of the line. On a row that runs the whole line that is the left edge. | One stage, first said ready the day after today, now ready a month later. At 320 px the words were 55 px off the left of the screen and *moved 32 days* read *2 days*. At 760 px they sat 70 px over the stage's name and the today line. The stage that moved the most is the one it hit. | `src/lib/startChecks/timeLine.ts:97` | #9170. The words sit under the row's marks, anchored on the day they say now and slid by the same share (`movedSlide`), so they cannot leave the row. |
| 5 | **A press that did nothing.** `timeLine` answers null when no stage ahead has a day, and the look drew nothing for null. | A site as the office first sets it up, lists written and no day planned: **Show it on a line of time** turned to **Hide** and the screen stayed as it was. | `src/lib/startChecks/timeLine.ts:57`, `src/components/developments/DevelopmentScheduleCard.tsx:130` | #9174. An empty state says what is missing and that **Plan our days** on a stage draws its row. |

Fault 4 was measured, not judged by eye: the real `ScheduleTimeLine` over the real `timeLine` and the app's own
stylesheet in headless Chrome, with made-up stages, at 320, 390, 760 and 1400 px, before and after.

### Calls for the owner, each with a pick

None of these is built.

| # | The call | As built | The pick |
|---|---|---|---|
| A | After a No, is the stage asked about again on the next trip? | Never. A stage is asked about once, and since #9167 the door holds that too. Only a dev deleting the arrival opens it again. | Ask again, about the bullets that had a No alone, once the office has a new yes on them. That is the trip where the yes most needs one of ours to see it. |
| B | Two of ours answer, the first says **Yes, all**, the second says **No**. | The second is refused by name. Their No is not kept. | Let a later No through as its own arrival, and keep refusing a later Yes. A No is the dearer of the two. |
| C | Who is the crew for an answer? | `start_checks_crew` counts anyone who was ever clocked in on the job, with no limit of days (`20261120033820_start_checks.sql:82`, PR 3's gate). PR 10 is the first write through it. | Hold the clock-in to the last 14 days. A person who worked the job last year should not answer for a stage today. |
| D | A first read that fails is silent (PR 10's own fourth default). | It asks nothing, for a lost signal and for a refusal alike. `CLAUDE.md` asks a failed read on a crew screen to draw on `OfflineRetryPanel`. | Keep silence for a lost signal, as built. Draw a refusal, since that one is a fault of ours and not of the site. |
| E | Values in place on the crew's card and the office's red line. | The stage's name is plain words in the card's lead (`JobModeArrivalCheck.tsx:96`). The name and the day in *Luis said No on site, Nov 20.* are plain words (`StartCheckStage.tsx:501`, a line from PR 4 that PR 10 added a press to). | Draw each as a worked-out value. Small, and it touches the kernel's words. |
| F | The trip an arrival keeps. | Only a trip on the job's site (`trips.development_id`). A trip made on the job itself, or on a job with no site, is not kept (`20261120100000_start_check_arrive.sql:154`). | Match `trips.job_id` too, when #379's tie from a No to a wasted trip is built. |

### Read, and found clean

- **The migration.** It opens with `SET lock_timeout = '3s';`. It is `CREATE OR REPLACE` with its grants restated,
  so a second run changes nothing. It makes no table, so it owes no fence calls.
- **Who may call.** Both functions are definer with `search_path = public`. `PUBLIC` and `anon` hold no grant on
  either, and `authenticated` and `service_role` do. Read from production's own catalog, not from the file.
- **Who may write.** The crew holds no insert or update grant on any `start_check_*` table. Both functions ask
  `start_checks_crew` or `start_checks_desk`. The door refuses an archived caller, training mode and a digital
  twin itself. The line to Dispatch is written in the caller's own name.
- **The road to Dispatch.** The one-open-check index does not hold a No back, since its question is null. The three
  self-close triggers key on a question and never match one. `notify-dispatch-request` reads the title alone and
  needed no change. Only Dispatch or a dev may close a line, so *the sender may close it* holds for a sender in the
  Dispatch group.
- **Production.** `20261120100000 start_check_arrive` is in the ledger. The types are on main (#9151).
  `npm run check:edge-drift` reads all 199 functions as current, and neither PR changed one. No deploy is owed.
- **The rules on the lines they wrote.** Error words go through `formatErrorMessage`. No raw neutral colour, and
  the reds and greens are status colours. The new styles take `font-family: inherit`. Both guides pass the plain
  words, content and links tests. The Schedule look draws a failed read on `OfflineRetryPanel`. The sheet's print
  is listed as not a send, with its reason.
- **The line of time's rules.** The span, the Monday it opens on, the ticks, a stage with no day, and the days
  moved against `movedDays`. The printed sheet escapes every name it prints.

### What the tests leave unproved

- **The bed, `30_arrive.sql`.** Its job is on no site, so the trip lookup never runs there. It ran once on
  production without error, for the ZZ arrival. The bed has no two stages both due, no stage at 100%, no sub, no
  primary, no job shut by its papers, no photo yes replaced by a yes we saw, and no title with *and 1 more* or two
  names. One transaction cannot show the lock holding two callers apart: #9167's check shows the second is refused
  once the first is in.
- **`movedSheetHtml`** has no test of its own. A day that moved earlier (*-5 days*) and a name that needs escaping
  are read only by eye.
- **The mounts.** No test holds that Job Mode's details draw the card, or that the Development page hands the look
  the site's name.

### The live look

- **The office's Schedule look, on production**, signed in as the dev, on the ZZ test site, at 1280 and 375 px in
  the dark theme. The banner, the five cards, the line of time with its bar, both diamonds, the day we decide, today
  and *moved 2 days*, and no sideways scroll at either width. Nothing was pressed but **Show it on a line of time**,
  which writes nothing.
- **The crew's card was not seen on production with a question on it.** The ZZ stage has been answered, and a new
  question needs rows on production that only a dev can take back. It was drawn from the real component on a
  scratch page with a made-up list, at 320 and 390 px, light and dark: the question, a No pressed, both answers
  kept, and a refusal. Every press is 44 px tall or more and nothing runs past the edge.
- **No ZZ row was made**, so none was left to delete.

### Not checked

The light theme on production. The printed sheet as a page. A No's line in the live Dispatch inbox, since production
holds none. The office's look as a sample assistant, a superintendent or a crew member through **View as**. The
whole unit suite and the typecheck ran in CI for each fix and not on the Mac, which was under heavy load.

One thing seen in passing and not this card's: `team-scores` runs on production with `verify_jwt` off while
`config.toml` has it on, so a plain redeploy would change its gate.
