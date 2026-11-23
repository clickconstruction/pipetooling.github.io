---
name: "A photo keeps its spot on the job"
number: 413
group: close
status: asked by Taunya 2026-11-21 as an idea to explore · read from the code, counted through the dev seat and drawn the same day · gone over a second time on her word *is this the best we can do?* · her word to card it the same day · three changes of hers drawn in the same day · her word the same day to build it all in the session that carded it, *Please build it all here* · built on claude/413-*, step 0 is v2.8186, the new place sheet is v2.8188, Photo of a spot is v2.8191, Keep this spot on the job is v2.8193, places kept at the address and place rows are v2.8200, a photo's own spot is v2.8201, more photos and a buried line's length are v2.8203, the office's Map tab is v2.8204, and a place that waits for a signal is v2.8205 · every step merged and live 2026-11-21 and walked on prod the same night · the close-out, small presses raised to 44 px, is v2.8276
summary: >
  Taunya asked whether photos should be tied to places on a map, perhaps on a Map tab of the job
  window. Half of it is in the app and unused: a job can keep named places with a mark, a line of
  words, a dot and one photo each, and nobody has set one. The other half is missing: no photo keeps
  where it was taken. The card's plan is a camera-first door onto the places the app has. One press
  on a job, or on a photo being added, opens the place sheet with the photo in it and the dot where
  the person stands. The sheet has big presses, asks what is buried, takes a description as long as
  it needs to be, and has one wide press for anything not on the list. One small migration and no new
  tab. A Map tab waits until jobs hold enough places to need one.
next: Taunya's look on a phone, then her word to close the card, which deletes this folder. Step 0, two crews trying it, and her seven calls below go into the closing line, or to a card of their own if she wants one.
size: S as a train of three (XS · S · S), then M for the later steps if the places get used
blocker: None. A real phone on a real site is the walk no session can do.
ver: v2.8186 · 8188 · 8191 · 8193 · 8195 · 8200 · 8201 · 8203 · 8204 · 8205 · 8276
opinion: done — every step is built and live; what is left is a phone on a real site and Taunya's calls
---

# A photo keeps its spot on the job (#413)

## Where it stands

Every step of the plan is built, merged and live as of 2026-11-21. Both migrations are on prod. The
walks below were on prod, on the ZZ Test job JP9309, at a phone's 390 px and at 1100 px. Every row,
line and photo the walks made was thrown away with the app's own presses and read back as gone.

| Step | Version | Walked on prod |
|---|---|---|
| 0, room for a description | v2.8186 | Yes. A description of 271 characters saved and read back whole. |
| 0b, the ground for the later steps | v2.8195 | The columns, the functions and the read rule read back after the push. |
| 1, the new place sheet | v2.8188 | Yes. The kinds are 175 by 56 px, **＋ Something else** 358 by 56. **Buried line**, then **Sewer**, named the place *Buried sewer line*. |
| 1b, **Photo of a spot** | v2.8191 | Yes. The sheet opened with the photo first, and said why the dot was not where the person stood. |
| 2, **Keep this spot on the job** | v2.8193 | No. A job photo is copied to the job's Drive folder, and nothing in the app takes it back out. |
| 2b, a place that waits for a signal | v2.8205 | No. It needs a phone in airplane mode. |
| 3, a photo keeps the phone's reading | v2.8201 | No. It needs a real reading. A photo with no reading writes the same row as before. |
| 4, places follow the address | v2.8200 | No. No two test jobs share a customer address. |
| 5, the crew's window draws them | v2.8200 | By its tests only. The crew's window needs **View as**, which swaps the shared browser's sign-in. |
| 6, a buried line with its length | v2.8203 | Yes. **＋ Draw this line** painted a map named for the place, and closing it tied the line: *About 300 ft, give or take 10 ft · drawn by hand · Open the line*. |
| 7, more than one photo | v2.8203 | Yes. **＋ Another photo** saved a second photo beside the first, and the row draws it. |
| 8, the office's **Map** tab | v2.8204 | Yes. The dot and the line draw, and a press on the dot opens the place in its list. |

- **The count of opens.** A press on a place, its dot or its photo sends the open. The person who
  set a place is not counted, by design, so the walk's own opens stayed at 0.
- **Raised in v2.8276.** The walk measured **Take another**, **Remove the photo** and **Remove this
  place** at 32 px tall, **Open the line** at 32 and **Change this place** at 16. All are 44 now.
