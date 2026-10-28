---
name: "Developments on bids, one page for a development, and questions kept on the record"
number: 208
group: ready
status: building 2026-10-28 · PR 1 shipped as v2.6019 (#6376, the migration applied): the column, the picker, the Bid window and Bid Board lines, the house filter, New Job from a bid, the suggestion by address · the mock-up's second pass drawn the same day (draft 3, the owner liked the idea and not the thing): one Pieces table instead of two boards, the Ask as a kind in the record's own box, the house line carrying the site's pulse, the since line inside the feed · three calls open on it · PR 2 next
summary: >
  A development is already a record on jobs: a named row, the house icon on the Pipeline, a filter,
  GC Review's By development. The owner wants it on bids too, so that a site with many moving pieces
  (the real example has 13 bids and 29 jobs at one address, 9 of the jobs tagged and none of the bids)
  reads as one thing; a Development page reachable from any of its bids or jobs that shows everything
  in one place and leads with what changed since you last looked; and a way for a leader to ask the
  estimators or Dispatch a question about a development, a bid or a job, answered in the app and kept
  on that record as its history. The plan: one column on bids, a page at /developments/<id> with the
  Customer Hub as its precedent, and the questions riding the two request lanes the app already has
  (the Estimator inbox and the Dispatch inbox) with a development as a third kind of reference.
next: >
  PR 2 (the page), which with PR 1 gives the owner the real site's page; PR 3 fills it, PR 4 is the
  questions, PR 5 the feed and the plans line, PR 6 the estimator's door.
size: S (PR 1 the column and picker) + M (PR 2 the page) + S (PR 3 not in it yet) + M (PR 4 questions) + M (PR 5 what changed, plans) + S (PR 6 the estimator's door, types)
blocker: None.
opinion: build — PR 1 and PR 2 are small and give the owner the Gun Dog page he described; the questions add no inbox, they ride two that exist
---

# Developments on bids, one page for a development, and questions kept on the record (#208)

Mock-up: [`mockup.html`](./mockup.html), draft 3 — the Bid window and the Job window before and
after, the Development page (and the page on a phone), the ask and its answer, and the two critique
passes. Made-up data (Ridgeway Builders, Harlow Ranch). Draft 3 is the second pass: the owner read
draft 2, liked the What changed feed and the page, and did not love the rest; what moved is the
strip at the top of the mock-up and *The second pass* under *Is this the best we can do?* below.

## The ask

The owner, 2026-10-28:

> in jobs we have a concept called development, this is meant to represent projects that may have
> multiple jobs where some of them may overlap
>
> I would like to extend that tag to bids, this way I can long term create a development grouping
> where as I get new updates about a project with many moving pieces they can be identified together
> so if one gets an update or a set of plans that might affect the rest we can quickly identify.
>
> I think after marking things in bids apart of a development it would be smart to make a
> development page view that could be accessed from any of the bids or jobs apart of a development so
> we could see everything in one place
>
> a good example of this in the app right now is the bids and jobs related to gundog
>
> I further think that we could create tooling where a master can ask questions about a development
> or a bid and an estimator or dispatch can respond to those questions in app and make it a history
> of the development or bid or Job

Three pieces: the development on bids; a Development page; questions on a record, answered in the
app and kept.

## What exists today (read off the code and prod, 2026-10-28)

**A development is a record, not a tag.** `public.developments` (v2.1198, migration
`20260801100000_developments_on_jobs.sql`): `name`, an optional default GC (`gc_customer_id`),
`city`, `notes`, a soft `archived_at`; one active name per master. Jobs link through
`jobs_ledger.development_id` (ON DELETE SET NULL; a same-master backstop trigger). The choice of a
row over a free-text tag was deliberate: typed names fragment on typos. The kernel is
`src/lib/jobs/jobDevelopments.ts` (the picker options, the name checks, the Settings sorts).

Where a job's development shows: **Edit Job → Project | Plans | Bid | Development** (a select with
an inline *+ New development*, autosaved); the **Pipeline** row's Job column, a house icon under the
customer, a press filtering the board (`jobsStagesRowShared.tsx`,
`jobsStagesBoard.ts`'s `filterJobsByDevelopment`); the Pipeline **search** and the house **filter**
in the search bar with *No development set*; the **Job window**'s customer panel, a muted line
(`DetailJobModalCustomerPanel`); **GC Review → By development** (`gcReviewRollup.ts` with
`groupBy: 'development'`, a statement and *Find a check* per development, v2.4912); **Job Summary →
Cut by development** (v2.2820); **Settings → Jobs & dispatch → Manage developments** (dev only,
`DevelopmentsSettingsBlock.tsx`: rename, default GC, archive, delete). Guide:
`group-jobs-into-a-development`.

**A bid has no development.** `bids` carries `project_id` (a Project: the multi-phase billing
container, offered on the Edit tab's Links row as *rarely needed*, v2.3215), `customer_id` or the
legacy `gc_builder_id`, `address`, `project_name`, `adopted_into_bid_id`, `alternate_group_tags`.
A job points at the bid it came from through `jobs_ledger.bid_id`. New Job from a won bid copies the
customer, the address and the budget snapshot (v2.3302).

**The live example, read as the dev through dev-mcp.** One commercial customer, one site address
in another state. 13 bids over April and May, every one with the same address string and nothing
else in common: the names say which building (an ATV building, a BESS room, a bunker, a lodge, a
bunkhouse). 29 jobs at the same address. One development exists for it, made 2026-08-01, and 9 of
the jobs carry it, the open ones; the 20 paid jobs never got the pick, and no bid is linked to any
job (`bid_id` is null on all 29). So today a person recognizes the site by its address string and
its customer, from two pages, and nothing reads the bids and the jobs together. (The $0 placeholder
jobs on it stay by the owner's call of 2026-10-09, `owner-decisions-pending.md`.)

**The question-and-answer shapes the app already has**, so the third piece is weighed before
anything new is proposed:

| Shape | From → to | Keyed to | Inbox, push, age | Thread | Reads back on the record |
|---|---|---|---|---|---|
| `dispatch_requests` + `dispatch_request_notes` | anyone → the Dispatch group (assistants in `dispatch_group_members`) | `bid_id` or `job_ledger_id`, one of them, plus a `reference_summary` | the Dispatch inbox (Dashboard, Dispatch Mode, Quickfill, Checklist Review), `notify-dispatch-request`, the *Dispatch answered* push to the asker, the age chip, priority, *My requests* on Job Mode | notes with author and time; close with a note | **no** — the Bid window and the Job window list nothing |
| `estimator_requests` + `estimator_request_notes` | anyone → the Estimator group (`estimator_group_members`) | the same two keys | the Estimator inbox, `notify-estimator-request`, the same push, chip, priority | the same | **no** |
| `twin_questions` | a robot → the owner or an estimator | `about_bid_id` | the Audits lens, the envelope, the robot's needs sheet | one answer | on the Bid Board's robot icon |
| `bid_plan_questions` (v2.5737) | a person → the robot, about the plans | `bid_id` | the Plans panel, the rounds answer | one answer with sheet refs; *Make this an RFI* | the Plans panel |
| `bids_rfis` | us → the GC | `bid_id` | the RFI tab, sends | an answer | the RFI tab |
| `gc_plan_questions` | a trade → us, GC mode | a plan set | the GC project's board | an answer | the board |
| Legal desk gap answers (v2.5920) | the office → the attorney's packet | (matter, gap key) | — | one line | the packet |
| `jobs_ledger_thread_notes`, `bids_submission_entries`, `bids.notes` | a person, to nobody | the job, the bid | — | a note | yes, as notes |
| Messages (`messages`) | us ↔ one outside person | a contact, with job keys as labels | Follow up | the thread | the customer's thread |

Who reads a request today (`dispatch_requests_select`, `estimator_requests_select`): the asker, a
dev, the group. A leader who did not ask cannot read a request about a bid.

**Pages and doors.** The Customer Hub (`/customers/:id`, tabs All · Money · Jobs · Notes) is the
app's precedent for one record's everything-in-one-place page. Punch list #182 wrote the rule: a
desk is a page with its own address when a person stays in it, it has views of its own, and it opens
from more than one place. `/jobs` is the office's (dev, leader, assistant, controller; primary and
superintendent on two tabs; no estimator), and the `jobs_ledger` SELECT policy has no estimator
branch, so an estimator reads a won job's money line only through a definer RPC
(`list_bid_money_strip`, v2.5651). `/bids` is the office's and the estimator's. `developments` is
readable by the office and the three bid roles (the one-company sweep, `20260906200000`). Every page
has a door in `src/lib/search/doors.ts` with a gate; the search box finds jobs, bids and customers by
name.

## The decision (after the pass)

### 1 · The development on bids: one column, the same shape as the job's

**Picked.** `bids.development_id uuid references developments(id) on delete set null`, an index,
and the same-master backstop the job has (`bids_development_master_match`). The Edit tab's Links
row gains **Development** beside Project, the same select and inline *+ New development* as Edit Job,
through the same kernel. The Bid window's read tab shows a house line under the number, the Bid
Board row its muted line (the GC line's sibling, as on the Pipeline), the Bid Board search finds it
by name, and a house filter joins the board's filters. New Job from a won bid copies the
development with the customer and the address, so a job made from a bid in a development is in it
without a second pick.

**With it, so the real site is not 33 edits:** a suggestion by address. Saving a bid or a job with
no development, whose address other members of one development share, offers one line on the form:
*4 bids and 6 jobs at this address are in Harlow Ranch* with **Put it in Harlow Ranch**. The match
is on the members' own addresses, normalized, so the development needs no address column.

**Rejected.** A free-text tag on bids (the jobs side rejected it in v2.1198, and the real example
shows why: thirteen spellings of one site). Reusing `bids.project_id` (a Project is a billing
container with one customer, and the owner asked for the development). A development on estimates
or GC projects (not asked).

### 2 · The Development page: a page, with the Customer Hub as its precedent

**Picked (draft 3).** `/developments/<id>`, by the #182 rule (a person stays, it has views, it opens
from bids and from jobs). Its head: the house, the name, the GC or customer, the address its members
share, Map, the site's people (the GC contact from the bids, estimating from the bids' estimators,
on site from the open job's crew), the counts with the waiting one first (*1 question waiting · 2
days*, bids and how many undecided, jobs and how many open, bid and not yet decided, open on bills),
**Ask a question**, **Edit**. No tabs: a jump strip as Messages has (**What changed · Pieces · Plans
· Questions**) over one page of cards, with the newest plan set and the count on an older one at
its right. A leader opens the page with one of three questions, and the page answers them in that
order: what moved since I looked (the feed), what is waiting on whom (the counts, the Waiting
column), which pieces has the newest set not reached (the strip, the Pieces table).

- **What changed** leads, because that is the owner's sentence (*if one gets an update or a set of
  plans that might affect the rest we can quickly identify*). It is a reader over rows the app
  already keeps: a bid's sends and contacts (`bids_submission_entries`), its outcome (`outcome_at`),
  its plans link and plan date (the bid history ledger `bid_changes` records the change, v2.4598), a
  job's stage moves (`job_status_events`), bills, payments and reports, the customer thread's last
  word, and the questions. *You last looked · Thu Oct 23* is a line inside the list, kept on the
  device as the owner chose: above it is new, under it is seen, **Mark as looked** moves the line
  to now, and the card's header counts *9 since you looked*. (Draft 2 filtered the list and hid the
  rest behind *Everything older*; one list with a line in it reads better and keeps the context.)
