---
name: "Phone first: the five screens a tech touches, with one thumb and a camera"
number: 189
group: gated
status: proposed 2026-10-26 from the owner's holistic look at the phone, lens 4 · the owner answered the same day; PR 2, the press bar, built as v2.5905 and PR 4, the job window's bar in both windows, as v2.5910, both live and run press by press on the ZZ test job on 2026-10-27 · the picks of 2026-10-29 on the review canvas (sections 3, 4, 6 and 8 as redrawn, Leaving opens the On my way sheet, a home screen web app, the clock-out note filled from the day's reports, a photo with no folder kept and marked, the typed plan stays) · built the same day as five PRs, PR 5a v2.6076, PR 5b v2.6083, PR 3 v2.6089, the Leaving PR v2.6091 and PR 8 v2.6092, run live on the ZZ test jobs at 375 px before the queue took them, all five live by the 05:55Z deploy on 2026-10-30 · the report photos migration on prod since the push of 2026-10-30, and photo-save redeployed with the report sweep at 14:13Z the same day; the camera's live run on a ZZ job is next
summary: >
  A tech's day on the phone is five screens: the Job Mode card with the day's press, the On my
  way sheet, the field report, My Schedule with its percent stepper, and the job window. Walked
  at 375 px on 2026-10-26, the day's press sits a third of the way down the screen and moves with
  the rail, the report has no photo field, the percent chips are 33 px, Clock out is a 20 px text
  link, and a helper's job window has no bar at the bottom. The plan is four moves: a press bar
  pinned above the tab bar on the Job Mode card, every daily target at 44 px or more with the
  close by the thumb, a field report that opens on the camera and puts each photo in the
  customer's Drive folder as #164 decided, and clock out in one press. #163's waiting bar sits
  under the status bar on every screen and #164's gallery under the address. The position on
  native: stay a home screen web app, with three named triggers for revisiting it.
next: The camera's live run on a ZZ test job (the recipe in v2.6083's fragment): a shot lands in the bucket, the sweep files it in the job's Photos folder within five minutes, and the report card reads in Drive. PR 6 can start, since #164's checklist tables are live. PR 7 waits on #163's PR 3, the field report through the queue.
size: L as a train of nine (S · XS · S · M · M · S · S · S, and the Leaving PR at XS), seven built; one migration, the report photos table; left: PR 6 (S) and PR 7 (S)
blocker: None for the camera, since the migration and photo-save are both live. PR 7 waits on #163's PR 3.
ver: v2.5905 · 5910 · 6076 · 6083 · 6089 · 6091 · 6092
opinion: every PR the owner's picks unlocked is built and live, with its migration and photo-save; run the camera on a ZZ job; PR 6 can start; PR 7 after #163's PR 3; stay a home screen web app until one of the three triggers fires
mockup: to-dos/phone-first/mockup.html
---

# Phone first: the five screens a tech touches, with one thumb and a camera (#189)

## The ask

The owner, 2026-10-26, on the fourth lens of his holistic look at the user experience:

> It's a web app on the home screen. The round, Job Mode, On my way and the phone dock are good.
> What's missing is what a tech feels most: no signal, photos, and a camera-first report. Add
> #163 and #164 as decided. Refine: one-thumb checks on the five screens a tech touches daily;
> a field report that starts from the camera.

And the shape he asked for: *coming up with a plan and then asking yourself is this the best we
can do and then presenting me a mockup of the before and after of what could be added.*

Two decisions already stand. With no signal, #163 keeps clock in, clock out, a note and a field
report in a queue on the phone. It shows a bar at the top of every screen while anything has not
uploaded yet. #164 keeps every photo in Google Drive. The gallery reads the
customer's folder, a checklist photo is saved there, and there is one checklist per stage.

This is a proposal. Nothing here is built until the owner picks.

## The five screens, walked

Walked on 2026-10-26 in the browser pane at 375 × 812, as the dev with Job Mode on. The roles
that need a schedule were read in the code instead. Nothing was pressed that writes.
A real iPhone adds a status bar of 47 to 59 px above everything below. A thumb reaches the bottom
330 px of the screen without a shift of the hand.

