# PipeTooling app directory (for digital twins)

---
file: docs/twins/APP_DIRECTORY.md
type: Twin reference / Directory
purpose: Route-level map of the app for role-impersonating agents — where everything lives, who sees it, and a task→URL index. Shared by every docs/twins/<role>.md brief.
audience: Digital Twins, AI Agents, Developers
last_updated: 2026-10-08
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
- New-builder pipeline / hiring pipeline → `/prospects`
- Small quotes to homeowners (not bids) → `/estimates`
- Contracts and document packets → `/documents`

**Everything else**
- Your day, pins, nudges → `/dashboard`
- Company task list → `/checklist`
- Calendar view → `/calendar`; map of work → `/map`
- Price/labor/assembly books (catalog data behind pricing) → `/materials`
- Your profile, theme, release notes → `/settings`
- How-do-I articles → `/help` (search) or `/help?g=<slug>`
- The public trade rule behind a count or check (hanger spacing, fill limit, drop, mount height) → `https://counttooling.com/rules/` — `https://counttooling.com/rules/rules.json` for software; derive from it and stamp `ruleId` (see the CountTooling bid guide)

## Pages

### /dashboard — Dashboard
Landing page for every role: pinned pages, role-relevant cards (recent reports, my bids,
Wednesday GC-certification nudge, tasks, and for the office team the **GC projects** Follow up line on Needs you, v2.4941). Start here to orient; do work elsewhere.
Roles: all.