- **Pieces**, one table where draft 2 had two boards: each bid on the row with the job it became
  (`jobs_ledger.bid_id`, one direction), a job with no bid and a bid with no job each on a row of
  their own, the done ones (paid jobs, lost bids) folded. Columns: the piece's name, the bid (number,
  status, value, estimator, sent or due), the job (number, stage, revenue or open, crew, last work),
  the plans (the set it carries, *older* in amber when it is not the newest, *none*), and **Waiting
  on** (an open question with its age, a billed job's payment, a sent bid's answer). The thing no
  board can show is the row. The real site's 29 jobs predate the link, so they open as rows of their
  own, which is still the truth. The card's header carries the filter to the Bid Board and the
  Pipeline, which keep their own columns.
- **Not in it yet**, its own line above the lists: *2 jobs and 1 bid share Harlow Ranch Rd and are
  not in Harlow Ranch*, with **Put the 3 in Harlow Ranch** (the count in the button, `countedLabel`)
  and **Not these**. Dead on arrival otherwise: the real site would open with 9 jobs and no bids.
- **Plans**: every set on the site, newest first, with which records carry it; a line under it
  names the records on an older set or none with **Ask the estimators about the 7**, which writes
  one request on the development with the set's date in its `reference_summary`; the card finds
  that request and reads its answer back under the line, and the Pieces table's Plans cell reads the
  answer's text for the names it carries (*repricing*, *not in the Oct 20 set*). The loop closes on
  the page: a set arrives, the page names the siblings, the leader asks, the estimator answers, the
  answer reads back where the question was raised. A check per piece in its own table (touched ·
  not touched · repriced) would make that cell a fact instead of a reading of prose; a later card.