| Screen | Where the common press sits | Presses for the common act | What the thumb reaches up for |
|---|---|---|---|
| **1 · The Job Mode card** on the Dashboard. The day's press: Clock In, On my way, I'm here, Wrap Up Day. Leave Report beside it. | Two 92 px buttons at 214 to 306 px from the top with no rail. The rail of the day's jobs pushes them down 33 px a job, so four jobs put them near 380 px. Nothing is pinned. | On my way: 2. I'm here: 1 or 2. Manual Clock In with no schedule: 3 and a typed plan. Clock out: 2 and a typed note. | The big buttons on a short day. Turnaway at 56 px. Message the customer and Clock out, which are 20 px text links. |
| **2 · The On my way sheet** and the I'm here sheet. | Full screen. The primary sticks to the bottom at 48 px and says what it does. The job list is first, the text under it. | 2. The sheet opens on the suggested job with the minutes guessed. | The ✕ at the top right. The second job when the suggestion is wrong. |
| **3 · The field report** from Leave Report. | A centred card, not a full screen. Type chips at 37 px, percent chips at 33 px, a slider, two typed boxes. Cancel and Save at 37 px at the end of the form, so they scroll with it. | 3 and two typed boxes. No photo is possible. | The type chips and the percent chips. Save on a long form. |
| **4 · My Schedule** and its Update % done stepper. | Below the Job Mode card and Your record, so below the fold. The card's two buttons are 44 px. The stepper is a centred window with 40 px chips and a 36 px Save. On a job with lines it draws the list with 33 px quick picks. | A scroll, then 3. | The whole card. The stepper's chips, mid screen. |
| **5 · The job window** from Job detail or a schedule card. | A helper, a sub or a superintendent gets the plain window: a centred card that scrolls, Arrived, Leaving and Post note as 28 px chips under the note box, Close at the very end. The primary gets the tabbed window with a bar at the bottom at 41 px. | A note: a scroll to the box, then 2. Arrived or Leaving: a scroll, then a 28 px chip. | Everything. Nothing is pinned for the crew. |

The sheet is the one screen built for a thumb already. The other four put the press where the
page happens to put it.

## What the walk found

- **The Job Report button at the top of Job Mode does nothing.** The pinned row draws it, but the
  report window is not mounted there. `docs/DASHBOARD_SECTIONS_ARCHITECTURE.md` records it as a
  kept quirk. A tech presses it and nothing opens.
- **The report form's percent opens on 0, not the job's number.** `AdditionalReportModal`, the
  form behind Leave Report, shows 0 until the tech touches a chip. By the code, an untouched Save
  on a one-line job submits 0. `propagateReportPctToJob` then writes that 0 to the job. A job
  with two or more lines is safe,
  since the lines seed the number. `NewReportModal` seeds the job's number on every job. Not
  tried live. It is not this to-do's work, and it is listed under *Follow-ups* so it is not lost.
- **No report field takes a photo.** The template field types are long text, a percent and a
  signature, held by a CHECK on `report_template_fields`. The only camera in the app is the Write
  up a change wizard. Its photos land in the `estimate-field-photos` bucket and reach Drive by
  the Quickfill station. A text's photos reach Drive by the `photo-save` sweep.
- **Offline is Retry and nothing else.** The shell is precached. Every read and write is live. A
  failed clock in, clock out or report shows Retry and keeps nothing. The On my way sheet and the
  stepper show a toast. IndexedDB holds only the Pipeline's snapshot.
- **The crew's job window has no bar.** `resolveJobWindowMode` gives the tabbed window and its bar
  to the office roles and the primary. Helpers, subs and superintendents get the plain window.
- **The push and the status bar are right already.** Push works on an installed app since iOS
  16.4. `--app-top-chrome` pads every window, and `check:status-bar` and `check:window-z` hold the
  rule for every new one. The tab bar slides away under the keyboard.

## The plan

### a · The one-thumb pass

1. **A press bar on the Job Mode card.** The day's press moves out of the card into a bar pinned
   above the tab bar. Leave report sits on the left and the day's press on the right, at 56 px.
   A row of three 44 px buttons sits over them: Turnaway, % done and Clock out. The card above
   scrolls.
   The same handlers run. The Job Report row at the top goes, since it is the same door and
   does nothing today. The Message the customer press stays under the customer, where the text
   is read.
2. **Every daily target at 44 px or more.** The percent chips on the report and the stepper go
   from 33 to 48 px. The crew's job window gets the bar at 48 px with Arrived or Leaving on it.
   The filter pills go from 21 to 32 px. The quiet links under the card become buttons or move
   to the bar.
3. **The close comes down.** Every sheet a tech opens gets Not now beside its primary at the
   bottom. The ✕ at the top right stays for the office and goes on the phone. The On my way
   sheet keeps every open job in view, the still-open ones too. A jump to another job is one
   press on its row. Its minutes buttons grow to 56 px.
4. **Nothing important under the status bar.** Already held by the two codemods. The waiting
   bar of #163 joins their list, drawn under the inset and above the header.