- **Still small, and not this card's.** The painted map's own link presses, such as **Remove this
  line** and **Move its corners**, are 32 px tall. **From above** and **Streets** are 34.
- **Not walked by any session.** A real camera, a real reading and airplane mode, on a phone on a
  site. That walk is Taunya's or a crew's.

The mock-up is [`mockup.html`](mockup.html): five frames, four at a phone's 380 px and one at 730 px,
in light and in dark. Purple marks what is new. The job, the names and the address on it are made up,
and the view from above and the photos are drawings.

## The ask

Taunya, 2026-11-21:

> Right now we have the ability to draw on a map, and we have the ability to mark on a map. I think
> that a reasonable next step would be the ability to associate photos with a map, which makes me
> think that perhaps a job in the modal for jobs should have an additional map tab and we should add
> a feature that allows an individual to associate photos with locations that they upload. Could you
> help me explore this feature, think through it, and the validity and the value to our service
> business?

She read the first answer, asked *Is this the best we can do?*, and said to card it. Then, the same
day:

> I'm going to let another user on a different computer do the entire thing. But there are some
> changes I want to make first. For example, deciding what is buried there. There also needs to be
> an open-ended description available. And that custom button. Needs to be easy to click

And after the card merged:

> I've decided we're going to build it all. Please build it all here.

That is her yes to every step of the plan, the later ones too. Step 3 keeps where a worker stood on a
photo, and step 4 changes who can read a place. Both are built as the card describes them.

## Taunya's three changes

All three are on frame 2 of the mock-up.

1. **Deciding what is buried there.** A press on **Buried line** asks **What is buried?** with seven
   presses: Water, Sewer, Gas, Electric, Irrigation, Cable and **＋ Something else**. Each wears the
   color a locator paints on the ground for it: blue, green, yellow, red, purple and orange. The
   place is then named for it, such as *Buried sewer line*, and its line and its mark draw in that
   color. Each is a kind of its own in `src/lib/paintedMap/paintedPlaceKind.ts`, such as
   `buried_sewer`, which the table's check already allows. No migration.
2. **An open-ended description.** The short box, *A word for whoever comes next*, becomes
   **Describe it**: a tall box that grows, with room for as much as the person needs. The table caps
   a place's words at 200 characters and the app at 160 (`PAINTED_PLACE_WORDS_MAX` in
   `src/lib/paintedMap/paintedMap.ts`), so this is the one migration. A row, a mark's label, a
   printed page and a picture draw a short form of it, and the place draws it whole when opened.
3. **That custom button, easy to click.** A press for anything not on the list, which Taunya
   confirmed the same day: *Yes, that one*. It is **＋ Something else**, the full width of the phone and 56 px tall, under the kinds and again under
   *What is buried?*. One press opens **What is it?** with the keyboard up. The place keeps the typed
   name and the plain dot, as a place with no kind does today. Every other press on the sheet grew
   with it: the kinds are two to a row and 56 px tall, where they were small chips.

The two doors, **Photo of a spot** and **Keep this spot on the job**, are 56 px tall and the full
width too.

## The short answer

Worth building for a plumbing business, at a small size, and not as a Map tab first.

- Most of what a plumber leaves behind gets buried or closed up. A photo with a spot is the only
  record of it.
