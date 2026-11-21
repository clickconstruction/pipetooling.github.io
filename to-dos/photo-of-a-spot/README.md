---
name: "A photo keeps its spot on the job"
number: 413
group: ready
status: asked by Taunya 2026-11-21 as an idea to explore · read from the code, counted through the dev seat and drawn the same day · gone over a second time on her word *is this the best we can do?* · her word to card it the same day · three changes of hers drawn in the same day · her word the same day to build it all in the session that carded it, *Please build it all here* · building on claude/413-*, step 0 is v2.8186, the new place sheet is v2.8188, Photo of a spot is v2.8191, Keep this spot on the job is v2.8193, places kept at the address and place rows are v2.8200, and a photo's own spot is v2.8201
summary: >
  Taunya asked whether photos should be tied to places on a map, perhaps on a Map tab of the job
  window. Half of it is in the app and unused: a job can keep named places with a mark, a line of
  words, a dot and one photo each, and nobody has set one. The other half is missing: no photo keeps
  where it was taken. The card's plan is a camera-first door onto the places the app has. One press
  on a job, or on a photo being added, opens the place sheet with the photo in it and the dot where
  the person stands. The sheet has big presses, asks what is buried, takes a description as long as
  it needs to be, and has one wide press for anything not on the list. One small migration and no new
  tab. A Map tab waits until jobs hold enough places to need one.
next: The migration alone and pushed, then PR 1 and PR 2, then the later steps in order. Taunya's word covers them all.
size: S as a train of three (XS · S · S), then M for the later steps if the places get used
blocker: None. A real phone on a real site is the walk no session can do.
opinion: build, small — the places exist and nobody has set one, so the work is a quicker door onto them and not a new surface
---

# A photo keeps its spot on the job (#413)

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

2b. **A spot set with no signal waits on the phone (S).** A new kind of waiting press, with the
   photo's bytes kept as a job photo's are (`src/lib/offline/outbox.ts`,
   `src/lib/offline/keptPhotos.ts`).

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
6. **A buried line with its length (S).** A walked line tied to a photo taken before backfill. The
   app can walk a line and say its length today.
7. **More than one photo on a place (S).** Open and covered.
8. **A Map tab for the office (M).** Once a job commonly holds five or more places.

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
   this for service work, and it changes who can read a place.
5. **Should every job photo keep the phone's spot without asking.** Clock punches and reports
   already do. It is a record of where a worker stood, so step 3 wants a yes in words, and the guide
   should say it plainly.
6. **Is a spot's photo also filed in the job's Drive folder.** A place's photo is not today.
7. **May a customer be sent their places as a matter of course, or only when they ask.**

## How to verify

- **The migration.** After the push, read the check on `painted_map_places.words` back from prod.
  It allows 4,000 characters. The app still cuts a place's words at 160 until PR 1.
- **PR 1.** On a ZZ Test job, standing outside, press **Photo of a spot**, take a photo, press a
  kind and **Add this place**. Press **Buried line**, then **Sewer**: the place is named for it and
  draws green on the job's maps. Press **＋ Something else** and type a name. Type a description of
  several hundred characters, then read it whole on the opened place and short on its row, on a
  printed page and on the place's link. The place's row holds a point within the phone's margin, the margin,
  the kind and a photo. Do it again indoors, where the reading is rough: the dot sits on the job's
  address and the row holds no margin. Do it once in airplane mode. Open the job as a second person
  on its team and read the place. Delete the places and their photos after.
- **PR 2.** Add two photos in the Job photos window and keep the spot of one. One place is made, and
  both photos reach the job's Drive folder as today.
- A real phone on a real site is the walk that matters. A desktop browser has no reading to give.

## Picking this up

For a person or a session on another computer, starting cold.

- Read `CLAUDE.md`, then `AGENTS.md`, `docs/AI_CONTEXT.md` and `docs/SESSIONS.md`. Then this card
  and its mock-up, and the guide `src/content/help/paint-a-map.md`, which is how the places work
  today.
- Put your branch in this card's `status` and drop a session card. `npm run sessions -- --brief`
  prints what the other sessions hold.
- Build in this order: the migration alone and pushed, PR 1, PR 2. Each PR claims its version, and
  ships its release note, its fragment and its part of the guide. Mark each step built on this card
  in the PR that builds it.
- Settled, and not to reopen: no Map tab in these three PRs, no Google map in the job window, a dot
  dragged by hand stays on Esri's photograph (#387, call 6), and no reading of the spot inside a
  photo.
- Taunya's to change at any time: the lists and the words under *Taunya's calls*. Build the card's
  picks and show her the sheet on a phone.
- Before step 3 or any later step, ask her. Step 3 keeps where a worker stood on every photo, and
  step 4 changes who can read a place.
- A walk writes to prod, since there is no staging. Use a ZZ Test job, and delete the places and
  their photos after.

## What was not checked

- Two crew phones, for what each gives a web page.
- Photos in the Drive folders the file index has not read yet. It has read 35 of 121 live jobs.
- What the place sheet does today with no signal.
- How the photo tables read for anyone but a dev.