### /gc — GC projects
GC mode's real build, step by step; open to the office and estimators since door 1 (v2.4832), reached
from the **Trades | GC** switch on Bids. **New here?** walks the page (v2.4838). Since door 2 the office and estimators see the **Project Board** above the
list (the Board's B3, guide `see-where-every-gc-project-stands`): the stages with a jump strip, each project's days left, its customer and
architect, and its price so far with the card behind it. Its switch opens **Trade partners** (guides `add-a-trade-partner`,
`approve-a-company-new-to-us`): each trade's companies and the projects short of quotes, **Add a company**, and the
**New to us** box to approve or decline a company, and **Follow up** (guide `follow-up-on-a-quote-from-a-trade-partner`):
every company we wait on for a quote, the ones to call first at the top, with Log a contact and **Will not do it** /
**Cannot do it**. A company's name opens its window (guide `look-up-a-trade-partner`): About, who gets our emails, its language, and **Their portal** (guide `share-a-trade-partner-its-portal`), its portal link,
made, copied, remade or turned off, and whether they opened it (a dev's only, until the trade wave). Each project's trades list their asks too, with **Ask for quotes**: the Ask window
(guide `ask-trade-partners-for-a-quote`) lists who to ask and draws each company's invitation, saves the asks and, for a dev, emails each company its invitation.
Once a trade has a quote, **Compare quotes** (guide `compare-quotes-and-carry-one`) puts its quotes side by side, takes a cost to cover what each leaves out, and carries one as the trade's number.
**Our number** on a project's card (guide `set-our-number-and-send-our-bid`) adds our costs and fee to the trades for the money team; **We sent our bid**, **We won this** and **We lost this** sit on the project's head.
**Bid tabs** on a project's card (guide `share-a-bid-tab-with-the-trades`) share each trade's quotes, low to high, with the companies that quoted once our bid is in.
For the money team (the owner, the leaders and the controller, since the Owner Billing door): **Change orders** on a won job's card (guide `change-our-contract-with-the-customer`) writes a change order to the customer, sends it and records their answer, **Bill the customer** on a won job's card (guide `bill-the-customer-on-a-gc-job`) sends this month's pay application and records the architect's certificate, and the switch's **Money** pill (guide `see-the-money-on-our-gc-jobs`) shows money across every job that is ours. Lists every GC project as the kernels read it (the plan
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
- `?tab=billing` — invoices, payments, billing flows per job.
- `?tab=job-summary` — one job's charges-vs-payments timeline chart + % complete.
- `?tab=teams-summary` — Crew P&L (hours-weighted billing credit per crew).
- `?tab=combined-labor` — team labor hours/costs across jobs.
- `?tab=sub_sheet_ledger` — subcontractor sheets/payments.
- `?tab=parts` — parts costs against jobs.
- `?tab=inspections`, `?tab=billed` — inspection tracking; billed-jobs list.

### /schedule-dispatch — Dispatch
Week grid scheduling crews/subs onto jobs (and bid-anchored blocks). Drag to assign.
Roles: dev, master, assistant, controller, superintendent (limited).

### /people — People
Roster with Contact / Account / Pay lenses (`?tab=users&lens=`), + Hire, the Person desk (`?tab=person&id=`), who is spending what on the company cards (`?tab=spending`, office roles; help: `see-who-is-spending-what-on-the-company-cards`), clock cards, hours approval (People→Hours grid).
Roles: dev, master, assistant (no wages), controller (wages too), estimator (limited).

### /customers — Customers · /customers/:id — Customer Hub
All customers/builders; the Hub is one customer's money strip, jobs, bids, contacts.
Roles: dev, master, assistant, controller; estimator limited. No subs/primary/super.

### /prospects — Prospects
Customer-prospect calling pipeline (+ Team hiring tab, per-user gated).
Roles: staff; estimator only with `estimator_prospects_access`.

### /estimates — Estimates
Homeowner-style quotes (separate from bids): line items, send for acceptance, → job.
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

### /map — Map
Geocoded work map. Roles: dev, master, assistant, controller, estimator.

### /calendar — Calendar · /checklist — Checklist · /settings — Settings · /help — Help
All roles. Settings holds profile, theme, release notes; dev/master see admin sections.

### Header (any page)
Global search (jobs/bids/customers by name or J#/B#/C#), Inbox, Task dispatch/add,
gear menu (theme, sign out). The 🤖 DIGITAL TWIN banner lives here when you are a twin.
On a phone with Dispatch Mode on, an assistant / controller gets the **phone dock** instead of
the hamburger and gear: a bottom bar of Jobs (`/jobs?tab=stages`) · Schedule
(`/dispatch-mode/schedule`) · PO (`/dispatch-mode/po`) · Inbox (`/dispatch-mode/inbox`) · More (a sheet
with *The dock* row — tap a slot there to swap it — every page, the mode switches and Help /
Settings / Sign out); holding a slot on the bar swaps it too.

### /t/:token — A trade partner's portal (public)
One no-password link per trade partner company (v2.4920, `GcTradePortal.tsx`, read through `gc-trade-portal`): the
company's asks, quotes, plans and questions on each project. From it the company names its people, promises a quote
day, quotes, answers lines, passes, asks about the plans and picks who gets our emails (v2.4935, through
`submit-gc-trade-portal`). `/t/sample` is the sample. A link is made by a dev in the company window's **Their portal**
until the trade wave, and the first email to the company makes one (v2.4936).
Roles: public.

### /pay/:id — Pay a bill (public)
What a scanned pay code opens (v2.3754): the bill's number and job, what is still owed, then
a forward to Stripe's secure payment page (a Pay now button if the forward is blocked). A paid
bill says *Paid* and the day; a voided bill or an unknown id gives the office number. No
sign-in: the id is the capability. The office never lands here on purpose — it is the
customer's page; the codes that carry it are drawn on the lien notice's pay page and in View
bill (punch list #35).
Roles: public.

## Nav skeletons by role (what you actually see)

- **estimator**: Dashboard · Customers · Estimates · Documents · Bids · Materials · Map ·
  Calendar · People · Checklist · Tally · Settings · Help (+ Prospects if granted).
  Everything else redirects to `/bids`.
- **assistant / controller**: nearly everything above plus Jobs, Dispatch, Projects,
  Banking, AR, Quickfill, Prospects; controller additionally Moneyfill + payroll surfaces.
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