5. **One press per common act.** Clock out's review keeps its note. The note is filled from the
   day's reports, so the usual press is one: Complete clock out. The tech can still edit it. The office reads the same words it read on the report. I'm here is one
   press at the door already. On my way stays two, since the second press is the text.
6. **The words a first-timer reads.** The bar's words are the acts: Clock in, On my way, I'm
   here, Wrap up the day, Leave report, % done, Clock out, Turnaway. The review's title becomes
   Clock out. Each new line passes `plainWords.ts`.

### b · A camera-first field report, stage by stage

0. **How complete, stage by stage, with a precise number.** The report's percent question
   becomes the list of the job's stages, every stage its own row and all of them in view. The
   open row takes a quick pick at 48 px, a −5 and a +5 at 56 px, or a typed number. The Job line under the list adds them up, as Report by line does today. The same
   control stands in the My Schedule stepper and, on a one-stage job, alone for the job. This
   ships before the camera, on the owner's word of 2026-10-26.
1. **The press opens the camera.** Leave report fires a file input with capture set to the back
   camera. The Write up a change wizard uses the same input. On an installed home screen app the
   phone's own camera opens at once. A shot comes back to the form as a tile. Take another opens
   the camera again. Cancel on the camera gives the form with Take a photo as the first tile.
2. **Each photo goes to the customer's Drive folder, small.** The phone shrinks the shot before
   it leaves. It draws the shot on a canvas at the long edge the office picked and reads it back
   as a JPEG at quality 0.8. A web worker does it, so the form never freezes. A 12 MP shot of 3 to 5 MB
   becomes about 300 KB at 1600 px. The camera input hands iOS photos over as JPEG, so HEIC never
   reaches us, and the orientation tag is honoured. The office picks Small, Medium or Large once
   in Settings → Photos, an `app_settings` key, with Medium the default. The bucket refuses a
   file over 2 MB, so nothing full size slips through. The tile shows the before and after
   sizes. The phone then sends the bytes to a `report-photos` bucket and writes a row in a new
   `report_photos` table. The `photo-save` sweep copies it into the job's Photos folder
   under the customer's Drive folder. It names the file by day, sender and caption, as it names
   a text's photo. It keeps the `drive_file_id` on the row and deletes the bucket copy. This is
   the v2.2300 pattern. Drive is the home and the bucket a waiting room. A failed copy is tried
   again.
3. **A photo hangs on its stage, or answers a checklist question.** Under a new tile one row of
   chips asks which stage it shows. The chips are the job's priced lines, the same list Report
   by line draws. The photo then sits on that stage's row, where its number is set. A 📷 on any
   stage row opens the camera for that stage. The Stage progress sentence names the moved
   stages and their photos. Where #164's checklist has a question that asks for a photo, that
   question is a chip too. The photo is its answer.
4. **The typed parts come after the photos.** One optional box, What got done. What is next and
   the other report types fold under a link. Save sticks to the bottom and names what it writes:
   *Save · 3 photos · job 72%*. The percent opens on the job's number.
5. **With no signal** the report and its photos wait in #163's queue. The bar says *1 report ·
   1 photo waiting to send*. The line's new percent shows on the card from the phone's copy.

### c · Where #163's bar and #164's gallery sit

- **The bar** is a 36 px band under the status bar inset and above the app header, on every
  screen. It turns amber when the server refused a press. A tap lists what waits with when it
  was pressed. On the Job Mode card a press with no signal lands in the queue. The big button
  reads *Clocked in · waiting to send* for a beat.
- **The gallery** is a strip of four thumbnails under the address on the job window. *Photos ·
  6* is the door to the folder's viewer. The Job Mode card draws the same strip under the
  customer while clocked in, once #164's viewer exists. A report's card shows its own photos.

### d · Web app or native shell

**The position: stay a home screen web app.** Build the three to-dos on it. Revisit native only
when one of three triggers fires.

What the installed web app gives today, on iOS 16.4 and later and on Android:

- The camera through the file input with capture. One shot a press, the phone's own camera UI,
  the bytes handed to the page. No live viewfinder of our own, and no burst.
- Push through the service worker on an installed app. On iOS the app must be on the home
  screen, and a tech who opens the site in Safari gets no push.
- Offline through the service worker and IndexedDB. An installed app's storage is not evicted by
  Safari's seven day rule. The queue of #163 fits here.
- The location while the app is open, which is how On my way guesses the minutes.

What only a native shell gives, and what each costs:

