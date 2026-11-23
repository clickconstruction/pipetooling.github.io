---
name: "Painted maps on a Google map"
number: 387
group: ready
status: asked 2026-11-17 · read the same day · the owner picked it to build first, then parked it on the punch list the same evening · Grace's word to build 2026-11-19 (*Please build*), which is not the billing look · step 1, the kernel, built the same day (v2.7979, #8974), with no screen changed · Google's terms read at that step, and a sixth call added from them · the Google canvas's doors to Leaflet moved to one place and mended the same day (v2.7981, #8975) · step 2, a Google canvas for looking, built the same day (v2.7990, #8984) and proved in a headless browser against Google's own script, held as a draft until the count was read · the month's count read 2026-11-20 in the Google console, from Grace's Chrome: 4,269 Dynamic Maps loads for November 1 to 20 against the 10,000 free, 3,871 in October, nothing billed · step 2 rebased over #402's four PRs and armed on Grace's number the same day · merged the same day and walked on clicktooling.com on a made-up map on no job: drawn on Esri's photograph and saved, opened again on Google's photograph with the street names, then **Streets**, **Time** and **Draw a line**, each as built, and the map thrown away after · the automatic check of the live site found to be most of the month's count and taken off Google the same day (v2.8049, #9056) · step 5, the person's task map, built the same day on the owner's own word (v2.8032, #9037) · audited the same day on a made-up map on the local server, both maps side by side at 320, 390 and 1400 px: two mends merged the same day (v2.8076, #9089 and v2.8078, #9090) and the rest left for the owner (*The audit*, below) · step 5 walked on clicktooling.com 2026-11-21 under the deploy's own key, at 390 px and 1280 px, light and dark, on two made-up tasks on public ground: Google's own tiles with no watermark, the switch, **Time** and the two corner presses each as built, and 10 Google map loads made by the walk · the empty frame the walk read in the code mended the same day on Taunya's word, so every map of dots says *Loading the map…* while Google's script is on its way (v2.8179, #9226) · step 4 built up to its switch the same day on Taunya's ask, with no screen changed: the public page hands the rule its ask and Google's canvas keeps a reader and the line together (v2.8208), and the page stays off Google until the look at the count · the page turned on the same day on Taunya's yes, with no link yet made (v2.8210) · call 6 settled the same day on Taunya's word from her lawyer, so step 3 is to be built whole · step 3's first part, a walk painted on Google, built the same day and seen on a local server with Google's own script (v2.8212) · step 4 walked on clicktooling.com the same day, on the public page's own sample: Google's own tiles, light on the page's paper, a reader and the line framed together, and one Google map made · what is left and what still needs walking written down 2026-11-22, on Taunya's ask, under *What is left* · Taunya's word the same day that step 3's placing and drawing merge first and are walked on a real phone after · its second part, a place's dot put down on Google with the magnifying glass, built and seen the same way (v2.8235) · its last part, a line drawn by hand on Google, built and seen the same way (v2.8236), so the window is on Google from the moment it opens to Save · step 3 walked on clicktooling.com 2026-11-22 after the deploy, on a `ZZ Test` map on no job thrown away after: every mode on Google's own tiles, three Google map loads, and the glass's photograph soft · the card handed to the owner's own sessions the same day, and the public page's sample moved off the lake onto dry public ground (v2.8311)
summary: >
  The owner wants to paint and read a painted map over Google's map, not the map it draws on today.
  Since v2.7990 a saved map opened to be read draws on Google. Painting still draws on Leaflet, where
  *From above* is Esri's photograph and *Streets* is OpenStreetMap. The app
  already draws seven other maps on Google through one browser key, with Leaflet as the fall back, so
  no new key is needed. The work is the painting canvas itself: the line drawn by hand, its corners,
  the magnifying glass and the walk are all written against Leaflet. One canvas serves the painting
  window and the public `/way` page, so those two move together. The picture and the print stitch map
  tiles into an image, which Google does not allow for its tiles, so they need their own call.