- **Questions**: the same log the records draw (open first with the age, then answered, each with
  the record it was asked about), so the page and the record show one shape.
- **On a phone** (375): the head keeps its counts, the feed is the same list, each piece is a card
  (the bid line, the job line, the plans, the wait).

**Doors.** The house line on a Pipeline row keeps filtering the board (a board affordance), and the
filter chip that appears in the search bar gains *Open Harlow Ranch ›*. The Job window's house line
and the Bid window's house line open the page, and carry the site's pulse rather than its counts:
*Harlow Ranch · 1 question waiting · new plans Oct 24 · Open ›*, the two reasons to go, read
from the requests and the newest plan date the page reads anyway; with nothing waiting and no new
plans the line is the name and *Open ›*. GC Review → By development's group name, Settings →
Manage developments' row, the Bid Board row's line, and the search box by name (a `page` door with
the developments gate).

**Who.** The office set sees all of it. An estimator opens it from a bid and reads the bids, the
jobs' names and stages, the plans and the questions, with no money on the jobs, through a definer
read (`list_development_overview(p_development_id)`, the way the Money lens reads a won job for
them). Primaries, superintendents, subs and helpers do not reach it. An archived development's page
opens read-only.

**Rejected.** A window over the Pipeline like GC Review (opens from bids too, has views: the rule
says page). A filter alone on each board (exists on the Pipeline; it never reads the two together).
Two boards on one page (draft 2: the Bid Board's columns over the Pipeline's, nothing read across
the pair). Tabs over cards that all show anyway (draft 2). Money on the development itself (a
statement, a total) beyond GC Review's By development. A timeline chart. Scheduling by development. A
robot that reads the site. A piece name of its own on bids and jobs (a piece that is one bid and two
jobs takes two rows for now).