| Only native gives | What it would change | What it costs |
|---|---|---|
| Location in the background | Who's where between presses, a drive time with no press at all | The Always permission, which Apple questions, and the battery |
| Upload with the phone in the pocket | A photo keeps going after the app is closed | A native upload task a plugin provides |
| The store | An icon from the store, no Add to Home Screen step, push with no install step | $99 a year for Apple and $25 once for Google, a review of one to three days on every release, and every tech reinstalling |
| A better camera | Burst, a viewfinder of our own, HEIC handled on the phone | A camera plugin and its permissions |

The shell itself is Capacitor around the same React build. It is about two weeks to stand up
and a third client track forever. The web stays for the office and the store serves the techs.
The two drift unless every PR is checked on both. The owner's comparison of 2026-10-24 found
field apps that break without signal among the top complaints across vendors. That is #163's
queue, which the web app can do. None of the four rows above is something the owner or a tech
has asked for.

Three triggers would reopen the question. The office wants location between presses. A photo
must finish uploading with the phone in the pocket. Push on iOS proves unreliable for the crew
after #163 ships. Any one of them opens a to-do for the shell. Until then the money goes into
the five screens.

## The PR train, smallest shippable first

| PR | What it touches | Size |
|---|---|---|
| 1 · this folder | `to-dos/phone-first/` | docs |
| 2 · the press bar | `DashboardJobModeCard.tsx` draws the day's press and Leave report in a fixed bar above `DispatchModeFooter`, with Turnaway, % done and Clock out over them. A kernel `lib/jobMode/pressBar.ts` picks the bar's words and buttons from the card's six states, with tests. The Job Report row leaves Job Mode. Not now joins the On my way and I'm here sheets. `check:window-z` and `check:status-bar` list the bar. The guide *clock in and out with Job Mode*. **Built as v2.5905**, without Not now on the sheets and the home screen line. | S |
| 3 · 44 px everywhere a tech presses | The percent chips in `ReportTemplatePercentField` and `ReportLinesProgressField`, the stepper's chips in `FieldPctUpdateModal`, the quiet links under the card, the filter pills on the job window. A render test holds the heights at 375 px. | XS |
| 4 · the crew's job window gets the bar | `resolveJobWindowMode` keeps the plain window for helpers, subs and superintendents, and `DetailJobModal` in phone pane mode gains `JobWindowActionBar` with Arrived or Leaving, Leave report and Note. Note opens the composer as a bottom sheet over the keyboard. The gallery strip under the address, read from the folder, lands here once #164's PR 5 ships. **Built as v2.5910** in both windows: the tabbed window's bar carries the stamp for a viewer on the crew, and its Note opens the same sheet. | S |
| 5a · the percent by stage, with a precise number | `ReportLinesProgressField` redrawn: every stage in view, the open row with 48 px picks, a −5 and +5 at 56 px and a typed number, the Job line under it. The same control in `FieldPctUpdateModal`, drawn as a bottom sheet on a phone, and alone on a one-stage job in place of the six chips. `AdditionalReportModal` seeds the job's number. The kernel `lib/reports/stagePct.ts` holds the steps and the clamps, with tests. No migration. The guides *file and review field reports* and *update how done a job is from my dashboard*. | M |
| 5b · the camera-first report | `AdditionalReportModal` opens on the camera for the field roles, draws the tiles, puts a photo on its stage, folds the typed parts and pins Save. `lib/photos/shrink.ts` shrinks a shot on the phone in a worker, with tests on sizes and orientation, and the Settings → Photos row. One migration: `report_photos` with the three fences, and the `report-photos` bucket with its 2 MB cap. `photo-save` learns the new bucket and table. The guide *file and review field reports* and a new guide *take photos for a report*. | M |
| 6 · a photo answers a checklist question | The checklist chip under a tile, the answer written to #164's table. Waits on #164's tables. | S |
| 7 · the bar and the queue on these screens | After #163's PR 2: the bar's place under the inset, the press bar's *waiting to send* beat, the report and its photos through the queue. | S |
| 8 · clock out in one press | The review's note filled from the day's reports and jobs by `lib/clock/clockOutNote.ts`, with tests. The title becomes Clock out. | S |

PRs 2, 3, 4, 5a and 8 need no migration. PR 5b carries the one migration and follows 5a. PR 6
can start now that #164's tables are live, and PR 7 waits on #163's PR 3.

## Is this the best we can do?

The argument against the plan, and where it wins.

