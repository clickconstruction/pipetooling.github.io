---
name: "GC mode: pick it up here"
parent: to-dos/gc-mode/README.md (punch list #81)
status: handed off 2026-10-05 by the Board lane at the owner's ask · the prototype is done (the Gantt's last rows 2026-10-06; PUNCHLIST.md is closed) · the owner said "the shape is settled" on 2026-10-06 and the real build started from `main` · **handed off again 2026-10-08 ~19:00 UTC** with doors 1, 2 and Owner Billing live, the trade portal real, the schedule through 6b · start at *Handoff, evening 2026-10-08* in `PLAN_2026-10-07.md` → Status, which names every open PR, the evening migration batch and the two yeses waiting on Grace
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
  `README.md` → *What the prototype has* walks every screen. The schedule is a whole Gantt: four
  rounds of helper sessions landed its last rows on 2026-10-06 (`HELPERS.md` says how they worked).
- **Every open question is answered** (`README.md` → *Open questions*, all 29).
- **The real build is paused (2026-10-07).** New project's real build is on `main` but step 7. The
  schedule's kernels and its first two migrations are on `main` and applied, and its PR 4 is open
  and held. *Pick up the real build* below has what was in flight, the test rows on prod and how
  the work was driven. `BUILD_MAP.md` is the plan for every lane and who builds what.
- **The branch must never merge.** It holds the fixture in the client, and it touches nine files of
  the app outside GC mode: `src/App.tsx` (the route), `src/pages/Bids.tsx` (the switch, dev only),
  `src/components/SpotlightTour.tsx` (walkthrough features, and `onStep` for the walk's tabs) with
  its test and snapshot, and the dashboard's Needs you (`src/lib/dashboardNeedsYou.ts` and its
  test, `src/hooks/useGcFollowUpNeeds.ts`, `src/components/dashboard/DashboardPinnedQuickRow.tsx`).
  The real build is new PRs from `main`.
- The branch is about 385 commits behind `main`; merge `origin/main` in before reading the
  dashboard files side by side.

## Start here

1. **Read**, in this order: this file; `README.md` (*The ask*, *The model, in one paragraph*,
   *What the prototype has*, *Decided by the owner*); *Pick up the real build* below; `BUILD_MAP.md` (the whole real
   build: the lanes, their order, who builds what); `NEW_PROJECT_REAL_BUILD.md` and
   `SCHEDULE_REAL_BUILD.md` (the two plans under way, each with its *Status*). `REMAINING.md` is the history of
   what each lane built, round by round.
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

## Pick up the real build (paused 2026-10-07)

The owner paused the build on 2026-10-07 and asked for this page so someone else can pick it up.
`BUILD_MAP.md` is the plan for every lane, and its section 1 says what is on `main`. This section
is what was in flight, what is on prod for the checks, and how the work was driven.

### In flight

