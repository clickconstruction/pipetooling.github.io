---
name: "Paint a map: walk it, drive it or draw it by hand, keep the line on the job, and share it by a link"
number: 345
group: gated
status: asked 2026-11-13 · the card and the mock-up the same day · nothing built · waits on the owner's calls
summary: >
  The owner's idea: a person walks with precise location on, the phone draws their line on a map,
  and they share it. For measuring, for showing where to drive, how to get into a place, and what
  things are. Read against what a phone's browser can do: it can follow a person who walks or
  drives with the screen on, within about 16 ft under open sky, and it cannot follow a locked
  phone at all. So a phone in a pocket draws nothing, and a walked length is a rough guide, never
  a number to price from. The card proposes one thing, a painted map: lines, places with a word
  and a photo, a name, and a job. A line is walked, driven or drawn by hand on the view from
  above, and drawing by hand is the better way for a drive and for a length. One link with no
  sign-in shows it to a customer or a driver, with a dot for where they are. Location is read
  only while a red bar says Painting, and nothing leaves the phone until the person saves.
next: The owner reads the mock-up and answers the eight calls. A yes to call 3 starts the one-day try on his own phones.
size: L as a train of six after a one-day try (S · S · M · M · M · S · S)
blocker: The owner's calls, first of all whether walking with the screen on is good enough to build.
opinion: build the one-day try, then PRs 1 to 4, then count. Strong for the way in and what is where, weak for measuring.
mockup: to-dos/paint-a-map/mockup.html
---

# Paint a map (#345)

## The ask

The owner, 2026-11-13:

> A person could track themselves and walk with GPS precise location turned on, and draw a line on
> a Google Maps overlay they could then share with other people. This could be a useful tool for
> measurement, or showing other people where to drive, or showing people how to get into places,
> or what things are. I think it could be called "paint a map", and then it tracks your phone and
> you can confirm or stop or restart the line later. What are your thoughts on this?

He asked for thoughts. This card is the thinking, the plan and the calls, and
[mockup.html](mockup.html) is the picture. Nothing is built.

## My thoughts, in short

It is a good idea, and its strong half is not the tracking. The strong half is the thing it leaves
behind: **the way in and what is where, saved on the job, opened by a customer or a driver from a
text with no app and no sign-in.** Walking is one of two ways to make that, and for two of the four
uses it is the weaker way.