**What a tech would still find slow.** On my way is still two presses and a read. That is
right, since the second press sends a text. The manual Clock In with no schedule still asks a
typed plan. The office could drop that question for a job picked from the list. That is a
question for the owner, not a PR here. The report still has one typed box, and a thumb on a
truck types badly. Speech to text is the keyboard's own mic on both phones, so the box needs
nothing from us. A photo on one bar of signal takes ten to thirty seconds to go up. So a tile
shows a spinner and Save never waits for it. That is PR 7's job. Until it ships, a shot on no
signal fails the way a report fails today.

**What a native shell would fix that the plan does not.** The camera comes back to the app after
every shot, so ten photos are ten round trips. Upload stops when the app is closed. Nothing
moves between presses. A tech who never added the app to the home screen gets no push and no
offline. The plan accepts all four. The first is a few seconds a photo. The second is what #163's
queue is for, on the next open. The third nobody has asked for. The fourth is a line in the
onboarding guide and a check on the Dashboard. It reads *Add this app to your home screen for
push and offline*, shown once to a tech in Safari.

**What the plan adds that nobody asked for.** The first draft hid Turnaway, Message the
customer and Clock out behind a More sheet. That made room for the press bar. It is a bad trade.
Turnaway happens at the door, and a hidden press is a press not made. The draft also grew the
filter pills on the job window to 32 px. A tech presses those perhaps once a week. It drew the
gallery on the Job Mode card too. The tech who took the photos has no need to see them there.
And the clock out note was to be filled from the day's jobs as well as the reports. The office
already knows the jobs from the clock sessions.

**The smallest version that would still feel different on the truck.** PR 2 and PR 5. The
press bar puts the day's press under the thumb on the first morning. The camera makes the report
something a tech wants to file. If the owner picks one, PR 5. The camera is what he named.

**Where the argument wins, and the plan changed.**

- The More sheet is gone. Turnaway, % done and Clock out are a row of 44 px buttons over the
  press bar. They stay in view whatever the rail holds.
- The filter pills stay in PR 3 as a one line change. Nothing else on the job window grows
  unless a tech presses it daily.
- The gallery lands on the job window only. The Job Mode card draws the strip only while
  clocked in, under the customer, and only once #164's viewer exists.
- The clock out note is filled from the day's reports alone. With no report that day it is empty,
  as today, and the review asks as it asks today.
- PR 8 moved to the end of the train. It saves the most presses but touches payroll's words, and
  the owner should see the bar and the camera first.
- The home screen check joined PR 2. Without it half the plan never reaches a tech who opens
  the app in Safari.

## The owner's answers, first pass (2026-10-26)

The owner read the mock-up the same day and answered section by section:

1. **The Job Mode card:** *we can do 1 right away.* PR 2 is built as v2.5905.
2. **The On my way sheet:** *we need to keep it easy for a tech to jump between jobs.* The
   fold under Change is gone. The sheet keeps every open job in view and a jump is one press.
3. **The field report:** *we need to improve before we update. We need to improve how complete
   is this job so it breaks down by stage. Please revise this mockup.* Section 3 is redrawn.
   Every stage is its own row with a precise number, and a photo hangs on its stage. That is
   PR 5a, before the camera's PR 5b.
4. **The stepper:** *I like your idea, but we need to make it easy for a user to specifically
   offer how far along things are.* The sheet takes a quick pick, a −5 and +5, or a typed
   number per stage. Section 4 is redrawn.
5. **The job window:** *I like it, we should build it.* PR 4 is built as v2.5910.
6. **The camera flow:** *I like it, but we'll need to convert the photos from their full size
   to a more compact format. How can we offer this?* Section 6 gained a fourth frame: the phone
   shrinks the shot on a canvas before it leaves, the office picks the size once in Settings,
   the bucket refuses anything over 2 MB, and the tile shows the before and after sizes. The
   detail is under the plan's b.2.
7. **The presses:** *I like all of this but want to make sure it flows the way I want. Please
   make mockups for each.* Section 8 draws all nine flows one frame a press.

The rest were answered on 2026-10-29, below: the native shell, the clock out note, the photo with
no Drive folder, the manual Clock In's typed plan and what Leaving opens.

## Decisions for the owner

1. **The train.** Answered above: PRs 2 and 4 now, 5a then 5b after the look at the flows. On
   2026-10-29 PR 3, the Leaving PR and PR 8 were built the same day as 5a and 5b, on the picks of
   the review canvas.
2. **Native.** Answered 2026-10-29: stay a home screen web app. If the owner wants the shell
   later, it is its own to-do after #163 and #164. The three triggers become its ask.
3. **The clock out note.** Answered 2026-10-29: filled from the day's reports, editable, so the
   usual press is one. Built in PR 8.