| What | State at the pause | To finish |
|---|---|---|
| Schedule PR 4, clickconstruction/pipetooling.github.io#4835 (v2.4816, migration `20261007235500_gc_schedule_what_if_and_before`) | Open as a draft, its CI passed, auto-merge off. Turning auto-merge off alone did not hold it: the merge-conflict watcher re-armed it, so it was made a draft (`gh pr ready 4835 --undo`). Its SQL is byte for byte the approved plan, and `mockups/schedule-pr4.md` → *Status* says where it stopped. Its stamp skips three claims not merged at the pause (`20261007230000`, `20261007234000`, `20261007235000`). | First hold its stamp against `main`'s newest migration and any claim since. If a later stamp has been pushed, `db push` would refuse this one as out of order, so renumber it from a clean commit. Check its version the same way: v2.4816's claim file was swept once `main` reached v2.4817, which is harmless while v2.4816 is not on `main`, since no claim hands out a number below `main`'s newest. If it is on `main`, claim a new one and renumber. Then mark it ready with `gh pr ready 4835` and re-arm it with `gh pr merge 4835 --auto`. Once it merges, push its migration after PR 3's, run its doc's five verify steps and open the types PR (*How the work was driven*). |
| New project step 8b's check on prod | One question recorded on the test project ("Test Concrete Co, delete me", about S-102), not sent and not answered. The test architect, "GC Test Architects", has no email on record, so nothing can be sent yet. | Put an address the owner names on the test architect and get the owner's yes to send one email. Then press *Email it to GC Test Architects*, *Record the answer*, and issue a set that carries it (*Answers to carry in this set*). |
| Schedule PR 5, the RPCs | Not started. | Plan it in PR 2's shape. It must word two refusals before the tables refuse them: a template with no lines (`templateShape` has no guard) and a template whose weeks come out under one. |
| New project step 7, the set email | Waits on the company record (the Board lane's B1) and the portal's emails (P3). | Build it once both land. |

Helper 1, the only helper that ran in the real build, was told to stop at the pause and to say in
`mockups/schedule-pr4.md`'s *Status* exactly where it stopped. Helpers 2 to 5 were never opened for
the real build; their rows in `BUILD_MAP.md` section 3 are their briefs.

### Test rows on prod

Each is named so a sweep finds it, and none touches a real job:

- The project "GC test project, delete me" (`ef8905d1-039a-4cbc-9d69-9468cfea50e0`), with its
  customer, its architect "GC Test Architects", two sets of plans (Bid set and "Permit set, delete
  me"), five trades with their scope lines, and the test question.
- Its folder in the PipeTooling Jobs Shared Drive, with Plans and Team only inside.
- A scope set saved to the scope book from its Concrete scope.

No `gc_schedule_*` table holds a row: the schedule's checks rolled back or deleted what they wrote.
Whether to keep the test rows for the next checks or delete them is call 13.

### How the work was driven

- **Helpers.** A helper writes its plan on the spike (`mockups/<name>.md`, ending with "is this the
  best we can do?"). The lead gives the go, the helper cuts the PR from `main` and arms auto-merge,
  and the lead reviews it. For a migration the lead compares the PR's SQL with the plan's, byte for
  byte. After a lift merges, the helper writes the spike's follow-up commit, which deletes what moved
  and re-exports it from `main`. `HELPERS.md` is the brief, and `BUILD_MAP.md` section 5 has the rules.
- **Claim at the cut.** Run `npm run claim -- --branch <branch>` and
  `npm run claim -- --migration <file>` when the PR is cut, past `main`'s newest and past any claim
  not merged yet. A merge-conflict watcher session renumbers or rebases a PR that clashes in the
  queue and messages its owner. Take its force-push before committing more on that branch.
- **Push a migration** only once its PR is on `main`. Make a clean detached checkout
  (`git worktree add --detach <dir> origin/main`), copy `.env.local` in, symlink `node_modules`, and
  run `bash scripts/db-push.sh`. It pushes, regenerates `src/types/database.ts` and the dev-mcp
  catalog, and runs the drift check. Remove the symlink, commit the two generated files on a
  `claude/types-…` branch, and open the types PR with auto-merge. The next PR that calls the new
  names waits for it.
- **Verify a migration** with its doc's steps. Steps 1 and 3 went through the management API's query
  endpoint, the way `scripts/check-migration-drift.mjs` calls it: the policy catalog read only, and a
  training-mode user's insert inside a transaction that never commits. Steps 2, 4 and 5 ran from the
  app signed in as a dev, through the page's `supabase` client, against an id that matches nothing.
  Write what each step said in the migration doc's *Status*.
- **Deploy an edge function** with `supabase functions deploy <name> --project-ref
  yewfzhbofbbyvkvtaatw`, the management token as `SUPABASE_ACCESS_TOKEN`. Retry on a
  `TransportError`.
- **An email that leaves the company** needs more than its function, or CI fails as it did on
  #4815. It needs `file:` on `sendEmailViaResend` (the sent copy), an entry in `CUSTOMER_SURFACES`
  (`src/lib/customerSurfaceRegistry.ts`), a journey step with a sample email (`customerJourneys.ts`
  and `customerSampleEmails.ts`, both reading one builder in `supabase/functions/_shared/`), and an
  answer in `src/lib/journeys/personJourney.ts`.
- **Access at the pause.** The management token in `.env.local` covers the db push, the deploys and
  the verify queries; never print it or commit it. The dev-mcp read seat's key was revoked (it
  answers "Unknown or revoked dev key"), and the Supabase MCP needs authorizing.

## What is left

### 1. The owner's calls

Nothing in the real build starts before the first one.

| # | The call | Raised by | Where it stands |
|---|---|---|---|
| 1 | **"The shape is settled."** The gate for the real build (section 4). | The plan | Said 2026-10-06. The real build is open, in section 4's order. |
| 2 | ~~**Questions during construction (RFIs).** Its own tab? Trades ask from the portal? Needed 3 days before the work? A cost answer starts a change order in one click?~~ | Building | Answered 2026-10-05: **yes to all four.** Being built (section 2). |
| 3 | ~~**New Project's PR 1b**: lift the kernels added since PR 1 (the sheet table, the title block, budgets per square foot, the Drive link, the scope book) into `src/lib/gc/` with their tests. Pure code, no tables.~~ | New Project | Landed 2026-10-06 (clickconstruction/pipetooling.github.io#4687). |
| 4 | **Quo**: whether to build the calls-and-texts link at all (exploration so far); billed yearly or monthly ($23 or $33 a seat); Claude reading texts from the first day or later. Before building, ask Quo whether texts sent from its own phone app come back to us as events, and whether calls forwarded to a cell are still recorded and summarized. | New Project | Everything else decided. See section 5. |
| 5 | **The defaults he never confirmed**: `README.md` → *My defaults the owner has not confirmed* (about 30 rules), plus the lanes' timings below. | Every lane | Each is a constant in `src/lib/gcMode/`; change freely. |
| 6 | **Owner Billing's defaults**: bill day the 25th (monthly was confirmed, the day was not); retainage step from 50% at 5%; late interest 1.5% a month and the day it starts (check against Texas prompt pay); a payment reminder's pay-by 5 days out; stored materials billed at the trade's cost, our fee once installed; the notification timings (bill day minus 2 days; the architect reminded at 3 days, the project manager at 5; the customer 3 days before a bill is due; a Monday forecast email). The customer emails' wording has not been read by him. | Owner Billing | Defaults in the code. |
| 7 | **Building's defaults**: a milestone's grace 3 days, the daily log looks back 5 working days, reliability over 4 weeks, Starting soon at 14 days, a kept promise shows 7 days, our crew's stage shares (20, 35, 25, 20), calendar days on the schedule "for now". | Building | Defaults in the code. |
| 8 | **The Board's and the Portal's defaults**: a change request or a back-charge reads late after 7 days; a paper's day picks 3 days, a week or two weeks; a bench is deep at 3 companies that answer; a company should open the plans within 3 days. A trade has 5 days to answer a back-charge (`BACK_CHARGE_ANSWER_DAYS`), and one comes off an approved draw not paid yet. | Board, Portal | Defaults in the code. |
| 9 | **The portal's Spanish** read by a native speaker before it ships. | Portal | Someone he names, at production. The list is at the end of `PORTAL_SPANISH.md`. |
| 10 | **Two portal ideas offered and not picked**: "Your record with Click" and "Get paid early". | Portal | Open if he wants them. |
| 11 | **The schedule's real build**: the ten decisions in `SCHEDULE_REAL_BUILD.md`, each with a default, for the Gantt's three real-build rows (G-132 the tables, G-133 who may move a bar, G-134 two people on one schedule). | The Gantt | Taken at their defaults on 2026-10-07 while the build was driven, without asking the owner one by one. PRs 2 to 4 follow them. He can overrule any before PR 5 writes the RPCs. |
| 12 | **The GC entity's name**: `src/lib/gc/company.ts` carries the prototype's "Click Construction" and "Click" until the owner names it. The Pipeline's `GC_STATEMENT_COMPANY_NAME` is the plumbing company, not this one. | The schedule (PR 1b) | Open. A late notice's words read it. |
| 13 | **The test rows on prod**: keep them for the next checks or delete them (*Pick up the real build* → *Test rows on prod*). | The real build | Open. |
| 14 | **G-13's two defaults**: with one company picked, the pills count only that company's work; *The city* (the inspections) is in the company list, as By company names it. | The Gantt | Defaults in the code (`src/lib/gc/schedule/gantt.ts`, v2.4837). |

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
- **The Gantt**: nothing open. Four rounds of helper sessions built its last rows on 2026-10-06
  (`HELPERS.md`), and `PUNCHLIST.md` is closed for it; what is left is its real build (call 11).

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
- **The schedule lives in the session store**: no tables, anyone may move a bar, and only one
  person is ever on it. `SCHEDULE_REAL_BUILD.md` makes each real (G-132 to G-134).
  Every day is a working day by the owner's call (2026-10-05), not as a stand-in.
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
docs fragment and help guide (`CLAUDE.md`). `BUILD_MAP.md` maps the steps onto helpers, and its
section 1 says what is on `main`.

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
5. **Plans: sets, the email, who opened them**: `NEW_PROJECT_REAL_BUILD.md` holds its PRs in
   order, and its *Status* says which are in. Who to ask waits on the company record and
   invitations too.
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
9. **Building**: the schedule by `SCHEDULE_REAL_BUILD.md` (its tables, functions and PRs in
   order; our crew's count and percent from clock sessions and its Pipeline job, G-51, is its
   PR 16); the daily log, submittals, punch list and inspections (and questions during
   construction, yes to all four on 2026-10-05); files and photos in Drive.

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

- **`.proto` names on the spike.** Main owns the real paths of components the real build ported
  (New project's windows, and the Board's `GcBoardStages.tsx` and `GcPriceCard.tsx` since B3-a); the
  spike's forks carry `.proto` in their names and the spike's pages import those. A main merge takes
  main's file at the real path and a spike-only change goes in the `.proto` file.

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
  One word for each thing (*orden de cambio*, *documento para aprobación*, *cronograma*, usted
  throughout) is pinned by `gcSpanishVoice.test.ts`; change a word there, never around it.
- **Kernels moved to main live in `src/lib/gc/`.** Edit them there, never a copy in `gcMode/`.
- **The spike's New project windows carry `.proto` in their names** (`GcNewProject.proto.tsx`,
  `GcNewPlans.proto.tsx`, `GcNewProjectDriveLink.proto.tsx`) because main owns the real paths.
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

Handed off 2026-10-05. **Since then** (2026-10-05 and 2026-10-06, the owner's sittings): the schedule as a Gantt landed (`GANTT_PLAN.md`), its last rows in rounds one to four of the helper sessions (`HELPERS.md` says how), with the Ask window, Follow up's two views and a company's address. `PUNCHLIST.md` is closed for the Gantt. The real build started on 2026-10-06 and paused on 2026-10-07 at the owner's word (*Pick up the real build*). **Resumed the evening of 2026-10-07** with seven helpers under the lead session *GC spike*: `PLAN_2026-10-07.md` is the plan (lanes, doors, the day-by-day) and is newer than *Pick up the real build* where they differ.

Handed off 2026-10-05. Pick it up by reading *Start here*, then take section 1 to the owner. Each
real-build plan keeps its own status; drop a session card when a real-build PR starts
(`docs/SESSIONS.md`).