### 3 · Questions: the two request lanes, with a development as a reference

**Picked.** A question is an `estimator_requests` or `dispatch_requests` row. The lane already has
everything a question needs: a *to*, an open state, an inbox someone watches, a push, an age chip, a
priority, a thread (`*_request_notes`), a close with a note, and *My requests* for the asker. What is
new:

- `development_id` on both tables beside `bid_id` and `job_ledger_id`, one reference per request
  (a check constraint), an index, and the inbox row's reference chip reading the development with a
  door to the page.
- **Who reads a request about a record**: the SELECT policies gain the office set
  (`is_office_staff()`) for requests that carry a reference, so a leader reads the history on a bid
  he did not ask about; an estimator reads the requests on bids and developments (the bid roles'
  read); a primary or superintendent reads their own, as today.
- **The ask starts in the record's own box (draft 3).** The Job window's customer sheet
  (`JobCustomerSheet`, Note · Text · Email) gains a fourth kind, **Ask**, with a *to* (the
  estimators · Dispatch); the Bid window's notes panel (`BidBoardNotesPanel`) gains **Ask the
  estimators** and **Ask Dispatch** beside **Note**. The send writes the request the header's
  *Message the Dispatch team* writes today, with the reference filled in, instead of a note. Nothing
  new to learn: the same box, one more word on it. (Draft 2 opened a sheet with three fields and put
  two Ask buttons under a card on every record; cut.)
- **The record reads it back as its log.** Notes and requests draw in one list by time: the ask is
  a line with *asked* on it and the answer sits under it with a green edge; while it waits the line
  is amber at the top with *waiting 2 days* and **Reply**. That is the history the owner asked for,
  with the question in it and the answer under it, written from the same box as the notes. A
  question asked on a bid shows in the log of the job it became, marked *asked on BP418*, one
  direction. The page's Questions card and **Ask a question** draw the same log and the same box,
  with an *about* (the site, or one piece from the list) that a bid or a job never needs.
- **The answer comes back** as the push the asker already gets, naming the record; the group's
  Needs you line for waiting requests names the site. No new Needs you source.
- **Kept**: the question and every reply stay on the record and in the development's What changed
  feed as two lines, the ask and the answer.