4. **Where a report's photos live when the job has no Drive folder link.** Answered 2026-10-29:
   the bucket keeps the photo and the report card shows it with *not in Drive yet*. Built in
   PR 5b. The Needs you line it counted on, one that asks the office for a folder link, does
   not exist; it is a follow-up below.
5. **The manual Clock In's typed plan.** Answered 2026-10-29: it stays. Not in this train.
6. **What Leaving opens.** Answered 2026-10-29: the On my way sheet for the next job when the
   day has one, as flow 8 draws it, since it clocks the drive and texts the customer in one
   press. With no next job, Update Focus. Built in the Leaving PR.

## Where it plugs in

| Piece | Exists | New |
|---|---|---|
| The card and its six states | `DashboardJobModeCard.tsx`, `jobModePickCurrentNext.ts`, `jobModeDayRail.ts` | the press bar, `lib/jobMode/pressBar.ts` |
| The tab bar | `DispatchModeFooter` variant job, 60 px plus the inset, hidden under the keyboard | the bar sits above it, same rule under the keyboard |
| The sheets | `OnMyWaySheet.tsx`, `ImHereSheet.tsx`, `ResponsiveModalShell` with its sticky footer | Not now in the footer, the jobs folded under Change |
| The report | `AdditionalReportModal.tsx`, `ReportTemplatePercentField.tsx`, `ReportLinesProgressField.tsx`, `useJobLineProgress`, `stampMovedLines` | the camera press, `ReportPhotoTiles.tsx`, `lib/photos/shrink.ts`, `report_photos`, the `report-photos` bucket |
| Photos to Drive | `photo-save` with `_shared/driveUpload.ts` and `driveJobFolder.ts`, `photoDriveName`, the v2.2300 Quickfill station | the sweep reads the new table |
| The stepper | `FieldPctUpdateModal.tsx`, `submitStatusReportFromStepper.ts` | opened from the press bar, drawn as a bottom sheet |
| The job window | `resolveJobWindowMode`, `DetailJobModal` phone pane, `JobWindowActionBar.tsx`, `jobWindowBar.ts` | the bar on the plain window, the note sheet, the gallery strip |
| Clock out | the review modal, `clock_sessions` notes | `lib/clock/clockOutNote.ts` |
| Offline | `src/sw.ts` precache, `OfflineRetryPanel`, `offlineRecoveryState.ts` | #163's queue, the bar |
| The status bar | `--app-top-chrome`, `check:status-bar`, `check:window-z` | the bar and the press bar on their lists |
| Roles | `MESSAGES_TECH_TEAM` is primary and helpers. Job Mode is on by default for subs and helpers. `canLeaveJobFieldReport` gates the report. | nothing |

## How to verify

On the phone preset as the dev with Job Mode on, and on a real iPhone on a ZZ test job only.

- The press bar sits above the tab bar on every card state and never under the keyboard. The
  big press lands within 330 px of the bottom. The handlers are the old ones: On my way opens
  the sheet, the sheet clocks in. Nothing writes that did not write before.
- Every chip a tech presses measures 44 px or more in the render test at 375 px.
- Leave report opens the camera on an installed app and a tile comes back. The photo appears in
  the ZZ test customer's Drive folder under Photos within the sweep's few minutes. It is named
  by day and sender. The report card shows it. A pick of 50 on the Rough In chip moves the line
  on the Bill tab. The Stage progress sentence names the photo.
- Airplane mode: a report with a photo saves on the phone and the bar reads *1 report · 1 photo
  waiting to send*. Back online, both go and the bar clears. Needs PR 7, after #163's PR 3.
- A helper's job window shows the bar with Arrived, and Note opens the sheet over the keyboard.
- Clock out with a report filed today opens the review with the note filled. One press ends the
  session and the office sees the note on the session.

## Where it stands

