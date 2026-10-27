---
name: "The trade partner's portal beside JobTread's job portal: what to borrow"
number: 205
group: gated
status: proposed 2026-10-27 from the owner's look at JobTread's job portal as a sub · five rows, each waiting on the owner's call
summary: >
  On 2026-10-27 the owner worked as a sub on another GC's job and saw JobTread's job portal. The
  question back was whether our subs have a job portal. They do, since v2.4920: one link per
  company, flow first. This card puts the two side by side and names five things worth borrowing.
  Each has a decision row for the owner.
next: The owner reads the five rows and marks each one build, later or drop. Build the ones marked build, smallest first, one PR each. The Directions link and the job head go first.
size: S for the Directions link, the job head, the files list and the whole-job stages · M for the thread with its reply box · S for the word to every trade after it
blocker: The owner's call on each row. A dev still makes every link until the trade wave, and Spanish stays behind PORTAL_SPANISH_ON.
ver: v2.4920 · 5044 · 5048 · 5198 · 5200 · 5201 · 5315 · 5331
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
