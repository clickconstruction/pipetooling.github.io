# PipeTooling app directory (for digital twins)

---
file: docs/twins/APP_DIRECTORY.md
type: Twin reference / Directory
purpose: Route-level map of the app for role-impersonating agents — where everything lives, who sees it, and a task→URL index. Shared by every docs/twins/<role>.md brief.
audience: Digital Twins, AI Agents, Developers
last_updated: 2026-08-28
authority: Routes from src/App.tsx; role gates from src/lib/layoutRouteAccess.ts + docs/ACCESS_CONTROL.md (Page Access Matrix). When this file and the app disagree, the app wins — report the drift.
---

Deep links are real: navigate by URL. Tab params are load-bearing (`/bids?tab=pricing`).
A page your role can't see redirects you away — that means "not your role", not "broken".
Help guides open at `/help?g=<slug>`; they are the *how* — this file is only the *where*.

## Go here when… (task → URL)

**Bids / estimating**
- See every open bid, who it went to, what's won/waiting → `/bids` (Bid Board)
- Chase sent bids for answers; log a call; mark won/lost → `/bids?tab=waiting-to-hear` (recent, stale-first) or `/bids?tab=call-queue` (by builder)
- Understand why bids are lost → `/bids?tab=why-we-lost`
- See bids not yet sent, by owner → `/bids?tab=working`
- Count fixtures from plans for a bid → `/bids?tab=counts` (pick the bid)
- Price a bid / set margins / see revenue-profit-margin-multiple → `/bids?tab=pricing` (New view = Workbench)
- Write and send the proposal letter; mark sent → `/bids?tab=cover-letter`
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

## Pages

### /dashboard — Dashboard
Landing page for every role: pinned pages, role-relevant cards (recent reports, my bids,
Wednesday GC-certification nudge, tasks). Start here to orient; do work elsewhere.
Roles: all.

### /bids — Bids (the estimating hub)
One page, many tabs via `?tab=`. Board tabs are lists; tool tabs are **bid-scoped** — pick
a bid (search or click a row's tool icons) and the tab works on that bid. `&bidId=<uuid>`
deep-links a specific bid into a tool tab.
Roles: dev, master, assistant, controller, estimator, primary; superintendent draft tabs
only (no Pricing / Cover Letter / Submission); no subs/helpers.

- `?tab=bid-board` — **Bid Board**: every bid by status section (Not yet won or lost / Won /
  Lost / Started). Row shows value, due, estimator, last contact; multi-GC bids show a line
  per GC (sent date · waiting/won/lost pill). Key actions: set per-GC outcome, open notes,
  update last contact, open Edit Bid (✎), jump to tool tabs (icons).
- `?tab=builder-review` — per-customer review: section counts, estimating/job hours.
- `?tab=call-queue` — **Followup, By builder**: call-mode queue grouped by builder; log
  calls, outcomes, next-followup promises.
- `?tab=why-we-lost` — loss reasons lens; call mode for un-categorized losses.
- `?tab=waiting-to-hear` — recent sent-but-unanswered bids, stale-first; one-tap chase
  actions (Left message / Still pending / Bid tab received / Won / Lost…).
- `?tab=working` — **Unsent/Working** kanban by owner: bids still being built.
- `?tab=bid-costs` — clocked estimating cost per bid. Roles: dev only.
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
- `?tab=rfi` / `?tab=change-order` / `?tab=lien-release` — bid-scoped paperwork tools.

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
Roster, clock cards, hours approval (People→Hours grid), users admin (dev).
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
Company transaction tally: payroll marks, categorization, follow-up.
Roles: all (feature access varies; payroll actions gated).

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
