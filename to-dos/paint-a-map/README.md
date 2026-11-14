---
name: "Paint a map: walk it, drive it or draw it by hand, keep the line on the job, and share it by a link"
number: 345
group: close
status: asked 2026-11-13 · the card and the mock-up the same day · the owner liked the basics and asked three things the same day, each added · the owner's word the same day (*Build it all*), every call taken at the card's pick · nine PRs built and merged 2026-11-13 and 14 (#8029, #8043, #8047, #8052, #8053, #8054, #8056, #8057 and the types in #8073), both migrations pushed and `painted-map-link` deployed on his yes · step 0 (the one-day try) skipped, step 5 (a task's place carries the map) and *Text it…* not built · not yet tried on a real phone
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
next: The owner's try on a real phone: walk a short line on his own job card with the screen on, lock the phone mid-walk, save, share the link to a second phone and end it. Then his word on step 5 and on *Text it…*.
size: L as a train of eight after a one-day try (S · S · M · M · M · M · S · S · S)
blocker: None for what is built. The walk, the screen held on, the pause on lock and the phone's share sheet have only been walked in a headless browser, so the first real walk is the proof.
opinion: built as carded. Strong for the way in and what is where, weak for measuring. Count the maps painted and the links opened for two weeks before step 5.
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
[mockup.html](mockup.html) is the picture.

## What is built

2026-11-14: the owner said *Build it all* and that he would test it once it was live. Every call
below was taken at the card's pick. The guide is `/help/paint-a-map`.

| Step | PR | Version | What went in |
|---|---|---|---|
| 1 and 2 | #8029, #8043 | v2.7202, v2.7211 | The three tables, drawing by hand with the magnifying glass, places with a photo, the line under the address |
| 3 | #8047 | v2.7220 | Walk or drive it, on a tech's own job card and on *On my way* |
| 4 | #8052 | v2.7223 | The link, the page at `/way/<code>`, *Show where I am*, a code to scan, *End this link now* |
| 4b | #8053 | v2.7225 | A picture and a page to print, which files itself on the job as a sent copy |
| 5b | #8054 | v2.7226 | A `.kml` and a `.gpx` file |
| 6 | #8056, #8057 | v2.7227, v2.7228 | The search door, a map on no job with *Put it on a job…*, and the layer on the Map page and the site map |

Both migrations are pushed and `painted-map-link` is deployed, each on the owner's yes. Each
version's fragment says what changed from this card and why.

Not built, each on purpose:

- **Step 0, the one-day try.** Skipped, since he asked for all of it and said he would test it
  live. His first real walk stands in for it.
- **Step 5, a task's place carries the map.** It needs a migration and is after the count.
- ***Text it…* from the company's number.** The link is copied, shared by the phone's own sheet or
  scanned. Texting it from the app waits on his word.
- ***File it on the job* as a press.** A print files itself, so the press had nothing left to do.

Not tried anywhere: a real phone. The walk, the screen held on, the pause on lock and the share
sheet were walked in a headless browser with a made-up location. A real print and a `.kml` opened
in another app are untried too.

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

### The magnifying glass

The owner, 2026-11-13: *on draw it by hand, when a user is dragging by hand a magnifying glass
shows up over where their finger would be, such that the user can be super precise where they
place things.* Yes. It is the right fix, and it is in the first build of drawing by hand.

**Why it is needed.** A fingertip covers fifty feet of ground or more at the zoom a route is drawn
at, and it hides the very spot it is placing.

- **While a finger drags, a round glass rides above it.** It shows what is under the finger about
  four times larger, with a cross at its centre. The thing being placed sits on the cross.
- **It shows on every drag by finger:** a corner of a line, a new corner (press and hold, then
  slide before lifting), a place's dot, and an end being trimmed after a walk.
- **A quick press still works.** One press drops a corner where it lands. The glass is for the
  corners that matter.
- **It catches.** Within a few feet of a place or of another line's end, the corner jumps onto it
  and the ring turns green: *On Water stub, Lot 14*. Pull away and it lets go. So a line really
  ends at the gate and two strokes really meet.
- **It gets out of the way.** Near the top or a side of the screen the glass moves to whichever
  side has room. The map does not pan while a corner is dragged, and slides slowly when the finger
  reaches an edge.
- **The readout follows.** The two legs that meet at the corner show their lengths while it moves.
- **At a desk there is no glass.** A mouse is already that exact, and the wheel zooms.

**Its honest limit: the glass is as sharp as the picture.** The view from above that the app
draws is about one to two feet of ground to a dot across the United States, finer in some cities.
So a corner can be placed to within a couple of feet and no finer. Past that the glass only makes
the dots bigger. The measuring table above already assumes a few feet at each end, so its numbers
stand, and the glass is what makes them reachable by a finger.

**How it is built.** A second small map in a round window, kept centred on the dragged point and
two zoom steps in, drawn over the first. A known Leaflet add-on does the same thing and
says it was not tested on phones, so this one is written here, on pointer events, about a
hundred lines. No new dependency. It belongs to PR 2.

### Length, said honestly

- Always *about*, rounded to the nearest 10 ft, with its give or take and how it was made: *About
  830 ft, give or take 40 ft, walked*.
- **A measured length wins.** *Type a length measured with a wheel or a tape* puts the real number
  on the line, and the line shows it from then on: *612 ft, measured with a wheel*.
- No area and no height in the first build.

## Where it is offered, and what it reuses

The owner, 2026-11-13: *where in the app should we offer this?* Drawn at the top of the mock-up.

**Wherever the app already shows an address.** A painted map is the address, continued: the part
a street address cannot say. So it gets no page, no tab and no header button of its own. It is
one line under the 📍 address, on screens people already open. Where a map exists the line names
it and opens it. Where none exists, the line is the press **＋ Paint a map**, for those who may
paint.

**The four doors of the first build:**

1. **The job window's top band.** It holds the address and shows on all seven tabs (Job, Edit,
   Bill, Costs, History, Documents, Materials). The line sits under the address. A press opens the
   map with its places, Share and Add to it. No eighth tab.
