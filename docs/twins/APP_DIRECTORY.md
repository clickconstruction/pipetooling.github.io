# PipeTooling app directory (for digital twins)

---
file: docs/twins/APP_DIRECTORY.md
type: Twin reference / Directory
purpose: Route-level map of the app for role-impersonating agents — where everything lives, who sees it, and a task→URL index. Shared by every docs/twins/<role>.md brief.
audience: Digital Twins, AI Agents, Developers
last_updated: 2026-10-29
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
- Search a bid's plans, ask the robot what they say and make an RFI of what they do not → the **Plans** button at the end of the bid tabs' row while a bid is picked (`&plans=1` on the Followup tab opens it; v2.5736, v2.5737; guide `search-the-plans-on-a-bid`)
- Everything new for an estimator in two minutes: the robots' ring, the Plans button, the Dashboard's lines and Messages → `/help?g=use-the-robots-and-the-new-bid-tools-as-an-estimator`

**Jobs / operations**
- Job pipeline by stage (Waiting → Working → RTB → Billed → Collections) → `/jobs?tab=stages`
- Open jobs with no crew on site in 21+ days, reviewed one card at a time (the Follow-ups deck's Idle lens) → `/jobs?tab=stages&followups=idle`
- Bill a customer for a finished job → `/jobs?tab=billing` (or the Bill Customer button on an RTB job in Stages)
- Make our lien waiver for a GC's bill, let the leader sign it on your screen with his signing code, or print it for a notary and attach the notarized PDF when it comes back → the Release of Lien window from a Billed or Collections row on `/jobs?tab=stages` (the office; v2.5924, v2.5925, v2.5985; `/help?g=send-a-gc-our-lien-waiver`); a GC who asks for a notarized one → `/help?g=answer-a-gc-who-asks-for-a-notarized-waiver` (v2.5928)
- Field/tech job reports → `/jobs?tab=reports`
- Crew profitability / labor rollups → `/jobs?tab=teams-summary`, `/jobs?tab=combined-labor`
- Job cost detail (parts, subs) → `/jobs?tab=parts`, `/jobs?tab=sub_sheet_ledger`
- One job's money story (charges vs payments timeline) → `/jobs?tab=job-summary`
- Who owes us money → `/accounts-receivable`
- Schedule crews to jobs by week → `/schedule-dispatch`

- See one development, a site with many bids and jobs, in five looks (History, Pieces, Money, Plans, Questions) → `/developments/:id` (from the house line on a bid or a job; guide `see-everything-on-a-development`)

**People / hours / money**
- Who worked, approve hours, clock cards → `/people`
- Company transactions, payroll marks, spending → `/tally`
- Bank ledger, card sorting, accounting review → `/banking`
- Customers and builders (GCs), their profile and history → `/customers`, `/customers/:id`; on a phone the dock's Customers slot and Job Mode's Customers tab → `/dispatch-mode/customers`, `/job-mode/customers`, where a tap opens the customer's summary sheet with every property and its note, **Edit customer** and **Open record** (v2.5831; guide `dispatch-mode`)
- Every message with every person we work with on GC projects, one thread each → `/messages?kind=trade` (since v2.5717 GC projects' Messages pill goes there; `/gc?view=messages&thread=` still opens a thread there for the links in the wild; every person with a message, back to the first, is **Everyone we have talked with** behind **Show everyone**, v2.5700, and the search box over the pills finds the lines, v2.5701) (guide `find-every-message-with-a-person-in-one-place`)
- Everyone waiting on us for an answer, what we owe them, who went quiet after our send (**Waiting on them**, v2.5704) and, since v2.5686, every text and email we sent in the last 7 days (**Went out**, v2.5699; emails v2.5707), with the week in five numbers at the top (**The last 7 days**, v2.5715; the customers' ratings since v2.5878) and, since v2.5801, one bar at the top holding the kind picker, Mine · Everyone, the search glass, the jump strip over the lanes with their counts (v2.5799), 7 days and a ? that says what each lane holds (v2.5802), pinned while the page scrolls, the lanes' headings bands with the count in a pill, for every kind of person, one pill per kind → `/messages` (`?kind=customer`, `trade`, `arch`, `lead`, `sub`, `team`, or `more` for supply houses and candidates; `?q=<words>` lands on the lines that hold them, v2.5708) (guide `answer-everyone-waiting-on-us-from-one-page`)
- Sort what came in before anyone answers it: who a new number is, which job a line is about, who has the conversation → `/messages`, the **New** list on top (guide `sort-new-messages`)
- A training course your role must take, read at your own pace: the lessons, Check yourself, the final check → `/training/osha-30-refresher` (from the **Training** card under My Time on the Dashboard, under My Schedule in Job Mode; guide `take-a-training-course`)
- A course open to everyone, with a drawing in every lesson of how water comes into a house and leaves it → `/training/intro-to-plumbing` (the **Available** row of the same Training card; guide `take-a-training-course`)
- A course open to everyone on how a house's electrical system works, what is live and where plumbing work touches it, understanding and not doing → `/training/intro-electrical` (the **Available** row of the same Training card; guide `take-a-training-course`)
- New-builder pipeline / hiring pipeline → `/prospects`
- Note a candidate's or a new sub's qualifications, a level from 0 to 3 in plumbing, electrical and HVAC, the license and where they drive in from → their thread on `/messages`, the flow's **Qualifications** step (a candidate's flow and a sub's coming-on lane since v2.5812; guide `see-where-a-person-stands-and-what-comes-next`)
- Owners, developers and architects with a job we could build as the GC → `/prospects?kind=gc-leads` (guide `find-jobs-to-build-as-the-gc`)
- Trade companies to call for the bench, by what GC mode needs right now (every trade short of quotes, the bench, the scope book's trades), the path onto the bench as a strip (To call → Called → Talked → On the bench → Quoted), the list by trade with For, the project a set of plans is for, and the Board by trade whose Call the top 3 → runs the deck through a column's best three, a drag pinning a card and Call first · Normal · Later on every sub (v2.5809), and the sub that says yes asked on the project's job as it lands on the bench (v2.5810) → `/prospects?kind=subs` (the list `/prospects?kind=subs&tab=prospect-list`, the board `/prospects?kind=subs&tab=board`; guide `find-subs-for-the-bench`)
- Small quotes to homeowners (not bids) → `/estimates`
- Contracts and document packets → `/documents`
- Set where a job's Drive files go, move the jobs root, name a job's folder, or make the folders for every job without one → `/documents?tab=where-files-go` (the office; guide `set-where-a-jobs-files-go`)

**Everything else**
- Your day, pins, nudges → `/dashboard`
- Company task list → `/checklist`
- Calendar view → `/calendar`; map of work → `/map`
- Price/labor/assembly books (catalog data behind pricing) → `/materials`
- Your profile, theme, release notes → `/settings`
- Color the Texas counties each collections law firm covers, add the second firm, and see today's Collections cases as dots while you color → `/settings?tab=settings-jobs` (Collections law firms: a dev, v2.5756, the zooming map with the cases and the contents card v2.5758; guide `set-which-law-firm-covers-each-county`)
- See every Collections account on the county map, with the firm that covers each county, who covers what and the cases no firm covers → `/legal-desk?view=map` (the Legal desk’s Map view, a page since v2.5894: the office, v2.5784; guide `review-a-collections-account-before-it-goes-to-your-attorney`)
- See which law firm an account belongs to and why, switch it on a two-county account, or add a firm and color its counties from the desk → `/legal-desk` (the firm segment and the venue line: the office; **Firms…**: a dev, v2.5792; guide `review-a-collections-account-before-it-goes-to-your-attorney`)
- Let the job's master sign a lien notice on your screen with his signing code, or set your own code as a master → the Lien desk from the gavel on `/jobs?tab=stages` (the awaiting footer, v2.5791) or straight to it at `/jobs?tab=stages&liendesk=1` and `/settings#settings-lien-sign-code` (Settings → Your account: a master or a dev, v2.5788; guide `send-lien-notices-from-the-lien-desk`); his code also signs a lien waiver in the Release of Lien window (v2.5924) and on `/bids?tab=lien-release` (v2.5958)
- See the owner of record's mailing address and what the supply houses are owed on a Collections account, before counsel asks, and mark a house paid from there → `/legal-desk` (the Legal desk's Account tab property table and the Paper tab's Supply houses section: the office, v2.5835; Mark paid… on a house's row writes the Supply houses tab's own Paid check, v2.5838; guides `review-a-collections-account-before-it-goes-to-your-attorney`, `see-which-supply-houses-are-owed-on-a-lien-job`)
- Run a Collections case from the office while counsel is away: set it In house, set the settlement floor, log offers with the day they expire, save questions for counsel → `/legal-desk` then **Run it in house…** (the Legal desk header and its Fees & steps tab: the office, v2.5847; guide `review-a-collections-account-before-it-goes-to-your-attorney`)
- Note a fact the record can't fix (work on a handshake, no paper) so the attorney reads it beside the gap → `/legal-desk` (*Before this goes to an attorney* → **Answer…**: the office, v2.5920; the firm reads it on its Paper tab, v2.5923; guide `review-a-collections-account-before-it-goes-to-your-attorney`)
- Plan what happens next on a Collections account and read what happened on one dated line, with notes on each step → `/legal-desk?tab=timeline` (the Legal desk's Timeline tab: the office plans, marks done, holds from counsel and undoes, and since v2.5836 records what already happened with its Evidence documents, and since v2.5842 reads the lien clock's deadlines on the same line and ties a planned step to the deadline it serves, and since v2.5892 adds either behind one **Add to the timeline** door, the day deciding plan or event; the firm reads the same line on its portal and plans a step there; v2.5800; guide `review-a-collections-account-before-it-goes-to-your-attorney`)
- Change a clause of a contract our trade partners sign, or approve one waiting on you → `/settings?tab=settings-clauses` (Contracts and clauses: the office edits, a dev or the controller approves; guide `change-a-contract-clause`)
- Paste Quo's API key once, so the seats and the inboxes pick from Quo's own lists → `/settings?tab=settings-phone-texts` (Quo connection, above Company phone seats: the owner or a dev, v2.5718; guide `connect-the-app-to-quo`)
- Set the company's Google review link the review page asks for, and read this month's reviews → `/settings?tab=settings-what-customers-see` (Reviews: the owner or a dev sets the link, v2.5946; guide `ask-a-customer-for-a-review`)
- Paste a language model's API key once, so the report form drafts a field report from a tech's voice note → `/settings?tab=settings-phone-texts#settings-phone-texts-model-keys` (Model keys, under Inboxes: the owner or a dev, v2.5916; guide `turn-on-drafted-field-reports`)
- See or set who gets a new text, call or email first → `/settings?tab=settings-phone-texts` (Phone and texts: the office reads the rule, the owner or a dev sets the seats; guide `choose-who-gets-a-new-message`), and which company phone seat is whose (Company phone seats, the owner or a dev, a **Quo member** pick since v2.5718; guide `match-each-company-phone-seat-to-a-person`)
- Type the two inboxes' addresses and numbers, the team inbox and the bids inbox → `/settings?tab=settings-phone-texts` (Inboxes, under Company phone seats: the office reads, the owner or a dev saves, a **Quo number** pick since v2.5718; the app uses them once the inboxes are switched on; guide `set-up-the-two-inboxes`)
- Turn on the reply push, so a customer's, a lead's or a sub's reply reaches whoever has it as a phone alert within a minute → `/settings?tab=settings-phone-texts` (Reply push, the owner or a dev, off as it ships; guide `turn-on-the-reply-push`)
- Set the office hours, the days and the open and close that decide when a reply waits for the morning → `/settings?tab=settings-phone-texts` (Office hours, after Reply push, anchor `settings-phone-texts-hours`: the office reads the line, the owner or a dev saves, v2.5709; guide `turn-on-the-reply-push`)
- Set what the app does with each reminder it can text, Off, Offers or Sends, where the other Messages switches are → `/settings?tab=settings-phone-texts` (Reminders the app offers, the last card: the owner or a dev; the same control is on each step in Flows; guide `offer-the-apps-reminders`)
- Change the steps a customer, trade partner, architect, residential customer, sub or candidate goes through (the Candidate tab since v2.5812) → `/settings?tab=settings-flows` (Flows: the office edits; the owner or a dev turns the app's reminders and the Pipeline's ask on a move; guide `set-up-the-steps-a-person-goes-through`)
- Turn a training course on, say which roles must take it or open it to everyone, how long a pass is good for, see where everyone stands, preview the course and clear a retake day → `/settings?tab=settings-training` (Training: a dev; guide `take-a-training-course`)
- Where the company stands this week, the weakest link, the Monday sheet and its Weekly email switch → `/bridge` (dev only; a dev opens the app here, v2.5879)
- How-do-I articles → `/help` (search) or `/help?g=<slug>`
- The public trade rule behind a count or check (hanger spacing, fill limit, drop, mount height) → `https://counttooling.com/rules/` — `https://counttooling.com/rules/rules.json` for software; derive from it and stamp `ruleId` (see the CountTooling bid guide)

## Pages

### /dashboard — Dashboard
Landing page for every role but a dev, who opens on `/bridge` since v2.5879 (`indexLandingPath`, the Dashboard one press away in the header): for dev, master, assistant and controller the **Money in** bar under the Financials cards (v2.5955: what came in this week, what is still expected and what last week still owes, pressed open to the week line whose chips open the job, `/accounts-receivable` or Banking, a *Their word* or *Pace · a guess* chip opening *Write down their word*; guide `/help?g=see-what-money-is-coming-in-this-week`); pinned pages, role-relevant cards (recent reports, my bids,
Wednesday GC-certification nudge, tasks, and for the office team the **GC projects** Follow up line on Needs you, v2.4941; for whoever wrote down a customer's word that they paid, *A customer said they paid, and nothing landed* a week on, v2.5650, opening the won bid for an estimator and the Pipeline for the office; for the leader the *Sign N lien notices before the run* line, v2.5087, landing on the Lien desk's Ready pile; for a dev or the controller the **Contracts** line, v2.5285, the clause changes waiting on their approval, whose **Review** opens the paper on Settings → Contracts and clauses; for the office team the **Customers** line, opening `/messages?kind=customer`, v2.5451; and on Job Mode's card **Message the customer** for primary and helpers, v2.5449, on since v2.5505, guide `message-a-customer-from-job-mode`; since v2.5573 the big **On my way** / **I'm here** press that clocks the drive and texts the customer, with the tech's bio the first time, v2.5590, and on a phone the day's press with Leave report, Turnaway, % done and Clock out on a bar above the tab bar, v2.5905, guide `job-mode-clocking`; for the office team the **Today's sends** line, the texts the app prepared for a person to press, v2.5595, guide `work-todays-sends`; for the office team a low review nobody has called, *Dana left 2 stars on job 1312*, v2.5946, opening their thread (`/messages?thread=`), guide `ask-a-customer-for-a-review`; for the office team the **Job accounts** line, the current invoices a house would still move onto a job account, v2.5723, also on Quickfill, opening `/materials?tab=supply-houses&list=movable`; for the owner and devs *The robots have not made a round since …* and for the bid roles *The robot is blocked on bNNN*, v2.5734, opening the Console and the needs sheet; for the asker *The robot answered your question on bNNN*, v2.5737, opening the Plans panel). Start here to orient; do work elsewhere.
Roles: all.

### /gc — GC projects
GC mode's real build, step by step; open to the office and estimators since door 1 (v2.4832), reached
from the **Trades | GC** switch on Bids. **New here?** walks the page (v2.4838). Since door 2 the office and estimators see the **Project Board** above the
list (the Board's B3, guide `see-where-every-gc-project-stands`): the stages with a jump strip, each project's days left, its customer and
architect, and its price so far with the card behind it. Its switch opens **Trade partners** (guides `add-a-trade-partner`,
`approve-a-company-new-to-us`): each trade's companies and the projects short of quotes, **Add a company**, and the
**New to us** box to approve or decline a company, **Call script** at the right of the trade strip (what to say when phoning a company new to us, the caller's name filled in; `/gc?view=partners&script=1` opens the page with it showing), with **By step** beside that list (`/gc?view=partners&by=step`, guide `see-where-every-company-stands-and-who-is-late`): every trade partner on the step of its flow: a line that says who needs a hand today, then one band per part of the flow in the Project Board's colours (v2.5555), each counting its companies with a dot per company, every step a row inside with each company's day and the step's own press; **By company** (`by=company`), one row per company with the Once lane as a track, the step on now, a line per job and the Portal column; **By trade** (`by=trade`), one row per trade with its companies; **Customers** (`/gc?view=customers`, opening since v2.5557 on a **List**, guide `see-every-customer-and-where-each-job-stands`: a card per customer on a GC project with the person to call, the master agreement, the portal, and a row per job with its stage, the step it is on and the next press; the same guide), every customer **By step** and **By company**, its Portal column the last time the customer opened their page; **Templates** (`/gc?view=templates`, guide `build-a-schedule-template`, for the schedule team since v2.6022, punch list #204 PR 3): every schedule template's current version with its kind, rows, phases, weeks, who saved it and the jobs drawn from it, **New template** and **From a job's schedule** over the list, a kind filter, and the editor, phases and rows with no dates, where **Save as version N** makes a new version and the one before keeps what the jobs drew, `/gc?view=templates&template=<id>` opening one; since v2.6024 **Start from a template** on a job's first draft lands every row of such a template and the chart reads **By phase** (guide `start-a-schedule-from-a-template`); and **Follow up**: on top the people waiting on us (guide `see-who-is-waiting-on-us-and-what-we-owe-them`):
**New** (what came in and still needs sorting), **Needs you**, **Needs a reply** and **We owe them**, each row with who has it, and **Ask the architect** on a plans question;
**Nudges from the flow**, one row a person whose step went quiet past its nudge, with the nudge's own press (since v2.5714 *Text Greg* opens the thread with the reminder written and the send window open), **Hold until Mon** and **Remind now**;
then **We are waiting on them** (guide `follow-up-on-a-quote-from-a-trade-partner`): every company we wait on for a quote,
the ones to call first at the top, with Log a contact and **Will not do it** / **Cannot do it**. **Messages** (guide `find-every-message-with-a-person-in-one-place`; since v2.5717 the pill opens `/messages?kind=trade`, and `/gc?view=messages` still opens the in-page view) lists every
person the office works with, newest conversation first, and opens a person's thread as a window over any view
(`?thread=<contact id>&at=<message id>`): their jobs with the star, each line's job, one message in full with an email's
**Attachments** and **Open**, the offer to file a trade partner's certificate or W-9 that came by email, and **Who is this?** for a
number nobody named; the reply box under the lines sends a **Text**, an **Email**, a team **Note** or logs a **Call** (what they said and the day they gave, v2.5710), a sent text reads **✓ delivered** or **⚠ not delivered** (v2.5703), our estimate email or text carries **Open estimate #N** (v2.5698, v2.5706), and the customer's open, accept or decline of an estimate shows as the app's own line (v2.5705). At its right side sits the person's flow, a rail that opens to the panel (guide `see-where-a-person-stands-and-what-comes-next`). A customer's own message has **Start a change order** for the office (guide `start-a-change-order-from-a-customers-message`), and a line that became one shows *became CO 2*; on a Pipeline job's line the press is **Line on the estimate** instead, and the line shows *a line on estimate 1044* (guide `put-a-customers-message-on-their-estimate`). A company's name opens its window (guide `look-up-a-trade-partner`): About, who gets our emails, its language, **Flow** (guide `see-where-a-person-stands-and-what-comes-next`: where they stand on their flow, each step's card with its notes, skips and holds, and their page), and **Their portal** (guide `share-a-trade-partner-its-portal`), its portal link,
made, copied, remade or turned off, and whether they opened it (a dev's only, until the trade wave). Each project's trades list their asks too, with **Ask for quotes**: the Ask window
(guide `ask-trade-partners-for-a-quote`) lists who to ask and draws each company's invitation, saves the asks and, for a dev, emails each company its invitation.
Once a trade has a quote, **Compare quotes** (guide `compare-quotes-and-carry-one`) puts its quotes side by side, takes a cost to cover what each leaves out, and carries one as the trade's number.
A **gap**, work no trade on the job covers, shows in red on the card (a known exclusion the trade it points to does not list) and as *+ ?* on every number (a quote's exclusion with no cost yet); the card's **How to fill a gap →** and the walk's Gaps stop open the guide (guide `fill-the-gaps-between-trades-on-a-gc-project`).
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
with the sort card at its top, whose **Who is this?** offers the customers we know and makes a new customer, trade partner,
supply house or candidate in one press (v2.5795, v2.5811); guide `/help?g=sort-new-messages`), then **Needs you**, **Needs a reply** and **We owe them** (with the call tasks since v2.5596, guide `call-a-customer-from-a-task`),
with pills for Customers, Trade partners, Architects, Leads, Subs and Our team (`?kind=`), **Show** Mine · Everyone for what you hold (v2.5713), and **Supply houses and candidates**,
which never count on Follow up and show as a people list. Under the queues: **Waiting on them** (everyone whose newest line is ours and two days old, with **Nudge**, which writes the step's reminder into the box and opens the send window, v2.5714, and **☎ Call**, *Their move · N d* over the two since v2.5790; every Call button in the app asks once on a phone whether to call in Quo or from the phone and keeps the pick, v2.5803, guide `call-a-customer-from-a-task`), **Went out** (every text and email we sent in the last 7 days, a text marked ✓ delivered or ⚠ not delivered, a failed one red with **☎ Call them**) and **Everyone we have talked with** behind **Show everyone**; above them one bar since v2.5801: the kind picker, Mine · Everyone, the search glass that opens the box, the jump strip (each lane with its count, pinned while the page scrolls, the lane being read lit, a press going to the lane, v2.5799) **7 days**, which opens **The last 7 days** (answered within an hour, the longest wait, texts not delivered, the estimates, the ratings) under the bar and stays as left per browser, and **?**, a card saying what each lane holds (v2.5802; the lanes' headings are bands with the count in a pill and no sentence); two letters finding every line that holds them (`?q=`); **Answer all** on Needs a reply walks the lane one person at a time with the reply box (v2.5716); a lead's row and thread carry **Book a visit** and **Start an estimate** (v2.5711); the owner and a dev see **Finish switching Messages on** at the top until all eight switches are on (v2.5712). A row opens the person's thread over the page
(`?thread=<contactId>&at=<messageId>`, `&nudge=text|email` with the reminder written), the thread window described under `/gc`; under a customer's own line, **Write down their word** opens the promise sheet on the job the line is about, else their one job with money open, else a pick (guide `reply-to-a-person-from-their-thread`). Other doors to a customer's thread: the speech bubble beside a customer's name on `/customers`, the customer's page and `/estimates` (`/messages?thread=<contact>`), the customer's door behind the same bubble on `/jobs` rows and in the job window (its **Open their thread**), and the Dashboard's **Customers** line (`?kind=customer`). Guide: `/help?g=answer-everyone-waiting-on-us-from-one-page`.
Roles: dev, master_technician, assistant, controller, estimator.


### /training/osha-30-refresher — Training: a course

A course read at the person's own pace (punch list #111, v2.5566): the rail of parts and lessons on the left with a tick on each one done (a **Lessons · N of 30** button on a phone, and a header chip *N of 30 lessons* with a green *Final check passed* after the pass), the lesson on the right (Why it matters, Must know, Traps, with a line drawing under a sentence that needs one, Numbers to remember, Check yourself), and the Final check at the foot of the rail once every lesson is done. Pick one answer per question; a wrong pick says why and offers **Try again**; the lesson records itself when all four are right; **Next lesson ›** goes on. `?lesson=<key>` opens a lesson, `?final=1` the final check. Anyone signed in may read a course that is on; a dev reads one that is off as a preview. The first course is the OSHA 30 refresher, thirty lessons and a final check of twenty, each asked once, fourteen right passes; a pass says the day it is due again and offers **‹ Back to the Dashboard**. Guide `take-a-training-course`.

### /training/intro-to-plumbing — Training: Intro to plumbing

The second course (punch list #119, v2.5610), the same page: how water comes into a house under pressure and leaves by gravity, a drawing in every lesson in one language (a pipe is two lines, water a tint, flow an arrow, the trap's seal a hatch). Required of helpers and **offered** to every other role, who find it under the Training card's **Available** line with no colour and no clock. Off until a dev turns it on; all four parts are built (v2.5610 to v2.5613): Start here, Water in, Water out, the two systems under conditions, Reading the job, thirty lessons and a final check of twenty. Guide `take-a-training-course`.

### /training/intro-electrical — Training: Intro to electrical

The third course (punch list #120, v2.5614), the same page: how a house's electrical system works, for the plumbing crew that works beside it, understanding and not doing. A conductor is one line in the ink for the hot, white for the neutral and amber for the ground, current an arrow along it, and the house red for one thing only, current where it should not be. Every lesson ends at what it does, how you know it is live, what you do not touch and who you call, and the content test refuses a Must know or Traps item that begins with a doing verb without naming who does it. Offered to every role and required of nobody, under the Training card's **Available** line; off until the owner's reader signs it off and a dev turns it on. Thirty lessons in four parts and a Start here (Power in, The devices, The two together as strips, On the job), a final check of twenty with fourteen to pass. Guide `take-a-training-course`.

### /bids — Bids (the estimating hub)
One page, many tabs via `?tab=`. Board tabs are lists; tool tabs are **bid-scoped** — pick
a bid (search or click a row's tool icons) and the tab works on that bid. `&bidId=<uuid>`
deep-links a specific bid into a tool tab.
Roles: dev, master, assistant, controller, estimator, primary; superintendent draft tabs
only (no Pricing / Cover Letter / Submission); no subs/helpers.

- `?tab=bid-board` — **Bid Board**: every HUMAN bid by status section (Not yet won or lost /
  Won / Lost / Started). Row shows value, due, estimator, last contact; multi-GC bids show a
  line per GC (sent date · waiting/won/lost pill). Key actions: set per-GC outcome, open
  notes, update last contact, open Edit Bid (✎), jump to tool tabs (icons). The robot icon before the bid number
  is a seven-step ring (v2.5732) whose tap opens the status sheet (*Read the run*, *Leave this one to me*); a bid left
  to a person wears a dashed *you* mark whose sheet has *Let the robot back in*, and a sent bid wears the ring while a
  robot works on it (v2.5751; guide `let-the-robots-shadow-a-bid`).
  Edit Bid's **Job** block on a won bid carries the **money line** for the job's people (the office, the job's account manager, the bid's estimator or account manager): the job's stage, what is still open on its bills, the customer's last word on paying, **Send the pay page** (a text or an email with the open bill's pay page filled in), the customer's speech bubble opening their door (Call · Text · Email · Open their thread), and **Write down their word** (a day they will pay by, or that they say they paid). Office roles open the job from the block; an estimator gets **Send to Dispatch** (v2.5659): a short draft of the job (name, address, GC, the figure it starts at, the trade, a wanted-by day, a note) that Dispatch's inbox opens as New Job, then *Sent to Dispatch … · waiting*, then the job's chip. Guide `see-where-a-job-you-bid-stands-on-money`.
- `?tab=money` — **Money** (v2.5651): every won job with money open, past their word first, then no word, then waiting; each row the money line with its doors and a **Trail** of the money's story; **Only my bids** keeps the bids the person sold. The Dashboard's **Money on your bids** card opens it for estimators and primaries. Guide `see-where-a-job-you-bid-stands-on-money`.
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
  above ready, each with a copyable kickoff prompt — since v2.5753 the one rule the rounds claim by, so the top row is what
  the next round takes, and **Held** lists the live bids with plans the rounds pass over with the reason; plus **Backtest candidates** (v2.2594) — graded A/B decided references grouped
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
  runs** (`twin_runs`, newest first). Twins never see it. Since v2.5733 its first card is **Rounds**: each robot key
  alive, quiet or asleep, when it checked in, what it holds and its last five finished things, with **Stop the rounds**
  / **Start again**; since v2.5735 *Run the robots* holds **Copy rounds kickoff** (`kickoffs/rounds-operator.md`) to make
  a Mac that stays on the rounds, its Claude Code session set to the mode that asks before the paste (v2.5754).
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
  REVENUE·PROFIT·MARGIN·MULTIPLE header, margin brush, Solve, price options per GC. The strip names the version your prices land on (*📐 name · alternate* / *name · base*) and a typed price's tick says *saved ✓ on …* (v2.6003); version cards say **Open ›** and move you onto that version, on an own-takeoff alternate the base the first card (v2.6000); a typed 0 saves as $0.00 (v2.6001). Guide `price-a-bid-with-the-workbench`.
- `?tab=cover-letter` — the letter studio: pick packets/alternates per GC, preview, copy to
  Google Docs, Print, **Mark sent** (stamps send date + value).
- `?tab=submission-followup` — the selected bid's full submission record: sends by GC,
  notes/contacts ledger, links, RFIs.
- `?tab=rfi` — the selected bid's **RFI queue** (draft → approve with a per-GC pick →
  mark sent → record answer; "Paste RFI flags" imports CountTooling `RFI:` notes) above
  the RFI letter composer. Twins: DRAFT ONLY — approving/sending is human.
- `?tab=change-order` / `?tab=lien-release` — bid-scoped paperwork tools; `?tab=lien-release` keeps every waiver that goes out on the bid (**Already on this bid**, v2.5958), and a held assistant or estimator gets **Sign with his code** for the leader at the screen (`/help?g=make-a-lien-waiver-from-a-bid`).

### /jobs — Jobs (the operations hub)
Tabs via `?tab=`. Roles: dev, master, assistant, controller; primary = Reports+Billing on
Account-Man jobs; superintendent = Reports + Sub Sheet Ledger; no subs/helpers/estimator.
- `?tab=stages` — **Stages**: pipeline sections Waiting / Working / Ready to Bill / Billed
  Awaiting Payment / Collections. Job rows: activity thread, % complete, dispatch, Edit Job,
  Bill Customer on RTB. New Job button (imports from a bid — multi-GC bids ask which GC won).
  The customer's speech bubble opens the customer's door over the board: Call, Text, Email,
  Open their thread, Their record, the thread's last three lines, and an orange dot while they
  wait on us (`/help?g=text-a-customer-from-the-job`). A forward move to Working, Ready to Bill
  or Billed asks before it texts the customer when that step is set to Asks in Settings → Flows
  (`/help?g=set-up-the-steps-a-person-goes-through`).
- `?tab=reports` — field job reports (create/review); dispatch items (e.g. site-not-ready). Since v2.5912 (punch list #186) both report forms carry **Talk it through** over Report type: the phone's own speech into Notes, read before Save report, and since v2.5916 drafted into Notes and the named lines when a model key is set (guide `reports` § Talk it through).
- The job window, for the office team: **＋ Report** beside the Reports pill leaves a field report from the window (v2.5688, guide `reports`); **Note · Text · Email** over its note box, a text or an email to the customer tied to the job (guide `text-a-customer-from-the-job`); a customer's speech bubble opens the customer's door over the window, as on the Pipeline's rows but with no Their record row, and its **Open their thread** goes to `/messages`. Since v2.5895 (punch list #186) the Job tab opens on **Where it stands with ‹name›**, three stamped lines from the rows people wrote (whose word came last, their written promise, what we owe), *Where it stands* and *Their word* a door to their line when one is behind them, with **Read again** and **Keep as a note** (guide `see-where-a-job-stands-with-the-customer`; dev, master, assistant and controller in practice, since the card needs the full-ledger window). Since v2.5946 (punch list #185), above Their journey, the job's newest review ask: asked, opened, the stars and their words, the Google press, the call, with **I called** on an answer at three stars or fewer (guide `ask-a-customer-for-a-review`). The Costs tab's **Print** makes the job's costs packet, four Letter pages (dev, master, controller; v2.5749, guide `job-window-tabs`). The box opens on the lines for the job's stage, and `{bill}` in a quick reply fills with the pay page of the job's newest Stripe bill; a slash typed in any reply box lists the quick replies by keyboard, and the words bill or estimate after it the customer's own bills and estimates, a pick putting in a line about that paper with its link (guide `reply-to-a-person-from-their-thread`).
- `?tab=billing` — invoices, payments, billing flows per job.
- `?tab=materials` — **Materials** (v2.6043, punch list #209): the office side of what is in the cages and boxes on a big site. The desk of every job with a container; a job's page with the flow row came in → on site → used → missing, the boxes by place with the site map, Missing (one row per part: bought against reported against left, the money that walked away), Deliveries (drop the invoice in the job's Drive folder, or paste its lines and add them to Unsorted), History, Label on every box and Print labels. `?job=` opens a job, `?label=<container id>` its label. Guide: `see-what-is-on-every-job-site-and-what-walked-away`. The job window's **Materials** tab and the Pipeline tools menu's **Materials desk** row lead here; the header's Go anywhere lists **Boxes on site**.
- `?tab=job-summary` — one job's charges-vs-payments timeline chart + % complete. A search finds the job whatever the
  chips and the HCP # floor say, and a line under the controls says which stepped aside (v2.5745).
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
All customers/builders, each row's second line where the money stands and how fast they pay (*pays in ~30d*, office roles, v2.5767); the Hub is one customer's money strip, jobs, bids, contacts.
Roles: dev, master, assistant, controller; estimator limited. No subs/primary/super.

### /developments/:id — Development page
One site's bids and jobs as one unit (v2.6040): the customer, the GC and who is on site; five count tiles whose cards list the records behind each number; the strip's five looks: History (one dated stream of what the records did and what people wrote, with a composer that keeps what happened at its own time, v2.6042, chips to narrow, a search), Pieces (each bid with the job it became, the pairing tool, what is at the address but not in it), Money (progress and what is left, by stage), Plans (every set and the pieces without one), Questions. Opened from the house line on a bid or a job.
Roles: dev, master, assistant, controller, estimator. No subs/primary/super.

### /prospects — Prospects
The cold-call deck in three lanes: Customers, Jobs to GC (`?kind=gc-leads`, a lead's jobs and bid days, Asked us ✓ → New project) and Subs (`?kind=subs`, what GC mode needs right now with a door from each need to the bench, the subs here or Add a sub, Add to the bench ✓ → Trade partners; since v2.5807 the path onto the bench as a strip over the lane, the Prospect List by trade with a stage chip and a press per row, **For**, the project a set of plans is for, `?for=`, and since v2.5808 the **Board** sub-tab, `?tab=board`, one column a trade with Call the top 3 → opening Follow Up as a run, `?run=`, a drag pinning a card and Call first · Normal · Later since v2.5809); plus the Hiring tab, per-user gated.
Roles: staff; estimator only with `estimator_prospects_access`.

### /estimates — Estimates
Homeowner-style quotes (separate from bids): line items, send for acceptance (since v2.5594 through **Tell the customer**: the email and the text with the link, the sheet answering every press with a band or its receipt since v2.5681, guide `send-an-estimate-and-turn-it-into-a-job`; a sent estimate shows **What went**, v2.5683, every option it offered, v2.5988, **Extend good-through** keeping the link and mailing it again, v2.5992 and v2.5997, and **Download PDF**, v2.5993), → job (the detail page's Create job moving the texts that carried the link onto it, v2.5706); a lead's **Start an estimate** on Messages makes the customer and opens a draft on them here (v2.5711).
Roles: dev, master, assistant, controller, estimator, primary; super limited.

### /tally — Tally
Company card charges sorted to jobs: the office's Team queue (one card per person per day,
the likely job first), each holder's own card, payroll marks, follow-up. The **On site** tab (`?tab=on-site`, v2.6041, punch list #209) is the crew's side of Materials on site: the job's cages and boxes by place, the flow row Unsorted → Used → Count, each box's lines with Used, Move to… and Can't find, the Count this box walk, Photo, the site map; `?job=` and `?container=` open a box straight away (the Job Mode card's Materials on site, a label's code through `/b/:code`). Guide: `keep-track-of-the-material-in-the-cages-and-boxes-on-site`.
Roles: all (Team for dev, master, assistant/controller; payroll actions gated).

### /b/:code — A box label's short address
The door a printed box label's QR opens: `prts.co/b/7D759246` forwards here (v2.6039, punch list #209). The page finds the box by its eight-character code and opens it on the tally's On site tab; a code no box carries says so and offers the tab. Roles: anyone signed in who can see the job.

### /banking — Banking
Mercury bank ledger: user/drag sort, accounting labels, card + category review,
reconciliation; every Approvals card says the day the charge was made (v2.5804), and the Account nicknames window shows each
Mercury account with Mercury's own name, its numbers and its newest lines (dev, v2.5806, guide `label-bank-transfers`). Roles: dev (full incl. Stripe), master, assistant/controller (staff tabs).

### /accounts-receivable — AR
Outstanding billed jobs by customer; collections flags. The bank deposits modal leads a deposit's pane with a customer's word that they paid when the deposit fits it (**They said they paid**, v2.5650; guide `match-bank-deposits-to-bills`). Roles: dev, master, assistant, controller.

### /legal-desk — Legal desk
The Collections accounts the way the law firm would receive them, one account at a time: the rail by what Click would keep, six tabs (Narrative · Account · Paper · Evidence · With the firm · Timeline), the county Map, the firm group, Mark attorney ready, Run it in house, Write it down. A page since v2.5894 (punch list #182): `?account=<payer key>` is the account, `&tab=narrative|account|paper|evidence|firm|timeline` the tab, `&view=map` the map; `/jobs?tab=stages&legal=1`, `?legal=<key>` and `&legalTab=` redirect here, and since v2.5936 the Pipeline’s scales, ☰ row and Collections header, the Lien desk’s door and the Dashboard’s law-firm lines all open it, and since v2.5990 the ⋯ tools menu's **Legal desk** row under **Lien desk**, the only door on a phone's Mobile cards. On a phone (since v2.5941) the bare address is the list of accounts, and an account opens as its own screen with **← Accounts**. **← Back** at the top left goes back (**← Pipeline** on a cold open). Roles: dev, master, assistant, controller (`canManageCollections`). Guide `review-a-collections-account-before-it-goes-to-your-attorney`.

### /materials — Materials
Price book / labor book / assembly book catalogs feeding Pricing.
Roles: dev, master, assistant, controller, estimator, primary; super: price+assembly books.

### /documents — Documents
Contract library (Documents/Packets), quick-send. Roles: staff + estimator, primary, super. **Where files go** (`?tab=where-files-go`, v2.6057, punch list #211): the office sets the jobs root with a live write check, how a job's and a bid's Drive folder is named as pieces with a real job's example, and whether a job's folders are made up front or as needed; under the cards it makes the folders for every live job without one, checks one job's folder and every pasted folder, and reads the amber line of the ones the app cannot write to. The four office roles, never the estimator; guide `set-where-a-jobs-files-go`.

### /estimates·/projects·/workflows — Projects & workflows
Project containers linking jobs/bids; workflow boards. Roles: staff; super assigned-only.

### /quickfill · /moneyfill — Data-repair queues
Quickfill: guided fix-missing-data recipes (staff), in three views on a desk, **Page · Focus · Roller** (`?view=`, kept per person on the device): Focus folds a station with nothing open to one line (v2.5778), the Roller shows one station at a time with Previous, Next, a strip of dots and the Board as its index (v2.5787), and the page opens on the Roller for anyone who has not picked (v2.5813; guide `quickfill`); a station's chart icon, its *Last marked* words and the round's *last look* words open its Mark history, eight weeks of looks with the tiles, the habit line and its boxes (v2.5819, v2.5826), and the Email station's window carries the counted labels' four-week trend over the marks (v2.5828). Its Percent complete station (`/quickfill#percent-complete`, help `/help?g=fix-a-jobs-percent-done-in-quickfill`) lists the open jobs whose ticked stages or paid money disagree with the % done, to fix in place or dismiss for a week, the card's bar the slider for the number since v2.5805 (v2.5764; restored in v2.5789 after v2.5774's squash dropped its page lines on 2026-10-23); its Needs you station carries every office line the Dashboard's card shows with the same buttons (v2.5771) and a **Fill them in** deck that clears a line's rows one at a time: lost bids with no reason (v2.5774), vehicles missing a record (v2.5775), jobs that bought with no job account (v2.5776) and contracts out for signature a week (v2.5777; guide `needs-you-card`); its Physical inbox is a deck that decides each paper in the tray with one press, Done, Trash, File it, Task or Ask (v2.5818), Waiting for or Someday, which park it in a fold under the deck (v2.5821), or Comes back, which makes a paper that arrives every month a repeating Checklist task (v2.5825; guide `clear-the-physical-inbox`); its Texts station reads Messages' own lanes narrowed to texts, Needs a reply with Reply and Call, Not delivered with Call them or Send it as an email, and Went out today as the receipt, its Mark writing the note from the rows (v2.5816), and Needs you's Customers line leaves a customer's text to it (v2.5823); its Email station reads Gmail's own labels for the boxes and people the owner lists, senders, subjects and dates and never the words, one row per label with Gmail's count, the oldest age and the threads past the limit, Read again, and by hand with the reason while the switch is off (v2.5827; the `gmail-count` sweep v2.5820, the Settings cards v2.5824); its Billed Awaiting Payment station reads the lean — who needs a call after 30 days past due, who was leaned on inside the owner's days or holds a promise, a lean logged from the row (v2.5885); a dev can point an Assistant Dailys box at a station, which that station's mark today satisfies, and the time-off box lists who is off in the next two weeks (v2.5884). Moneyfill: dev + controller only.

### /bridge — The Bridge
The owner's one page for where the company stands: contribution per week, the five stages with the weakest link lit, the week's call, the cash forecast from the bank, the people tables; `?view=monday` is the Monday sheet, with the **Weekly email** switch under it (v2.5883: Monday 6 AM Central to every dev, off as it ships). Press the Collect card, then **Break it down**, for the Collect desk: every payer's open bills read by their own pay pace, the one move on each with its *Say:* line, the week's plan recorded as the Bridge's call, **After the call** recording the answer, and Friday's scorecard (v2.5848–v2.5858). A desk behind every stage card (punch list #192, v2.5929 Build · v2.5930 Bill · v2.5931 Market · v2.5932 Sales): each card ends in **Break it down ›**, opening the stage's pile broken into its rows, each with its door (Sales' with a move too), read-only, the week's call staying with the lit link; Build's is the hours-in, work-out ledger of every open job over the last 14 days, a stalled row opening `/schedule-dispatch`; Bill's lists the finished work with no bill, the hand-marked bills apart, the ready jobs and the same-day rule, its doors on `/jobs?tab=billing`; Market's reads 26 weeks of asks by customer, its doors `/bids?tab=bid-board` and `/estimates`; Sales' ranks the open bids by expected dollars, each bid opening at `/bids?tab=bid-board&bidId=<id>`. Roles: dev only (every other role is redirected to `/dashboard`). A dev opens the app here since v2.5879: `/` and a sign-in land on the Bridge, the Dashboard one press away in the header, and a deep link opens where it points.

### /map — Map
Geocoded work map. Roles: dev, master, assistant, controller, estimator.

### /calendar — Calendar · /checklist — Checklist · /settings — Settings · /help — Help
All roles. Settings holds profile, theme, release notes; dev/master see admin sections. A master or a dev sets
the signing code the Lien desk takes on anyone's screen under Your account (`/settings#settings-lien-sign-code`, v2.5788). For the owner or a dev, Phone and texts holds **Mail the app counts**, the switch, the limit in days and the shared boxes and people whose Gmail labels Quickfill's Email station counts, and Your account holds **Mail Quickfill counts** for a person on that list, their labels, who sees their rows and their own switch (v2.5824; guide `choose-which-mail-quickfill-counts`). A dev retires a robot on
`/settings?tab=settings-digital-twins` (**Archive** on its row revokes its keys and archives the account; the *N archived*
fold brings it back with **Restore**, v2.5741; guide `run-the-robots-from-claude-desktop`), where the walk tester's line
sits under the Sample accounts card (v2.5738). A dev sees every screen as every role on invented data at `/settings?tab=settings-what-everyone-sees` (What everyone sees, v2.5963; `/help?g=see-every-screen-as-every-role`). A dev's map of every door only a dev or the controller can open today is
`/settings?tab=settings-dev-doors` (Dev doors, the card *Only devs and the controller see these*, each a link with who may open
it beside it, v2.5882; the audit with a call per door is punch list #188).

### Header (any page)
Global search (⌘K or Ctrl+K; for the office jobs/bids/customers by name or J#/B#/C#, and under them every page, tab, window, Settings card, guide and to-do the role may open, from one gated index, `src/lib/search/doors.ts`, v2.5900 to v2.5933, punch list #181; the estimator, primary and superintendent get the doors alone, helpers and subs their job lookup with the guides; guide `global-search`), Inbox, **Messages** with its count on the word's corner for the office team (`/messages`, v2.5762), Task dispatch/add,
gear menu (theme, sign out). The 🤖 DIGITAL TWIN banner lives here when you are a twin.
On a phone with Dispatch Mode on, an assistant / controller gets the **phone dock** instead of
the hamburger and gear: a bottom bar of Jobs (`/jobs?tab=stages`) · Schedule
(`/dispatch-mode/schedule`) · PO (`/dispatch-mode/po`) · Inbox (`/dispatch-mode/inbox`) · More (a sheet
with *The dock* row — tap a slot there to swap it — every page, the mode switches and Help /
Settings / Sign out); holding a slot on the bar swaps it too.

### /portal · /p/:slug — A customer's portal (public)
One no-password link per customer (`CustomerPortal.tsx`, read through `customer-portal`): since v2.5948 *Your jobs*
first (each open job and each paid one asked for a review, with its stage and a door to `/rate`), then their open
bills and the statement, payments, waivers, their agreements and test reports. On a GC job we build it is the customer's page
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

### /rate — The customer's review (public)
What a rating ask's link opens (v2.5876; the owner's review ask since v2.5934): the company and
the job by name, *Dana, how did we do on the water heater?* with five stars, one tap saving the
score and an optional words box after. At five stars it asks them to put it on Google with the
company's own link, their words copied for the paste; below five the box asks what we could
have done better, and at three or fewer the page says the office will call. No sign-in: the
`?t=` token is the capability and reaches that one rating alone. The office mints the ask from
the reply box (`{rate}`) and, since v2.5943, the Review asked step's text the morning after Paid, pressed on Today's sends; it reads each answer as the app's line in the customer's thread, on the job window's Job tab, on Needs you (three stars or fewer, not called) and in Settings → What customers see → Reviews (v2.5946), and the
counts on Messages → The last 7 days. The Google button shows below five too (`GOOGLE_ASK_AT`).

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