| His use | How strong | Why |
|---|---|---|
| **Where to drive** | Strong | A new development's drives are on no map yet, so no maps app can route there. Drive it once with the phone on the dash, or draw it by hand from the office in a minute. A few feet either way do not matter to a truck. |
| **How to get into a place** | Strong outdoors, weak at the door | The line gets someone to the right gate and the right side of the building. Sixteen feet of doubt can put a line on the wrong side of a fence, so the person fixes it by hand before saving. Indoors the phone is lost, and a photo of the door does the last steps. |
| **What things are** | Strong | A named dot with a photo: the gate, the meter, the shutoff, the laydown yard. The app built exactly this for a task a day ago (#328). A painted map holds several. |
| **Measurement** | Weak | A walked 50 ft can read 35 or 65. A walked 500 ft is good to a few in a hundred in the open. That is *about how far*, never a trench length that gets priced. A line drawn by hand on the view from above measures better, and a wheel or a tape typed onto the line is the number to trust. |

Three ways it could disappoint, said now so they are not found later:

1. **Someone prices from a walked length.** The screen must never look more sure than the phone
   is. Every length reads *about*, with its give or take.
2. **Someone puts the phone in a pocket.** The line stops when the screen locks. No browser on any
   phone can change that. The honest product is *walk with the screen on, in your hand*.
3. **Nobody paints one.** The app has three optional location presses already and the record of
   2026-11-12 says they are skipped: 2 of 211 dispatch requests carry a location and 0 of 102
   boxes have a spot on a site map. So the train is short and stops to count.

## Can a phone's browser do it well enough?

The app is a web page, installable on a home screen, not a native app. Checked against current
browser documents on 2026-11-13. Sources are at the foot.

### How close

- **Under open sky a phone is typically within about 16 ft (4.9 m).** That is the figure the U.S.
  government's GPS site gives for phones, and it says the figure worsens near buildings, bridges
  and trees. Studies put a phone at 16 to 65 ft (5 to 20 m) among buildings and trees.
- **A reading's own margin is a two-in-three claim.** The browser hands each reading an accuracy in
  metres, and the standard defines it at the 68 percent level. One reading in three falls outside
  its own ring. So the app's give or take on a length is wider than the ring.
- **A moving line is better than its dots.** Readings a second apart share most of their error, so
  a walked line is usually the right shape, shifted a few feet. The shape is what a route needs.
- **High accuracy is a request, not a promise.** The standard calls `enableHighAccuracy` a hint
  the phone may ignore, at a cost in battery.
- **Indoors there is no fix worth drawing.** The margin grows to hundreds of feet. The app says so
  and draws that part faint.

What that means for each use:

- **A route to drive or walk:** metres are fine.
- **A gate or a side door:** usually enough to pick the right gate. Not always enough to pick the
  right side of a wall. The person looks the line over and fixes it before it is saved.
- **Measurement, bluntly.** These are my reckoning from the 16 ft figure, not measurements. Step 0
  of the plan measures them on the owner's own phones.

| Run | Walked, in the open | Walked, beside buildings or under trees | Drawn by hand on the view from above |
|---|---|---|---|
| 50 ft | reads about 35 to 65 | worse, can be off by the whole run | within a few feet, when both ends can be seen |
| 500 ft | reads about 475 to 525 | about 450 to 550 | within a few feet, when both ends can be seen |

A raw track also reads **long**, because every wobble adds length and none takes it away. A known
study walked a marked square and found a cheap receiver 10 to 20 percent long. The app cleans the
line before it adds it up, which removes most of that, not all.

**Phone GPS is the wrong tool for a trench length that gets priced.** A wheel or a tape is right.
The painted line can carry that number, typed in, and show it in place of its own guess.

### The screen-lock question

- **A browser gives a page its position only while the page is on the screen.** The standard says
  position updates are for visible pages only. A locked phone, another app in front, or an
  incoming call all stop the readings.
- **This holds in iOS Safari, in an installed home-screen web app, and in Android Chrome.** The
  reports from developers agree, and nothing in the standard allows otherwise. An installed web
  app gets no more than a tab does.
- **So *walk with the phone in your pocket* is not possible without a native app.** The honest
  version is *walk with the screen on*.
- **The Screen Wake Lock API holds the screen on.** It works in Safari on iPhone since iOS 16.4, in
  a home-screen web app since iOS 18.4 (it was broken there before), and in Chrome on Android. The
  browser lets go of it whenever the page is hidden, and the app asks again when the page is back.
  It can be refused when the battery is low.
- **What it costs.** The screen and the location radio together are among the heaviest things a
  phone does. Ten minutes is nothing. An hour is a real bite of a battery. That is one reason
  painting ends by itself.
- **When the screen does go off,** the app does not pretend. The line gets a gap, the person is
  told why, and *Keep painting from here* starts the next stroke.
- **A phone on a dash mount is the easy case.** The screen is on, the sky is open, and a drive is
  the use where a few feet matter least.

### Permissions, prompts and no signal

- **The first press asks.** The browser's own prompt appears on the first *Start painting*, never
  before. The page must be on https, which it is.
- **iPhone has two switches.** *Safari Websites* must be allowed, and **Precise Location** must be
  on. With it off the phone hands the page a rough spot with a margin of a mile or more. The app
  reads that margin and says how to turn the switch on. The exact path on a home-screen app is to
  be checked on a real phone in step 0.
- **iPhone may ask again on another day.** Safari does not always remember a yes for long. A
  nuisance, not a blocker.
- **Refused:** the person can still draw by hand. Nothing dead-ends.
- **No cell signal is fine for the line.** The phone finds itself from satellites. The first fix is
  slower without a signal. The picture under the line may be blank, and the app says so.
- **Kept and sent later.** Readings are written to the phone as they come, so a reload does not
  lose a walk. A map saved with no signal waits on the phone and sends itself, the way a field
  report and a job photo already do (`src/lib/offline/outbox.ts`, the outbox, which would gain one
  kind).

## What the app has today

Read on main, 2026-11-13.

- **Installable.** `vite.config.ts` builds a home-screen web app named ClickTooling, standalone,
  with a service worker (`src/sw.ts`) that keeps the app's own files and takes push. It keeps no
  map pictures and has no background work.
- **Two map stacks.** Leaflet on free OpenStreetMap tiles is the default everywhere
  (`src/components/map/PinsMapCanvas.tsx`). Google's map (`PinsMapGoogleCanvas.tsx`) draws only
  when the `VITE_GOOGLE_MAPS_BROWSER_KEY` key is set, on the Dashboard, Pipeline, Bids and
  clocked-in maps, and falls back for good if it fails.
- **A view from above.** Materials on site (`src/components/materials/OnSiteMap.tsx`) and the task
  maps (`src/components/checklist/TaskPlacesMapCanvas.tsx`) draw Esri World Imagery with a Streets
  switch, on Leaflet.
- **Shapes, but no line.** Court areas are drawn as areas, and the Map page loads a drawing tool
  (`@geoman-io/leaflet-geoman-free`) with line drawing switched off. Nothing in the app draws a
  line today. The drawing tool is already in the bundle.
- **Distance.** `haversineMeters` in `src/lib/jobTravelEstimate.ts`.
- **Location, one reading at a time.** `requestMyFix` in `src/lib/materials/myLocation.ts` asks
  with high accuracy and keeps the margin. Clock in takes a coarser reading without a press. No
  code calls `watchPosition` and none holds the screen on. **Nothing follows a phone.**
- **A place on a task** (#328, v2.7058 to v2.7067, `to-dos/task-places/README.md`). A named point
  with its margin in metres, a photo of the spot, Directions, *How far am I?*, and a map at the top
  of Today. Its door for a doer refuses a reading worse than 46 m. Its card ruled lines and areas
  out as *a tool of its own*. This is that tool.
- **Directions.** `src/lib/directionsUrl.ts` builds a Google Maps link to a point and
  `openInExternalBrowser` opens it.
- **The job and the development.** The job window has an address link and a street picture, and no
  map of its own. Its Materials tab draws the boxes on the view from above. The Development page
  (`developments/:id`) has no map. A job carries `development_id`.
- **The clocked-in map** draws the *jobs* that people are clocked in on, at each job's address,
  with a head count. It never draws where a person is. The punch's own reading is kept on the
  clock session and is not on that map.
- **Public pages with no sign-in.** `/show/<code>` (First look), `/r/<code>` (a receipt link),
  `/b/<code>` (a box). Each has its own table and one function as the only door for the signed-out
  reader (`first-look`, `receipt-link`, `box-read`). The newer two mint a ten-letter code, keep
  only its hash, and end by a date: 7 days and 14 days. Each has its line in
  `docs/ACCESS_CONTROL.md`.
- **Texting a link.** `TellCustomerSheet` and the Messages reply box send from the company's
  number through `quo-send`. A contract's signing link and the First look link already go out this
  way.
- **Taken addresses.** `/m/<code>` is a machine's code and `/map` is the Map page. The shared page
  here is `/way/<code>`.

## The thing: a painted map

One object, small on purpose.

- **A painted map** has a name, the person who started it, and what it is for: a job, a
  development, a customer, or nothing yet. All optional but the name.
- **It holds lines.** A line is one stroke: a stretch walked, driven or drawn by hand, with its
  length, how it was made, who made it and on what day. Stop and restart make a second stroke on
  the same map. So does *Add to it* next week.
- **It holds places.** A place is a named dot with a word for whoever comes next and a photo. The
  same thing a task carries. A place need not sit on a line.
- **A saved line is a shape only.** It keeps its points and no clock along them. It cannot say how
  fast someone walked or how long they stood anywhere.

### Stop, confirm, restart

His three words, as presses:

- **Pause** stops the reading at once. The bar turns grey and says *Nothing is being read*.
- **Keep painting** starts the next stroke from where the person now stands. If the screen went
  off, the app offers to join the gap with a straight line or leave it open.
- **Done** opens *Look it over*: the whole line on the map, before anything is saved.
- **Save the map** is the confirm. **Throw it away** leaves nothing, on the phone or anywhere.
- **Add to it**, on the saved map, is the restart on another day, by anyone who may open the job.

### Fixing a line that wandered

- **Cleaning, by itself.** Readings with a poor margin are drawn faint and left out of the length.
  The scribble a phone makes while a person stands still is dropped. The line is smoothed.
- **Trim an end.** Drag the handle at the start or the finish. The usual fault is the knot at each
  end, where the person stood getting ready.
- **Redraw a part.** Press the faint part, then press along the right way. Each press is a corner.
  The redrawn stretch says *drawn by hand* on the saved line.
- **Move a place.** Drag its dot on the view from above.

### Drawing by hand, with no walking

Yes, and in the first build. Press along the route on the view from above and each press is a
corner.

- **For *where to drive* it is often better.** The office draws the route in a minute and nobody
  goes out.
- **For a length it is better.** Both ends are put where the picture shows them.
- **It asks for no location.** No prompt, no screen held on, nothing to worry a tech.
- **Its limit is the picture.** A new development can be a bare field in a picture a year or two
  old. Where the drive cannot be seen, walk or drive it once. That is where walking earns its keep.

### Length, said honestly

- Always *about*, rounded to the nearest 10 ft, with its give or take and how it was made: *About
  830 ft, give or take 40 ft, walked*.
- **A measured length wins.** *Type a length measured with a wheel or a tape* puts the real number
  on the line, and the line shows it from then on: *612 ft, measured with a wheel*.
- No area and no height in the first build.

## Where it lives and what it reuses

- **On a job:** a *Painted maps* block in the job window, which has no map of its own today.
- **On a development:** the same block on the Development page. *The way in for deliveries* belongs
  to the whole site more often than to one lot.
- **From anywhere:** *Paint a map* under the header's ＋, tied to nothing until the person picks.
- **On a task, later:** a task's place gains the painted map that leads to it. *Where the work is*
  becomes a dot and its way in.
- **On the Map page and Materials on site's map, later:** painted maps as a layer.

**The map under it: Leaflet, with the view from above.** It is what the task maps and the box map
already draw, it is free, and the drawing tool for lines is already loaded. The owner said *a
Google Maps overlay*. Honestly:

- The line is drawn on the app's own map. **Directions** opens Google Maps at the start, as every
  Directions press in the app does.
- A Google base map needs a browser key with billing. Since March 2025 Google gives each map
  product a free count each month, 10,000 loads for the basic map, and bills past it. Every open
  of a shared link would count.
- My pick is the free maps. If the owner wants Google's picture under the line, it is a switch for
  later, on the screens that already choose between the two.
- One thing to read at PR 4: the terms of the free picture providers for a page customers open.

**Reused as it stands:** `OnSiteMap`'s layers and its ring, `requestMyFix` and its refusal words,
`haversineMeters`, `directionsUrl.ts`, `openInExternalBrowser`, the photo shrink and the outbox,
the estimate link's code shape, `TellCustomerSheet`, the *Hide map* fold.

**New:** following a phone (`watchPosition`), holding the screen on, a line on a map, and a page
that shows a map to someone who is not signed in.

## Sharing

- **One link, no sign-in:** `clicktooling.com/way/<code>`, on the pattern of First look and the
  receipt link. Its own table, a ten-letter code kept only as a hash, and one function as the only
  door for a signed-out reader.
- **What the page shows:** the map's name and one line of words, the lines, the places with their
  words and photos, **Directions to the start**, and **Show where I am**.
- **What it never shows:** who painted it, when, the job, the customer, a price, or any other
  thing in the app. The company's name is the only name on it.
- **Show where I am** puts the reader's own dot on the map so they can follow the line. It is
  asked for on a press, it moves while the page is open and the screen is on, and it never leaves
  their phone. The page says so in those words.
- **Who may make a map:** anyone who may open the job. **Who may share one:** the office and the
  person who painted it. Both are the owner's calls.
- **Ending a link:** *End this link now* on the map, and a date it ends by itself. An ended link, an
  expired one and a wrong code all read the same: *This map is no longer shared.*
- **Texting it:** *Text it…* opens the composer on the job's customer, from the company's number,
  with the link in the words.
- **A gate code never goes on a painted map.** A link carries whatever is on the map to anyone who
  holds it. The place sheet says so.

## Privacy and trust

This is the first thing in the app that follows a phone. Said plainly:

- **Only while painting.** Location is read from *Start painting* to *Pause* or *Done* and at no
  other time.
- **Unmistakable.** A red bar across the top says *Painting* with a running clock the whole time,
  and the phone's own location mark shows in its status bar.
- **It cannot run unseen.** A web page is not given a position while it is off the screen. The
  limit that rules out a phone in a pocket is the same limit that protects the tech. The app
  cannot follow a locked phone even if someone wanted it to.
- **It stops by itself.** Five minutes standing still pauses it. An hour ends it. Both numbers are
  the owner's call.
- **Nothing leaves the phone until Save.** The readings live on the phone while painting. The
  office sees nothing live. *Throw it away* deletes them, and so does a day going by.
- **Only the confirmed line is kept.** A shape, with no clock along it. No speed, no stops, no
  trail before the start or after the end.
- **Never a record of a person.** A painted map is not shown on the clocked-in map, is not read
  against hours or pay, and is not proof of where anyone was. I would write that into the guide.

**Beside the clocked-in map.** That map shows which job a person is clocked in on, at the job's
address. It never shows where the person stands. Painting does not change that, and painting does
not need a person to be clocked in.

**What a tech would reasonably worry about, and the answer to each:**

- *Is it on when I do not know?* It cannot be. The bar is red while it reads, and it reads only
  with the screen on.
- *Does the office watch me walk?* No. Nothing is sent until Save.
- *Did it keep my drive home because I forgot to stop?* It paused when the phone locked, and it
  shows the whole line before saving, with a trim at each end.
- *Will it be used to check my pace or my route?* The saved line has no clock in it.
- *It is my own phone and my own battery.* Ten minutes costs little. The app says to expect a
  real bite from an hour.

## What phone map apps already do

- **Google Maps** drops a pin, shares a place, and measures a distance by pressed points. Its
  drawn maps are made at a desk.
- **Apple Maps** drops and shares a pin.
- **Hiking and fitness apps** record a walk with the phone locked in a pocket, and share a link.
  They are native apps, which is why they can.

So recording a walk is not new, and a native app does the recording better than a web page ever
will. What none of them does is the reason to build it here:

- **The line is on the job,** next to its photos, its boxes and its tasks, for the next person and
  the next year.
- **The customer or the driver opens it from the company's text,** with no app and no account.
- **A task can point at it.**
- **The office can draw one without anyone going out.**

If the built thing is only a worse recorder, it failed. Its worth is where the line ends up.

## Underneath

- **Storage, one migration.** Three tables, since strokes and places are added by different people
  on different days and must not overwrite each other:
  - `painted_maps`: name, a line of words, `job_id`, `development_id`, `customer_id` (each may be
    empty), who started it and when.
  - `painted_map_lines`: the map, its order, how it was made (`walked`, `driven`, `drawn`), the
    points as pairs with no time, the length and its give or take in metres, a measured length and
    how it was measured, who and when.
  - `painted_map_places`: the map, a name, a word, the point, the margin in metres (empty when
    placed by hand), who and when, and the photo.
  - The file opens with `SET lock_timeout = '3s';` and ends with the four fence calls a new table
    needs. Additive and idempotent, numbered from main and claimed, pushed after the merge.
- **Who reads and writes.** Whoever may read the job reads its painted maps. A map tied to nothing
  is read by its maker and the office.
- **The link, a second migration.** `painted_map_links`: the map, the code's hash, who made it,
  when it ends, when it was ended, how many times it was opened. Minted by a function in the
  database on the estimate link's pattern. Read by one edge function, `painted-map-link`, as the
  service role, which answers with the name, the lines, the places and the photos and nothing
  else. A line for it in `docs/ACCESS_CONTROL.md` and a section in `docs/EDGE_FUNCTIONS.md`.
- **How a photo reaches a signed-out reader** is the one open design point, settled in PR 4. First
  look and the box page each solved a version of it.
- **Kernels first,** in `src/lib/paintedMap/`, all pure and tested: clean a track (drop the poor
  readings, the standing scribble, the too-close points, then simplify), a line's length and its
  give or take, the length words, when to pause, the gap after a hidden page, the words for each
  refusal, what the shared page may carry.
- **The phone side.** `watchPosition` with high accuracy and no cached reading. The screen held on
  with `navigator.wakeLock`, asked again when the page returns, and a plain line where a phone
  does not have it. Readings kept in the phone's own store while painting.
- **The shared page** is its own small entry, as `/show` is, so a customer's phone does not load
  the whole app to see one map. Always light.

## The PR train

Each ships alone with its tests, its guide, a release note and a fragment.

| Step | What | Migration and door | Size |
|---|---|---|---|
| 0 | **A one-day try.** A page for devs only that paints a walk on the screen and saves nothing. The owner walks a taped 50 ft and 500 ft on an iPhone and an Android, in the open and beside a building, and locks the phone mid-walk. | none | S |
| | **Read the numbers.** If a walked line is worse than this card says, the train starts at drawing by hand and walking waits. | | |
| 1 | The painted map itself, no screen | one migration: the three tables. The kernels and the types. | S |
| 2 | Draw it by hand. The *Painted maps* block on a job and a development. Places with a photo. Typed lengths. | none | M |
| 3 | Walk or drive it. The red bar, the screen held on, pause and restart, the faint part, *Look it over*, trim and redraw, kept on the phone with no signal. | none (one new outbox kind) | M |
| 4 | The link. *Share a link*, the page at `/way/<code>`, *Show where I am*, *Directions to the start*, *End this link now*, *Text it…*. | one migration: `painted_map_links`. One public door: the `painted-map-link` function. | M |
| | **Stop. Count the maps painted and the links opened for two weeks.** | | |
| 5 | A task's place carries the painted map that leads to it | one small migration | S |
| 6 | Painted maps as a layer on the Map page and on Materials on site's map | none | S |

Drawing by hand is before walking on purpose. It needs no location, it proves the object, the
block and the places, and it is the half that works on every phone.

## Left for later

- **An area.** A closed shape and its square feet. Same doubts as a length, squared.
- **Height along the line.** A phone's height reading is worse than its position.
- **Sharing a walk live while it is walked.** It would mean the office watching a person move.
  That is a different promise from the one this card makes, and I would not build it.
- **A native app** that follows a locked phone. A large step: a store listing, a second code base,
  and an *Always* location permission that a tech would be right to question.
- **Bringing in a line from a hiking app.** A file such an app saves, dropped onto a painted map.
  It would give the pocket walk without a native app of our own.
- **A screen lock for a pocket.** A dark, touch-proof screen that stays on. Worth trying only if
  the try in step 0 shows people want it.
- **Map pictures kept on the phone** for sites with no signal.
- **Print** as a page with the map and the places list.

## How to verify

- **Kernels:** a clean straight track, a track with a standing knot at each end, a track with a
  poor stretch in the middle, a gap, a single reading, and a rough-location reading. Length words
  at 40, 500 and 5,000 ft. A typed length winning.
- **Locally, every write refused:** headless Chrome with Playwright's location set and moved along
  a path, then given a 60 ft margin, then refused. The page hidden and shown again mid-walk. Phone
  and desk widths, light and dark.
- **Live, on real phones:** the same taped 50 ft and 500 ft as step 0, on an iPhone in Safari, the
  same iPhone from its home-screen icon, and an Android in Chrome. Lock each phone mid-walk.
  Airplane mode with location on. Then a made-up map shared to a second phone, opened, followed
  with *Show where I am*, and ended.
- **The public door:** a wrong code, an ended link and an expired link read the same. The answer
  carries no name but the company's.

## The owner's calls

1. **Screen on.** Is *walk with the screen on, in your hand* good enough to build? My pick: yes. A
   locked phone would take a native app.
2. **Measuring.** May the app show a walked length at all? My pick: yes, as *about*, with its give
   or take, and a typed length wins.
3. **Try first.** The one-day try on your own phones before the train? My pick: yes.
4. **Who may paint and who may share.** Anyone who may open the job paints. The office and the
   painter share. Or tighter.
5. **The link's life.** Ends by itself after 90 days (my pick, since a way in is used for months),
   or lives until ended, or short like First look's 7 days.
6. **The painter's name on the shared page.** My pick: no. The company's name only.
7. **The stop.** Five minutes standing still pauses it and an hour ends it. Or other numbers.
8. **The map under it.** The free maps the app draws today (my pick), or Google's, which bills
   past a monthly count.

## Sources

Read 2026-11-13.

- W3C, *Geolocation* (the standard): updates are for visible pages only, `enableHighAccuracy` is a
  hint, accuracy is at the 68 percent level. https://www.w3.org/TR/geolocation/
- GPS.gov, *GPS Accuracy*: phones are typically within 4.9 m under open sky, worse near buildings,
  bridges and trees. https://www.gps.gov/systems/gps/performance/accuracy/
- MDN, *Screen Wake Lock API*: what it does and when the browser lets go of it.
  https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API
- Chrome for Developers, *Stay awake with the Screen Wake Lock API*.
  https://developer.chrome.com/docs/capabilities/web-apis/wake-lock
- WebKit bug 254545 and Apple's Safari 18.4 release notes: the wake lock fixed for home-screen web
  apps. https://bugs.webkit.org/show_bug.cgi?id=254545
- Ranacher and others, *Why GPS makes distances bigger than they are* (2016).
  https://arxiv.org/abs/1504.04504
- Google Maps Platform, pricing overview and FAQ: the free monthly count per product since March 2025. https://developers.google.com/maps/billing-and-pricing/overview
- Not found in any official document, and so left to step 0: Apple's and Google's own statement of
  what a web page gets with the screen locked, and how the margin reads with Precise Location off.
  The developer reports agree with the standard, and a real phone settles it.
