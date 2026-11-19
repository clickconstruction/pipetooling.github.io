---
name: "Precise Location on the painted map: say it is on, and show the way to the switch when it looks off"
number: 402
group: ready
status: asked 2026-11-18 through the coordinator session · designed the same day, with a prototype drawn on the app at a phone's width in light and dark from made-up readings · shown to the owner on a private look page with eight calls, each with a pick · the owner's word 2026-11-19 (*build the four PRs with your picks*), every call at the pick · not built
summary: >
  Today the painted map speaks about location only when something is wrong, so nothing tells a
  person that Precise Location is on. A page is never told whether the switch is on. It gets each
  reading's margin, and the margin gives the switch away at both ends. The design puts one line on
  the walk, under Put the dot where I am and on the shared map, in every state: finding, on, a weak
  signal, or a reading so rough that the switch looks off. When it looks off, the line sets the
  phone's two numbers side by side and lists the steps to the switch for this phone alone. The map
  pulls back to the whole circle, and the dot stays where it was.
next: PR 1, the kernel and its tests, cut from fresh main.
size: M as a train of four (S · M · S · S), then call 8 as its own follow-up (S)
blocker: None. Every call was taken at the pick on 2026-11-19. No real phone has been read with the switch off, so the first walk on one is the proof.
opinion: build — four small PRs, and it answers the first question a person on site has
---

# Precise Location on the painted map (#402)

The mock-up is [mockup.html](mockup.html). It draws each state of the line on the walk, under
**Put the dot where I am** and on the shared map, with today's words beside it, and the steps for
each kind of phone. Add `?s=<id>` for one row alone (`walk-on`, `walk-weak`, `walk-rough`,
`place-rough`, `way`, `steps`) and `&theme=dark` for the dark theme. Every reading, job and number
on it is made up, and every sentence on it was printed by the prototype's kernel.

The owner picked from a private look page, https://claude.ai/artifact/JvPPDL1gm9yRQt2wQsRE18. It
holds pictures of the prototype running on the app beside today's screens, at a phone's width in
light and dark. It opens only for the owner, who can share it.

The prototype is the branch `claude/precise-location-proto` (commit `c08a3430d6`), pushed for
reading and never for merge. It was cut from `6134ca7d05`, before #8814 rewrote the start sheet.

## The ask

Relayed by the coordinator session on 2026-11-18: add something to the painted map screens that
explains Precise Location plainly and confirms to the person that it is on. Five ideas came with
it: a status line that is always there, in three states; the phone's two numbers side by side when
the switch is off, with a large margin in miles; the map zoomed out to the whole margin circle; a
**Check my location** line on the Paint a map start sheet; and the same words on **Use where I am**
and on `/way`, where a stranger reads them.

The owner's word on 2026-11-19: *build the four PRs with your picks*.

## What a page can know

- **No browser tells a page whether the switch is on.** The Permissions API says only whether
  location is allowed. The proposal that would say more, `accuracyMode`, has not shipped: Chrome
  lists it for Android 153 and desktop 165, and WebKit's bug is open. So the app reads each
  reading's margin, `coords.accuracy`.
- **iPhone, switch off:** Apple says usually within 1 to 20 km, about 5 km typical, and the rough
  spot is worked out again about four times an hour. WebKit hands the page the phone's margin as
  it is.
- **iPhone, switch on, a cell tower only:** 1,414 m in developer reports from 2011 and 2012, never
  read on a modern phone. So a margin over 1,000 m can be either, and the line says *looks off*,
  never *is off*.
- **Android, approximate:** about 2 km in Google's explainer, never under 200 m in Android's own
  code, and sized by how many people live there from Android 17. Chrome on Android gained a site's
  own approximate grant in about version 148.
- **The walk already asks for the best reading** (`enableHighAccuracy: true`), which an iPhone
  maps to its best accuracy.

