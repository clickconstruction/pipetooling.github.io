# PipeTooling app directory (for digital twins)

---
file: docs/twins/APP_DIRECTORY.md
type: Twin reference / Directory
purpose: Route-level map of the app for role-impersonating agents — where everything lives, who sees it, and a task→URL index. Shared by every docs/twins/<role>.md brief.
audience: Digital Twins, AI Agents, Developers
last_updated: 2026-10-17
authority: Routes from src/App.tsx; role gates from src/lib/layoutRouteAccess.ts + docs/ACCESS_CONTROL.md (Page Access Matrix). When this file and the app disagree, the app wins — report the drift.
---

Deep links are real: navigate by URL. Tab params are load-bearing (`/bids?tab=pricing`).
A page your role can't see redirects you away — that means "not your role", not "broken".
Help guides open at `/help?g=<slug>`; they are the *how* — this file is only the *where*.

## Go here when… (task → URL)

**Bids / estimating**
- See every open bid, who it went to, what's won/waiting → `/bids` (Bid Board)
- Chase sent bids for answers; log a call; mark won/lost → `/bids?tab=waiting-to-hear` (recent sends, newest-first by builder) or `/bids?tab=call-queue` (by builder)
- Understand why bids are lost → `/bids?tab=why-we-lost`
- See bids not yet sent, by owner → `/bids?tab=working`
- Count fixtures from plans for a bid → `/bids?tab=counts` (pick the bid)
- Price a bid / set margins / see revenue-profit-margin-multiple → `/bids?tab=pricing` (New view = Workbench)
- Write and send the proposal letter; mark sent → `/bids?tab=cover-letter`
- Ask the GC a plans question (RFI) / see what's unanswered → `/bids?tab=rfi`
- One bid's full record (sends, answers, notes, links) → `/bids?tab=submission-followup` (pick the bid)
- Estimator workload/performance pivot → `/bids?tab=estimators`
- Create a bid → `/bids` → New Bid button