| PR | Version | State |
|---|---|---|
| 2 · the press bar | v2.5905 | built 2026-10-26, live since the 08:45Z deploy on 2026-10-27 |
| 4 · the job window's bar | v2.5910 | built 2026-10-26, live since the 03:39Z deploy on 2026-10-27 |
| 5a · the percent by stage, with a precise number | v2.6076 | built 2026-10-29 on the picks of the review canvas, live since the 02:00Z deploy on 2026-10-30: `lib/reports/stagePct.ts`, `StagePctControl` on every stage row and alone on a one-stage job, the stepper as a sheet from the bottom with Not now and Save · job N%, Leave report's percent opening on the job's number (the follow-up below). No migration. |
| 5b · the camera-first report | v2.6083 | built 2026-10-29, live since the 05:55Z deploy on 2026-10-30: the camera on Leave report for the field roles on a phone, the tiles, the stage chip and the camera on every stage row, the shrink in a worker at the office's size (Settings → Jobs & billing → Photos, Medium the default), the `report_photos` table and the `report-photos` bucket at 2 MB (`20261029220000_report_photos.sql`, pushed on 2026-10-30, in the types since #6497), `photo-save`'s third source (deployed as version 62 at 14:13Z on 2026-10-30, byte for byte main's), the photos on the report card, the guide *take photos for a report*. The live run into Drive is next. |
| 3 · 44 px everywhere a tech presses | v2.6089 | built 2026-10-29, live since the 02:00Z deploy on 2026-10-30: `lib/phonePress.ts` holds the heights; the whole-job percent's five chips stand 44 px; the job window's activity pills and the ＋ Report chip stand 32 px on a phone; `phonePressTargets.render.test.tsx` holds every daily press at 375 px. |
| the Leaving PR (decision 6) | v2.6091 | built 2026-10-29, live since the 00:10Z deploy on 2026-10-30: `leavingOpens` in `lib/jobs/jobWindowBar.ts`; the bridge's `registerOnMyWayOpener` / `requestOnMyWay`, which Job Mode's card answers with its sheet on the day's next block; the Clock In window at z 1020 beside Update Focus, above the job window. |
| 8 · clock out in one press | v2.6092 | built 2026-10-29, live since the 04:57Z deploy on 2026-10-30: `lib/clock/clockOutNote.ts` writes the note from the day's reports; the review is called Clock out and fills it when it opens, only while the box still holds what it opened on; the card reloads after its own press through the bridge; the pinned row's Job Report button leaves Job Mode at every width. |
| 6 · a photo answers a checklist question | — | can start: #164's checklist tables (v2.6077) were pushed on 2026-10-30 and are in the types |
| 7 · the bar and the queue on these screens | — | #163's PR 2 is on main (v2.6099: the store, the bar on #183's strip, the clock through the queue); the field report through the queue waits on #163's PR 3, and #163 keeps photos out of its train (its call of 2026-10-29), so the photos' leg is this PR's own |

PRs 2 and 4 were checked at 375 px as the dev before merging, nothing pressed that saves. The press bar
sat right above the tab bar in all six of the card's states. The plain window was opened with a
helper's role in a throwaway copy, and the tabbed window as the office. Every bar button stood
48 px and fit 375 px with no sideways scroll. Note opened its sheet with the box focused.

Where the build differs from the mock-up:

- The Tally button stays at the top of Job Mode. The mock-up drops the whole row, and techs use
  Tally.
- The day's press keeps its words, Clock In and Wrap Up Day.
- Leaving opens the On my way sheet only when the day has a next job, as decision 6 answered on 2026-10-29. With none it opens Update Focus, which flow 8 does not draw.
- Close stays the last thing in the plain window's scroll.
- The stage rows stay one open at a time (every row in view with its number, as before); the open row's control is what changed. Every control open at once would push Save off a 375 px screen on a four-stage job.
- Leave report's whole-job percent on a one-line job keeps its five chips and slider, the chips at 44 px since PR 3; the stepper's one-stage job takes the new control, as the brief named it.
- The camera opens on a phone only (≤ 640 px) for the field roles; at a desk the same input is an **Add a photo** tile, so the office never gets a file picker in its face.
- Save waits while a shot is still on its way, instead of saving without it; the mock-up's *Save never waits* is #163's queue, PR 7.
- Decision 4's second half found no Needs you line that asks the office for a folder link in the code; the sweep writes *That job has no Drive folder yet.* on the row and the report card reads it. The line itself is a follow-up below.

Not tried on a real iPhone: the keyboard rising under the Note sheet.

**The live run, 2026-10-27.** On the owner's yes, every press on both bars ran to its saved
result on the ZZ test job, as the dev at 375 px, and was then undone.

- **The press bar.** On my way clocked in as on the way and sent no text, since the dev's role
  does not text from the phone. I'm here stamped the arrival with its toast. Leave report filed
  a Note report, so the job's unset percent stayed unset. Turnaway filed its report and its
  dispatch request. Wrap Up Day ran the whole clock-out. % done stays hidden for the dev, as
  built.
- **The job window.** A viewer on the crew got the four-button bar, Status ▾, the verb, the
  stamp and Note, at 48 px with nothing cut. Arrived flipped the stamp to Leaving. Note's sheet
  saved to the thread. Status ▾ and the verb moved the job forward, and it was sent back.
- **The widths.** At 768 px and on a computer neither bar draws, and the card keeps its own
  buttons.
- **Undone.** The two reports, the clock session, the schedule block and the crew row were
  deleted, and Recently deleted keeps them for 90 days. The dispatch request was closed with a
  note. Nobody can delete the rest, so it stays on the ZZ test job: four job notes, two status
  changes, four activity lines and two Day book lines.

**The second live run, 2026-10-29.** The five new PRs together, on the phone preset at 375 px as
the dev with Job Mode on, on the ZZ test jobs 1088 and 1085, with two schedule blocks put on the
day for the run and taken off after.

- **Clock in.** Start here instead on the On my way sheet clocked in on 1088; the bar then read
  Turnaway and Clock out at 44 px over Leave report and On my way at 56 px.
- **The camera-first report.** Leave report clicked the back-camera file input once
  (`capture="environment"`, the pane's proof); the form drew the stage rows with 48 px picks and
  56 px steps, a 44 px camera on every row, What got done with the folds under it, and Not now
  beside Save · job 0% at 48 px pinned at the foot. A generated shot shrank in the worker, 399 KB
  to 73 KB at 1600 px, and its send was refused *Bucket not found* with Retry, since the bucket
  waited on the push; Save was not held. A pick of 50 on Rough In saved the report with Rough In
  at 50 on its line and the job at 17%.
- **Leaving.** On the job window's bar, Leaving at 48 px stamped the note and opened the On my way
  sheet for PLUM 1085 at z 1100 over the window at 1010.
- **Clock out.** The bar's Clock out opened the tally gate, then the review as *Clock out* with
  the note filled from the report and the line under it. Complete clock out kept the note on the
  session, and the card read *Ready to start · PLUM 1085* with no reload.
- **A bug the run caught**, fixed before PR 8 was armed: the note was filled inside a state
  updater with a side effect, which React's dev StrictMode double invocation undid, so the box
  kept the clock-in words under the filled line. The fill is plain state updates now, with a
  StrictMode render test.
- **Undone.** The report, the session, the two blocks, the two fixtures added for the run and
  the crew row the blocks' trigger made were deleted; the job's percent went back to none. A crew
  row on 1085 from 2026-10-20 went with them by mistake and was put back with its id and date.
  Left on 1088 as the first run left its own: the Leaving stamp note and the percent's thread note.

## The mock-up

[`mockup.html`](./mockup.html), served at `/to-dos/phone-first/mockup.html`. Six pairs at 375 ×
812 with the status bar inset drawn. They are the five screens before and after, and the
camera-first report press by press with the photo shrink. Every after names the presses it saves,
section 7 counts them, and section 8 draws each act's flow one frame a press, as the owner asked
on 2026-10-26.
Luis Ortega, Dana Whitfield, Priya Natarajan, Ridgeway Builders on Lot 14 Cedar Bend, and every
street and number are made up. The desktop is out of scope.

## Follow-ups

- **The report form's percent.** Done in PR 5a (v2.6076): the percent opens on the job's number
  and `AdditionalReportModal.render.test.tsx` opens a one-line job at 40%, presses Save with
  nothing touched and reads 40 on the insert.
- **A Needs you line for report photos with no folder.** Decision 4 counted on a line that asks
  the office for a folder link; none exists. One line for the office, *N report photos wait for a
  Drive folder on job 972*, opening the job window's Documents tab where **Make the job's Drive
  folders** is.
- **Rows no report holds.** A form closed by the app itself (not by Not now) leaves its
  `report_photos` rows and bucket objects with no `report_id`; the sweep never files them. A
  nightly sweep of rows older than a day, or the queue of #163 once the form rides it.
- **The Job Report button in Job Mode.** Done in PR 8 (v2.6092): the pinned row's button leaves
  Job Mode at every width.
- **The manual Clock In's typed plan.** Decision 5, answered 2026-10-29: it stays.
- **The card after its own clock-out.** Done in PR 8 (v2.6092): the clock button says when the
  session changed under it and the card reloads at once.
- **Leaving's window opens behind the job window.** Done in the Leaving PR (v2.6091): the Clock
  In window moved from 1000 to 1020 beside Update Focus, and the On my way sheet stands at 1100,
  both above the job window at 1010.
- **Add me to the job crew.** Done by punch list #196 (v2.6066): the add-a-job window on My
  Schedule drops the box and says the job joins your crew.
- **A Turnaway's dispatch title.** It shows a dash where the job number belongs when the job's
  number sits in the Click number field.
