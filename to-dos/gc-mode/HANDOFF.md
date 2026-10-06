---
name: "GC mode: pick it up here"
parent: to-dos/gc-mode/README.md (punch list #81)
status: handed off 2026-10-05 by the Board lane at the owner's ask, with each lane's open items · **2026-10-06: the open items are now kept in PUNCHLIST.md** (the Gantt landed 2026-10-05 and 2026-10-06; GANTT_PLAN.md and GANTT_FEATURES.md hold it) · the prototype is done enough to judge · every open question in README.md is answered · the owner has not yet said "the shape is settled", which starts the real build · on main only the plan kernels (`src/lib/gc/`, #4448)
summary: >
  What is left in GC mode and where to start, for someone new. The prototype plays the whole loop
  on made-up data (branch spike/gc-mode, page /bids/gc). Left: a short list of the owner's calls,
  some prototype work, what the prototype only pretends to do, and the real build in order.
---

# GC mode: pick it up here

GC mode is Bids turned around: we are the general contractor, and trades quote to us. The owner
asked for it on 2026-10-02 and has shaped it screen by screen since, in a playable prototype on
branch `spike/gc-mode`. Five sessions ("lanes") built it at once, each owning one area. This file is
what is left, gathered from every lane on 2026-10-05.

## Where it stands

- **The prototype plays the whole loop** on one fixture through one reducer: a new project and its
  plans, asking trades, their quotes through a portal, comparing, our bid, winning, award, papers,
  Get started, the schedule, the daily log, submittals, draws, billing the customer, closeout.
  `README.md` → *What the prototype has* walks every screen.
- **Every open question is answered** (`README.md` → *Open questions*, all 29).
- **Nothing real is built** except the plan kernels on main (`src/lib/gc/plans.ts`,
  clickconstruction/pipetooling.github.io#4448). No table, no email, no file storage.
- **The branch must never merge.** It holds the fixture in the client, and it touches seven files of
  the app outside GC mode: `src/App.tsx` (the route), `src/pages/Bids.tsx` (the switch, dev only),
  `src/components/SpotlightTour.tsx` (walkthrough features), and the dashboard's Needs you
  (`src/lib/dashboardNeedsYou.ts` and its test, `src/hooks/useGcFollowUpNeeds.ts`,
  `src/components/dashboard/DashboardPinnedQuickRow.tsx`). The real build is new PRs from `main`.
- The branch is about 137 commits behind `main`; merge `origin/main` in before reading the
  dashboard files side by side.

## Start here

1. **Read**, in this order: this file; `README.md` (*The ask*, *The model, in one paragraph*,
   *What the prototype has*, *Decided by the owner*); `NEW_PROJECT_REAL_BUILD.md` (the only real
   build plan written out). `REMAINING.md` is the history of what each lane built, round by round.
2. **Run it**: check out `spike/gc-mode`, `npm install`, `npm run dev`, open
   `http://localhost:<port>/dev-login?as=1&to=/bids/gc`. **Start over** (top right) resets the
   made-up data. A page reload resets it too: the state lives in one session store (`gcStore.ts`).
3. **Walk it** with *New here?* (the board) and *Walk me through this job* (inside a project), then
   `README.md` → *How to verify*.
4. **Test it**:
   - `VITE_SUPABASE_URL=http://x VITE_SUPABASE_ANON_KEY=x npx vitest run src/lib/gcMode src/components/gc src/lib/dashboardNeedsYou.test.ts`
   - `npm run typecheck` (vitest does not type-check; about 10 minutes on a busy machine)
   - `node scripts/theme-tokenize.mjs --check src/components/gc`
5. **Keep the rules** in `README.md` → *Working in parallel*: the golden test, shared files take
   additions only, new logic in a new file for its area.

## What is left

### 1. The owner's calls

Nothing in the real build starts before the first one.

| # | The call | Raised by | Where it stands |
|---|---|---|---|
| 1 | **"The shape is settled."** The gate for the real build (section 4). | The plan | Not said yet. |
| 2 | ~~**Questions during construction (RFIs).** Its own tab? Trades ask from the portal? Needed 3 days before the work? A cost answer starts a change order in one click?~~ | Building | Answered 2026-10-05: **yes to all four.** Being built (section 2). |
| 3 | **New Project's PR 1b**: lift the kernels added since PR 1 (the sheet table, the title block, budgets per square foot, the Drive link, the scope book) into `src/lib/gc/` with their tests. Pure code, no tables. | New Project | Waiting on his word, like PRs 2 and 3. |
| 4 | **Quo**: whether to build the calls-and-texts link at all (exploration so far); billed yearly or monthly ($23 or $33 a seat); Claude reading texts from the first day or later. Before building, ask Quo whether texts sent from its own phone app come back to us as events, and whether calls forwarded to a cell are still recorded and summarized. | New Project | Everything else decided. See section 5. |
| 5 | **The defaults he never confirmed**: `README.md` → *My defaults the owner has not confirmed* (about 30 rules), plus the lanes' timings below. | Every lane | Each is a constant in `src/lib/gcMode/`; change freely. |
| 6 | **Owner Billing's defaults**: bill day the 25th (monthly was confirmed, the day was not); retainage step from 50% at 5%; late interest 1.5% a month and the day it starts (check against Texas prompt pay); a payment reminder's pay-by 5 days out; stored materials billed at the trade's cost, our fee once installed; the notification timings (bill day minus 2 days; the architect reminded at 3 days, the project manager at 5; the customer 3 days before a bill is due; a Monday forecast email). The customer emails' wording has not been read by him. | Owner Billing | Defaults in the code. |
| 7 | **Building's defaults**: a milestone's grace 3 days, the daily log looks back 5 working days, reliability over 4 weeks, Starting soon at 14 days, a kept promise shows 7 days, our crew's stage shares (20, 35, 25, 20), calendar days on the schedule "for now". | Building | Defaults in the code. |
| 8 | **The Board's and the Portal's defaults**: a change request or a back-charge reads late after 7 days; a paper's day picks 3 days, a week or two weeks; a bench is deep at 3 companies that answer; a company should open the plans within 3 days. A trade has 5 days to answer a back-charge (`BACK_CHARGE_ANSWER_DAYS`), and one comes off an approved draw not paid yet. | Board, Portal | Defaults in the code. |
| 9 | **The portal's Spanish** read by a native speaker before it ships. | Portal | Someone he names, at production. The list is at the end of `PORTAL_SPANISH.md`. |
| 10 | **Two portal ideas offered and not picked**: "Your record with Click" and "Get paid early". | Portal | Open if he wants them. |

### 2. Prototype work still open

Finished on 2026-10-05 at the owner's ask ("help me finish the Prototype work still open"), by the Board while the Building, Portal and Owner Billing lanes were not running. What stays open is named in its line.

- ~~**Portal: look at its newest screens**~~ done 2026-10-05 by the Board, at a desk width and at
  375 px: Known exclusions and the exclusions form, the customer words, the dates and the late chip,
  the quotes-wanted day, *A trade asks for a change*, *Charges from Click*, *Who gets our emails*
  and *Your weeks*. Nothing runs past the frame or widens the page. *Your weeks'* overlap warning
  stays test-only: the made-up data has one job with a schedule, and a second job being built would
  move every lane's numbers.
- ~~**New Project: amend `NEW_PROJECT_REAL_BUILD.md`** before PR 2's migration~~ done 27456635d:
  the scope book's tables (PR 2, its page a new PR 4b), the Drive link on `gc_plan_sets` and the
  `gc-drive-access` check (PR 5), set kinds (PR 3), *We work for* (PR 2), and PR 1b's kernels.
- ~~**Building**: Questions during construction (call 2)~~ done: the **RFIs** tab, the portal's
  *questions about the plans*, and **Start a change order** (`gcBuildingRfis.ts`; README → *What
  the prototype has*). Not built yet: a ring card line, a Follow up reminder to the architect, the
  weekly report's mention, and the hold drawn on the schedule's bar (each would move every lane's
  snapshots, so they wait for the real build or the owner's word).
- ~~**The architect's portal** has no answer box~~ done 28d2ca53d: each question has one, sent
  through `answerQuestion` to every company on the trade.
- ~~**Owner Billing**: the payment reminder has no golden step~~ done 28d2ca53d (its own test from
  the start, since the walk's late bill gets a promise first); ~~Their messages shows only the
  latest weekly report~~ done 28d2ca53d (every send is kept; the portal shows the newest).
- **Board**: nothing open.

### 3. What the prototype only pretends to do

The real build has to make each of these real, or decide not to.

- **Nothing is sent.** Every email is written and shown (Their messages, the send views, the
  Follow up draft), never sent. "From me" opens the user's own mail or Messages (`mailto:`,
  `sms:`); "from Click" only logs. Every lane's notification table in `README.md` → *Workflow steps
  not built yet* says who would hear what. Email only, through Resend (question 29).
- **No files.** Plans are stand-in drawings; submittals, back-charge photos, quote files and papers
  are names only; the daily log has no photos. The owner's call: files live in Google Drive.
- **Made-up contact details.** A company's phone and email are made up until its record has them
  (`partnerReach`).
- **The schedule counts calendar days**: no workdays or holidays. Moving a date pushes what follows
  and never pulls it earlier. The projected finish has no weather or crew-size allowance.
- **Typed by hand where the app already knows**: our own crew's percent (the real build reads its
  Pipeline job), its head count on the daily log (clock-ins), the weather, a delivery arriving.
- **Past jobs** a new project's budget reads are the prototype's own; the real build reads closed
  GC jobs.
- **Plans in Drive**: the link check is a stand-in (`driveAccessStandIn` knows two made-up links;
  any other reads as open). The real check opens the link with no Google sign-in (PR 5). *Drop the
  plan PDF here* is switched off ("Coming soon", the owner's call); the made-up PDF demo stays. A
  PDF's sheet list is read only from a text layer, so a scanned set with no text is not read (no
  OCR).
- **The map** draws from a short list of towns; the real build uses the Bid Board's map.
- **Money stand-ins** (Owner Billing): general conditions count at budget and contingency as not
  spent, with no actuals; our crew counts at its price, not its Pipeline cost; late interest runs
  from the first promise or the day we expected the bill, a stand-in for the contract's due day;
  the forecast assumes trades ask by bill day.
- **The pay application files**: the notary block is blank lines; no unconditional waiver's signing
  day is kept (`Draw.unconditionalOn` was asked for).
- **The dashboard's Needs you lines** read the prototype's session store. The real build reads the
  real follow-ups, change requests and back-charges.

### 4. The real build, in order

`README.md` → *The plan* has the order and *Where it plugs into the app that exists* says what to
reuse; do not build a second system for any of them. Each step ships alone with its release note,
docs fragment and help guide (`CLAUDE.md`).

1. **Schema from the model.** `gcTypes.ts` is the first sketch of the tables. New Project's tables
   and RPCs are written out in `NEW_PROJECT_REAL_BUILD.md` (its five decisions taken). Building's:
   daily logs; schedule activities with a baseline snapshot; inspections with their failures; punch
   items; submittals and their rounds; RFIs; the trades' pay applications on draws, with stored
   materials per line; weekly reports. Owner Billing's: our pay applications (worth by line, done to
   date, stored by line, the retainage step, the certificate, payments, promises, reminders),
   interest bills, the customer's acceptance, and on the project the signed worth, retainage step,
   late interest, late finish and change orders. The Portal's back-charges, change requests and a
   company's people. Every table: RLS and both read-only block calls.
2. **The kernels with their tests**, moved to `src/lib/gc/` the way `plans.ts` was: Building's
   (`gcBuilding*.ts`, `gcPriceStanding`, `gcFollowUpSheet`, `gcBuildingWeekly`), the Board's
   (`gcBids`, `gcFollowUp`, `gcProjectPeople`, `gcCompanyPeople`, `gcStart`), Owner Billing's
   (`gcOwnerBilling*.ts`), the Portal's (`gcPortal.ts`).
3. **The board and one project, read only**, on real data, behind the dev gate.
4. **Invitations and the company portal**: the sub portal's pattern, keyed to a company instead of
   a person (`docs/SUB_PORTAL_ARCHITECTURE.md`). `portalLink(partnerId)` is one link per company
   with no password, and every portal read takes the company (`portalHome`, `portalAsks`,
   `portalPay`, `portalWeeks`, `portalMessages`). Each trade-side write, the `trade*` actions in
   `gcTypes.ts` (about twenty: quote, promise, question, sign, draw, pay application, waiver,
   look-ahead, punch, submittal, insurance, vetting form, language, change request, back-charge
   answer, people), becomes an RPC or edge function checked against the company's link. The
   emails are ready for Resend: `portalMessages` gives subject, lines, kind, recipients and
   language; `mailRecipients` gives who gets each kind. Printing goes through `printPortalHtml`.
5. **Plans: sets, the email, who opened them**: `NEW_PROJECT_REAL_BUILD.md`. PR 1 is merged
   (#4448). Next PR 1b (call 3), then PRs 2 and 3 (the migrations), 4 (New project steps 1 to 4 on
   real data, dev only), 5 (Drive: the folders and the link check), 6 (a new set), 7 (the set email, after the
   company record and invitations), 8 (questions), 9 (the plans window). Who to ask waits on the
   company record and invitations too.
6. **Compare, carry, our number.**
7. **Award, master agreement, statement of work, Get started.**
8. **Draws and waivers**, then **billing the customer**: the app's AIA template
   (`public/templates/aia-g702-g703-mission-hills.xlsx`) through `fillAiaG702G703Workbook`, which
   must learn more than one 703 line, the notary and "TO CUSTOMER" (the prototype's
   `gcPayAppFile.ts` writes rows 13 to 46 itself); a sent bill becomes a bill on the customer
   portal's statement (Stripe pay link, bank transfer) and payments go through the existing
   recording; promises and reminders map onto the Pipeline's payment promises (v2.3280 to 3286)
   and its chase loop; our waivers use the lien waiver train's four forms (`LienReleaseStepRow`);
   Money and margin stay the owner's and the controller's.
9. **Building**: the schedule, daily log, submittals, punch list and inspections (and questions
   during construction, yes to all four on 2026-10-05); our crew's count and percent from clock sessions and its
   Pipeline job; files and photos in Drive.

Access (question 9): an assistant follows up the same way an estimator does; awarding stays with an
estimator; money stays with the owner and the controller.

### 5. Calls, texts and big files (Quo): decided, nothing built

The owner took a design on 2026-10-05 (`README.md` → *Calls, texts and big files*, mock-up
`quo-messages-mockup.html`): one company number on Quo Business with two seats, every call recorded,
threads tied to a job by dragging a job onto a message, everyone sees every thread, a Customers tab
in Bids, calls and texts mixed into the Pipeline's Job activity later, and a file agent that files
big files and photos into the job's Drive folder. Open: call 4 above, and how the file agent reads
bids@ (a Gmail grant in the admin console, or bids@ forwarding a copy). Drive itself needs nothing:
uploads work through the "PipeTooling Jobs" Shared Drive since 2026-08-29
(`docs/DRIVE_INTAKE_SETUP.md`). It is its own build, after or beside the real build.

## Gotchas

- **The golden test** (`src/lib/gcMode/gcModel.test.ts`) pins what the model says after each step
  of a scripted walk. It must pass without `-u`. A moved snapshot is a behavior change: only with
  the owner's OK, and the commit names which. Add steps only at the very end of `STEPS`; one
  inserted mid-walk renumbers everyone's. Re-pin one step with `-u -t "<step name>"`. On a merge
  conflict in it, put the other side's steps first and yours after, rebuild the snapshot from
  theirs with `-u`, then read the diff.
- **A new line on a project's ring card** (`stageProgress`) moves every lane's snapshots. That is
  why the weekly report and back-charges have none.
- **The fixture's today is Friday 2026-10-02**, so Friday-only things (the weekly report) are live.
  On purpose: Fair Oaks D has no daily log for Sep 30, its service inspection failed with the
  re-inspection today, Pecan Valley's insurance ran out (which locks approving its draws), Iron
  Horse has a $1,250 back-charge, and Cibolo's pay application 3 is two days past its Sep 30
  promise. Bill day is Oct 25.
- **Words**: "customer" on screen, `owner` in code (Round 6). A trade gives a quote; we give the
  customer our bid.
- **Read the price through `ownerContractWorthOf`**, never `proposalTotals`: it freezes when the
  customer signs. A sent bill keeps what it went with; rebuild a form from the record.
- **Import loops**: `gcOwnerBilling` reads `gcBuilding`; `gcBuildingSchedule` reads
  `gcOwnerBilling`. New logic goes in a new file. `gcPayAppFile.ts` stays out of the barrel (it
  pulls in the real Excel filler).
- **The barrel** (`gcModel.ts`): two lanes adding a line at the end conflict on merge; keep both.
- **`useAuth` throws outside its provider**, so the Follow up sheet and the weekly report wrap it
  (`useMeName`).
- **`exactOptionalPropertyTypes`** and unused imports fail only in `tsc`, not vitest.
- **The browser pane**: sign in with `/dev-login?as=1&to=/bids/gc`; reload after a resize; when the
  pane is hidden, animation frames stall, so click through JavaScript. Never press a "from me"
  Send or Call in a test: it opens Mail, Messages or FaceTime.
- **A trade never sees our price to the customer.** A change request shows its share as "Your
  part"; a test guards it.
- **Portal emails**: a new message builder starts with the standard hello line, so it is
  re-addressed to the right people; a new message kind goes into `KIND_GROUP` in `gcPortal.ts` (its
  type makes you).
- **Spanish**: *cotización* and *orden de trabajo* are feminine, *contrato maestro* masculine
  (fírmela, fírmelo); the office's typed notes go in as typed. After any word change, redraw the
  native speaker's list with `to-dos/gc-mode/portal-spanish-list.ts` (how to run it is at its top).
- **Kernels moved to main live in `src/lib/gc/`.** Edit them there, never a copy in `gcMode/`.
- **The quote's due day** (`quotesWantedOn`) is the day questions close (`questionsCloseOn`), and
  the portal's `portalQuoteDue` follows it.
- **Walkthroughs anchor to words and `data-tour` names**: New project's "+ New project", its five
  step names and "Create the project" stay as they are, or *New here?* loses its stops.
- **pdf.js**: open with `getPdfLoadingTask` and close with `task.destroy()`; `Array.at` is not in the
  build's target.
- **Phones**: a bare file input will not shrink below about 300 px and a chip that does not wrap
  widens the page; use width 100% with minWidth 0, and `PortalTag` for anything sentence-like. The
  portal frame is `data-theme="light"` with its own paper look.
- **Never run `prettier --write`**: the repo has no config and it rewraps whole files.
- **Ports**: each lane had its own (`README.md` → *Working in parallel*); `.claude/launch.json` is
  gitignored and lives in the main checkout.

## Who reads whose code

Tell the owner before changing one of these; another area reads it.

| Kernel | Owner | Read by |
|---|---|---|
| `drawPayDays`, `projectedFinish` | Building | Owner Billing |
| `substantialCompletionOn` | Building | New Project, Owner Billing |
| `partnerReach`, `telHref`, `followUpPeople`, `followUpDraft` | Building | Board |
| `buildingActivity` | Building | Board (a company's Activity) |
| `submittalRowsOn`, `onSite`, `scheduleRows`, `inspectionItems`, `activityName` | Building | Portal (`portalWeeks`) |
| The weekly report's subject and body | Building | Owner Billing (Their messages) |
| The `charge` link on Draws | Building | Board (Needs you) |
| `backChargesToAct`, `backChargeState`, `backChargeDraws` | Portal | Board, Building |
| `mailRecipients`, `portalMailGroup`, `contactGets` | Portal | Board (About, Follow up's Email) |
| `openChangeRequests` | Portal | Board, Owner Billing |
| `payReminderStep`, `payReminderEmail`, `latePayApps` | Owner Billing | Board (a customer's Documents) |
| `allJobsMoney`, `GcOwnerBillingMoney` | Owner Billing | Board (the Money tab) |
| `allPeople`, `projectPeople` (the people-to-call count) | Board | Building (the Follow up sheet), the dashboard |
| `quotesWantedOn`, `questionsCloseOn` | New Project | Portal (`portalQuoteDue`) |
| The kernels in `src/lib/gc/` | New Project | `gcNewProject.ts`, `gcPlans.ts` (they re-export them) |

## Status

Handed off 2026-10-05. **Since then** (2026-10-05 and 2026-10-06, the owner's sittings): the schedule as a Gantt landed (`GANTT_PLAN.md`), with the Ask window, Follow up's two views and a company's address; what is left is kept in `PUNCHLIST.md`, which is where to start now.

Handed off 2026-10-05. Pick it up by reading *Start here*, then take section 1 to the owner. When
the real build starts, put its branch here and drop a session card (`docs/SESSIONS.md`).