- **Half of it is built and unused.** A job keeps **Places on this job** today (#393): a dot, a mark
  for its kind, a line of words and one photo. Prod holds one painted map and no place.
- **The other half is missing at the root.** No photo row holds a place, and a phone will not hand a
  web page the spot inside a photo (see *What a phone gives a web page*).
- **A Map tab would not reach the crew.** Helpers, subs, superintendents and estimators get a job
  window with no tabs. The office has seven.

So the work is a quicker door onto the places the app has: camera first, the dot set by the phone,
two presses after the photo.

## What is there today

### Places

- A painted map (#345) is lines and named places. A place is a dot with a name, a line of words, a
  mark for its kind and one photo (`src/lib/paintedMap/paintedMap.ts`,
  `src/lib/paintedMap/paintedPlaceKind.ts`, `src/lib/paintedMap/paintedPlacePhoto.ts`). The kinds
  are gate, parking, door, meter, shutoff, cleanout and hazard.
- A map belongs to one job, to one development, or to nothing yet
  (`supabase/migrations/20261113220000_painted_maps.sql`).
- **Places on this job** is a job's own list (`src/lib/paintedMap/paintedJobList.ts`). It needs no
  painted map first. Its places wear letters and draw on every painted map of the job.
- A place row holds its point, the phone's margin when it was set from where the person stood, who
  set it and when. **The point is required**, so a place cannot be kept with no dot.
- A place's photo sits in the private bucket `painted-map-photos`. It is not copied to Drive.
- Whoever can read the job, or is on its team list, can read its places and add one
  (`on_site_can_touch_job`, last defined in `supabase/migrations/20261118010000_job_papers_lock.sql`).
  Changing one is for whoever set it and the office.
- The door is a line and a press under the job's address, on every tab of the job window and on the
  job card in Job Mode (`src/components/paintedMap/JobPaintedMapsStrip.tsx`). The sheet is
  `src/components/paintedMap/PaintedPlacePanel.tsx`.
- Setting a place today is place first: open the job, press **＋ Place on this job**, drag the dot,
  press a kind, type a word, press **＋ Add a photo**, take it, press **Add this place**.
- Painting, placing and dragging a dot happen on the old map, Leaflet with Esri's photograph. Google
  is used only to look at a saved map (`src/lib/paintedMap/paintedMapProvider.ts`).

### Photos

- A photo is added to a job from the **Job photos** window, a report, a stage checklist, a box on
  Materials on site, a task, a counter ticket, a start check and **Add a file** on the Documents tab
  (`src/components/photos/JobPhotosWindow.tsx`, `src/hooks/useReportPhotos.ts`,
  `src/components/materials/PhotoPress.tsx`).
- Each flow shrinks the photo on the phone, sends it to a private bucket and writes a row. The
  `photo-save` function then copies it into the job's Drive folder.
- A row keeps who, when, which job, which stage or report, the words and the size. No photo row has
  a place.
- The app reads the time inside a photo and nothing else (`src/lib/photos/photoTakenAt.ts`). The
  shrink redraws the photo, so the stored copy holds no spot (`src/lib/materials/photoShrink.ts`,
  `src/lib/photos/shrink.ts`).
- A place exists beside some photos: a report keeps the phone's spot when it is saved, a box on site
  can keep a dot, and a task can keep a place and one photo of it.
- A photo taken with no signal waits on the phone for up to seven days
  (`src/lib/offline/keptPhotos.ts`).

### The job window

- Dev, master technician, assistant, controller and primary get seven tabs: Job, Edit, Bill, Costs,
  History, Documents, Materials (`src/components/jobs/JobWindowModal.tsx`,
  `src/lib/jobs/jobHistoryTab.ts`).
- Everyone else gets one page with no tabs (`src/components/jobs/DetailJobModal.tsx`,
  `src/lib/jobDetailModalRole.ts`). On a phone it reads as Where, Photos, Who and What's happening.
- A job has no point of its own. Its address is placed and the point kept in `address_geocodes`.
  An address no service can place is #408.
- The job window has no live map. It shows a still of the street and the line that opens the
  painted maps.

## The count, read 2026-11-21

Through the dev seat, counts only.

| What | Count |
|---|---|
| Painted maps | 1 |
| Places, on a map or on a job | 0 |
| Tasks with a place | 1 |
| Photos added in the Job photos window | 0 |
| Photos on a report | 1 |
| Photos on a task | 0 |
| Photos of a box on Materials on site | about 100 on 4 jobs, 91 of them on one job |
| Boxes with a dot on the map | 0 |
| Photos on a bid | 11 on 2 bids |
| Reports in the last 30 days | 27 on 19 jobs, 22 of them with the phone's spot |
| Pictures in jobs' Drive folders, as far as the file index has read | 231 in Customer Pictures and 10 in Team only › Photos, across 125 jobs |

- These flows are one to three weeks old, so the numbers are a start and not a verdict.
- Even so, the idea starts from a habit people would have to learn. Crews are not yet adding job
  photos in the app, and nobody has set a place.
- Four in five reports kept the phone's spot. Most crew phones let the app read where they are.

## What a phone gives a web page

The first answer left this open. It was read up the same day.

- Chrome on Android takes the spot out of a photo before a web page gets it
  ([Google's tracker](https://issuetracker.google.com/issues/243294058),
  [a test on Android 14](https://blog.addpipe.com/geolocation-metadata-ios-android-video-files.md)).
- An iPhone takes it out of a photo taken through the page. For a photo picked from the library,
  iOS 17 and later keep it only when the person leaves **Location** on in the picker's Options
  ([WebKit 257534](https://bugs.webkit.org/show_bug.cgi?id=257534),
  [WebKit 207088](https://bugs.webkit.org/show_bug.cgi?id=207088)).

So the phone's own reading at that moment is the one source to build on. Reading the spot inside a
photo is left out of the plan. A check on two crew phones is still worth ten minutes.

## What it is for

| Moment | Who takes it | Who looks later | Today instead | Strength |
|---|---|---|---|---|
| The next crew must find a cleanout, a shutoff, a meter or a buried line | Whoever did the work, before it is covered | The next crew | Memory, a call, a text thread | **Strong** |
| A service or warranty call at the same house a year later | Same | A different tech, on a new job | Nothing | **Strong, once a place follows the address** |
| Proof of where and when work was done, for a GC, a back-charge or a lien | The crew, as they work | The office, a GC, a lawyer | A photo with a time and a name | Medium. The phone's own reading matters more here than a dot set by hand |
| An estimator's site walk | The estimator | The estimator at a desk, then the crew | Photos in a row | Medium. Strong on a large site |
| A superintendent finding what a helper reported | The helper | The superintendent | The report's words and its spot | Medium on a large site, weak in a house |
| A customer asks where their shutoff is | The crew | The customer | A call to the office | Medium. The link to send it exists |
| Looking over every photo of a job by where it was taken | Anyone | The office | The photo strip, by day | **Weak.** On a house lot every dot lands on the roof |

The last row is the warning. The value is in the few photos that show something a person must find
again, not in a dot for every photo.

## The picks

**How a photo gets its place.** The phone is read once, when the photo is taken. A good reading sets
the dot. A rough one is not used: the dot goes on the job's address, and the words say where, such
as *Garage, behind the water heater*. A person can drag the dot. Outside, that beats the phone,
since the roof and the drive are there to judge by. A photo added hours later never takes the spot
where the person stands now.

**A tab, a layer or a field.** None of the three at first. The places already have a table, a
window, letters, marks, a link and a guide, so the first step is a door onto them. A field on the
photo rows comes later, for proof. A Map tab comes last.

**The job or the site.** The address, read from every job there. The row can stay on the job that
made it, which keeps who and when. It changes who can read a place, so it is a later step and
Taunya's call. Developments already work this way for their lots.

**Who sees it.** The crew, a sub on the team and the office, by today's gate. A GC or a customer
only by a link someone chooses to send. The phone's raw reading stays inside the company.

**What it costs.** No Google load, since it draws on the old map as the Map page and Materials on
site do. #387 reads 4,269 Google loads for Nov 1 to 20 against the free 10,000. A dot dragged by
hand has to stay on Esri's photograph, which is that card's call 6, and this card does not reopen
it. A shrunk photo is a few hundred kilobytes.

**With a weak signal.** The spot is read when the photo is taken and waits on the phone with it. It
is never read when the photo sends. Setting a place must not need the map's picture to load.

## The plan

- **Step 0, no code, beside the build.** Two crews press **＋ Place on this job** with a photo on
  every job, starting with the shutoff and the cleanout. It says whether anyone opens a place later.
  It was the card's gate. Taunya's word to have it built makes it a thing to watch and not a thing
  to wait for.

0b. **The ground for steps 3, 4, 6 and 7 (S, one migration, alone). Built in v2.8195.** A photo's point on
   the job photo and report photo rows, a place's count of opens, its line and its other photos, and
   the read rule that lets a job's list of places follow its customer address. One migration, so
   each later screen ships with none of its own.
0. **Room for a description (XS, one migration, alone). Built in v2.8186.** The check on `painted_map_places.words`
   goes from 200 characters to 4,000. No new column and no new table, so the four fences are not
   called. It starts with the lock timeout, gets its page in `docs/migrations/`, and is pushed with
   `supabase db push` after its merge and before PR 1 is armed. The table held no row on
   2026-11-21. Read the constraint's real name on prod before writing the drop.
1. **The new place sheet (S). Built in v2.8188.** Taunya's three changes, on the sheet every place
   is set from: the kinds as presses two to a row and 56 px tall with **＋ Something else** under
   them, **What is buried?** under **Buried line** with each answer a kind in its locator's color,
   and **Describe it** at any length with a short form for a row, a picture's key and a text. It was
   split from the photo press so each could ship alone.
1b. **Photo of a spot, from the job (S). Built in v2.8191.** A press beside **＋ Place on this job** in
   `src/components/paintedMap/JobPaintedMapsStrip.tsx`. The camera opens at once. The place sheet
   (`src/components/paintedMap/PaintedPlacePanel.tsx`) then opens with the photo in it and the dot
   where the person stands, read once through `requestMyFix` in `src/lib/materials/myLocation.ts`
   and judged by `src/lib/paintedMap/preciseLocation.ts`. A rough reading, or none, moves no dot:
   it starts on the job's address or where the map is looking, and the sheet says why. A weak
   reading still sets the dot, with an amber line that says to drag it, which is the place sheet's
   own rule and not the mock-up's *On the house*. A photo more than five minutes old takes no
   reading. The list of places already draws each photo beside its name.
   **Not built:** a place set with no signal. Today the sheet says the save failed and keeps the
   photo and the words while it stays open. A place that waits on the phone as a photo does is its
   own step, 2b below. The guide `src/content/help/paint-a-map.md` gains a section.
2. **Keep this spot on the job, from a photo (S). Built in v2.8193.** The same sheet from one press on
   a photo in the Job photos window (`src/components/photos/JobPhotosWindow.tsx`) and on a report's
   photo (`src/components/reports/ReportPhotoTiles.tsx`), through one small press,
   `src/components/paintedMap/KeepSpotPress.tsx`. A plain photo is one press to skip. A photo whose
   own time is more than five minutes old does not take the phone's spot. The phone is read on this
   press and not when the camera opened, since the photo is already on the screen. Of the report
   forms, Leave Report alone has the press: New report, Turnaway and the edit of a saved report do
   not.

2b. **A spot set with no signal waits on the phone (S). Built in v2.8205.** Kept the way a walk that was
   never saved is, in the phone's own storage, with the photo's bytes where a job photo's wait
   (`src/lib/offline/keptPhotos.ts`), and sent by the painted maps' own host. It is not a kind of
   press in the waiting queue (`src/lib/offline/outbox.ts`), so the line at the top of the app does
   not count it: the host says how many places wait.

The card's first pick was to stop here and watch for three or four weeks. Taunya's word of
2026-11-21 is to build the later steps too.

3. **A photo keeps the phone's reading by itself (S). Built in v2.8201, on the columns of v2.8195.** Columns for the point, the
   margin and where it came from on `job_photo_notes` and `report_photos`. No new table. The column
   ships alone first. The reading rides in the waiting photo's own record
   (`src/lib/offline/outbox.ts`). This is the step that serves proof. It also counts how often a
   place is opened.
4. **Places follow the address (M). Built in v2.8200, on the read rule of v2.8195.** A job reads the places kept by earlier jobs at the same
   customer address.
5. **The crew's window draws them (S). Built in v2.8200, as rows with photos. The small picture from above
   is not built: a row opens the list's own map on that place.** Rows with photos in the **Where** section of
   `src/components/jobs/DetailJobModal.tsx`, with a small picture from above on the old map.
6. **A buried line with its length (S). Built in v2.8203.** A walked line tied to a photo taken before backfill. The
   app can walk a line and say its length today.
7. **More than one photo on a place (S). Built in v2.8203.** Open and covered.
8. **A Map tab for the office (M). Built in v2.8204.** Once a job commonly holds five or more places.

## Left out

- A dot for every photo.
- Google's map in the job window.
- Reading the spot inside a photo.
- Floor plans for inside a building.
- Any page a customer gets without someone sending it.

## What would stop it

- Step 0 runs and nobody opens a place before a visit.
- Crews go on taking photos outside the app. The second door rides on a photo flow nobody uses yet,
  which is why the first door is on the job.
- What is wanted is a way to browse all of a job's photos by where they were taken.

## What to learn in the first weeks

- How many places a job gets, and which kinds.
- How many readings are good to within about 50 feet.
- Whether anyone opens a place before or during a later visit.
- Which jobs get them: a house, a development or a commercial site.
- One true story of a tech who found something because of a dot.

## Taunya's calls

1. **The list under *What is buried?*.** Water, Sewer, Gas, Electric, Irrigation and Cable are the
   card's guess. Storm drain and a septic line are candidates. The plumbers know.
2. **The other kinds.** Backflow, water heater, sewer tap, septic lid and gas shutoff are candidates
   for a press of their own. Until then **＋ Something else** holds them.
3. **The words.** *Photo of a spot*, *Keep this spot on the job*, *Describe it* and *Something else*
   are guesses.
4. **Does a place follow the address to the next job there.** It is the strongest reason to build
   this for service work, and it changes who can read a place. Answered by her word *Please build it
   all here*: built in v2.8200.
5. **Should every job photo keep the phone's spot without asking.** Clock punches and reports
   already do. It is a record of where a worker stood, so step 3 wants a yes in words, and the guide
   should say it plainly. Answered by the same word: built in v2.8201, and the guides for job photos
   and report photos say it plainly.
6. **Is a spot's photo also filed in the job's Drive folder.** A place's photo is not today.
7. **May a customer be sent their places as a matter of course, or only when they ask.**

## Left to do and to walk (2026-11-22)

This is the one list of what is left. The build is done and live, except #9346, which is in the
merge queue. The *Where it stands* table at the top says what a session walked on prod on
2026-11-21. Everything below is for a person, and most of it needs a real phone.

### Walks still owed

Use ZZ Test jobs only. JP9309, *ZZ Test Stages Walk 2026-11-18*, is the office's test job.
JP1113, *ZZ Test Walk Project 2026-11-08*, has the sample superintendent on its team. Neither has a
customer address, and both have a Drive folder. Throw away every place, line and photo after, with
**Throw this list away** in the Places window and **Throw this map away** on a line's own map.

1. **Photo of a spot, outdoors (steps 1b and 3).** On JP1113's job window, under the address, as
   the superintendent. Use an iPhone in Safari and an Android phone in Chrome, location on, standing
   outside. Press **Photo of a spot**, take a photo, press **Buried line**, then **Water**, then
   **Add this place**. The sheet opens with the photo on top and the dot where you stand, under a
   line that says how sure the phone was. The place's row says the same. No session has a camera or
   a location to give.
2. **Photo of a spot, indoors (step 1b).** The same, inside a building, where the reading is rough.
   The dot stays on the job's address or where the map was looking, and the sheet says why. The
   place saves with no margin. No session has a rough reading to give.
3. **A place set with no signal (step 2b).** The same, with the phone in airplane mode. The sheet
   closes, and a line reads *Kept on this phone. It goes to the job when the signal is back.* A line
   above the dock counts the places that wait, with **Send now**. Turn the signal back on. The place
   reaches the job once, with its photos, and the line goes. No session can cut a phone's signal.
4. **Keep this spot on the job, from a job photo (steps 2 and 3).** In the **Job photos** window of
   JP1113, as the superintendent, on a phone outside. Add two photos and press **＋ Keep this spot on
   the job** on one. One place is made, and both photos reach the job's Drive folder as before. Open
   the kept photo: it says where it was taken. Delete the two test photos from the Drive folder by
   hand after. A session stopped here because the app copies a job photo to Drive and cannot take it
   back, and because it has no reading to keep.
5. **Keep this spot from a report's photo (step 2).** In **Leave Report** on JP1113, as the
   superintendent, on a phone outside. Take a photo in the report and press **＋ Keep this spot on
   the job** on it. New report, Turnaway and the edit of a saved report have no such press. Delete
   the test report after. Same reasons as 4.
6. **Places follow the address (step 4).** Give two ZZ jobs the same ZZ customer address, keep a
   place on the first, then open the second. As the office, and as a crew member on the second
   job's team, the second job shows the first job's places under **Kept at this address**. A crew
   member on neither job sees none of it. No ZZ job had a customer address, so a session had nothing
   to open.
7. **The crew's window draws the places (step 5).** The plain job window on a phone, at 390 px in
   light and in dark, as the superintendent on JP1113 with five places kept. Under **Where**, four
   places show as rows with their photos, then **＋ 1 more ›**. A press on a row opens the job's
   list on that place. A session would need **View as**, which swaps the sign-in of the browser
   every session shares.
8. **Walk a buried line (step 6).** On a buried place's row, on a phone outside, press **＋ Walk
   this line**, walk the trench and save. The row reads the length and *walked*, with **Open the
   line**. A session walked **＋ Draw this line** only. Walking needs a phone's readings.
9. **A second person opens a place (step 3's count).** A place set by one person, opened by another
   on the job's team, from its dot on the **Map** tab, its row or its photo. The place's count of
   opens goes up by one (`painted_map_places.opened_count`). The person who set it is never counted.
   The session walked with one account, so its count stayed at 0, as designed.
10. **Dark theme, and the 44 px presses. Walked 2026-11-22 on Micah's word *Yes, walk it*, except
    Open the line.** On JP9309 as the dev, in dark, at 390 and 1100 px. The live site at 390, then a
    dev server on `main`'s code against the live database at 1100, after another session's View as
    took the shared browser's sign-in.
    - **Measured at 44 px tall, at both widths:** **Take another**, **Remove the photo**, **Remove**,
      **Remove this place** and **Change this place**. The place sheet, the Places window and the
      **Map** tab draw in dark, with no sideways scroll at 390.
    - **Not measured in dark: Open the line.** It needs a drawn line, so a second map and a line
      row, which the yes did not cover. The code sets it at 44 px, and the 2026-11-21 walk saw it in
      light.
    - **Made:** one `painted_maps` row, the job's list. One `painted_map_places` row, *ZZ Test walk
      10*, with no kind and no words. One file in the bucket `painted-map-photos`, a made-up picture
      of nothing. A second photo was put on the sheet twice and never saved.
    - **Removed:** all three, with **Throw this list away**. Read back as the dev after: no map on
      JP9309, no place on any map, and the map's folder in the bucket lists empty.
    - **Left behind:** about four Google map loads, from the place sheet and the Places window. They
      count in #387's tally.
    - **Seen in passing:** at 390 px the **Map** tab opened on the whole country, with and without
      the place, where 1100 px fit the place at street level. Not looked into.
    - **For the next walk:** a theme set from the gear is kept for every tab of the shared browser.
      Set `data-theme` on the page's own `<html>` instead, which lasts until a reload.

### Loose ends

- **#9346 merged** at 07:25 UTC on 2026-11-22. It raised the six small presses to 44 px and moved
  this card to the close column. Nothing of the card is unmerged. Both migrations are pushed, and
  the card has no edge function.
- **Small presses seen, and not this card's.** On the painted map's window, the link presses are
  32 px tall, such as **Remove this line**, **Move its corners** and **Type a length measured with a
  wheel or a tape**. **Send more…** on a place's row is 32 px. **From above** and **Streets** are
  34 px, and the window's **Close** is 47 by 40 px. They belong to the painted map (#345) and wait
  for a sweep of their own.
- **Google map loads to watch.** The **Map** tab draws on the old map and loads nothing from Google.
  A press on a dot, a row or **Places on this job** opens the painted map's window, which shows a
  saved map on Google. Each open counts in #387's tally of loads. Watch it once crews keep places.
  Since v2.8235 (#387) the place sheet draws on Google too, so **＋ Place on this job** and **Photo
  of a spot** each count, and twice on a phone, where the glass is a second map.
- **Step 0 is Taunya's.** Two crews press **Photo of a spot** on every job for three or four weeks,
  starting with the shutoff and the cleanout. The count of opens now says whether anyone came back
  to a place.
- **Taunya's calls still open:** 1, 2, 3, 6 and 7 under *Taunya's calls*. One more is hers: whether
  the crew's rows also want the small picture from above that step 5 named. A row opens the list's
  own map instead.
- **Closing the card is her word**, once #9346 has merged. It deletes this folder. The walks and
  calls left here then go into the closing line in `to-dos/README.md`, or to a card of their own.

## Picking this up

For a person or a session on another computer, starting cold.

- Read `CLAUDE.md`, then `AGENTS.md`, `docs/AI_CONTEXT.md` and `docs/SESSIONS.md`. Then this card
  and its mock-up, and the guide `src/content/help/paint-a-map.md`, which is how the places work.
- The build is done. What is left is under *Left to do and to walk*: walks on a real phone, and
  Taunya's calls.
- Settled, and not to reopen: no Google map in the job window, a dot dragged by hand stays on Esri's
  photograph (#387, call 6), and no reading of the spot inside a photo.
- Taunya's to change at any time: the lists and the words under *Taunya's calls*.
- A walk writes to prod, since there is no staging. Use a ZZ Test job, and delete the places and
  their photos after.
