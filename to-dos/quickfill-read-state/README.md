---
name: "Quickfill: read the thing itself, not the retyped note"
number: 180
group: gated
status: built 2026-10-26 (the owner's "build it all"): v2.5884 #6191 (Assistant Dailys), v2.5885 #6201 (Billed Awaiting), v2.5886 #6203 (Prospects), v2.5887 #6204 (Vehicle check-ins), v2.5888 #6205 (Field photos) · left: the one-time pick on the Dailys' live list, then the owner's look
summary: >
  The owner's lens from the Email station, "replace typed notes with read state", run over
  every Quickfill station's Mark history. Only three stations have ever written a note, and
  all three are already rebuilt or proposed. The lens still finds the same crack in another
  shape on five stations: a count that cannot move because it counts the whole set (Billed
  Awaiting Payment, Prospects), a tick that copies a look the round already recorded
  (Assistant Dailys), an honest read with the office's own side missing (Vehicle check-ins),
  and a count that never reaches the mark (Field photos). Each is drawn before and after in
  the Email station's shape: the live count, the oldest item's age, the items past a limit
  with a door, what moved since the last look, and a note that writes itself from the rows.
next: The one-time pick on the Dailys' live list (Where it stands), a week of use on the five stations, the owner's look at the three numbers on their stance lines, then delete the folder.
size: M as a train of five (S · M · M · S · XS); no migration anywhere
blocker: none
opinion: built in the drawn order, the owner's yes of 2026-10-26; the three numbers took their defaults and a dev changes each on its station
ver: v2.5884 · 5885 · 5886 · 5887 · 5888
---

# Quickfill: read the thing itself, not the retyped note (#180)

## The ask

The owner, 2026-10-26, after reading the Email station's history on 2026-10-24 and watching the
same six emails get retyped every morning for a week while the station counted the typing. He
named the lesson as a lens, *replace typed notes with read state*, and asked for two things: look
at every station's Mark history for repeated notes, then show a mock-up of what replacing each
with a read of the thing itself could look like. He answered the same day, on the proposal as drawn: *"I think all your suggestions are
logical here, please build it all."* The five reads were built that day in the drawn order.

## How the histories were read

Live, on 2026-10-26, as the dev, read only, through the app's own client on the dev server: every
row of `quickfill_section_mark_events` from 2026-08-31 to 2026-10-26, eight weeks, 814 marks over
26 stations, one assistant on every mark; then every row since the table began in April, 2,177
marks, to catch notes older than the window and stations that have gone quiet. Nothing was
pressed on the live app. No customer name, number or amount from a live note is in this folder.
The raw audit, with the count sequences, stays in the session's scratchpad. The box labels of the
tick stations and the time-off and vehicle tables were read the same way.

## What the histories say

**Three stations have ever carried a note: Email, Texts and the Physical inbox.** Every one of
their marks has one, 115, 128 and 123 all time, and each is the same short list retyped each
morning with one line drifting through. All three are covered: the Email station reads Gmail's
own state since v2.5827 (#159), the Physical inbox is a deck that decides each paper since
v2.5818 (#158), and the Texts station is proposed as a read of the Messages page (#157). The Mark
history window itself was redrawn as the trend in v2.5819 (#156). Two retired stations, Email's
old Follow Up and Next Actions halves, carried 81 notes each until August: the same two lines on
44 marks running, and the one word *empty* on 74.

**No other station has ever written a note.** So the retyped list the lens was named for does not
exist outside those three. What the lens finds on the other 29 is the same crack in another shape:

- **A count that never moves.** Prospects read 268 at every one of its 32 marks in eight weeks,
  and 107 marks all time without a zero. It counts every active prospect. Vehicle check-ins sat at
  9 and 10 for eight weeks, the size of the fleet.
- **A count that never reaches zero because it counts the whole set.** Billed Awaiting Payment
  ran 50 to 78 over 117 marks and never once reached zero. It counts every open bill. The
  question on its banner, *have we leaned on them this week*, has no row.
- **A tick that copies a look the round already records.** Three of the Assistant Dailys' five
  boxes restate the Schedule, Email and Physical inbox stations. The fifth, the trash, is Office
  Leaving's box again, and it is the one left unticked on 33 marks of 38.
- **A count that never reaches the mark.** Field photos has 35 marks in eight weeks and not one
  carries a count. Its reporter unmounts with the collapsed strip, so the mark saves a look.

Everything else already reads the thing itself and reaches zero on an ordinary day: Missing bill
dates was zero on 34 marks of 36, Unassigned field time on 26 of 32, Job follow-ups on 20 of 28.
Those stations are the lens already applied.

## The audit

One row per station, ranked by how much retyping it holds. *Note pattern* is in general words:
the shape of the eight weeks, never a line from a note. *The thing itself* is the table, page or
queue a read would show instead. The verdict is **read it**, **keep the note**, or **nothing to
read** when the count already is the thing.

| # | Station | Note pattern, eight weeks | The thing itself | Verdict |
|---|---|---|---|---|
| — | Email · Texts · Physical inbox | The only three with a typed note, on every mark, the same lines retyped each morning | Gmail's labels · the Messages page · the paper deck | **covered** by #159 · #157 · #158 |
| 1 | Billed Awaiting Payment | No note. 50 to 78 open on 117 marks, never zero: every open bill, oldest first with its age. Who was leaned on this week lives in a head | The open bills joined to the customer's call log (`customer_contacts`) and the last outbound message on their Messages thread | **read it** |
| 2 | Prospects | No note. 268 on every mark for eight weeks, 107 marks all time, never zero: every active prospect, in warmth buckets with a 30-day chart. Who is overdue lives in a head | `prospects.last_contact` and `warmth_count` against days per warmth, plus `prospect_callbacks` past their day | **read it** |
| 3 | Assistant Dailys | No note. 1 open on 33 marks of 38: five ticks, three restating the Schedule, Email and Physical inbox stations, one for time off, one for the trash | The siblings' own marks today (`quickfill_section_marks`), their live counts, and `user_time_off` for the next 14 days | **read it** |
| 4 | Vehicle check-ins | No note. 9 and 10 on every mark, the fleet: trucks past their cadence with the days since the last reading. Whom we already asked lives in a head | The readings and holders as today, plus the holder's Messages thread for the last ask and reply | **read it** |
| 5 | Field photos → Drive | No note and no count: 35 marks, every count blank, because the reporter unmounts with the collapsed strip. No row shows an age | `estimate_field_photos` and the hand-over rows, as today, with the oldest photo's day and a page-level count | **read it** |
| 6 | Supply Houses | No note. 2 to 7 on 116 marks, never zero: houses with an unpaid invoice 60 or more days past due, in an aging grid | Already read, with its 60-day rule. The never-zero is true. A *since your last look* line and the oldest invoice on the Next line would help; the call to the house is the lean's shape and can join row 1's kernel later | nothing more to read |
| 7 | Office Leaving | No note. 1 open on 31 marks of 34: one box, the trash, almost never ticked. The done map does not reset by day | A physical act. The day-reset is a residual, not a read | nothing to read |
| 8 | Office Arriving | No note. 0 on 30 marks of 37: three boxes, shades, lights, the floor | Physical acts | nothing to read |
| 9 | People Hours | No note. Climbs through the pay week and resets, 0 to 99: closed clock sessions not yet approved | Already read; the shape is the pay week | nothing to read |
| 10 | Dispatch inbox | No note. 0 to 6, zero on 6 of 26: open field requests, oldest first with ages | Already read | nothing to read |
| 11 | Warnings | No note. 0 to 8, zero on 7 of 33: card purchases over two days old on nobody's job, ages in the window | Already read | nothing to read |
| 12 | Today's lines | No note. 2 to 4 on 8 marks: the viewer's own Needs you lines | Already read | nothing to read |
| 13 | GC weekly review | No note. Zero outside the week's window, 7 to 14 inside it | Already read, weekly by design | nothing to read |
| 14 | Job follow-ups | No note. Zero on 20 of 28, a spike to 18: jobs quiet too long for their stage | Already read, with the quiet rule | nothing to read |
| 15 | Missing job info | No note. 0 to 7, zero on 7 of 36 | Already read | nothing to read |
| 16 | Complete, no Total Bill | No note. 0 to 2, zero on 9 of 34 | Already read | nothing to read |
| 17 | Jobs Cleanup | No note. 0 to 7, zero on 2 of 16: sub labor sheets with no job plus the money cards, two units in one number | Already read; the two units are a residual | nothing to read |
| 18 | Unassigned field time | No note. Zero on 26 of 32 | Already read | nothing to read |
| 19 | Missing bill dates | No note. Zero on 34 of 36 | Already read | nothing to read |
| 20 | Property kinds | No note. 1 then 0, 13 marks since Oct 7 | Already read | nothing to read |
| 21 | Unreachable Prospects | No note. Last marked 2026-07-20, zero on 72 of 77: prospects marked can't reach, with the last-contact age | Already read; the station has gone quiet | nothing to read |
| 22 | Jobs Billing | No note. 7 marks, all in April: three tallies added, no status filter | Already read; the count's defects are a residual of their own | nothing to read |
| 23 | Percent complete · Unpriced Fixtures · Banking sorting | Never marked | Already read | nothing to read |
| 24 | Difficult people | No note. 6 marks in May, one item, a dev-typed plan with a tick a day | A human plan with no table behind it | keep the note |
| 25 | My Inbox · Schedule · Tomorrow's Schedule | No mark by design: personal, or a look with no count | The checklist and the schedule pages | nothing to read |
| — | Lost bid reasons | Retired in v2.5841 | | |

**Count:** 32 stations on the page. Three repeat a typed note, all covered. Five earn **read it**.
One keeps its note. Twenty-three have nothing to read, because the count already is the thing.

## The mock-up

[`mockup.html`](./mockup.html) beside this file, served at `/to-dos/quickfill-read-state/mockup.html`:
the audit at a glance with the eight weeks as bars, then the five stations before and after on a
desk and on a phone, the first pick in dark, the order to build them in and the critique. The
before frames draw what is really on each station today. No station outside the three has a note
box, so a dashed box marks where the answer lives today: in a head. Every name, truck, bill,
prospect, supply house and count in the frames is made up (Marisol and Dale in the office,
Ridgeway Builders, Cedar Bend Partners, Harlan Freight, Pruett & Vance, Hill Country Supply).

### The five, in words

| | The read | The count becomes | Still typed | Cost |
|---|---|---|---|---|
| **1 · Billed Awaiting Payment** | The open billed bills the station already loads, joined to the newest `customer_contacts` row per customer and the last outbound message on the customer's Messages thread. A bill needs a lean when it is past due and the newest of those is older than the owner's number | Bills past due with no lean in 7 days. A leaned bill waits in its own fold, out of the count. Zero means every late bill was leaned on this week | The lean itself, where it is logged today. One optional word | M. One kernel with tests, one query, two folds, a Lean door, no migration. Two PRs |
| **2 · Prospects** | `prospects` of kind customer with an active fit, `last_contact` and `warmth_count`, plus `prospect_callbacks` with a `callback_date`. Past its day when a promised callback is past or the last touch is older than the days for its warmth | Prospects past their day: promised and missed first, then past the cadence. The 268 stays as the on-time line, folded with the buckets and the chart | Nothing new. The call is logged in the calling flow as today | M. One kernel with tests, the days per warmth as one `app_settings` key with defaults, the rows and folds, no migration. One PR, two with the Settings line apart |
| **3 · Assistant Dailys** | `quickfill_section_marks` for schedule, email-inbox and physical-inbox, today's mark by anyone, which the page already loads; their live counts from the page's metrics context; `user_time_off` rows starting in the next 14 days | Rows not yet satisfied. A station row is satisfied by that station's own mark today, the time-off row by one press, Told the lead | One press. The trash box moves to Office Leaving, where the same box already is | S, one PR. One kernel with tests, no table, no migration; a dev marks a box *reads station X* in the items setting |
| **4 · Vehicle check-ins** | `vehicle_odometer_entries` and `vehicle_checkins` per truck against the cadence, as today; `vehicle_possessions` for the holder; the holder's Messages thread for the last outbound ask and reply since the last reading | Late trucks with no ask out. An asked truck waits in its fold until a reading lands or the ask goes stale. The ten stay on the count line as *10 late* | The miles, from the driver's reply, as today. The ask is one press with the standard words | S to M. One kernel with tests, one read of each holder's thread through the Texts station's substrate, the ask through the existing send, two folds. One PR after #157 lands its send, two otherwise |
| **5 · Field photos → Drive** | The same tables as today, `estimate_field_photos` and `estimate_photo_handover`, with the oldest photo's day per estimate; the count in a page-level hook so it lives while the strip is collapsed | Estimates still holding photos, on every mark, with the oldest age in the note | The Drive link, as today | XS. A hook, an age chip, the Next line names the oldest, the note from the rows. One small PR or a rider |

Every one of the five keeps the Email station's shape: the live count, the oldest item's age, the
items past the limit with a door into their page, one line for what moved since the last look
(new, cleared, still here), and the bar's presses with the note written from the rows. The
presses are the ones every station has since v2.5839: **Done** lit at zero, **Worked it · N left**
above zero, **Not sure what to do**.

## The recommendation

Build in this order. The first is one PR with no table and no migration, and it makes a station
that is marked every morning honest the same day.

1. **Assistant Dailys** · S · one PR. The three station ticks read the siblings' marks, the time-off
   row reads the list, the trash box moves to Office Leaving. Proves the shape where everyone will
   see it.
2. **Billed Awaiting Payment** · M · two PRs. The lean read. The biggest list scanned by hand every
   morning, and the question the owner wrote on the banner. Needs the lean's days.
3. **Prospects** · M · one or two PRs. Past their day. The count that never moved. Needs the days per
   warmth, with defaults to start.
4. **Vehicle check-ins** · S to M. Whom we asked, read from the thread. Waits for the Texts
   station's standard-words send (#157), or ships its own.
5. **Field photos → Drive** · XS. The count reaches the mark, with an age. Rides with any of the four.

Three numbers for the owner, each one line in Settings with a default: the lean's days (7), the
days per warmth (7 · 14 · 30 · 60 for warmth 3 · 2 · 1 · 0), and the time-off window (14). What
does not change: the mark, the round, the rhythm, the history window, and every station's id, so
every past mark stays in its history.

## Is this the best we can do?

- **Is the premise true?** Only in part, and the proposal says so. Outside Email, Texts and the
  Physical inbox no station has ever written a note, so there is no retyped list to replace. What
  the lens finds instead is the same crack in another shape: a count that cannot move because it
  counts the whole set, and a tick that copies a look the round already recorded. Each read above
  replaces a fact held in a head with a fact read from a table the app already keeps.
- **Why these five and not Supply Houses?** Supply Houses already reads its invoices with a 60-day
  rule, and its never-zero count is true: the invoices are past due. Nothing is retyped. A *since
  your last look* line would help, and the call to the house is the same lean the Billed Awaiting
  kernel reads, so it can join that kernel later rather than get its own.
- **Why Assistant Dailys first and not the biggest?** Because it is the smallest honest win: no
  table, no owner's number, and a count that turns true the day it ships. The lean read is the
  biggest win and needs a number from the owner and a join the app has not made before, so it goes
  second, with the shape already proven.
- **Does any of this need a new table?** No. Every read is over tables the app already keeps, plus
  three settings keys. That is the test of the lens: if the thing itself were not already in the
  app, there would be nothing to read.
- **What stays by hand?** The lean's note, the call, the miles, the Drive link, one Told press, and
  one optional word per station. Nothing retyped.
- **What does not change?** The mark, the round, the rhythm, the history window and the station
  ids.

## Where it plugs in

Exists:

- The stations: [`BilledAwaitingPaymentSection.tsx`](../../src/components/quickfill/BilledAwaitingPaymentSection.tsx)
  over [`fetchStagesHeaderStats.ts`](../../src/lib/jobs/fetchStagesHeaderStats.ts);
  [`QuickfillProspectsSection.tsx`](../../src/components/quickfill/QuickfillProspectsSection.tsx)
  over [`prospectWarmthCounts.ts`](../../src/lib/prospectWarmthCounts.ts);
  [`QuickfillAssistantDailysSection.tsx`](../../src/components/quickfill/QuickfillAssistantDailysSection.tsx)
  over `quickfill_assistant_dailys_daily_checks` and the `quickfill_assistant_dailys_items` setting;
  [`QuickfillVehicleOdometersSection.tsx`](../../src/components/quickfill/QuickfillVehicleOdometersSection.tsx)
  with its cadence settings; [`QuickfillFieldPhotoHandoverSection.tsx`](../../src/components/quickfill/QuickfillFieldPhotoHandoverSection.tsx).
- The shape to copy: [`QuickfillEmailSection.tsx`](../../src/components/quickfill/QuickfillEmailSection.tsx)
  and its model [`emailStation.ts`](../../src/lib/quickfill/emailStation.ts) (the boxes, the stuck
  rows, new · cleared · still since the last mark, the composed note); the presses in
  [`markOutcome.ts`](../../src/lib/quickfill/markOutcome.ts); the metrics context
  [`QuickfillSectionMetricsContext.tsx`](../../src/contexts/QuickfillSectionMetricsContext.tsx)
  (`count`, `markNote`, `nextLine`); the marks the page loads in [`Quickfill.tsx`](../../src/pages/Quickfill.tsx).
- The tables: `customer_contacts`, the Messages threads and `contact_owed`; `prospects` and
  `prospect_callbacks`; `quickfill_section_marks` and `user_time_off`; `vehicle_odometer_entries`,
  `vehicle_checkins` and `vehicle_possessions`; `estimate_field_photos` and `estimate_photo_handover`.
- The banners in [`sectionBanners.ts`](../../src/lib/quickfill/sectionBanners.ts) stay as they are;
  each question is already the one the read answers.

New, per pick: one kernel with tests under `src/lib/quickfill/` (`leanRead.ts`, `prospectsDue.ts`,
`dailysRead.ts`, `vehicleAsks.ts`, `fieldPhotosAge.ts`), its io file where a new query is needed,
the station redrawn in the Email station's shape, the three settings keys with defaults, the
guide *run the office day with Quickfill* amended per station, and the architecture map's station
bullets. No migration.

## Decisions for the owner

1. **The order**, or a different first. The recommendation is Assistant Dailys, then Billed
   Awaiting Payment, Prospects, Vehicle check-ins, Field photos.
2. **The lean's days.** A bill past due with no call, text or email in this many days needs a
   lean. The recommendation is 7.
3. **The days per warmth.** How long a prospect may go without a touch at each warmth. The
   recommendation is 7 · 14 · 30 · 60 for warmth 3 · 2 · 1 · 0, and 4+ follows warmth 3.
4. **The time-off window** the Dailys row reads ahead. The recommendation is 14 days.
5. **The trash box.** One home, Office Leaving, or keep the Dailys copy as a morning reminder.

## Not in this proposal

Three things the audit noticed that are not reads and would be follow-ups of their own: Office
Leaving's done map never resets by day, so a tick from last month still reads as today's; Jobs
Billing adds three tallies with no status filter, so one job can count three times and paid jobs
are in; Jobs Cleanup adds sheets and money cards into one number. Also left alone on purpose:
Supply Houses (above), the three physical-act ticks, and the stations that already reach zero.

## The decision and where it stands

Built 2026-10-26, the owner's "build it all", five PRs in the recommended order, each one station,
no migration:

1. **v2.5884 (#6191) Assistant Dailys** reads the stations it used to tick: a box marked `reads` in
   the items setting is done when that station was marked today, by anyone, and shows its live
   count; the time-off box lists `user_time_off` for the next 14 days and stays a tick, done alone
   when nobody is off. Kernel `lib/quickfill/dailysRead.ts`.
2. **v2.5885 (#6201) Billed Awaiting Payment** reads the lean: the Payment Chase touches and the
   promised dates, folded into Need a lean, Leaned on or promised, Not yet past due; a lean is logged
   from the row through the one chase write path; the owner's days in
   `app_settings.quickfill_lean_days_v1`, default 7. Kernel `lib/quickfill/leanRead.ts`.
3. **v2.5886 (#6203) Prospects** reads each prospect's last touch and the promised callbacks against
   the days per warmth (`app_settings.quickfill_prospect_days_v1`, default 7 · 14 · 30 · 60). Kernel
   `lib/quickfill/prospectsDue.ts`.
4. **v2.5887 (#6204) Vehicle check-ins** reads each holder's Messages thread for the ask and the
   answer; the count is what is still to do; the standard ask is one Copy press, sent from the thread.
   Kernel `lib/quickfill/vehicleAsks.ts`.
5. **v2.5888 (#6205) Field photos** reports its count from a page-level hook so a mark on a collapsed
   strip carries it, and each estimate shows its days in storage. Kernel `lib/quickfill/fieldPhotosAge.ts`.

The three numbers took their defaults; a dev changes each from the station's stance line. Not built,
by design: sending the vehicle ask from the station (it is copied and sent from the thread; the
Texts station's standard-words send, #157, can take it over), and a dated due day per prospect
beyond the warmth cadence.

**Left, the one-time pick on the Dailys' live list**, five minutes as a dev with Edit checklist on:

1. On *Check for obvious schedule conflicts…* pick **Reads the Schedule station**.
2. On *Is my email inbox clear…* pick **Reads the Email station**.
3. On *Is the physical inbox clear…* pick **Reads the Physical inbox station**.
4. On *…upcoming time off* pick **Reads time off coming up**.
5. Press **Remove** on *When leaving: take out all the trash*. Office Leaving keeps the same box, one
   home. Its past ticks stay in the history.

Then a week of use, the owner's look at the three numbers, and this folder goes.