next: Every step is built and walked on the live site. Step 3 (v2.8212, v2.8235, v2.8236) was walked on clicktooling.com on 2026-11-22, and step 4 (v2.8208, v2.8210) on 2026-11-21 on the page's own sample. Step 5 is built and walked (v2.8032). One small fault was seen on step 3's walk, the glass's soft photograph, and the walks on a real phone are owed. Both are under *What is left*. The sample of the public page is on dry ground since v2.8311.
size: L as a train of five (S · M · L · S to M · S)
ver: v2.7979 · v2.7981 · v2.7990 · v2.8032 · v2.8049 · v2.8076 · v2.8078 · v2.8179 · v2.8208 · v2.8210 · v2.8211 · v2.8212 · v2.8213 · v2.8235 · v2.8236 · v2.8311
blocker: None. Every call is settled, the last on Taunya's word of 2026-11-22 (*What is left*).
opinion: build — the count read 2026-11-20 leaves room under the free 10,000, and the key, the fall back rule and a shared Google canvas already exist, so the cost is the drawing tools, not the plumbing
mockup: not required — the presses and the tools stay where they are and only the map under them changes, and Google's own tiles cannot be drawn in a mock-up without the live key
---

# Painted maps on a Google map (#387)

This card follows [Paint a map (#345)](paint-a-map/README.md), which built painted maps on Leaflet and
left Google as *a switch for later*. This is that switch.

## The ask, in the owner's words

2026-11-17, with two screenshots of a painted map on his phone:

> I want to be able to not use OpenStreetMap, I want to see Google Maps

The first ask on #345 said it too: *draw a line on a Google Maps overlay*.

He picked it to build first the same evening, then changed his mind:

> add the Google Maps Change to the punchlist and open a punchlist card

## What a painted map draws on today

- **From above** is Esri's World Imagery. **Streets** is OpenStreetMap. Both are free tiles on Leaflet.
  So moving to Google swaps both pictures, not only the streets.
  Since v2.7990 (step 2) a saved map opened to be read draws on Google. A line, a place or a walk
  being made, **Time** and `/way` are still on Leaflet.
- **One canvas, two screens.** `src/components/paintedMap/PaintedMapCanvas.tsx` is mounted by the
  painting window (`PaintedMapWindow.tsx`) and by the public page (`src/pages/PaintedWay.tsx`).
- **A layer on two other maps.** `PaintedMapsLayer.tsx` lays painted maps over the Map page
  (`MapPageView.tsx`) and Materials on site (`OnSiteMap.tsx`). Both of those are whole Leaflet maps,
  and the Map page's drawing tool is Leaflet's own.
- **A person's task map.** `TaskPlacesMapCard` draws in the shared `PinsMapFrame`, on Google since
  v2.8032 (step 5), with a press that switches to the OpenStreetMap map. The team's map on
  Checklist → Review moved to Google in v2.7686.
- **The picture and the print.** `src/lib/paintedMap/paintedMapPicture.ts` and
  `paintedMapPictureIo.ts` load Esri's tiles and paint them into one image.

## What the app already has

- **The key.** `VITE_GOOGLE_MAPS_BROWSER_KEY`, a deploy secret. It is nowhere local.
- **The rule.** `resolveDashboardMapProvider` in `src/lib/dashboardJobsMap.ts`: Google when the key
  is set and the API loads, Leaflet with no key or once Google fails on the page.
- **A Google canvas for pins.** `src/components/map/PinsMapGoogleCanvas.tsx`, on
  `@vis.gl/react-google-maps`. It draws dots and an info window. It draws no line and takes no
  drawing press, so it is a model for the new canvas, not the canvas.
- **The map type.** `src/lib/map/googleMapType.ts`: Satellite is `hybrid`, Streets is `roadmap`, and
  a photograph is held flat so a dot does not slide off its spot.

## What is new

A second painting canvas on Google with the same props as today's, so the window and `/way` choose
between the two and nothing above them changes. It has to carry everything the Leaflet one does:

- the saved lines, with their poor parts, and the numbered places with their taps;
- the line being drawn: a press adds a corner, a corner drags, a middle dot inserts one;
- the press held still that becomes a placing press, and the catch on a nearby corner;
- the magnifying glass, which today is a second small map riding above the finger;
- the walk: the dot for the person, follow, and the frame that keeps them in view;
- the first view, refit and fly to a place.

The Leaflet canvas stays as the fall back, as on every other map in the app.
Since v2.7814 it is also the canvas **Time** draws on (punch list #395): the photo archive is Esri's and cannot sit on a Google map, so the Leaflet canvas must stay whole, and a Google painting canvas goes down while Time is on.

## The calls, each with a pick

1. **Which screens.** The painting window and `/way`, then the person's task map. The Map page and
   Materials on site stay on Leaflet: each is a whole map with its own tools, and each would be its
   own card.
2. **What *From above* is on Google.** `hybrid`, the photograph with street names, as Review's map
   chose. The other choice is the bare photograph.
3. **The picture and the print.** Keep them on Esri for now. Google's paid picture service is the
   other choice, and its images are small. Read Google's terms at that step: the v2.7686 note reads
   them as not allowing a Google map used with or near another provider's map, and a picture made
   from Esri's tiles by an app that shows Google's map may fall under that.
4. **The public page.** Google in the app first. `/way` moves only after the billing look, since
   every outside reader's open counts.
   Moved 2026-11-21 on Taunya's yes (v2.8210), with no link yet made.
5. **The magnifying glass.** One small Google map made when the window opens and kept, never one per
   drag. Whether Google counts it as its own map opened is read at that step.
   Read on 2026-11-19: Google's pages name what it bills a successful map load and do not say whether a second map on one page is a second one, so the plan counts the glass as one more.

6. **Drawing by hand over Google's photograph.** Found at step 1, when the terms were read (v2.7979).
   Google's terms (3.2.3 (c)) forbid making content from its content, and the first example is tracing roads, building outlines and utility posts from the satellite view.
   A line drawn by hand along the road in the photograph is close to that example, and so is a meter, a shutoff or a cleanout dragged onto its spot.
   The app then keeps the line, shows it on maps that are not Google's, prints it and sends it out as a file.
   My pick: read painted maps on Google and keep drawing by hand on Esri's photograph, which is steps 2, 4 and 5 without step 3.
   The other choice is the owner's own reading, or a lawyer's, that marking a way in is not tracing, and then step 3 as planned.
   A walked line comes from the phone's readings and not from the photograph, so it reads differently and could move to Google by itself.
   The kernel keeps `drawing` and `placing` off Google until this is settled, and a test holds the line.
   This is a reading and not legal advice.
   **Settled 2026-11-21, on Taunya's word.** She asked a lawyer, and reports his answer: that paragraph does not stop this, and drawing over Google's satellite photograph as the app does is fine, because the drawn maps are not sold to anyone else.
   So step 3 is built whole, and this is not asked again. The reason given rests on the maps not being sold.

## Risks said plainly

- **Two photographs do not line up exactly.** Esri's and Google's pictures of one spot can sit a few
  feet apart. A line drawn by hand over Google's photograph may sit a little off on a picture or a
  print still made from Esri's. Not measured.
- **Sharper is not promised.** Which photograph is newer or sharper varies by place.
- **Google's own labels.** Seen on the live walk of step 2: Google's photograph with street names also carries Google's own place labels, such as rooms, shops and an ATM.
  At the zoom a site is read at there can be a dozen of them around a line.
  They cannot be pressed, and the road map carries them too.
  Off since v2.8211, on Taunya's word of 2026-11-21: every one of them, on a painted map and on every map of dots, with the street names kept (`googleMapLook.ts`).
- **Cost.** #345 read Google's free count as 10,000 opens of the basic map a month since March 2025,
  billed past it. Read again on Google's pricing page on 2026-11-19: 10,000 free a month for Dynamic Maps,
  then $7.00 for each 1,000 up to 100,000, with or without a Map ID. The app's seven Google maps already
  draw on that count. Read in the console on 2026-11-20: 4,269 loads for November 1 to 20, about 6,400 for
  the month at that pace, 3,871 in October, and nothing billed.
  Read again the same day (v2.8049): most of those loads were the automatic check of the live site, which no longer opens a Google map.
  On the five days that check reached no page, people made 4 to 19 requests a day.
  People alone made roughly 10 to 40 map loads a day, read the same day in the console's chart of the Maps JavaScript API by day.
  So the pace above is too high, and the room under the free 10,000 is wider than it reads.
- **Old maps.** Every painted map already saved was drawn over Esri's photograph. They will open on
  Google's with the same small shift.

## The plan

1. **The kernel** (S). Which map the painting canvas draws on, from the key, a failure on the page
   and the screen it is on. The picture's own rule. Tests. No screen changes.
   Built 2026-11-19 (v2.7979): `src/lib/paintedMap/paintedMapProvider.ts`. Its reach is empty, so every answer is still Leaflet, and each step below adds its own word to it.
2. **A Google canvas for looking** (M). Lines, places, the person's dot, the first view and refit.
   Mounted in the painting window when nothing is being drawn, with the Leaflet canvas as the fall
   back. Guide `paint-a-map`, release note, fragment, the Glossary's entry amended.
   Built 2026-11-19 (v2.7990, #8984). Held as a draft until the count was read on 2026-11-20, then armed.
   One thing differs from the line above: a window that has left Google's map to draw or to place keeps the Leaflet canvas until it closes, so a new line stays on the photograph it was drawn over.
   Google bills by the map made, and the canvas keeps one map for the whole visit, so going to Time and back or opening a second painted map makes no new one.
3. **Drawing by hand on Google** (L). Corners, the held press, the catch, the magnifying glass and
   the walk. After this the window is on Google from start to Save. Waited on call 6, settled 2026-11-21.
   Built in three parts, each its own change, so each adds its word to `PAINTED_GOOGLE_REACH` with the part of the canvas that carries it.
   - **The walk** (v2.8212, 2026-11-21). A walk is painted on Google from its first reading to Done, paused or not, and Look it over reads it there. The canvas slides to the walker by the Leaflet canvas's own rule, now a kernel (`followMe.ts`), and draws again only the line that grew. Fixing a walked line by hand, or adding a place, still brings the Leaflet canvas up and keeps it.
     Seen on a local server at 390 px with Google's own script and no key, so the tiles wear Google's watermark: one Google map from reading through the walk to Look it over, no Leaflet map, and the dot drifting to three quarters of the way across before the map slid it back to the middle. Not walked outdoors on a phone.
   - **Placing a dot** (v2.8235, 2026-11-21). **＋ Place** puts its dot down on Google: one of Google's own markers, wearing the Leaflet canvas's dot, that a finger drags. A press on the map brings it there. The window keeps its one Google map from reading through placing and back.
     The magnifying glass rides above the finger, as on the Leaflet canvas. Its picture is a second small Google map, made the first time a finger places something and kept for the page, as call 5 picked. It shows the big map's own view drawn four times the size, so it never asks Google for a zoom it has no photograph for. The lines and places in it are drawn by the app, sharp.
     So a phone that places or draws makes two Google maps in a visit where it made one: the map, and the glass's. A mouse gets no glass and makes one.
     The catch, the held press and where the glass sits are now one set of rules both canvases read (`handPlacing.ts`).
     Seen on a local server at 390 px with a touch screen, Google's own script and no key: the dot dragged with the glass above or beside it, the gate drawn in the glass when the dot neared it, two Google maps made in the whole visit, and Cancel back to reading on the same map. Two things are Google's own and differ from the Leaflet canvas: its marker trails a dragging finger by about 17 px, and a press within about 40 px of the dot goes to the dot and not the map.
   - **Drawing by hand** (v2.8236, 2026-11-21). **Draw a line** and **Fix this line by hand** draw on Google. A press on the map adds a corner. A press held still for 380 ms, then slid, places one under the glass, and the map does not move under the finger while it is held. The corners and the small dots in the middle of the legs are Google's own markers: a drag on a corner moves it, and a drag on a middle dot makes a corner. A corner dragged near a place or the end of another line is caught by it. The line in hand is one pair of Google's lines, moved and never remade.
     With that every use is within Google's reach, and the window is on Google from the moment it opens to Save. Only **Time** and a picture of the map still bring the Leaflet canvas up, and a window that made a picture keeps it.
     Seen on a local server at 390 px with a touch screen, Google's own script and no key: three presses made three corners and two middle dots, a corner dragged with the glass above it, a middle dot dragged into a new corner, a held press slid and lifted into a fifth corner with the map still under it, and the last corner dragged to a place and let go exactly on it, with *On ZZ Test water stub* and the glass's ring green. Two Google maps in the whole visit, the map and the glass's.
     Not seen: a real finger on a real phone, and Google's clean tiles, which need the deploy's key.
   Step 3 walked 2026-11-22 on clicktooling.com, after drawing's deploy, signed in through the dev login, on a map named `ZZ Test walk 387 step 3` made on no job on public ground downtown, and thrown away after.
   - **At 390 px with a touch screen, in light.** The map opened on Google with no Leaflet map and no watermark. Three presses made three corners, and a press held still brought the glass up with Google's photograph in it, then set a fourth corner where the finger lifted. The line was saved.
   - **A place.** **＋ Place** stayed on the same Google map. The dot dragged with the glass beside it, and the place was saved as `ZZ Test gate`.
   - **A second line.** Two presses, then the last corner dragged onto the gate: *On ZZ Test gate*, the glass's ring green, and the corner let go exactly on the place. The line was saved.
   - **A walk.** **Walk or drive it** followed four made-up readings on Google, and **Look it over** read it there. The walk was thrown away.
   - **At 1280 px with a mouse, in dark.** The saved map opened on Google with its place, and no sideways scroll. **Time** took Google's map down and drew the archive on the Leaflet canvas, and **Time** again gave the same Google map back with no new map made. Two clicks made corners, and a mouse held still brought no glass. The line was let go with **Cancel**.
   - **The count.** Three Google map loads in the whole walk: the phone's map, the phone's glass map, and the desk's map. One map served the phone from the first corner through the place, the second line, the walk and Look it over.
   - **A fault, seen.** The glass's photograph is soft. It is the big map's own view drawn four times the size, where the Leaflet canvas's glass layers sharper tiles over it where the photograph goes that deep. The spot under the cross still reads, and the lines and places in the glass are sharp. Not mended (*What is left*).
   - **Not walked.** A real finger on a real phone, and a picture of the map, which the audit walked before.
   The map, its two lines and its place were thrown away with **Throw this map away**, and a read of the tables found none left.
4. **The public page** (S to M). `/way` on the same canvas, once the billing look says yes.
   The Google canvas did not keep a reader and the line in view together (`frameMe`), which `/way` asks for, so this step adds it.
   Built 2026-11-21 up to its switch, on Taunya's ask (v2.8208), with no screen changed: the frame is a kernel with the Leaflet canvas's own numbers (`frameMe.ts`), Google's map stays light on the page's light paper, and the page hands the rule its ask.
   The page is still off Google. The rule's own test holds it there until the look at the count says yes, and that yes is one word in `PAINTED_GOOGLE_REACH`, the test's line and the guide's sentence.
   Read for that look on 2026-11-21, from the app's own tables: no link to a painted map has ever been made and `/way` has never been opened by a reader, so the page adds no map to the count until a link is sent. Google's console was not read that day.
   Turned on 2026-11-21 (v2.8210) on Taunya's yes, given with those readings in front of her: `'way'` is in `PAINTED_GOOGLE_REACH`, the rule's test holds the page on Google for looking, and the guide says so.
   Each open of a link by a reader is one map on Google's count from here, made after the reader gives a name.
   Walked 2026-11-21 on clicktooling.com after the deploy, on the page's own sample, which reads no link, table or function.
   At 390 px: Google's own photograph with its logo and terms and no watermark, the line and the three places, and no Leaflet map. **Streets** was Google's road map, light on the page's light paper while the app's theme was dark, and made no new map.
   **Show where I am** was given a made-up reading set in the page, since the walk's browser gives no location. The map framed the reader's dot and the whole line together, left the view alone for a step of a few feet, and framed again when the reader was put 0.6 mi off.
   At 1280 px the same map drew 560 px wide with no sideways scroll. One Google map for the whole walk.
   The sample's made-up site sat in water on Google's road map, and was moved to dry ground in v2.8311. Not walked: a reader's phone in a hand, and a real link, since none has been made. Both are under *What is left*.
5. **The person's task map** (S). `TaskPlacesMapCard` on the shared Google canvas, as v2.7686 did for
   the team's.
   The count read on 2026-11-20 leaves room for it, but it opens a Google map on Today for everyone with task places, so the count is worth a second look when it is built.
   Built 2026-11-20 on the owner's own word from a walk on a phone (v2.8032): Google by default, with a press on the map that switches to the OpenStreetMap map and is kept on the device.
   Walked 2026-11-21 on clicktooling.com under the deploy's own key, in a desktop browser at 390 px and at 1280 px, light and dark.
   The walker was given two made-up tasks with places on public ground, and both were deleted after.

   - **The map.** Google's own photograph with street names, and its road map for **Streets**, with Google's logo and terms and no watermark. The two numbered dots drew at both widths and in both themes, with no sideways scroll.
   - **The presses.** The zoom buttons sat at the top left. **Show where I am** and the switch were 40 px squares, 10 px from each side and 40 px above the bottom, on the same spot on both maps.
   - **The switch.** One press brought the OpenStreetMap map up and the next brought Google's back. The device kept each pick. **Streets** stayed picked through the change.
   - **Show where I am.** An icon named *Show where I am*. Pressed, it turned and read *Finding you…*. The walk's browser gives no location, so the card answered *Location is off for this app* and the found state was not seen.
   - **A dot, then Time.** A press on a dot listed its task under the map with **Directions** and **Show the task**. **Time** took Google's map off the page and drew the archive on the Leaflet canvas with no switch, and **Time** again gave Google's map back.
   - **The count.** 10 Google map loads. One was the Review tab's map, where the sign-in landed. Nine were this card's: four opens (the first, two reloads and one change of width, which makes a new map), three switches back and two returns from **Time**. Each switch back and each return from **Time** made one new map, as v2.8032 says. They were counted in the page, by the maps made and by Google's own requests.
   - **Not seen.** A refused key cannot be seen under the deploy's own key, and none was faked. Google's script was in within the first second of each open, so no wait was seen either.
   - **A small fault, read and not seen.** The *Loading the map…* line of v2.8078 is on the painted map's canvas alone. This card's Google canvas, which the app's other maps of dots share, draws nothing while Google's script is slow: an empty grey frame under the card's own presses, for up to the ten seconds before the fall back. Mended in v2.8179: the frame of every map of dots says *Loading the map…* in its middle while it waits.
   - **The owner's calls, here too.** Google's own place labels sit around the dots in both views: about ten of them at 390 px on a downtown block, and one dot sat half over a landmark's own icon. They cannot be pressed. The ten seconds is this card's wait too, by the code. No map that is not Google's shared the screen with it on Today.

   Not walked: a phone in a hand, where Google's map moves under two fingers.

The picture and the print are call 3 and are not in the train.

## The audit, 2026-11-20

Steps 1 and 2, the doors to Leaflet and the suite's change were read and walked by a second session, on the local server with a made-up key, on a made-up map on public ground and on no job.
Google drew with the key taken off its script's address, which gives its own tiles with a watermark.

What held:

- **The rule.** Only the painting window, and only for looking, draws on Google. The public page `/way` made no request to Google with a key in the build, at a phone and at a desk.
- **The drawing.** The same saved map on both canvases at 390 px: every line, dash, dot and mark on the same pixel. Google's dash has square ends and a clear gap. Leaflet's has round ends that nearly close the gap. Both read as dashed.
- **The changes of map.** **Time** took Google down and gave it back with no new request to Google. So did closing the window and opening the map again. **Draw a line** and **Make a picture** each brought the Leaflet canvas up on the same spot, and the window kept it.
- **A refused key and a blocked script.** The Leaflet canvas came up with every line and place, within a second of Google's canvas for a refused key, and 0.3 s after the window opened for a script that failed outright.

Two mends, each its own pull request, both merged the same day:

- **A key refused earlier on the page** (v2.8076, #9089). Google says no once for a page. A painted map opened after a page's own map had fallen back waited eight seconds on an empty frame.
- **A blank frame while Google loads** (v2.8078, #9090). With the script slow, the frame was a white box with no word for up to ten seconds. It now says *Loading the map…*.

Left for the owner at the audit, and mended since on Taunya's word of 2026-11-21 (v2.8213). Of four choices, shown with a timing table and pictures, Taunya picked *lines at once*: while Google's script is on its way the lines and the numbered places are drawn as a plain drawing, each on the pixel Google's map will put it, and the photograph comes in under them. It makes no map and fetches nothing, so Google's count is untouched. The ten seconds itself is unchanged, for this canvas and for every map of dots. With the script held back on a scratch page the lines showed at 0.1 s whether the script took half a second, eight seconds or never came. The call as the audit wrote it:

- **The ten seconds.** A painted map is read in the field. On a slow signal the reader now waits up to ten seconds for a map that used to show its lines at once. A shorter wait for this canvas, or the lines drawn on the Leaflet canvas while Google loads, would mend it.

Settled, and not to be asked again:

- **A map that is not Google's on the page behind the window stays as it is.** Taunya's word on 2026-11-21: leave it up. At a desk the window is 1,080 px wide over a dimmed page. Opened from the Map page or from Materials on site, that page's Leaflet map shows beside Google's map, at the window's edge. The rule takes Google down for Time and for a picture because of the terms' clause on maps that are not Google's (3.2.3 (e)), and by that same reading this is the one place the two still share a screen. A page that cannot be seen behind the window while Google is up would end it. This is a reading and not legal advice.

Mended on Taunya's word, 2026-11-21:

- **Google's own place labels are off** (v2.8211). Taunya was shown three choices as before and after pictures of the live site's own map: as today, shops and restaurants off, or every place label off. Taunya picked every one off. It is one list for every Google map in the app, read by the painted map's canvas and by the canvas every map of dots draws on, so the two cannot drift. Street names, road numbers and the names of towns and neighbourhoods stay, and Google fits more street names in the room. It is Google's own `styles` option, which needs no Map ID, and it makes no map sooner, later or more often. Google's script with no key ignores the option, so it cannot be seen on a local page.

Both mends walked on clicktooling.com on 2026-11-21, after their merges, on the shipped build under the deploy's own key:

- **The task map, labels off.** Two made-up tasks on public ground downtown, at 390 px and 1280 px, light and dark, on the photograph and on **Streets**: eight looks, no place label in any, street names in all, and the road map still dark in dark. The map itself answers with the list it was made with. Before the change the same ground carried about ten labels at 390 px and about sixteen at 1280 px.
- **A painted map, labels off.** A made-up map on no job, one line drawn by hand on public ground, opened to be read at 1280 px in light and at 390 px in dark: Google's photograph with street names and no place label.
- **A painted map, the wait.** Opened on a page with no Google map yet, with Google's script held back seven and a half seconds in the walk's own browser. The line showed at 0.3 to 0.4 s on a blank ground with *Loading the map…* under it. Google's map came in at 7.9 s and 8.2 s and the drawing left in the same moment. At 390 px the two ends of the line were measured in the drawing and then asked of Google's own map: the same pixels to a tenth.
- **The count.** Nine Google map loads for the whole of the two calls: three before the merges for the pictures of the choices, four for the task map and two for the painted map. Changing the labels on a live map made none.
- **Not seen.** A real weak signal on a phone in a hand, and a painted map with places on the live site. The places were measured on a scratch page, within one pixel.

Every row the walks made was deleted after: four tasks named `ZZ Test walk 387 …` and the map `ZZ Test walk 387 lines`.

## What is left

Written 2026-11-22, on Taunya's ask, for anyone who picks this card up without the sessions that built it.

**No call is open.** The last was settled on Taunya's word of 2026-11-22: step 3's placing and drawing merge first and are walked on a real phone after, though *How to verify* asked for the phone walk before step 3 merged. The six calls each have their pick, call 6 and the public page were settled on her word of 2026-11-21, and the audit's three calls are closed.

Loose ends:

- **Google's count.** Look in Google's console about a week after step 5 shipped, near 2026-11-27, and again once links to painted maps are being sent. It needs a sign-in to the console. The last reading was taken from Grace's Chrome on 2026-11-20. Since placing (v2.8235), a phone that places or draws makes one more map in a visit, the glass's, once for each look.
- **The glass's photograph is soft on Google.** Seen on step 3's walk on the live site. The glass shows the big map's own view drawn four times the size, so at the zoom a line is drawn at the ground blurs. The Leaflet canvas's glass layers sharper tiles over it where the photograph goes that deep. A mend: ask Google how deep its photograph goes at the spot (`MaxZoomService`) and draw the glass's map up to two steps closer where it does, drawn larger only by what is left. It makes no new map. Not mended.
- **The public page's sample sat in a lake.** Mended in v2.8311. `/way/sample`, which Settings → What customers see opens, put its made-up site at 39.5, -98.35, which is the water of Waconda Lake in Kansas. Its truck gate is now at 39.4822, -98.3632: scrub beside a gravel road inside Glen Elder Wildlife Area, public ground with no building near, and a test holds it there (`paintedWaySample.test.ts`). Seen before the merge on a local page and on a scratch page with Google's own script and no key. The look at the live page follows the deploy.
- Nothing waits on a migration or a function. Every change of this card is in the client.

Walks still owed, one each:

- **Step 3 on a real phone outside.** The painting window (Documents → Painted maps, then the map), as anyone who may paint a map, on a phone in a hand, in light, on a `ZZ Test 387 …` map on no job that is thrown away after. Should be seen: a press held still brings the glass up and the map stays put, a slide moves the cross, lifting sets the corner, a corner dragged near a place lands on it with the glass's ring green, and two fingers still zoom. Not walked because no session can hold a phone. It is owed now: placing and drawing have been on the live site since 2026-11-22, on Taunya's word that they merge first. About two Google map loads each time the map is opened: the map and the glass's.
- **A painted map with places while Google loads.** The walk of 2026-11-21 saw a line drawn at once while Google's script was held back, and measured the places on a scratch page only. A `ZZ Test …` map with a line and two places, opened on clicktooling.com at 390 px with Google's script held back in the walker's own browser, signed in through `node scripts/dev-pane-login.mjs`. Should be seen: the places drawn at once on the pixels Google's map then puts them on, and nothing moving when the photograph comes in. Not walked because step 3's walk of 2026-11-22 did not hold the script back. One Google map load.
- **A real link to `/way`.** Step 4 was walked on the page's own sample only. Make a link with **Share** on the `ZZ Test 387 …` map and open it signed out in a private window at 390 px, in light, as a reader who gives the name `ZZ Test reader`. Should be seen: the name asked first, then the same Google map as the sample, and the visit kept for the office. Not walked because no link has been made, and a link and its visit are rows to delete after: check first that a dev can delete both. One Google map load for each open.
- **Steps 4 and 5 on a phone in a hand.** `/way/sample`, with no sign-in, and Checklist → Today → **Where my tasks are**, as anyone given `ZZ Test …` tasks with places on public ground, deleted after, in light and dark. Should be seen: **Show where I am** with the phone's own location and the dot moving as the person walks, and the task map moving under two fingers while one finger scrolls the page. Not walked because no session can hold a phone. One Google map load for each open.
- **A painted map on a real weak signal.** Any `ZZ Test …` painted map opened on a phone where the signal is weak, at the edge of a site or inside a building. Should be seen: the lines and the numbered places at once on a blank ground with *Loading the map…* under them, then Google's photograph coming in under them with nothing moving. Not walked because the last walk held Google's script back in a desktop browser, and a real weak signal needs a real place. One Google map load.

The three phone walks can be one outing with one phone.

## How to verify

- The key is a deploy secret, so Google's tiles cannot be seen before a merge. Locally, a one-screen
  harness with Playwright proves three things: with no key the Leaflet canvas draws, with a key the
  Google canvas mounts with its map type, and when Google refuses the key the screen falls back with
  its lines and presses working.
- After each merge, walk it on the live app on a made-up map on no job: draw a line by hand, place a
  corner under the glass, save, open the link, then throw the map away.
- Before step 3's placing and drawing merge, one walk on a real phone outside. The held press and
  the glass have only ever been walked in a desktop browser with a touch screen. On Taunya's word
  of 2026-11-22 they merge first, and the phone walk follows on the live site (*What is left*).
- A change to the look of Google's own map cannot be seen on a local page at all. Google's script
  with no key ignores the `styles` option, so every label stays. Picture such a change on the live
  site, by `setOptions` on the live map, and walk the shipped build after the merge.

## Out of scope

The Map page and Materials on site. Pins of new kinds on a painted map. The Dashboard's Paint a map
press. Any change to who can open a map or make a link.