**Jobs / operations**
- Job pipeline by stage (Waiting → Working → RTB → Billed → Collections) → `/jobs?tab=stages`
- Open jobs with no crew on site in 21+ days, reviewed one card at a time (the Follow-ups deck's Idle lens) → `/jobs?tab=stages&followups=idle`
- Bill a customer for a finished job → `/jobs?tab=billing` (or the Bill Customer button on an RTB job in Stages)
- Field/tech job reports → `/jobs?tab=reports`
- Crew profitability / labor rollups → `/jobs?tab=teams-summary`, `/jobs?tab=combined-labor`
- Job cost detail (parts, subs) → `/jobs?tab=parts`, `/jobs?tab=sub_sheet_ledger`
- One job's money story (charges vs payments timeline) → `/jobs?tab=job-summary`
- Who owes us money → `/accounts-receivable`
- Schedule crews to jobs by week → `/schedule-dispatch`

**People / hours / money**
- Who worked, approve hours, clock cards → `/people`
- Company transactions, payroll marks, spending → `/tally`
- Bank ledger, card sorting, accounting review → `/banking`
- Customers and builders (GCs), their profile and history → `/customers`, `/customers/:id`
- Every message with every person we work with on GC projects, one thread each → `/gc?view=messages` (guide `find-every-message-with-a-person-in-one-place`)
- Everyone waiting on us for an answer and what we owe them, for every kind of person, one pill per kind → `/messages` (`?kind=customer`, `trade`, `arch`, `lead`, `sub`, or `more` for supply houses and candidates) (guide `answer-everyone-waiting-on-us-from-one-page`)
- Sort what came in before anyone answers it: who a new number is, which job a line is about, who has the conversation → `/messages`, the **New** list on top (guide `sort-new-messages`)
- A training course your role must take, read at your own pace: the lessons, Check yourself, the final check → `/training/osha-30-refresher` (from the **Training** card under My Time on the Dashboard, under My Schedule in Job Mode; guide `take-a-training-course`)
- A course open to everyone, with a drawing in every lesson of how water comes into a house and leaves it → `/training/intro-to-plumbing` (the **Available** row of the same Training card; guide `take-a-training-course`)
- A course open to everyone on how a house's electrical system works, what is live and where plumbing work touches it, understanding and not doing → `/training/intro-electrical` (the **Available** row of the same Training card; guide `take-a-training-course`)
- New-builder pipeline / hiring pipeline → `/prospects`
- Owners, developers and architects with a job we could build as the GC → `/prospects?kind=gc-leads` (guide `find-jobs-to-build-as-the-gc`)
- Trade companies to call for the bench, by what the bench needs → `/prospects?kind=subs` (guide `find-subs-for-the-bench`)
- Small quotes to homeowners (not bids) → `/estimates`
- Contracts and document packets → `/documents`

**Everything else**
- Your day, pins, nudges → `/dashboard`
- Company task list → `/checklist`
- Calendar view → `/calendar`; map of work → `/map`
- Price/labor/assembly books (catalog data behind pricing) → `/materials`
- Your profile, theme, release notes → `/settings`
- Change a clause of a contract our trade partners sign, or approve one waiting on you → `/settings?tab=settings-clauses` (Contracts and clauses: the office edits, a dev or the controller approves; guide `change-a-contract-clause`)
- See or set who gets a new text, call or email first → `/settings?tab=settings-phone-texts` (Phone and texts: the office reads the rule, the owner or a dev sets the seats; guide `choose-who-gets-a-new-message`), and which company phone seat is whose (Company phone seats, the owner or a dev; guide `match-each-company-phone-seat-to-a-person`)
- Type the two inboxes' addresses and numbers, the team inbox and the bids inbox → `/settings?tab=settings-phone-texts` (Inboxes, under Company phone seats: the office reads, the owner or a dev saves; the app uses them once the inboxes are switched on; guide `set-up-the-two-inboxes`)
- Turn on the reply push, so a customer's, a lead's or a sub's reply reaches whoever has it as a phone alert within a minute → `/settings?tab=settings-phone-texts` (Reply push, the owner or a dev, off as it ships; guide `turn-on-the-reply-push`)
- Change the steps a customer, trade partner, architect, residential customer or sub goes through → `/settings?tab=settings-flows` (Flows: the office edits; guide `set-up-the-steps-a-person-goes-through`)
- Turn a training course on, say which roles must take it or open it to everyone, how long a pass is good for, see where everyone stands, preview the course and clear a retake day → `/settings?tab=settings-training` (Training: a dev; guide `take-a-training-course`)
- Where the company stands this week, the weakest link, the Monday sheet → `/bridge` (dev only)
- How-do-I articles → `/help` (search) or `/help?g=<slug>`
- The public trade rule behind a count or check (hanger spacing, fill limit, drop, mount height) → `https://counttooling.com/rules/` — `https://counttooling.com/rules/rules.json` for software; derive from it and stamp `ruleId` (see the CountTooling bid guide)

## Pages

### /dashboard — Dashboard
Landing page for every role: pinned pages, role-relevant cards (recent reports, my bids,
Wednesday GC-certification nudge, tasks, and for the office team the **GC projects** Follow up line on Needs you, v2.4941; for the leader the *Sign N lien notices before the run* line, v2.5087, landing on the Lien desk's Ready pile; for a dev or the controller the **Contracts** line, v2.5285, the clause changes waiting on their approval, whose **Review** opens the paper on Settings → Contracts and clauses; for the office team the **Customers** line, opening `/messages?kind=customer`, v2.5451; and on Job Mode's card **Message the customer** for primary and helpers, v2.5449, on since v2.5505, guide `message-a-customer-from-job-mode`; since v2.5573 the big **On my way** / **I'm here** press that clocks the drive and texts the customer, with the tech's bio the first time, v2.5590, guide `job-mode-clocking`; for the office team the **Today's sends** line, the texts the app prepared for a person to press, v2.5595, guide `work-todays-sends`). Start here to orient; do work elsewhere.
Roles: all.

### /gc — GC projects
GC mode's real build, step by step; open to the office and estimators since door 1 (v2.4832), reached
from the **Trades | GC** switch on Bids. **New here?** walks the page (v2.4838). Since door 2 the office and estimators see the **Project Board** above the
list (the Board's B3, guide `see-where-every-gc-project-stands`): the stages with a jump strip, each project's days left, its customer and
architect, and its price so far with the card behind it. Its switch opens **Trade partners** (guides `add-a-trade-partner`,
`approve-a-company-new-to-us`): each trade's companies and the projects short of quotes, **Add a company**, and the
**New to us** box to approve or decline a company, **Call script** at the right of the trade strip (what to say when phoning a company new to us, the caller's name filled in; `/gc?view=partners&script=1` opens the page with it showing), with **By step** beside that list (`/gc?view=partners&by=step`, guide `see-where-every-company-stands-and-who-is-late`): every trade partner on the step of its flow: a line that says who needs a hand today, then one band per part of the flow in the Project Board's colours (v2.5555), each counting its companies with a dot per company, every step a row inside with each company's day and the step's own press; **By company** (`by=company`), one row per company with the Once lane as a track, the step on now, a line per job and the Portal column; **By trade** (`by=trade`), one row per trade with its companies; **Customers** (`/gc?view=customers`, opening since v2.5557 on a **List**, guide `see-every-customer-and-where-each-job-stands`: a card per customer on a GC project with the person to call, the master agreement, the portal, and a row per job with its stage, the step it is on and the next press; the same guide), every customer **By step** and **By company**, its Portal column the last time the customer opened their page; and **Follow up**: on top the people waiting on us (guide `see-who-is-waiting-on-us-and-what-we-owe-them`):
**New** (what came in and still needs sorting), **Needs you**, **Needs a reply** and **We owe them**, each row with who has it, and **Ask the architect** on a plans question;
then **We are waiting on them** (guide `follow-up-on-a-quote-from-a-trade-partner`): every company we wait on for a quote,
the ones to call first at the top, with Log a contact and **Will not do it** / **Cannot do it**. **Messages** (guide `find-every-message-with-a-person-in-one-place`; `/gc?view=messages` opens it) lists every
person the office works with, newest conversation first, and opens a person's thread as a window over any view
(`?thread=<contact id>&at=<message id>`): their jobs with the star, each line's job, one message in full with an email's
**Attachments** and **Open**, the offer to file a trade partner's certificate or W-9 that came by email, and **Who is this?** for a
number nobody named. At its right side sits the person's flow, a rail that opens to the panel (guide `see-where-a-person-stands-and-what-comes-next`). A customer's own message has **Start a change order** for the office (guide `start-a-change-order-from-a-customers-message`), and a line that became one shows *became CO 2*; on a Pipeline job's line the press is **Line on the estimate** instead, and the line shows *a line on estimate 1044* (guide `put-a-customers-message-on-their-estimate`). A company's name opens its window (guide `look-up-a-trade-partner`): About, who gets our emails, its language, **Flow** (guide `see-where-a-person-stands-and-what-comes-next`: where they stand on their flow, each step's card with its notes, skips and holds, and their page), and **Their portal** (guide `share-a-trade-partner-its-portal`), its portal link,
made, copied, remade or turned off, and whether they opened it (a dev's only, until the trade wave). Each project's trades list their asks too, with **Ask for quotes**: the Ask window
(guide `ask-trade-partners-for-a-quote`) lists who to ask and draws each company's invitation, saves the asks and, for a dev, emails each company its invitation.
Once a trade has a quote, **Compare quotes** (guide `compare-quotes-and-carry-one`) puts its quotes side by side, takes a cost to cover what each leaves out, and carries one as the trade's number.
**Our number** on a project's card (guide `set-our-number-and-send-our-bid`) adds our costs and fee to the trades for the money team; **We sent our bid**, **We won this** and **We lost this** sit on the project's head.
**Papers** on a project's card (`?papers=<project>`, guide `see-every-paper-on-a-job-and-what-is-missing`) opens Papers on this job: a row per company on the job and a column per paper of its flow, a dot per paper, the counts as pills that filter, **Before bid day** on a job we are bidding, and **List** behind a tab.
**Bid tabs** on a project's card (guide `share-a-bid-tab-with-the-trades`) share each trade's quotes, low to high, with the companies that quoted once our bid is in.
For a dev, **Get started** on a won job's card (guide `get-a-gc-job-ready-to-start`) lists what must be in before work starts, then starts the job and tells each trade awarded on it.
For a dev, a customer's name on the board opens **the customer's window** (guide `send-our-contract-to-a-gc-customer`): their jobs with us, and our contract on each won job, sent to sign with its file and its price. Its **Flow** tab (guide `see-where-a-person-stands-and-what-comes-next`) shows where they stand on their flow, as the company window's does.
For the money team (the owner, the leaders and the controller, since the Owner Billing door): **Change orders** on a won job's card (guide `change-our-contract-with-the-customer`) writes a change order to the customer, prices a draft the office started from a customer's message (**Price it**, with a line back to the message), sends it, by email when its tick is on, and records their answer, and, for a dev while the trade wave is closed, lists the trades' asks for a change to make a change order of or turn down (guide `answer-a-trade-partners-change-request`), **Bill the customer** on a won job's card (guide `bill-the-customer-on-a-gc-job`) sends this month's pay application, by email to the customer and the architect when its tick is on, and records the architect's certificate, emailing the customer the certified bill when that tick is on, then what the customer paid and when they said they will pay (guide `record-what-a-gc-customer-paid`) and a reminder to pay a late bill (guide `remind-a-customer-to-pay-a-gc-bill`), then the customer's acceptance and our final pay application (guide `close-out-a-gc-job-with-the-customer`), and the switch's **Money** pill (guide `see-the-money-on-our-gc-jobs`) shows money across every job that is ours, with the Monday money email below it (guide `get-our-gc-money-by-email-each-week`); `/gc?view=money` opens it. Its Bill day card's **From the trades** (guide `get-the-trades-draws-in-and-checked-before-bill-day`) reads each trade's draw against the bill day on one job being built, with the seven gates and each ask as its own text; `/gc?view=money&billday=<projectId>` opens it, as do the **Bill day · N of 7** pill and line on a building job's card, and Settings → Jobs & billing sets the trades' cut-off. A dev's daily log on a building job (`?log=<projectId>`) shows **Claims to check** on the checking days (guide `check-the-trades-claims-on-site`). Lists every GC project as the kernels read it (the plan
sets, the sheets, the trades with their scope lines and the gaps) and holds **New project**:
the four-step window (project → plans → trades → each scope) that writes through
`gc_create_project`. **Open the scope book** (`?book=1`)
is every scope line we keep by trade: edit, add, fold duplicates, save a project's scope as a set.
**A new set of plans came in** (`?set=<project id>`) puts an addendum, a bulletin or a whole new set on the
project through `gc_issue_plan_set`. **The plans** (`?plans=<project id>`) is the plans window: the sheets and
the manual as they stood at each set, what each set changed and took out, and the scope that reads from a sheet.
**Questions about the plans** (`?questions=<project id>`) records a company's question, emails it to the architect
(`gc-plan-question-email`) and records the answer; the next set carries it. For a dev, a new set emails the companies asked to quote (**Who hears it**, v2.4940) and an answer reaches the companies on the trade (v2.4938), both through `gc-trade-email`. `?view=partners` and `?view=followUp` open those views (v2.4941).
Guides: `/help?g=start-a-gc-project`, `/help?g=use-the-scope-book`, `/help?g=issue-a-new-set-of-plans`,
`/help?g=read-the-plans-of-a-gc-project`, `/help?g=ask-the-architect-about-the-plans`.
Roles: dev, master_technician, assistant, controller, estimator.

### /messages — Messages
Follow up for every kind of person, from **Messages** in the header (its count is everyone waiting on us): **New** first
(what came in and still needs sorting: **Who is this?**, **Which job?**, **Who has it?**, each row opening the thread
with the sort card at its top; guide `/help?g=sort-new-messages`), then **Needs you**, **Needs a reply** and **We owe them** (with the call tasks since v2.5596, guide `call-a-customer-from-a-task`),
with pills for Customers, Trade partners, Architects, Leads and Subs (`?kind=`), and **Supply houses and candidates**,
which never count on Follow up and show as a people list. A row opens the person's thread over the page
(`?thread=<contactId>&at=<messageId>`), the thread window described under `/gc`. Other doors to a customer's thread: the speech bubble beside a customer's name on `/customers`, the customer's page, `/jobs`, the job window and `/estimates` (`/messages?thread=<contact>`), and the Dashboard's **Customers** line (`?kind=customer`). Guide: `/help?g=answer-everyone-waiting-on-us-from-one-page`.
Roles: dev, master_technician, assistant, controller, estimator.


### /training/osha-30-refresher — Training: a course

A course read at the person's own pace (punch list #111, v2.5566): the rail of parts and lessons on the left with a tick on each one done (a **Lessons · N of 30** button on a phone, and a header chip *N of 30 lessons* with a green *Final check passed* after the pass), the lesson on the right (Why it matters, Must know, Traps, with a line drawing under a sentence that needs one, Numbers to remember, Check yourself), and the Final check at the foot of the rail once every lesson is done. Pick one answer per question; a wrong pick says why and offers **Try again**; the lesson records itself when all four are right; **Next lesson ›** goes on. `?lesson=<key>` opens a lesson, `?final=1` the final check. Anyone signed in may read a course that is on; a dev reads one that is off as a preview. The first course is the OSHA 30 refresher, thirty lessons and a final check of twenty, each asked once, fourteen right passes; a pass says the day it is due again and offers **‹ Back to the Dashboard**. Guide `take-a-training-course`.

### /training/intro-to-plumbing — Training: Intro to plumbing

The second course (punch list #119, v2.5610), the same page: how water comes into a house under pressure and leaves by gravity, a drawing in every lesson in one language (a pipe is two lines, water a tint, flow an arrow, the trap's seal a hatch). Required of helpers and **offered** to every other role, who find it under the Training card's **Available** line with no colour and no clock. Off until a dev turns it on; all four parts are built (v2.5610 to v2.5613): Start here, Water in, Water out, the two systems under conditions, Reading the job, thirty lessons and a final check of twenty. Guide `take-a-training-course`.

### /training/intro-electrical — Training: Intro to electrical

The third course (punch list #120, v2.5614), the same page: how a house's electrical system works, for the plumbing crew that works beside it, understanding and not doing. A conductor is one line in the ink for the hot, white for the neutral and amber for the ground, current an arrow along it, and the house red for one thing only, current where it should not be. Every lesson ends at what it does, how you know it is live, what you do not touch and who you call, and the content test refuses a Must know or Traps item that begins with a doing verb without naming who does it. Offered to every role and required of nobody, under the Training card's **Available** line; off until the owner's reader signs it off and a dev turns it on. Start here and Power in are built, The devices, The two together and On the job follow. Guide `take-a-training-course`.

### /bids — Bids (the estimating hub)
One page, many tabs via `?tab=`. Board tabs are lists; tool tabs are **bid-scoped** — pick
a bid (search or click a row's tool icons) and the tab works on that bid. `&bidId=<uuid>`
deep-links a specific bid into a tool tab.
Roles: dev, master, assistant, controller, estimator, primary; superintendent draft tabs
only (no Pricing / Cover Letter / Submission); no subs/helpers.

- `?tab=bid-board` — **Bid Board**: every HUMAN bid by status section (Not yet won or lost /
  Won / Lost / Started). Row shows value, due, estimator, last contact; multi-GC bids show a
  line per GC (sent date · waiting/won/lost pill). Key actions: set per-GC outcome, open
  notes, update last contact, open Edit Bid (✎), jump to tool tabs (icons).
- `?tab=robot-board` — **🤖 Robot Board** (v2.2500; a mirror since v2.3222): the HUMAN
  bids that have a robot run, in the human board's sections, with a robot column — status
  before the human sends (`queued` / `working` / `sealed`, never a number), the robot's
  number, ours and the delta after. Since v2.3225 every live human bid lists — `needs`
  (no plans link / plans you can't open / your open question, with the person's door),
  `queued`, `off` — plus **Add bid value** on a sent bid with no value, and **where the
  delta lives** under a scored row. YOUR ZZ bids list on no board: a row's **Robot bid b###**
  opens your shell on its Counts tab; `?tab=counts&bidId=<your shell>` works directly. The
  human board and its counts still exclude your rows. The lenses under the one **🤖 Robots**
  tab between Bid Board and Followup (v2.2527; named v2.2905) are `robot-board`, `audits`,
  `robot-scoreboard` (dev) and `robot-console` (dev, v2.3224); `robot-queue` (dev) keeps its
  URL and opens from the Console; `robot-shadows` redirects to the mirror.
- **The envelope** (v2.3222; before send since v2.3234): the moment the human records a
  **best effort** on the Cover Letter (a table you cannot read — `bid_best_efforts`; your
  lock stays blind either way) or, failing that, saves the bid with value + sent date, its
  scored shadow opens for the estimator as a modal — your number, theirs, the
  delta, the six biggest row differences with one-tap verdicts, your open questions with
  their taps. Verdicts land as `bid_audit_notes` and answers as `twin_questions.answer`,
  exactly as from the Audits lens; read them the same way.
- `?tab=audits` — **🤖 Audits** (v2.2516–v2.2553; the queue v2.4230–v2.4261, punch list #63):
  one sentence sizes today (questions and their minutes · workable audits · sealed audits)
  and one button runs the robots' open questions one at a time (the run-through: shared
  first, then today's, then the older asks; numbered taps with the robot's pick first);
  under it a queue — Now · Up next by what a verdict unblocks · Opens when you send (the
  sealed 🔒 shadows, with the due date of the bid each waits on) · Digesting · Digested —
  with rows named for the job, the delta and a why line; the open card is the top of the
  queue (two panes at ≥1151 px) and leads with the six biggest robot-vs-ours differences,
  one-tap verdicts (`[verdict:teach|record|ok]`, and `[verdict:alias]` for one item under
  two names), the bid's own questions, Finish audit → next. Twins: open audits, seed
  anchored questions, post receipts, close as `digested`; setting `done` is human-only
  (RLS). Tab label carries the pending count; the group's six-number strip heads every lens.
- `?tab=robot-shadows` — retired v2.3222 (redirects to `robot-board`); the Shadows story
  (v2.2544) is the mirror row now.
- `?tab=robot-queue` — **🤖 Queue** (v2.2542, dev only; off the lens bar since v2.3222 —
  door on the Console lens): every robot-able live bid,
  front-of-the-line requests (stamped from a bid's robot status sheet on the Bid Board,
  oldest ask first; nobody asks for a robot since v2.3202 — shadowing is the default)
  above ready, each with a copyable kickoff prompt; plus **Backtest candidates** (v2.2594) — graded A/B decided references grouped
  by confidence axis with demand chips, starvation cards, `assign axis ▾` on unclassified
  rows, and blind backtest prompts.
- `?tab=robot-scoreboard` — **🤖 Scoreboard** (v2.2560; every audit role since v2.3221,
  plain words): the rule stated once with the last five scored runs; a **Your part** strip
  (the viewer's sealed / queued bids, live bids the robots can't see, audits + questions
  waiting) with doors; job types ranked closest to ready (`robotScoreboard.ts` — axis slugs
  → plain names, deltas as *44% high*, the newest digest receipt as the lesson line); then
  **On live bids** (every shadow run, in flight first, a row expands into the v2.2544
  sealed-envelope stepper) and **Practice on past bids** (backtests, voided runs kept and marked). Devs get a *Show robot notes* toggle
  for the operator's raw axis notes. Gate math unchanged (`confidenceBoard.ts`).
- `?tab=robot-console` — **🤖 Console** (v2.3224, dev only): the operator's desk. **Owner
  memo** (v2.3232): a question you wrote before the one-decision rule — several decisions
  in one, no taps — waits here, not on Standing rulings; the owner splits it into one-tap
  questions posted as yours, or dismisses it (nothing re-asks on its own). **Run
  the robots** — *Set up on this Mac* (one Terminal command that configures the Claude
  app's `twin-mcp` connector) and *Copy Code kickoff* (`kickoffs/code-operator.md`,
  connector filled in) for a batch in a Claude Code session, which reads the plans itself;
  *Copy chat kickoff* (`kickoffs/desktop-operator.md`) for a plain chat, where a person
  attaches them; *Copy handoff prompt* (`kickoffs/shadow-operator.md`) for the hourly
  Claude Code routine — then **Bids
  to run** (requested / ready counts, door to the Queue), the fleet at a glance (door to
  Settings → Digital twins for keys, seats, rungs, the calibration standard), **Operator
  questions** (the `operator` lane of `twin_questions` — answer, promote to RFI, send to
  estimator, dismiss; the estimator lane stays on Audits → Standing rulings), and **Recent
  runs** (`twin_runs`, newest first). Twins never see it.
- `?tab=builder-review` — per-customer review: section counts, estimating/job hours.
- `?tab=call-queue` — **Followup, By builder**: call-mode queue grouped by builder; log
  calls, outcomes, next-followup promises.
- `?tab=why-we-lost` — loss reasons lens; call mode for un-categorized losses.
- `?tab=waiting-to-hear` — recent sent-but-unanswered bids, newest-first grouped by
  builder (header rollup: "N never called, oldest Dd"); one-tap chase
  actions (Left message / Still pending / Bid tab received / Won / Lost…).
- `?tab=working` — **Unsent/Working** kanban by owner: bids still being built.
- `?tab=bid-costs` — clocked estimating cost per bid. Roles: dev only.
- `?tab=day-book` — the Day book (the same view as People → Day book: what each estimator and office person got done per day, the Month rhythm grid, the estimating strip for a picked person), mounted on Bids as the estimating side's door (v2.3735). Roles: dev, controller — the Day book's own gate. Help: `see-what-the-office-got-done`.
- `?tab=estimators` — cross-bid pivot of estimator clock time and output.
- `?tab=counts` — count fixtures per plan for the selected bid (per GC packet).
- `?tab=takeoffs` — takeoff book quantities for the selected bid.
- `?tab=labor` — labor cost estimate for the selected bid.
- `?tab=pricing` — **Pricing**; New view = the Workbench: rows priced from the price book,
  REVENUE·PROFIT·MARGIN·MULTIPLE header, margin brush, Solve, price options per GC.
- `?tab=cover-letter` — the letter studio: pick packets/alternates per GC, preview, copy to
  Google Docs, Print, **Mark sent** (stamps send date + value).
- `?tab=submission-followup` — the selected bid's full submission record: sends by GC,
  notes/contacts ledger, links, RFIs.
- `?tab=rfi` — the selected bid's **RFI queue** (draft → approve with a per-GC pick →
  mark sent → record answer; "Paste RFI flags" imports CountTooling `RFI:` notes) above
  the RFI letter composer. Twins: DRAFT ONLY — approving/sending is human.
- `?tab=change-order` / `?tab=lien-release` — bid-scoped paperwork tools.

### /jobs — Jobs (the operations hub)
Tabs via `?tab=`. Roles: dev, master, assistant, controller; primary = Reports+Billing on
Account-Man jobs; superintendent = Reports + Sub Sheet Ledger; no subs/helpers/estimator.
- `?tab=stages` — **Stages**: pipeline sections Waiting / Working / Ready to Bill / Billed
  Awaiting Payment / Collections. Job rows: activity thread, % complete, dispatch, Edit Job,
  Bill Customer on RTB. New Job button (imports from a bid — multi-GC bids ask which GC won).
- `?tab=reports` — field job reports (create/review); dispatch items (e.g. site-not-ready).
- The job window, for the office team: **Note · Text · Email** over its note box, a text or an email to the customer tied to the job (guide `text-a-customer-from-the-job`); a customer's speech bubble opens their thread on `/messages`.
- `?tab=billing` — invoices, payments, billing flows per job.
- `?tab=job-summary` — one job's charges-vs-payments timeline chart + % complete.
- `?tab=teams-summary` — Crew P&L (hours-weighted billing credit per crew).
- `?tab=combined-labor` — team labor hours/costs across jobs.
- `?tab=sub_sheet_ledger` — subcontractor sheets/payments.
- `?tab=parts` — parts costs against jobs.
- `?tab=inspections`, `?tab=billed` — inspection tracking; billed-jobs list.

### /schedule-dispatch — Dispatch
Week grid scheduling crews/subs onto jobs (and bid-anchored blocks). Drag to assign. A job's first visit saved asks before it texts the customer, and a moved first visit's Rescheduled text waits on Today's sends (guide `schedule-a-job-and-tell-the-customer`).
Roles: dev, master, assistant, controller, superintendent (limited).

### /people — People
Roster with Contact / Account / Pay lenses (`?tab=users&lens=`), + Hire, the Person desk (`?tab=person&id=`), who is spending what on the company cards (`?tab=spending`, office roles; help: `see-who-is-spending-what-on-the-company-cards`), clock cards, hours approval (People→Hours grid).
Roles: dev, master, assistant (no wages), controller (wages too), estimator (limited).

### /customers — Customers · /customers/:id — Customer Hub
All customers/builders; the Hub is one customer's money strip, jobs, bids, contacts.
Roles: dev, master, assistant, controller; estimator limited. No subs/primary/super.

### /prospects — Prospects
The cold-call deck in three lanes: Customers, Jobs to GC (`?kind=gc-leads`, a lead's jobs and bid days, Asked us ✓ → New project) and Subs (`?kind=subs`, what the bench needs, Add to the bench ✓ → Trade partners); plus the Hiring tab, per-user gated.
Roles: staff; estimator only with `estimator_prospects_access`.

### /estimates — Estimates
Homeowner-style quotes (separate from bids): line items, send for acceptance (since v2.5594 through **Tell the customer**: the email and the text with the link, guide `send-an-estimate-and-turn-it-into-a-job`), → job.
Roles: dev, master, assistant, controller, estimator, primary; super limited.

### /tally — Tally
Company card charges sorted to jobs: the office's Team queue (one card per person per day,
the likely job first), each holder's own card, payroll marks, follow-up.
Roles: all (Team for dev, master, assistant/controller; payroll actions gated).

### /banking — Banking
Mercury bank ledger: user/drag sort, accounting labels, card + category review,
reconciliation. Roles: dev (full incl. Stripe), master, assistant/controller (staff tabs).

### /accounts-receivable — AR
Outstanding billed jobs by customer; collections flags. Roles: dev, master, assistant, controller.

### /materials — Materials
Price book / labor book / assembly book catalogs feeding Pricing.
Roles: dev, master, assistant, controller, estimator, primary; super: price+assembly books.

### /documents — Documents
Contract library (Documents/Packets), quick-send. Roles: staff + estimator, primary, super.

### /estimates·/projects·/workflows — Projects & workflows
Project containers linking jobs/bids; workflow boards. Roles: staff; super assigned-only.

### /quickfill · /moneyfill — Data-repair queues
Quickfill: guided fix-missing-data recipes (staff). Moneyfill: dev + controller only.

### /bridge — The Bridge
The owner's one page for where the company stands: contribution per week, the five stages with the weakest link lit, the week's call, the cash forecast from the bank, the people tables; `?view=monday` is the Monday sheet. Roles: dev only (every other role is redirected to `/dashboard`).

### /map — Map
Geocoded work map. Roles: dev, master, assistant, controller, estimator.

### /calendar — Calendar · /checklist — Checklist · /settings — Settings · /help — Help
All roles. Settings holds profile, theme, release notes; dev/master see admin sections.

### Header (any page)
Global search (jobs/bids/customers by name or J#/B#/C#), Inbox, **Messages** with its count for the office team (`/messages`), Task dispatch/add,
gear menu (theme, sign out). The 🤖 DIGITAL TWIN banner lives here when you are a twin.
On a phone with Dispatch Mode on, an assistant / controller gets the **phone dock** instead of
the hamburger and gear: a bottom bar of Jobs (`/jobs?tab=stages`) · Schedule
(`/dispatch-mode/schedule`) · PO (`/dispatch-mode/po`) · Inbox (`/dispatch-mode/inbox`) · More (a sheet
with *The dock* row — tap a slot there to swap it — every page, the mode switches and Help /
Settings / Sign out); holding a slot on the bar swaps it too.

### /portal · /p/:slug — A customer's portal (public)
One no-password link per customer (`CustomerPortal.tsx`, read through `customer-portal`): their open bills and the
statement, payments, waivers, their agreements and test reports. On a GC job we build it is the customer's page
(v2.5303, shape B): Home with *Your move*, *This week* and *Your people*, then Money, Schedule and Papers, where they
sign our contract, answer a change order and accept the work. `/portal?t=sample-owner` is the GC owner's sample.
Roles: public.

### /t/:token — A trade partner's portal (public)
One no-password link per trade partner company (v2.4920, `GcTradePortal.tsx`, read through `gc-trade-portal`): the
company's asks, quotes, plans and questions on each project. Its home opens on **Where you are with Click
Construction** (v2.5315): its steps with us from its trade flow, Getting set up then each job it is asked on. From it the company names its people, promises a quote
day, quotes, answers lines, passes, asks about the plans and picks who gets our emails (v2.4935, through
`submit-gc-trade-portal`). On a job of its own it also reads its statement of work, the charges to it and the
changes it asked for (v2.5044), and agrees with or disputes a charge and asks for a change (v2.5048). From its papers it sends its vetting form, signs its master agreement and W-9 (v2.5201) and sends its insurance certificate for the office to check first (v2.5225). On a job being built, its pay application's door says when the next one is due and the bill it goes on, from the trades' cut-off. `/t/sample`
is the sample. A link is made by a dev in the company window's **Their portal**
until the trade wave, and the first email to the company makes one (v2.4936).
Roles: public.

### /f/:link — A file our office sent as its own link (public)
What a file's own link opens (v2.5447, `FileLinkPage.tsx`, Messages cut 7d), with no sign-in: it asks `drive-link`'s
open door once, which counts the open, then forwards to the file. A file in the job's Plans half opens in Drive's own
viewer, and a Team only file streams through the function. A link that was cut off or has ended says **This link was
turned off.**, and an unknown or too-big link says so in plain words. A teammate signed in on the browser, or the
office's `?preview=1`, is stamped and not counted. The office makes the link when a file goes on a message.
Roles: public.

### /pay/:id — Pay a bill (public)
What a scanned pay code opens (v2.3754): the bill's number and job, what is still owed, then
a forward to Stripe's secure payment page (a Pay now button if the forward is blocked). A paid
bill says *Paid* and the day; a voided bill or an unknown id gives the office number. No
sign-in: the id is the capability. The office never lands here on purpose — it is the
customer's page; the codes that carry it are drawn on the lien notice's pay page and in View
bill (punch list #35).
Roles: public.

### /files/:source/:id — A kept file's lasting link
What a file's **Open** goes to (Messages cut 6, `FileOpen.tsx`): `/files/messages/<attachment id>` is a file that came
on an email's line. Signed in as the office team, it goes straight to the file through a link that lasts a minute; a
link the email carried goes to its own address. `/files/drive/<job key>:<Drive file id>` (v2.5467, Messages cut 7d) is a
file in a job's Drive folder: `drive-link`'s office door checks the file is in that job's folder and the page goes to
Drive's own viewer. Signed out, it asks for a sign-in and comes back. Anyone else reads
*This file is not one you can open.* No page of its own to work on.
Roles: dev, master, assistant, controller, estimator.

## Nav skeletons by role (what you actually see)

- **estimator**: Dashboard · Customers · Estimates · Documents · Bids · Materials · Map ·
  Messages · Calendar · People · Checklist · Tally · Settings · Help (+ Prospects if granted).
  Everything else redirects to `/bids`.
- **assistant / controller**: nearly everything above plus Jobs, Dispatch, Projects,
  Banking, AR, Quickfill, Prospects, Messages; controller additionally Moneyfill + payroll surfaces.
  No Templates (dev-only); no Partnerships (dev-only).
- **subcontractor / helpers**: Dashboard · Calendar · Checklist · Tally · Settings · Help
  (+ Job/Dispatch modes from the header where dispatched). Everything else → `/dashboard`.
- **primary**: Dashboard · Materials · Estimates · Documents · Jobs (Reports/Billing,
  own Account-Man jobs) · Bids · Calendar · Checklist · Tally · Settings · Help.
- **superintendent**: Dashboard · Projects · Workflow · Jobs (Reports, Sub Ledger) ·
  Dispatch · Bids (draft tabs) · Materials · Estimates · Documents · Calendar · Checklist ·
  Tally · Settings · Help.
- **dev / master_technician**: everything (dev also Templates, Partnerships, Stripe,
  admin tools).