**Rejected.** A new `record_questions` table (a fourth internal lane beside the robots' questions,
the plans questions and the requests, with a fourth inbox nobody watches yet). Messages team notes
tied to a bid or a job (Messages is one thread per outside person; the estimator is not a contact,
and a question about a site has no customer to tie it to). A job note or a bid note (no *to*, no
open or closed, tells nobody; it is where an answer used to be retyped). A question to a named
person (the groups are the owner's words; a name can be in the text). A *Questions* card of its own
on every record with pills, a reply box and two buttons, and an Ask sheet with three fields (draft
2: a help desk inside a window; the record never shows the inbox's chrome).

## The owner's calls, answered 2026-10-28

Six calls, asked with the mock-up open, each answered as recommended the same day. The mock-up and
the train are drawn on them.

1. **Who answers.** The two groups, the estimators and Dispatch, as the lanes have today. A name can
   be in the text. (Not taken: a named person as a third *to*.)
2. **Who reads every question on a record.** The office set (dev, leader, assistant, controller)
   reads every question on a record; the estimators read those on bids and developments; a primary
   or superintendent reads their own, as today. (Not taken: only the asker, the group and a dev.)
3. **The estimator's door.** An estimator opens the page from a bid and sees the bids, the jobs'
   names and stages, the plans and the questions, with no money on the jobs, through the PR 6
   definer read. (Not taken: the page as the office's alone.)
4. **The suggestion by address.** Both: the line on Edit Bid and Edit Job when a saved address
   matches a development's members, and the page's *not in it yet* line with its one press. (Not
   taken: the page's line alone.)
5. **Since you looked.** On the device, like Messages' 7 days; no table, no write. (Not taken: a
   stamp per person in the database.)
6. **The plans line.** Built in PR 5 with the feed: the Plans card newest set first, and the line
   under it naming the records on an older set or none, with *Ask the estimators*. (Not taken: the
   list alone.)

**Open after the second pass (draft 3, 2026-10-28).** Three calls only draft 3 raises, each drawn
the recommended way and waiting on the owner's word:

7. **Where the ask lives.** The fourth kind in the record's own box (drawn), or a button of its own
   on the record. Recommended: the box, since the log it writes into is where the answer is read.
8. **Pieces or lists.** The Pieces table replaces the Bids and Jobs lists outright (drawn), or sits
   above them. Recommended: replaces; the boards keep their own columns a door away.
9. **The house line's words.** The site's pulse (*1 question waiting · new plans Oct 24*, drawn)
   or the counts (*5 bids · 6 jobs*, draft 2). Recommended: the pulse; counts never change and never
   pull.

## Where it plugs in

**Tables.** Exists: `developments`, `jobs_ledger.development_id`, `jobs_ledger.bid_id`,
`bids.address` and `jobs_ledger.job_address` (the match), `bids_submission_entries`,
`bid_changes`, `job_status_events`, `jobs_ledger_invoices`, `jobs_ledger_payments`,
`estimator_requests`, `dispatch_requests`, the two notes tables, `estimator_group_members`,
`dispatch_group_members`. New: `bids.development_id` (PR 1), `estimator_requests.development_id`
and `dispatch_requests.development_id` with the one-reference check (PR 4), the widened SELECT
policies (PR 4).

**RPCs.** New: `list_development_overview(p_development_id)` (PR 6, SECURITY DEFINER, the estimator's
read: bids under the bid policies, jobs as name · stage · last work · from bid, no money);
`put_in_development(p_development_id, p_bid_ids, p_job_ids)` (PR 3, SECURITY INVOKER, so the
caller's own update policies decide, one transaction, the count returned). Everything else is the
tables' own policies.

**Kernels (new, pure, with tests beside each).** `src/lib/developments/overview.ts` (the head's
counts, the people, the pulse line's words), `pieces.ts` (the rows: each bid paired with the job
it became through `bid_id`, the unpaired on rows of their own, the done fold, the plans cell with
*older* against the newest set, the Waiting cell from an open request, a billed job or a sent bid),
`whatChanged.ts` (the feed lines from the eight sources, newest first, the since line's place),
`plans.ts` (the newest set, who carries an older one or none, the plans request found by its
reference summary and its answer's names read against the pieces), `notInIt.ts` (shipped in PR 1;
the page's line reads it as it stands), `recordLog.ts` (notes and requests on a record as one list
by time, the bid's on its job, the open one first; the box's Ask writes the request's reference).
The bid picker reuses `jobDevelopments.ts` as it is.

**Pages and components.** New: `src/pages/DevelopmentPage.tsx` (PR 2) with `DevelopmentHead`,
`DevelopmentJumpStrip`, `DevelopmentPieces` (a table at desk width, cards at phone width),
`DevelopmentPlans`, `DevelopmentQuestions`, `WhatChangedFeed`. Changed: `BidFormModal` (the Links
row's picker, PR 1), `BidPreviewModal` (the house line, PR 1; its pulse and door, PR 2),
`useBidEditForm` (the field in the save pipeline, PR 1), the Bid Board row (the muted line, the
filter, PR 1), `JobFormModal` (New Job from a bid copies it, PR 1), `DetailJobModalCustomerPanel`
(the line becomes a door with the pulse, PR 2), `JobsStagesCommandBar` (the filter chip's door,
PR 2), `JobsGcReviewModal` and `DevelopmentsSettingsBlock` (doors, PR 2), `doors.ts` (the page door,
PR 2), `App.tsx` (the route, PR 2), `layoutRouteAccess.ts` (`/developments` for the office and the
estimator, PR 2), `JobCustomerSheet` (the Ask kind with its *to*, and the log drawing requests
beside notes, PR 4), `BidBoardNotesPanel` (the same two asks and the same log, PR 4),
`DispatchInboxSection` and `EstimatorInboxSection` (the reference chip and the door, PR 4), the
header's request modal (the development reference, PR 4).

**Docs and guides owed.** PR 1: the guide `group-jobs-into-a-development` amended to bids (its title
becomes *group bids and jobs into a development*, the slug stays), `GLOSSARY.md` → Development,
`BIDS_SYSTEM.md`, the migration doc. PR 2: a guide *see everything on a development in one place*,
`docs/twins/APP_DIRECTORY.md` (the page and its doors; `appDirectoryCheck.test.ts` holds it to the
route), `PROJECT_DOCUMENTATION.md`, `ACCESS_CONTROL.md` (who opens it). PR 4: a guide *ask the
estimators or Dispatch about a bid, a job or a development*, `ACCESS_CONTROL.md` (the widened
read), `GLOSSARY.md` → Dispatch requests and Estimator inbox, the migration doc. PR 5: the page's
guide gains *What changed* and *Plans*. PR 6: `EDGE_FUNCTIONS.md` is untouched (no function); the
RPC in the migration doc; the types PR after the push. Every PR: a release note and a
`docs/recent-features/` fragment.

## The plan

| PR | What | Migration | Size |
|---|---|---|---|
| 1 | `bids.development_id`; the Edit tab's picker beside Project; the Bid window's house line (a label until PR 2); the Bid Board row's line, search and house filter; New Job from a bid copies it; the forms' suggestion by address | `bids.development_id` + index + the same-master backstop | S |
| 2 | The page: route, head with the people and the counts, the jump strip, the Pieces table (cards on a phone), the doors (the Job window's and the Bid window's house lines with the pulse, the Pipeline filter chip, GC Review, Settings, the search box); the office's read under the tables' own policies | none | M |
| 3 | *Not in it yet*: the page's line with **Put the N in …** and **Not these**, one transaction | `put_in_development` | S |
| 4 | Questions: the reference on both request tables, the widened read, the Ask kind in the Job window's box and the Bid window's notes panel, the record's log drawing requests beside notes (the bid's on its job), the page's Questions card and **Ask a question** with its *about*, the inbox chip and door, the push naming the record | `development_id` on both tables, the check, the policies | M |
| 5 | What changed (the feed with the since line, kept on the device) and Plans (the card, its line, the plans request found by its reference summary and read back under the line and on the pieces) | none | M |
| 6 | The estimator's door: `list_development_overview`, `/developments` in the estimator's paths, the page's no-money view; then the types PR | the RPC | S |

Smallest shippable first: PR 1 alone lets the office mark the real site's 13 bids, and PR 2 gives
the owner the page he described. PR 3 fills it. PR 4 is the third piece and stands on its own. PR 5
is the owner's sentence about updates. PR 6 widens who opens it. Each PR is one change, one release
note, one fragment, armed with `gh pr merge --auto`; the three migrations push after their PRs
merge, PR 4's before the client that reads the new column deploys is fine (additive).

## How to verify

- **PR 1**, on a ZZ TEST bid: pick a development on the Edit tab, reload, the Bid window's house
  line reads it; New Job from the bid carries it into Edit Job's Development; the Bid Board's house
  filter narrows to it. Save a second ZZ bid with the first's address and no development: the form
  offers *Put it in …*; press it; the bid is in. Through the pooler, read-only:
  `select bid_number, development_id from bids where project_name like 'ZZ%'`.
- **PR 2**, as the dev on the dev server (`/dev-login?as=1&to=/developments/<the real site's id>`;
  a ZZ fixture exists since PR 1's walk: the development *ZZ Test development*
  (`be4449ca-64b4-4c42-8b89-21e0f0426989`) holds bid B398 *ZZ Test* and its job, both at
  5501 Balcones Dr, so the page can be walked on ZZ rows before the real site):
  the head's counts match the Pipeline's filter and the Bid Board's search for the address; the
  Pieces table pairs B398 with its job on one row (its `bid_id` set) and puts the unpaired on rows
  of their own; the house line on the ZZ bid and the ZZ job reads the pulse (*nothing waiting* until
  PR 4, the newest plan date once a plans link is filed) and opens the page; every door lands on
  the page; Back returns to where it came from; a phone width (375) shows the head, the feed, then
  each piece as a card, no sideways scroll; an archived development opens read-only. Reads only on
  the real rows; nothing pressed.
- **PR 3**, on the ZZ rows only: two ZZ jobs and one ZZ bid at one address, one of them in a ZZ
  development; the page says *2 not in it* with their names; **Put the 2 in …** puts them in, the
  line goes, the lists gain them; **Not these** hides the line for the device. Never press it on the
  real site: 33 live rows.
- **PR 4**, as Robert: in the ZZ job's box pick **Ask**, *to Dispatch*, type, send; the line sits
  amber at the top of the job's log with *waiting*; the request shows in the Dispatch inbox with the
  job's chip and *Open the development*; reply as a dispatch member (View as); the answer shows
  under the question in the job's log, in the log of the bid it came from (if any) and on the page's
  Questions card; close it with a note; the asker's push arrives (Settings → Notifications lists
  it). The ZZ bid's notes panel: **Ask the estimators** writes an estimator request, **Note** still
  writes a note, and the two draw in one list by time. Then as an estimator sample (`view_as`
  through dev-mcp, or the lens): the questions on the ZZ bid read, a job's do not.
- **PR 5**: file a plans link on a ZZ bid; the feed's top line is *New plans* with the count of
  siblings on an older set or none; the Plans card lists it first; the line under it names them; the
  device's *since* moves on **Mark as looked**.
- **PR 6**: `view_as` the estimator sample through dev-mcp on `list_development_overview`: the bids,
  the jobs as names and stages, no revenue, no open figure; the page draws for the sample estimator
  on the dev server with no money column.
- Always last: `npm run typecheck` read for `error TS`, `npm run lint`, `npm test`, and
  `npm run build` for PR 2 (a new route and page).

## Is this the best we can do? (the pass)

- **What a first-timer misreads.** *Development* beside *Project Name* on the bid and beside the
  Projects container. The picker sits beside Project on the Links row, each with its hint, and the
  page's second line says what a development is in one sentence.
- **What the leader needs to see first.** Not the lists: what moved since he last looked, and what
  is waiting on someone. The first draft led with the bids table; the feed moved to the top and the
  counts line says *1 question waiting*.
- **Tag or record.** A record, and it already is one. The mock-up adds nothing that would make it a
  tag again: the bid gets a foreign key, the page gets a route.
- **Dead on arrival.** The real site has 13 bids with no development and 20 paid jobs without it. A
  page that opens with 9 jobs and no bids is dead. So PR 1 ships the suggestion on the forms and
  PR 3 the page's *not in it* line with one press.
- **Does the question tooling duplicate Messages.** No, once it rides the request lanes: Messages
  stays the thread with people outside, the requests stay the asks between us. The first draft had
  a new table and a new inbox; cut.
- **What the rendered page caught.** The head said 2 open bids over a table of 3 and an open-bills
  figure no job carried; the plans line named one bid twice; a Dispatch question about the job sat
  on the bid as if asked there (a question shows on the record it was asked on and follows a bid
  onto its job, one direction); the *not in it* press sat inside the Jobs card and read as a
  jobs-only thing (its own line above the lists now); the Pipeline's house would filter while the
  window's house opened the page with nothing between them (the filter chip carries the door).
- **Left out on purpose.** A development on estimates and GC projects, money on the development
  itself, a timeline chart, scheduling by development, a robot that reads the site, a question to a
  named person. Each is a later card if asked.

### The second pass (draft 3, 2026-10-28)

The owner read draft 2 with PR 1 shipped, liked the What changed feed and the page, and did not
love the rest. Asked again whether it was the best we could do:

- **What draft 2 got wrong.** It drew the page as the Bid Board over the Pipeline, and the questions
  as a help desk: cards, pills, reply boxes, two Ask buttons on every record, a sheet with three
  fields. The owner liked the idea and not the thing. The idea was *everything in one place* and *a
  history*; the thing was two lists and a ticket queue.
- **Two boards became one table.** The thing no board can show is the row: this bid became that
  job, on this set, with this waiting on it. The Pieces table pairs them through `bid_id`, marks
  every older set against the newest, and carries a Waiting column (a question, a payment, the GC's
  answer). The boards keep their own columns a door away.
- **A question is history, not a ticket.** The owner's words were *make it a history of the
  development or bid or job*. A history is a log with the question in it and the answer under it,
  in the same list as the notes, written from the same box (the Job window's Note · Text · Email
  gains Ask; the Bid window's Note gains the two asks). The inbox is the answerer's view of the same
  row; the record never shows the inbox's chrome.
- **The house line earns its place.** A door that says *5 bids · 6 jobs* is a label. A door that
  says *1 question waiting · new plans Oct 24* is the reason to go, and costs one read of the
  requests and the newest plan date, both of which the page reads anyway.
- **Since you looked is a line in the feed**, not a filter with an *Everything older* link: one
  list, the new above the line, the seen under it.
- **Tabs that did nothing are gone.** Five tabs over cards that all showed anyway; a jump strip, as
  Messages has, over one page.
- **The plans loop closes on the page.** Draft 2 stopped at the ask. Now the Plans card finds the
  request its own press wrote (the set's date in the reference summary) and reads the answer back
  under the line, and the Pieces table's Plans cell reads the answer's names. A check per piece in
  its own table is the stronger version, a later card.
- **The phone.** The leader reads the site from a truck as often as a desk, and draft 2 never drew
  it: the head keeps its counts, the feed is the same list, each piece is a card.
- **What the rendered page caught this time.** The house line wrapped its name under the icon; the
  strip said *7 pieces* where the feed and the plans line said *3 bids and 4 jobs* (seven records on
  six rows); a sent bid had nothing in its Waiting cell while a billed job did.
- **What this draft does not solve.** The Plans cell is a reading of the estimator's prose, not a
  fact. The feed's *Their word* line is only as good as the customer thread's summary. A piece that
  is one bid and two jobs takes two rows.

## Where it stands

Planned 2026-10-28 in one sitting: the code and the live example surveyed, the three pieces weighed
against the nine question shapes, the mock-up drawn, critiqued once on the rendered page and
revised, shown to the owner in the browser pane, and the six calls answered by him the same day,
every one as recommended.

**PR 1 shipped the same day as v2.6019, #6376, its migration applied** (`docs/recent-features/v2.6019.md`,
verified live on the ZZ rows as that fragment records): the migration
`20261028170000_bids_development_id.sql` (the column, the partial index, and the backstop mirroring
the job's — a no-op under one company since v2.2984, and `bids` has no `master_user_id` to compare
against, so the trigger is kept as the hook and nothing more), the picker beside Project on Edit Bid's
Links row (`BidFormDevelopmentPicker` over `useDevelopmentPicker`), the house line on the Bid window
and the Bid Board row, the board's search and house filter (`src/lib/bids/bidBoardDevelopment.ts`),
New Job from a won bid copying the development, and the suggestion by address
(`src/lib/developments/notInIt.ts`, `useDevelopmentAddressSuggestion`,
`DevelopmentAddressSuggestionLine`) on Edit Bid and Edit Job. The guide is now *group bids and jobs
into a development*.

**The second pass, the same day.** The owner read draft 2 and liked the feed and the page, not the
rest; draft 3 redrew the page as one Pieces table with a Waiting column, put the Ask into the
record's own box with the answer under the question in its log, gave the house line the site's
pulse, drew the since line inside the feed, dropped the tabs for a jump strip, closed the plans
loop on the page, and drew the phone. Three calls are open on it (7, 8, 9 under *The owner's
calls*), each drawn the recommended way. The next session starts PR 2 from fresh `main` once they
are answered: the page, its head and strip, the Pieces table, its doors (the two house lines become
doors with the pulse, the Pipeline filter chip, GC Review, Settings, the search box), the route and
`APP_DIRECTORY.md`; PR 3's *not in it* line reads `notInIt.ts` as it stands.