2. **A tech's own job card** (`DashboardJobModeCard`, the Job Mode card). The person standing on
   the site is the one who can walk it, so the making press is here, beside the address. It is not
   in the press bar, which is the day's own flow: clock, drive, arrive, report. The **On my way**
   sheet gains the line too. It is the moment before the drive, and today that sheet shows no
   address at all.
3. **The Development page.** A **Painted maps** card after Plans, among History, Jobs & bids,
   Money, Plans, Questions and Photos. The best home for a way in, since it serves every lot. A map
   painted for a development shows on each of its jobs, with the development's name beside it.
4. **The header's search.** Type *paint* and **Paint a map** is there, the way a new job is
   (`src/lib/search/doors.ts`). A painted map is found by its name too. This is the door with no
   job open. The header has four single-purpose buttons and no general ＋, so a fifth button is the
   wrong price for a tool used now and then.

**Where a painted map then shows by itself:** under the address on the Dashboard's job cards, and
beside Directions on the field search's job card. Later: on a task with a place, under the boxes
on Materials on site's map, as a chip on the Map page, and on a sub's work order page, which
needs no sign-in and so is the owner's call.

**Where it is not, on purpose:**

- Not a page in the menu. A map belongs to a job or a development, not to a list of maps.
- Not a tab on the job window, and not a button in the header.
- Not in the press bar of a tech's day.
- Not on a bid's price. A walked length must never feed a number that gets priced.

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

## Sending it beyond the app

The owner, 2026-11-13, after the first look: *I like the basics of this. Can you help me come up
with what the export options could look like? Someone makes a map and then they want to share it
with others beyond just saving it in the app.*

Drawn in the mock-up's section 9. One rule sorts every option:

> **A link can be ended and stays current. A copy cannot be taken back and goes stale.**

So the link is always first, and every copy carries a code back to the link and the day it was
made. One sheet, **Share this map**, holds every way out, in two groups.

### A link, which stays current and can be ended

- **Text it…** and **Copy the link.** As drawn before.
- **Send it another way…** The phone's own share sheet. One press hands the link to mail, a group
  chat or a phone nearby, whatever the person has. The app already does this for a job
  (`ShareJobButton`) and for the lien desk (`LienDeskShare`), with a fallback to copy where a
  browser has no such sheet.
- **Show a code to scan.** A large code on the screen for the driver at the gate or a sub standing
  beside you. Their camera opens the map. The code drawer is already in the app (`qrcode.react`,
  used for a bill, a box label and a machine label).

### A copy, which cannot be taken back

- **A picture.** The map as an image: the line, the numbered places, a key under it, the day, the
  company's name. It shows in a text thread without a press, for the people who will not open a
  link. Sent through the phone's share sheet, with the link under it. The app already sends a photo
  this way (`src/lib/materials/photoShare.ts`).
- **A page to print.** One Letter page: the letterhead, the map, the places with their photos and
  words, and the code to scan for the map as it is today. **Print**, **Save as a PDF**, and **File
  it on the job**, which puts the PDF in the job's Drive folder. For a gate guard, a delivery
  ticket, the binder in the truck, a general contractor's site packet.
- **A file for another map.** A `.kml` file for Google Earth and Google My Maps, and a `.gpx` file
  for a hiking app or a handheld. The lines and the places with their words, and no photos. For
  the few who keep a map of their own: an engineer, a surveyor, a general contractor.

### What I checked, and what it rules out

