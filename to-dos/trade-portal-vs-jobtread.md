---
name: "The trade partner's portal beside JobTread's job portal: what to borrow"
number: 205
group: ready
status: the owner marked all five rows build on 2026-11-08 (row 5 as the Directions link only, the map canvas and the weather off; every trade's bars stay off) · PR 1 of six, the Directions link, built as v2.6701 · PRs 2 to 6 designed down to the file in the Build brief below, ready for any session to build in order
summary: >
  On 2026-10-27 the owner worked as a sub on another GC's job and saw JobTread's job portal. The
  question back was whether our subs have a job portal. They do, since v2.4920: one link per
  company, flow first. This card puts the two side by side and names five things worth borrowing.
  Each has a decision row for the owner.
next: A session builds PRs 2 to 6 from the Build brief, one PR each, stacked in order (the job head, the whole-job stages fold, the files list with Send Click a file, the thread with its reply box, Word to every trade). It claims a version per PR with `npm run claim`, drops a session card, and names in its wrap-up which function to deploy and which migration to push after each merge. The coordinating session deploys and pushes.
size: S for the Directions link (built), the job head, the files list and the whole-job stages · M for the thread with its reply box · S for the word to every trade after it
blocker: none for the build. A dev still makes every link until the trade wave, and Spanish stays behind PORTAL_SPANISH_ON.
ver: v2.4920 · 5044 · 5048 · 5198 · 5200 · 5201 · 5315 · 5331 · 6701
opinion: your call — the thread with its reply box and the job head are what a sub feels every week; the map canvas, the forecast and a files bucket are looks.
mockup: trade-portal-vs-jobtread-before-after.html
---

# The trade partner's portal beside JobTread's job portal: what to borrow (#205)

## The ask

The owner, 2026-10-27, worked as a sub on another GC's job and opened that GC's JobTread portal.
The question back to us was whether our own subs have a job portal like it.

The answer is yes. A trade partner company has had one no-password link across every project
since v2.4920. It opens on **Where you are with Click Construction** since v2.5315. This card
puts the two side by side and names what is worth borrowing. Each piece ends in a row for the
owner.

## What JobTread shows a sub, per job

JobTread gives a sub one portal per job, with five tabs.

- **Dashboard.** Action items, which read *You're all caught up* when there are none. The job's
  start and end with a progress bar, 0 of 42 tasks done. The GC's contacts, each with a Call
  button and a Message button. A message box addressed to the GC. The activity feed of message
  threads. The job's address on a map. An hourly and a 7-day weather strip.
- **Plans.** A plan viewer with the job's parameters.
- **Schedule.** The whole job's task list grouped by phase. Preconstruction, Sitework,
  Foundations and Slab, Building Shell, MEP Rough-In, Interior, Exterior Sitework, Closeout.
  Each task has a start, an end, its days, a Milestone tag and its assignees.
- **Files.** Upload, a list or a grid, filtered by type. Documents, Daily Logs, Tasks, image,
  video, PDF, Excel, Word.
- **Messages.** An inbox per job with Inbox, Unread, Sent and search. The GC sent one thread,
  *Prioritization*, to every trade at once. The replies sit in the thread.

## What ours shows

Ours is one link per company, not one per job. The link opens without a password and holds
every project the company has with us. The sample is `/t/sample`.

- **The home** opens on **Where you are with Click Construction**. Getting set up comes first,
  then each job the company is asked on, as steps. A step on the company says why and has its
  press. Under it sit **Needs you**, **Your paperwork with Click** and **Who gets our emails**.
  **Before** holds what ended.
- **A project page** shows the latest plans and the questions about them. It shows the lines
  the quote should cover, the quote form and **Who to call**.
- **A job being built** opens on **Your schedule on this job**. The company's own bars sit
  between the work right before and right after. Other companies show by name and never by
  price. Under each of its own bars is **We will be late**. Then come **Your dates moved**,
  **Your next three weeks** and the crew count. Then the statement of work, signed from
  clauses. Then report your work and get paid, with each line's percent, the punch list, the
  submittals it owes, the pay application and the draws. Then its questions, the charges from
  us, the changes it asked for and **Who to call** with Call, Text and Email.
- **Its papers** are the vetting form, the master agreement, the W-9 and the insurance
  certificate.
- **Messages from Click** is a read-only list of the emails we sent the company. The company
  answers by email or by text, and the office reads the answer on Messages.
- **Files** ride records only. A quote's file, a change's photo, a submittal's file and the
  certificate each go into the job's Drive folder.
- Spanish stays behind `PORTAL_SPANISH_ON`.

The two differ in shape before they differ in features. JobTread's sub sees one job at a time
and the GC's whole crew on it. Ours sees every job it has with us, and in detail only its own
work. That shape stays. Every row below borrows inside it.

## The gaps to weigh

Each row says what JobTread has, what ours has, what already exists in the repo and what would
be new. Then the trade-off and a recommendation. The decision line at the end of each row is the
owner's.

### 1. A job head on the job page

**JobTread.** The Dashboard tab opens on action items, the job's dates with a progress bar and
the GC's contacts with doors.

**Ours.** The same facts sit in three places. Needs you is on the home, for every job at once.
Who to call is at the foot of the job page. The job's dates and its progress are nowhere on the
portal. The job page opens on the schedule.

**Exists.** Needs you and its job ids: `portalTodos` in `src/lib/gc/portal.ts`. Who to call:
`portalContacts` over `project_superintendents` and the project manager, with `tel:` and
`mailto:` links. The job's start: `gc_projects.start_date` and `started_on`. The planned finish:
`projectedFinish` in `src/lib/gc/schedule/schedule.ts`. The company's own percent per line:
`gc_sow_line_reports`, already on the slice.

**New.** A head strip at the top of the job page. The start, the planned finish and the days
left. One progress bar from the company's own lines, weighted by each line's amount. Who to call
moved up under it. The Needs you lines for this job, under the head. Client only but for the
finish. The function adds the finish from the schedule read it already makes.

**Trade-off.** The whole job's percent would name the other trades' pace, which the schedule
never leaks. The company's own percent names only its own.

**Recommendation.** Build it. Size S.

**Decision.** Build the job head? *Yes / later / drop.* Whose percent on the bar: *the company's
own lines / the whole job's.*

### 2. A message thread with a reply box, and a word to every trade on a job

**JobTread.** A box on the Dashboard addressed to the GC, and an inbox per job. The GC wrote one
thread to every trade on the job, and each answered in place.

**Ours.** Messages from Click lists what we sent, read only. The company answers from its email
or by text. The office reads the answer on Messages, where a trade partner company and its
people are contacts since v2.5559. The portal's own asks are typed, not free. Ask Click a
question makes an RFI. Dispute it, Ask for a change and We will be late each carry their own
words.

**Exists.** The customer's page has this already since v2.5331. `PortalGcMessages.tsx` draws
the thread with its box. `_shared/gcPortalThread.ts` reads the customer's lines and writes a new
one as a line on Messages, with an hourly cap. `submit-portal-request` takes the kind
`portal_message`. The company's sent emails are `gc_trade_messages`. One email to many
companies: `gc-trade-email` sends by kind to who the company ticked. Tell the trades already
sends a move to every company at once.

**New.** A `thread` on `gc-trade-portal`'s answer, keyed by the company's contact row, the same
shape as the customer's. A `portal_message` kind on `submit-gc-trade-portal` that writes the
company's line to its thread on Messages. The portal's Messages tab becomes the thread, ours and
theirs, newest last, with the box under it. A **Word to every trade** press on the project's
card. It sends one email per awarded company through `gc-trade-email` and keeps each in
`gc_trade_messages`, so each company's thread shows it.

**Trade-off.** A second inbox the company must open loses messages. The thread here is the same
lines the office reads on Messages, so nothing is lost either way. The company keeps answering
by text if it likes. The broadcast is a press the office makes by hand today, one company at a
time.

**Recommendation.** Build the thread and its box. Size M. Then the word to every trade. Size S.

**Decision.** Build the thread with its reply box? *Yes / later / drop.* Build the word to every
trade on a job? *Yes / later / drop.*

### 3. The company's files on a job

**JobTread.** A Files tab per job. Upload anything, see it as a list or a grid, filter by type.

**Ours.** A file rides the record it belongs to. The quote, a change, a submittal and the
certificate each take one. Each lands in the job's Drive folder, under Submittals or under Team
only, From trades, the company's name. The plans are a Drive link per set. The company has no
list of what it sent us.

**Exists.** `gc_trade_files` keeps every upload with its purpose, its job, its name and its
Drive link. The picker, `GcTradePortalFile.tsx`, takes a PDF or a photo up to 10 MB. The plan
sets carry their links. The flow already reads the company's waiver uploads from the same
table.

**New.** A **Your files on this job** block under the statement of work. It lists what the
company sent, by purpose, with each file's Drive link, and the plan sets we sent. One more press,
**Send Click a file**, with a one-line note, for a photo or a ticket that belongs to no record.
It lands under From trades with the note as its name. The office sees it on the company's card,
where its other uploads already show.

**Trade-off.** A free bucket needs someone to sort it. A list of what went each way needs
nobody. The free press is the one thing a sub in the field wants that ours refuses today. Today
that photo becomes a text.

**Recommendation.** Build the list. Size S. Build the free press with it, since it reuses the
picker and the folder.

**Decision.** Build the files list? *Yes / later / drop.* With the free press? *Yes / no.*

### 4. The whole job's schedule

**JobTread.** The Schedule tab lists every task on the job, by phase, with dates, days,
milestones and who does it.

**Ours.** Your schedule on this job shows the company's own bars, the work right before and the
work right after. Other companies show by name, never by price. A third company never reaches
the answer, and a test pins that. The customer's page shows the whole job as stages with a
percent and the milestones since v2.5198.

**Exists.** `customerStages` and `milestoneRows` in `src/lib/gc/schedule/customerSchedule.ts`
draw the whole job by stage for the customer. The edge already mirrors them in
`_shared/gcKernels/`, and `customer-portal` sends them. The trade's chart is
`_shared/gcTradePortalSchedule.ts`.

**New.** A **The whole job** fold under the company's chart. It draws the customer's stages, the
milestones and the planned finish, with the company's own bars lit inside their stage. The
function adds the stage rows to its schedule answer. No company name beyond the neighbours it
already shows.

**Trade-off.** JobTread names every trade because its subs are the GC's whole crew. Ours was
built so one trade never reads another's dates in full. The stage view gives the sub the shape
of the job without that. Showing every trade's bars by name is a rule change, and the office's
call.

**Recommendation.** Build the stage fold. Size S. Keep every trade's bars off, as the rule
stands.

**Decision.** Build the whole-job stages fold? *Yes / later / drop.* Show every trade's bars by
name? *No, keep the rule / yes, change it.*

### 5. The map and the weather

**JobTread.** The job's address on a map, and the weather for the hour and the week.

**Ours.** The address is one line at the top of the job page. The app draws Google Maps on the
Dashboard and on Jobs, with OpenStreetMap when the key is refused. The portal draws none. The
daily log records the sky and whether work stopped for it. Nothing reads a forecast.

**Exists.** The directions link: `directionsUrlForAddress` in `src/lib/fieldJobLookup.ts`
builds a Google Maps directions link from an address, with no key. The map canvas:
`PinsMapGoogleCanvas` with `VITE_GOOGLE_MAPS_BROWSER_KEY`, whose referrers cover
clicktooling.com.

**New.** A **Directions** link beside the address. Nothing else for the map. A forecast would be
a new read from the National Weather Service. It is free and needs no key. It reads by the
job's latitude and longitude. That needs the address geocoded once per job and the forecast
cached for an hour. A new edge read, and a column or two.

**Trade-off.** A sub taps the address into its phone today. A map canvas on the portal costs a
load per open and shows what the phone shows. The weather strip is the one that could inform a
choice, the people a day on site in Your next three weeks. It is also the one new outside
dependency to keep up.

**Recommendation.** Build the Directions link now. Size S. Leave the map canvas. Put the
forecast beside the look-ahead later, if the owner wants it there.

**Decision.** Build the Directions link? *Yes / drop.* The forecast beside Your next three
weeks? *Later / yes / drop.*

## Where it plugs in

- The page: `src/pages/GcTradePortal.tsx` over `src/components/gc/GcTradePortal*.tsx`. The
  job page is `GcTradePortalJob.tsx`. The chart is `GcTradePortalSchedule.tsx`. The home is
  `GcTradePortalView.tsx`, which also draws Messages from Click.
- The read: `supabase/functions/gc-trade-portal/index.ts`, with `_shared/gcTradePortalSlice.ts`
  for what a company may read. The write: `submit-gc-trade-portal`.
- The customer's thread, to copy: `_shared/gcPortalThread.ts`, `src/lib/portal/portalThread.ts`
  and `src/components/portal/PortalGcMessages.tsx`.
- The emails: `gc-trade-email` and `src/lib/gc/tradeEmail.ts`.
- The guides to amend: `share-a-trade-partner-its-portal` and
  `see-what-a-trade-partner-sends-from-its-portal`. The directory: the `/t/:token` entry in
  `docs/twins/APP_DIRECTORY.md`.
- The sample: `_shared/gcTradePortalSample.ts`. Every new block gets its sample rows, so What
  customers see shows it.

## Build brief (hand-off, 2026-11-08)

Written by the session that built PR 1, for the session that builds the rest on another machine. Everything
below was read against the code on 2026-11-08. Start with `CLAUDE.md`, then this section; the rest of the card
is the why. PR 1 is v2.6701 (`claude/205-pr1-directions`): the Directions link, the pure `src/lib/directionsUrl.ts`
that `fieldJobLookup.ts` re-exports, and the `directions` key in `portalI18n.ts`. Build PRs 2 to 6 from
`origin/main` once it merges, each stacked on the one before, one `npm run claim` each.

### Rules found the hard way

- **The portal page never imports the Supabase client.** `fieldJobLookup.ts` sits beside modules that do, so the
  Directions helper moved to its own pure file. Anything new the portal draws from must be pure the same way.
- **A worktree has no `.env`**: the portal render tests throw *Missing VITE_SUPABASE_URL* until
  `ln -s ../../../.env .env && ln -s ../../../.env.local .env.local` in the worktree (both gitignored).
- **Do not touch the copy of the kernels** (`supabase/functions/_shared/gcKernels/`, generated from `src`). A change to
  any file in it, or to an export line in its index, regenerates and makes `check:edge-drift` name every one of its 32
  importers for redeploy. Every PR below is designed so nothing in the copy changes: the extra fields ride on types
  declared in `_shared/gcTradePortalSchedule.ts`, and the new kernels import only what the copy's index already
  exports (`customerSchedulePicture`, `portalSchedule`, `withScheduleRows`, …). `portal.ts`, `portalSchedule.ts`,
  `customerSchedule.ts`, `gantt.ts` and `draft.ts` are all in the copy, so no new export is added to them either.
- **The chart's never-list** (`src/lib/gc/tradePortalSchedule.test.ts`, `NEVER`) plants the third company's bar label
  *Rough-in*, which is also a stage's label (`SCHEDULE_STAGES` in `draft.ts`). PR 3's stage rows legitimately carry
  the word, so rename the planted bar (`LINES`' `sE1`) to something no stage is called, like *Panel and branch circuits*,
  and keep the never-list whole.
- **The slice's field list is reviewed**: a column added to `TRADE_PORTAL_FIELDS` is read by the sample test's
  key walk and the slice's never-sees list; add the new rows to `gcTradePortalSampleRows` so `/t/sample` draws each block.
- **`gc_trade_messages.kind` and `gc_trade_files.purpose` are CHECK constraints** (`20261010071000_gc_portal_p5_checks.sql`,
  `20261010140000_gc_portal_p5b_papers.sql`). A new kind on the messages table would also widen `PortalMessage['kind']`
  in `portal.ts` (in the copy), so PR 6 reuses `nudge` with `groups: ['job']` and writes no migration. A new purpose on
  the files table is one small migration, PR 4's.
- Run checks one at a time on a loaded machine: `npm run typecheck` took over ten minutes with six other
  sessions' typechecks running. Run it in the background.

### PR 2 · the job head (client, plus the finish on the function's answer) · gc-trade-portal redeploy

- **Function**: in `_shared/gcTradePortalSchedule.ts` declare
  `export interface TradePortalChart extends PortalSchedule { finish?: string | null }` and make
  `portalSchedulesFromRows` answer `Record<string, TradePortalChart>`: for each job, `customerSchedulePicture(state, project)`
  from `./gcKernels/index.ts` in a `try`, and `finish = picture.standing.finish` (that is `projectedFinish(project, today).on`).
  Nothing else of the picture leaves. The slice's `gc` fields gain `start_date` and `started_on`
  (`TRADE_PORTAL_FIELDS.gc`, the read's `gc_projects` select in `gc-trade-portal/index.ts`).
- **Mapper**: `tradePortalState.ts` `projectOf` sets `startDate: strOrNull(gc.start_date)` and `startedOn: strOrNull(gc.started_on)`
  (today both are `null`).
- **Kernel**: new `src/lib/gc/tradePortalHead.ts`, pure, with `tradePortalHead.test.ts`:
  `jobHead(project, partnerId, today, finish)` → `{ started, startedIsPlan, finish, daysLeft, pct, done, total, lines }`.
  `started` is `startedOn ?? startDate`; `pct` is the company's own signed statements of work's lines weighted by
  `amount` from `pctReported` (`Sow.sov`), `done`/`total` the dollars (`money`), `lines` each label with its percent;
  `daysLeft = daysUntil(finish, today)` (`words.ts`), negative when past the plan.
- **Page**: new `GcTradePortalJobHead.tsx` at the top of `GcTradePortalProject.tsx`, drawn only when
  `project.stage === 'building'` and one of the company's invites is the award. Lines: *Started Oct 7 · Click plans
  to finish Dec 18 · 52 days left*; *Your work on this job · 38% done · $18,468 of $48,600* with one bar; *Rough-in 60% ·
  Trim and fixtures 0% · from the percents you reported*; then **Who to call** (`Contacts`, moved up from the foot on a
  building job, left at the foot otherwise) and **Needs you on this job** with the to-dos for this project. The
  to-dos: `GcTradePortalView` computes `withScheduleTodos(portalHomeTodos(state, partner.id, asks, lang), scheduleTodos)`
  once (lift it out of `Home`), filters by `projectId` for the project page, and a press on one calls `go(shown.id, todo.anchor)`
  so the page scrolls to the block's `data-portal-anchor`. The old finish-less answer draws the head without the
  finish line. The schedule answer's type on the client (`tradePortalPage.ts` `schedulesOf`, `TradePortalAnswer.schedules`)
  becomes `Record<string, TradePortalChart>` (a type import from `_shared`), which fits everywhere `PortalSchedule` is read.
- **Words** (`portalI18n.ts`, English and Spanish): `headStarted` *Started {date}*, `headStarts` *Starts {date}*,
  `headFinish` *{gc} plans to finish {date}*, `headDaysLeft` *{n} days left*, `headDayLeft` *1 day left*,
  `headDaysPast` *{n} days past the plan*, `headYourWork` *Your work on this job*, `headPct` *{pct}% done · {done} of {total}*,
  `headFromReports` *from the percents you reported*, `headNeedsHere` *Needs you on this job*.
- **Sample**: the job's `gc` row gets `start_date: d(-30)`, `started_on: d(-30)`; `gcTradePortalSampleSchedules` gets `finish: d(40)`.
- **Tests**: the kernel's; `tradePortalSchedule.test.ts` asserts `finish` equals the picture's and the never-list holds;
  a new `src/pages/GcTradePortal.head.render.test.tsx` opens the sample's Sample Dental Office and reads the three head
  lines, Who to call under the head, and Needs you on this job with the punch item; `tradePortalSlice.test.ts` reviewed fields.
- **Docs**: `gc-trade-portal`'s section in `docs/EDGE_FUNCTIONS.md` (a `> **v2.NNNN — …**` line at the top and the two
  columns in **Purpose**); the guide *share a trade partner its portal* under *What the company sees*; release note and fragment.
- **After the merge**: deploy `gc-trade-portal`. The page reads an older answer with no head finish.

### PR 3 · the whole-job stages fold · gc-trade-portal redeploy

- **Function**: on `TradePortalChart`, `stages?: PortalStage[]` with
  `PortalStage = { key, label, start, finish, pct, state, yours: string[] }` (`state` is `CustomerStage['state']`).
  In `portalSchedulesFromRows`, from the same picture call as PR 2: `stages = picture.stages`; `yours` is each stage's
  bars that are the company's own, by `lineId`. The stage a bar is in comes from
  `customerSchedulePicture(state, { ...project, customerRole: 'gc' }).fullChart`, whose groups are the same stage keys
  with their `bars[].item.activity.lineId` (`ganttListGroups` by stage, since `customerFullChart` passes no phases);
  match them against the chart's `mine` bars and keep the labels. The forced `customerRole` lives inside the
  function only; the full chart never leaves. The dates to meet are already `dates` on the chart since v2.6025.
- **Page**: in `GcTradePortalSchedule.tsx` under the grid, a `<details data-portal-whole-job>` fold **The whole job**:
  one row a stage on the stages' own axis (first start to last finish, the finish line included), each
  *Rough-in · Oct 7 – Oct 31 · 70%* (or *done*) and *· your Rough-in is here* when `yours` has it, the company's own
  stage rows lit like its bars; under the rows *Dates to meet: Roof on Oct 6, met · Rough-in inspection Nov 11 · …*
  (from `dates`) and *Click plans to finish Dec 18* (from `finish`). No fold when the answer has no `stages`.
- **Words**: `wholeJob` *The whole job*, `stageYours` *your {work} is here*, `stageDone` *done*, `wholeDates` *Dates to meet: {list}*,
  `wholeFinish` *{gc} plans to finish {date}*, `stageBehind` *behind*, `stageUnderWay` *under way*, `stageNotStarted` *not started*.
- **Sample**: five stages on the sample job, the sample's two bars in *Rough-in* and *Finishes*.
- **Tests**: `tradePortalSchedule.test.ts` (stages present, `yours` names only Bedrock's bars, the never-list holds after the
  rename above, and `JSON.stringify(stages)` names no company); `GcTradePortal.schedule.render.test.tsx` (the fold, its rows,
  the finish line, none without `stages`); Spanish words.
- **Docs**: the function's section, the guide's schedule paragraph (*Under the chart, **The whole job** folds open…*), release note, fragment.
- **After the merge**: deploy `gc-trade-portal`.

### PR 4 · the company's files on a job, and Send Click a file · one migration, submit-gc-trade-portal and gc-trade-portal redeploy

- **Migration** (number it from `origin/main`, `npm run claim -- --migration <file>`, first line `SET lock_timeout = '3s';`,
  a `docs/migrations/<version>_<slug>.md` page): widen `gc_trade_files_purpose_known` to add `'note'`, the P5b
  migration's way (`DROP CONSTRAINT IF EXISTS` → `ADD … NOT VALID` → `VALIDATE`). Nothing else: no table, so no fence calls.
- **Slice**: `files` on `TradePortalRows`/`TradePortalSlice`, the company's `gc_trade_files` rows read by
  `company_id` (`id, project_id, purpose, paper, name, drive_url, uploaded_at, made_by`), held in `tradePortalSlice`
  to the company and its projects, in `TRADE_PORTAL_FIELDS.files`. Never `drive_file_id`, `record_id`, `bytes` or `mime`.
- **Function** (`submit-gc-trade-portal`): `TRADE_FILE_FOR` gains `'note'` (`_shared/gcTradeFile.ts`): `RECORD_FIELD.note = 'projectId'`,
  and `parseTradeFile` reads `note` (1 to 200 characters, required) and names the file `${cleanFileName(note)}${ext}` with the
  picked file's extension, so the note is the Drive name after the minute. `fileHome` for `'note'`: the project is one with a
  trade awarded to the company through its own invite and a signed statement of work, else `notAwarded`; the file goes to
  **Team only → From trades → <company>** (`tradeFileFolders` already does for any non-submittal). The row's `purpose` is `note`.
  `freeTextCounts` stays; the file cap of 20 an hour covers it.
- **Page**: new `GcTradePortalFiles.tsx`, **Your files on this job**, under `GcTradePortalSow` on a job awarded to the company:
  a table of the company's rows on this project (`name`, what it is by purpose and `paper` — *submittal*, *change you asked for*,
  *your quote*, the waiver's `WAIVER_FILE_LABELS`, *a file you sent* — the day, **Open ↗**) and the plan sets we sent
  (`slice.sets` with a `drive_url` for the project, *Plans Rev 0 from Click*). Then **Send Click a file**: `PortalFilePick`,
  one `<input>` *What is it? One line.*, **Send** → `press.upload({ for: 'note', projectId, name, base64, note })`; on success the
  page reads the slice again (`press.send` is not involved, so call `read()` through a new `press.refresh?` or send nothing and
  append the placed file to the list from the answer). Says *A photo or a PDF up to 10 MB. It goes to the office with your note.*
- **Words**: `filesTitle`, `filesWhat`, `filesDay`, `filesOpen`, `fileSubmittal`, `fileChange`, `fileQuote`, `fileNote` *a file you sent*,
  `filePlans` *Plans {label} from {gc}*, `sendFile` *Send Click a file*, `fileNoteHint` *What is it? One line.*, `fileHint`
  *A photo or a PDF up to 10 MB. It goes to the office with your note.*, `fileNoteNeeded`.
- **Sample**: three `files` rows on the sample job (a submittal's, a change's photo, a waiver PDF).
- **Tests**: `gcTradeFile.test.ts` (the note shape, the name, the refusals), `tradePortalSlice.test.ts` (files held to the company,
  the never fields), the sample test, a render test with the table and the press (`GcTradePortal.files.render.test.tsx`).
- **Docs**: both function sections, the guide *see what a trade partner sends from its portal* under **Its files** (the note file's
  folder; the office opens it in Drive, since no office screen lists a company's uploads today — the Draws window reads only
  waivers), the other guide's job paragraph, release note, fragment, the migration page.
- **After the merge**: push the migration first, then deploy `submit-gc-trade-portal` (it writes the new purpose) and
  `gc-trade-portal`. The page reads a slice with no `files` as no block.

### PR 5 · the message thread with its reply box · gc-trade-portal and submit-gc-trade-portal redeploy

- **Read**: new `_shared/gcTradeThread.ts`, the shape of `_shared/gcPortalThread.ts` keyed by the company:
  the company's contact is `contacts` where `gc_company_id = companyId and name is null` (the flow reads it the same way);
  `loadTradeThread(admin, companyId)` reads `messages` on it, `direction in (in, out)`, `channel in (portal, text, email)`,
  newest 200, and keeps a line tied to a `project_id` only when the company has a `gc_invites` row on one of that project's
  trades (the customer version checks `customer_id`). The lines leave as `PortalThreadLine` (`id, at, dir, door, who, subject, body`),
  the writer's first name only. `gc-trade-portal` answers `thread: PortalThreadLine[] | null` beside the slice; a failed read is null.
- **Write**: `writeTradeLine(admin, { companyId, projectId, text })`: the contact row found or made
  (`insert { kind: 'trade', gc_company_id }`, the loser of a race re-reads), the project checked as above (`notYours`),
  `PORTAL_LINES_PER_HOUR` (20) on `channel = portal, direction = in`, then `insert messages { contact_id, project_id, channel: 'portal',
  direction: 'in', body }`. The kind `portal_message` joins `TRADE_SUBMIT_KINDS` in `_shared/gcTradeSubmit.ts` with no verb
  (`call` empty, like `file`): `parseTradeSubmit` reads `text` (1 to 2,000) and `projectId` (a uuid or null) into `parsed.message`,
  and `submit-gc-trade-portal` handles it after the link, before the Spanish hold, answering `{ ok: true, value: line }`.
  Keys: `tooMany` (429, exists), `notYours` (409, exists), `failed`.
- **Page**: the Messages tab (`GcTradePortalView`'s `Messages`) becomes `GcTradePortalThread.tsx` when the answer has a `thread`:
  the thread's lines merged with `sentMessages(slice)` (each email we sent as an `out` email line: subject, then its lines,
  cut at 240 with **More**), oldest first, each bubble *You · Thu Oct 8 · from the portal* or *Jordan · Thu Oct 8 · by text*
  (`threadRows` in `src/lib/portal/portalThread.ts` is the customer's; write the trade's in `src/lib/gc/tradePortalThread.ts`
  with `portalI18n` words); then the box: a `<select>` *About: <job> / No job* (the company's projects not lost or passed,
  the one job picked when there is exactly one), a textarea `maxLength` 2000 and **Send** → `press.send('portal_message', { projectId, text })`
  (the page's `send` reads the slice again, which refreshes the thread). Under it *Click answers in office hours. For something
  urgent on site, call {name}.* (the superintendent, else the project manager, else Click). A `thread` of null keeps today's
  read-only list, so the client ships first. Add `sent_at` to `TRADE_PORTAL_FIELDS.messages` so the merge orders within a day.
- **Words**: `threadIntro` *The same conversation as your texts and emails with us.*, `threadYou` *You*, `threadHere` *from the portal*,
  `threadText` *by text*, `threadEmail` *by email*, `threadAbout` *About*, `threadNoJob` *No job*, `writeToClick` *Write to Click…*,
  `threadSend` *Send*, `threadMore` *More*, `threadHours` *{gc} answers in office hours. For something urgent on site, call {name}.*,
  `navMessages` becomes *Messages* when the thread is there.
- **Sample**: `gcTradePortalSampleThread(today)`: a text from Dana, an email line, a portal line. The sample's press answers ok
  and the page keeps the line on screen, as `PortalGcMessages` does.
- **Tests**: a pure test for `gcTradeThread.ts`'s filters (`src/lib/gc/tradeThread.test.ts`: a line on another company's job is
  dropped, a note or a call never passes, the writer's first name only); `gcTradeSubmit.test.ts` for the kind; a render test
  for the tab and the box; `tradePortalSample.test.ts`.
- **Docs**: both function sections (the kind's row in the table, the read's **Response**), `docs/twins/APP_DIRECTORY.md`'s
  `/t/:token` entry (the Messages tab is the thread), both guides, `docs/GLOSSARY.md`'s Messages entry if it names the portal's
  read-only list, release note, fragment.
- **After the merge**: deploy `gc-trade-portal`, then `submit-gc-trade-portal`.
- **Verify**: a line from the portal shows on Messages under the company's contact within a minute; a text from the company
  shows in the portal on its next load.

### PR 6 · Word to every trade on the project's card · no function change

- **Where**: `src/pages/GcProjects.tsx`, the project card (`data-gc-project`), a press **Word to every trade** on a job being
  built for `canSendGcTradeEmail(role)`, beside the card's foot. It opens a small window, new `GcWordToTrades.tsx`
  (pattern: `GcTellTrades.tsx`): a subject input (default *A word from {gc} on {project}*), a textarea, the awarded companies
  by name (`project.packages` whose `awardedInviteId` is one of a partner's invites, each company once), and the button
  `countedLabel('Tell', n, ['company', 'companies'])` from `src/lib/batchWords.ts` (`check:batch-words` refuses a static label),
  dead when nothing is typed or no company is awarded.
- **Send**: one `sendGcTradeEmail` per company (`src/lib/gc/tradeEmailIo.ts`): `kind: 'nudge'`, `groups: ['job']`, `projectId`,
  `lang: tradeMailLang(partner.lang)`, `subject`, `lines: [the text's paragraphs]`, and
  `key: wordEmailKey(projectId, subject, text)` = `word:<projectId>:<sha256>` (the shape of `datesEmailKey` in `tellWindow.ts`),
  so a second press of the same words answers `already: true` and sends nothing. Keep going past a refusal and name each
  company with `gcTradeEmailRefusal(key)` afterwards (`batchOutcomeWords`). Each row lands in `gc_trade_messages`, so PR 5's
  thread shows it in every company's portal.
- **Tests**: a pure kernel `src/lib/gc/wordToTrades.ts` (`wordRecipients(state, project)`, `wordEmailKey`, the lines from the
  text) with its test; a render test for the window (`GcWordToTrades.render.test.tsx`: the count on the button, one send per
  company, the refused one named).
- **Docs**: `gc-trade-email`'s **Doors** paragraph (the press and its key), the guide *email a trade partner from GC mode*,
  `PROJECT_DOCUMENTATION.md` if it lists the card's presses, release note, fragment, and this card's `status`/`ver`.
- **Verify**: one press sends one email per awarded company, and a second press sends nothing.

## The plan

One PR per row the owner marks build, smallest first.

1. The Directions link. Client only.
2. The job head. Client only, plus the finish on the function's answer.
3. The whole-job stages fold. The function's schedule answer and the page.
4. The files list and the free press. The slice, the page and one write kind.
5. The thread with its box. A read in `_shared`, a write kind and the page's Messages tab.
6. The word to every trade. A press on the project's card over `gc-trade-email`.

Each PR redeploys `gc-trade-portal` or `submit-gc-trade-portal` after it merges. The page reads
an older answer as it does today, so the client ships first.

## How to verify

- `/t/sample` draws each new block from its sample rows, in English, and in Spanish once the
  flag flips.
- A real company's link, opened as the office, shows the job head's dates against the project's
  card and its bar against the Draws window's percents.
- The thread: a line written from the portal shows on Messages under the company's contact
  within a minute. A text from the company shows in the portal on its next load.
- The word to every trade: one press sends one email per awarded company, and a second press
  sends nothing.
- The stage fold never names a company that is not before or after the company's own bars.
  The never-list in `tradePortalSchedule.test.ts` holds.