Sources:
[Apple, the location you share](https://support.apple.com/guide/iphone/control-the-location-information-you-share-iph3dd5f9be/ios) ·
[kCLLocationAccuracyReduced](https://developer.apple.com/documentation/corelocation/kcllocationaccuracyreduced) ·
[WWDC 2020 session 10660](https://developer.apple.com/videos/play/wwdc2020/10660) ·
[a developer thread on horizontalAccuracy](https://stackoverflow.com/questions/7402503/what-do-horizontalaccuracy-and-verticalaccuracy-of-a-cllocation-refer-to) ·
[Android location permissions](https://developer.android.com/develop/sensors-and-location/location/permissions) ·
[LocationFudger.java](https://android.googlesource.com/platform/frameworks/base/+/refs/heads/main/services/core/java/com/android/server/location/fudger/LocationFudger.java) ·
[Android 17 and location privacy](https://developer.android.com/blog/posts/redefining-location-privacy-new-tools-and-improvements-for-android-17) ·
[approximate location in Chrome on Android](https://blog.google/products-and-platforms/products/chrome/approximate-location-chrome-on-android/) ·
[Android help, location](https://support.google.com/android/answer/6179507?hl=en) ·
[Chrome help on an iPhone](https://support.google.com/chrome/answer/142065?hl=en&co=GENIE.Platform%3DiOS) and
[on Android](https://support.google.com/chrome/answer/142065?hl=en&co=GENIE.Platform%3DAndroid) ·
[W3C Geolocation pull request 233](https://github.com/w3c/geolocation/pull/233) ·
[Chrome Platform Status](https://chromestatus.com/feature/5143609755828224) ·
[WebKit bug 312748](https://bugs.webkit.org/show_bug.cgi?id=312748).

## The picks

The owner took every one on 2026-11-19.

| # | Call | Pick |
|---|---|---|
| 1 | The line says *Precise Location looks off*, never *is off*, and only once the margin has stayed over 1,000 m for 4 s. Until then it says *Finding you…* | Yes |
| 2 | The line names the switch *on* only at or under 100 m, about 330 ft, a margin no rough area gives. From 20 m to 100 m it says *Precise Location is on, but the signal is weak here.* From 100 m to 1,000 m it says only *The signal is weak here.* | Yes |
| 3 | A rough reading pulls the map back to the whole circle, dashed and with no dot. The first sure reading after it brings the map in to the person. | Yes |
| 4 | The steps name the switch for this phone alone, read from the browser's name for itself. A desk, or a phone the page cannot tell, gets one line for each kind of phone. | Yes |
| 5 | **Put the dot where I am** leaves the dot where it is on a rough reading, and says why. | Yes |
| 6 | The shared map at `/way` names the switch only when it looks off. | Yes |
| 7 | A **Check my location first** press on the Paint a map start sheet. | Left out |
| 8 | The same line on a task's **Use where I am** and on the box map. | Yes, as its own PR after the four |

## The words

Every line below was printed by the prototype's kernel. Bold is the line's lead.

| The reading | The line |
|---|---|
| None yet, or a rough one under 4 s old | **Finding you…** This takes a few seconds in the open. |
| 4.5 m | ✓ **Precise Location is on.** Sure within 15 ft. |
| 35 m | **Precise Location is on, but the signal is weak here.** Your phone is only sure within 120 ft. |
| 300 m | **The signal is weak here.** Your phone is only sure within 990 ft. |
| 3,200 m, held 4 s | **Precise Location looks off.** Then two rows, *Your phone now: within 2 miles* and *With Precise Location on: within 20 ft*, then the steps. |
| The same on Android | Android's own names: *Precise location is on.* and *Use precise location*. |
| The same on a desk | **Found you.** when sure. **This device only knows the area it is in.** *It is only sure within 2 miles.* when rough. No switch is named. |

- Margins are in feet up to half a mile, rounded up the way `taskPlaceAccuracyWords` does, then in
  whole miles, rounded up. The words never claim more than the phone did.
- Over the map while a walk's reading is rough: *You are somewhere in this circle, 4 miles across.*
- Under the steps: *Already on? Step into the open and wait a moment. The phone may only be
  hearing a cell tower.*
- The steps for Safari on an iPhone, and for an app saved to the Home Screen: *Open the Settings
  app.* · *Tap Privacy & Security, then Location Services.* · *Tap Safari Websites.* · *Turn on
  Precise Location.* · *Come back to this screen.* Chrome on an iPhone taps *Chrome*, and another
  iPhone browser taps *the browser you are using*.
- The steps on Android: *Press and hold the browser's icon, then tap App info.* · *Tap
  Permissions, then Location.* · *Turn on Use precise location.* · *Come back to this screen.*
- The shared map while rough, for a stranger: *Your phone is only giving the area you are in.* ·
  *It is only sure within 2 miles, so the map cannot show where you stand.* · *To see where you
  stand, turn on Precise Location:* then the steps.
- The walk adds after a weak line: *This part is drawn faint. Fix it by hand when you look the
  line over.* After a rough one: *A line cannot be painted from a reading that wide.*
- **Put the dot where I am** adds after a weak line: *Drag the dot onto the spot.* After a rough
  one: *The dot was not moved. Drag it onto the spot by hand, or turn the switch on and press
  again.*

## Today, for the record

- **The walk:** a chip at the right reads *Sure within 15 ft*. A weak reading adds *Only sure
  within 120 ft here. This part is drawn faint.* A rough one says *Your phone is giving a rough
  location, not where you stand. A line cannot be painted from that.* with one line of steps for
  each kind of phone. Nothing ever says the switch is on.
- **Put the dot where I am:** *Found you. Your phone is sure within 15 ft.* On a rough reading it
  says *Your phone is only sure within 10,500 ft. Drag the dot onto the spot.*, and the dot has
  already jumped to the middle of the rough area, which can be miles off.
- **The shared map:** on a rough reading it draws the dot at the middle of the area and says, for
  example, *The start is 1.9 mi north of you.* and *Your phone is sure within 10,500 ft.*
- Today's Android steps go through *the lock beside the address*, the site's own grant in Chrome.
  The design's steps go through App info, the switch for the browser itself. See *Not verified*.

## Where it plugs in

On main today:

- `src/lib/paintedMap/paintedTrack.ts`: `PAINT_POOR_FIX_METERS` (20 m), `PAINT_ROUGH_FIX_METERS`
  (1,000 m), `PAINT_USUAL_FIX_METERS`, `isRoughFix`, `isPoorFix`.
- `src/lib/paintedMap/paintedWalkWords.ts`: `walkSureWords`, `walkPoorWords` and
  `WALK_ROUGH_WORDS`, which the line replaces on the walk. Remove whatever nothing reads after PR 2.
- `src/lib/paintedMap/paintedWalk.ts`: `walkFix` marks a rough reading and keeps no point from it.
  That stays.
- `src/lib/tasks/taskPlace.ts`: `taskPlaceAccuracyWords`.
- `src/hooks/usePaintedWalk.ts`: `watchPosition` with `enableHighAccuracy: true`.
- `src/lib/materials/myLocation.ts`: `requestMyFix` and `requestMyLocation`, behind **Put the dot
  where I am** and call 8's screens.
- `src/components/paintedMap/PaintedMapCanvas.tsx`: the margin circle, `ME_ICON`, `FrameMe`, and
  `Follow`, which pans and never zooms.
- `src/components/paintedMap/PaintedMapWindow.tsx` (`putDotWhereIAm`), `PaintedWalkPanel.tsx`,
  `PaintedPlacePanel.tsx`.
- `src/pages/PaintedWay.tsx` and `src/lib/paintedMap/paintedWay.ts` (`wayWords`, `wayNearMap`,
  `WAY_FRAME_METERS`). `/way/:code` is already registered as an outside page in
  `src/lib/customerSurfaceRegistry.ts` (step `painted-map-page`) and in
  `src/lib/contracts/customerContractCatalog.ts`.

New:

- `src/lib/paintedMap/preciseLocation.ts`: `preciseStateOf`, `provesPrecise`, `marginWords`,
  `areaAcrossWords`, `phoneKindOf`, `preciseSwitchName`, `preciseSteps`, `preciseWords`,
  `wayRoughWords`, `roughCompareWords`, `roughCircleWords`, and the constants
  `PRECISE_PROVEN_METERS = 100` and `PRECISE_ROUGH_HOLD_MS = 4000`.
- `src/components/paintedMap/PreciseLocationLine.tsx`: the line, the steps and the tick.

Read the prototype with
`git show origin/claude/precise-location-proto:src/lib/paintedMap/preciseLocation.ts`, and the
screens with `git diff 6134ca7d05 origin/claude/precise-location-proto`. Redo these rather than
copy them:

- `usePreciseWords` writes a ref and reads the clock while it renders. Hold the 4 s in state that
  an effect sets when the readings turn rough, with one timer, both cleared by a better reading.
  Pin it with fake timers.
- The prototype pulls the map back on the first rough reading, while the line still says
  *Finding you…* for 4 s. Make the map wait the same 4 s, so a first reading off a cell tower does
  not throw the view out and back.
- The tick's disc and the amber dot are the literals `#16a34a` and `#d97706`. Run
  `node scripts/theme-tokenize.mjs --check src` and the `check:*` scripts that read colours. Green
  words are `var(--text-green-700)`.
- `src/hooks/useLocationCheck.ts` and the start sheet's edit are call 7, left out. Leave them
  behind.
- No tests came with it, and the walk panel's render smokes still expect the chip and
  `walkPoorWords`.

## The plan

Four PRs, in order, each cut from fresh `origin/main`. Each claims its version with
`npm run claim` and ships a release note and a `docs/recent-features/` fragment, per CLAUDE.md. No
migration and no edge function.

| PR | What | Touches | Size |
|---|---|---|---|
| 1 · the kernel | `preciseLocation.ts` and its tests. Each edge: 20 m, 100 m, 1,000 m and 4 s. The words for each state and each phone. Feet to miles at half a mile, always rounded up. `phoneKindOf` for Safari, a Home Screen app, Chrome (`CriOS`), Firefox and the other iPhone browsers, an iPad that calls itself a Mac, Android and a desk. No screen changes. | `src/lib/paintedMap/preciseLocation.ts` and its `.test.ts` | S |
| 2 · the walk | The line on the walk panel in every state, in place of the chip and the faint-line alert. The canvas's `frameMargin` on a walk: a rough reading fits the map to the circle and the map's own points, dashed with no dot, under the pill *You are somewhere in this circle, …* The first sure reading after it, or the first at all below zoom 16, sets zoom 18 on the person. Render smokes for each state. The guide `paint-a-map` gains the line and the steps, with the switch's exact name. The Glossary gains *Precise Location*, one sentence a line. | `PreciseLocationLine.tsx`, `PaintedWalkPanel.tsx`, `PaintedMapCanvas.tsx`, `PaintedMapWindow.tsx`, `paintedWalkWords.ts`, `src/content/help/paint-a-map.md`, `docs/GLOSSARY.md` | M |
| 3 · Put the dot where I am | A rough reading leaves the dot where it is, and the panel shows the line with its note and the steps. A weak one says *Drag the dot onto the spot.* Render smokes. | `PaintedMapWindow.tsx`, `PaintedPlacePanel.tsx` | S |
| 4 · the shared map | A rough reading draws no dot, fits the map to the circle when the reader is within `WAY_FRAME_METERS` plus the margin of the map, and shows `wayRoughWords` and the steps. A weak one says *The signal is weak here.* with the margin. A sure one keeps today's words with the tick. Read the outside page's registrations and amend any that quote its words. | `src/pages/PaintedWay.tsx`, `paintedWay.ts` (`wayNearMap` takes the distance) | S |

After the four, call 8 as its own PR: the same line on a task's **Use where I am**
(`src/components/checklist/TaskPlaceSheet.tsx` and the other checklist screens that call
`requestMyFix`) and on the box map (`src/components/materials/WhereIsBox.tsx`, `PinAskStrip.tsx`).

## How to verify

- `npm test` holds the kernel. The render smokes use `renderWithProviders` from
  `src/test/renderSmokeMocks.tsx`.
- **A walk in a headless Chrome**, no phone needed: Playwright on the system Chrome at 390 × 844
  with `isMobile`, `hasTouch` and an iPhone Safari user agent. Replace `navigator.geolocation` with
  a stand-in the script feeds made-up readings. Refuse every Supabase call that is not a read with
  `context.route`. Sign in through `/dev-login`. Open the start sheet by importing
  `/src/lib/paintedMap/paintedMapDoor.ts` in the page and calling `startPaintedMap` with a job id
  that matches nothing, a made-up label and a centre. Feed 4.5 m, then 35 m, then 3,200 m and wait
  5 s. `/way/sample` reads no table, so the shared map walks the same way.
- **The real test, once PR 2 is live:** on an iPhone, turn Precise Location off under Settings →
  Privacy & Security → Location Services → Safari Websites. Start painting on a ZZ Test job. The
  line should say *looks off* with the steps. Write the margin it shows on this card. Turn the
  switch on, come back, press **Keep painting**, and the line should say *is on*. Do the same on an
  Android phone if one is at hand.

## Not verified

- No real phone has been read with the switch on or off. Every number above is from documents.
- Which Location Services row governs an app saved to the Home Screen. One forum post says
  *Safari Websites*. The row for Chrome on an iPhone is from Google's help, not a phone.
- On Android, whether a rough reading comes from the browser's own switch, under App info, or from
  the site's own grant, under the lock beside the address, which Chrome added in about version
  148. The steps name the first. A real Android phone says whether both need a line.
- The 1,414 m figure for an iPhone with the switch on and only a cell tower is from 2011 and 2012.

## Found on the way

- A walk started on no job opened on the whole country and never came in to the walker, since
  `Follow` pans and never zooms. #8814 starts every map on a job, which hides most of it. PR 2's
  `frameMargin` brings the map in on the first sure reading.
- Leaving for Settings pauses the walk (`walkHidden`). The walker presses **Keep painting** on the
  way back, and the steps end with *Come back to this screen.*

## Neighbours

- #8814 rewrote the start sheet and #8798 touched the window and the guide. Both merged on
  2026-11-19.
- #8917 (v2.7933, *the press opens on your next job*) was open when this card was written. It
  touches the start sheet, the guide `paint-a-map` and the Glossary. PR 2 waits for it to merge or
  keeps to other lines.
- Before each PR, list the open PRs on these files.

## Where it stands

Designed and picked. Not built. The session that picks it up puts its branch in `status` and
builds PR 1.