- **Google Maps cannot show our line from a link.** Its link format carries points, not a line: a
  start, an end and up to three stops on a phone, routed along its own roads. So **Directions to
  the start** is the honest Google Maps press. The line itself reaches Google's maps only as a file
  the other person brings in, which is a desk job for them.
- **Google My Maps takes `.kml` and `.gpx`** up to 5 MB. **Google Earth** takes `.kml`, on the web
  and on a phone.
- **The phone's share sheet sends pictures and PDFs.** Map files are not on the list of kinds it
  usually takes, so a file is saved to the phone or the desk and sent from there.
- **A picture of the map can be made in the browser.** Both free map sources answer with the header
  that lets a page draw their tiles into an image (checked 2026-11-13). Their terms for a saved
  picture are a separate matter, to read before that PR. If they say no, the picture is drawn on
  the Streets map, or on plain ground with only the line and the places.
- **Every copy shows the same things as the link** and nothing more: no painter, no job, no
  customer, no price. A file and a link both carry exact points. That is the point of a map.

### Who gets what

| For | Send |
|---|---|
| A customer | The link by text |
| A delivery driver | The link by text, or the picture |
| A supply house's desk | The page, on the delivery ticket |
| Someone standing beside you | The code to scan |
| A sub or a group chat | Send it another way, or the picture |
| A general contractor | The link, and the page for the site packet |
| An engineer or a surveyor | The file |
| The next tech, next year | Nothing to send: it is on the job |

### My pick

Build the link's two new presses with the link itself, since both pieces are already in the app.
Then the picture and the page, which are what a field company's people will use. The files last:
cheap, and wanted by few.

**Inside the app, later:** the map on a task, on a sub's work order, and on the customer's and the
general contractor's portal pages. Each is a place the link already wants to be.

**Not proposed:** a public page that lists a company's maps, an embed for someone else's website,
and a map that anyone with the link can add to. Each opens a door the link does not need.

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
| 2 | Draw it by hand, with the magnifying glass. The line under the address on the job window and the Development page, its *Painted maps* card, the header search door. Places with a photo. Typed lengths. | none | M |
| 3 | Walk or drive it. The red bar, the screen held on, pause and restart, the faint part, *Look it over*, trim and redraw, kept on the phone with no signal. The line and the press on a tech's own job card and on *On my way*. | none (one new outbox kind) | M |
| 4 | The link. *Share this map*, the page at `/way/<code>`, *Show where I am*, *Directions to the start*, *End this link now*, *Text it…*, *Send it another way…*, *Show a code to scan*. | one migration: `painted_map_links`. One public door: the `painted-map-link` function. | M |
| 4b | The copies. *A picture*, and *A page to print* with its code, *Save as a PDF* and *File it on the job*. | none | M |
| | **Stop. Count the maps painted and the links opened for two weeks.** | | |
| 5 | A task's place carries the painted map that leads to it | one small migration | S |
| 5b | *A file for another map*: `.kml` and `.gpx`, each a pure kernel that writes text | none | S |
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
9. **Which copies first.** The picture and the page with the link (my pick), and the files after
   the count. Or the files sooner, if a general contractor or an engineer is asking today.
10. **Who may send a copy.** A copy cannot be taken back. My pick: the same people who may share
    the link, with those words on the sheet.
11. **Filing the page.** *File it on the job* on a press (my pick), or by itself the first time a
    map is shared.
12. **The doors.** Under the address on the job, the tech's own job card and the development, plus
    the header's search (my pick). Or a header button as well.
13. **A sub's work order.** May a painted way in show on a sub's page, which needs no sign-in? My
    pick: yes, later, and only a map the office has shared.

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
- Google, *Maps URLs*: a directions link takes points, up to three stops on a mobile browser, and
  no drawn line. https://developers.google.com/maps/documentation/urls/get-started
- Google My Maps help, *Import map features from a file*: KML and GPX, up to 5 MB.
  https://support.google.com/mymaps/answer/3024836
- Google Earth, *Import data*: KML on the web and on a phone.
  https://developers.google.com/maps/documentation/earth/import-data
- Esri, *World Imagery* (the view from above): 0.5 m a dot across the United States, 0.3 m in
  select cities. https://doc.arcgis.com/en/data-appliance/2023/maps/world-imagery.htm
- *Leaflet.MagnifyingGlass*, the add-on that shows the approach: a second map at a zoom offset,
  not tested on phones. https://github.com/bbecquet/Leaflet.MagnifyingGlass
- MDN, *Navigator.share()*: a link, words and files, on a press, and which kinds of file.
  https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share
- Not found in any official document, and so left to step 0: Apple's and Google's own statement of
  what a web page gets with the screen locked, and how the margin reads with Precise Location off.
  The developer reports agree with the standard, and a real phone settles it.
