---
name: "prts.co: scan a box, see what is in it with no sign-in"
number: 294
group: close
status: designed 2026-11-09 from the owner's ask of the same day · the tape labels for the two Brother P-touch printers and the dashed code (4F2A-9C18) added the same day · the owner's go the same afternoon (build it as drawn, the search keyed by a scanned code) · all five PRs merged 2026-11-09/10: v2.6796 #7469, v2.6797 #7473, v2.6799 #7474, v2.6800 #7475, v2.6801 #7476 · box-read deployed after PR 2 and again after PR 3, dev-mcp after PR 2, both probed live on a real cage · left: the owner's second Cloudflare rule, the ZZ walk of the public page, the tape walk on both printers
mockup: to-dos/prts-box-page/scan.html
summary: >
  Every cage and box on a job site already wears a printed label whose QR reads prts.co/b/<code>,
  and prts.co already forwards every path to the app. Today the scan ends at the sign-in page, and
  a helper who is signed in is bounced to the Dashboard, because the box route is not on the field
  roles' list. The owner wants the scan to open a public page: what is in the box with its count,
  the newest photo and the manifest, a search over the other boxes on that site, and a sign-in only
  when someone wants to change a count. The design keeps the printed labels and the redirect as
  they are, moves the box route out from behind the sign-in, and reads the box through one new
  function by its code with the estimate link's guess guard. The search is keyed by a scanned code
  and covers that site's boxes, never the whole company. The owner's second ask the same day: the
  labels will come off two Brother P-touch tape printers for boxes that sit in the sun, so the card
  adds a Tape format printed through the printer's own driver from the browser's print window, a
  CSV for Brother's label editor, and a Copy the label code press on the phone for Brother's app.
  His third ask: the code reads 4F2A-9C18 everywhere a person reads it, so it can be relayed by
  voice, while the bare code keeps working and the QR stays as small as it is.
next: The owner's walk of the redrawn page on a phone with no session (direction B of `to-dos/prts-box-page/landing-before-after.html`, built as v2.6868 and v2.6874); press Text the office once on a real phone and say whether the letterhead's number takes texts. The owner makes the second Cloudflare rule for bare prts.co from `scripts/cloudflare/prts-co-redirect.md`; the ZZ walk in v2.6797's fragment on a phone with no session; the tape walk on the PT-D610BT and the PT-E720BT, once on each width, from Labels → Tape. Retire the card once the walks pass.
size: M as a train of five (XS · S · S · XS · S), all five shipped; left: the walks (S)
blocker: None. The second Cloudflare rule is the owner's step and nothing waits on it; the tape walk needs the printers on the office Mac.
opinion: build — the labels, the domain, the redirect, the arithmetic in SQL, the guess guard and the view ledger all exist; what is missing is one public page and one read function, and a crew's scan is broken today for every field role
---

# prts.co: scan a box, see what is in it with no sign-in (#294)

## The ask, in the owner's words

2026-11-09:

> I love the materials on site manager we have created. Since we have the prts.co domain I was thinking we turn that entry point into a part manager page where someone going to that page doesn't need to sign in to see the parts that are in that box: prts.co. I want someone to be able to go up to a box, scan the QR code, have it pull up what's inside with the most recent photo and manifest, and if they want to update the quantity then they have to sign in. But from that non-signed-in screen they should be able to search all the materials on site to find what they're looking for.

## The recommendation in one line

Build it: the label, the domain, the redirect and the arithmetic already exist, so the work is one public page and one read function, and the same change fixes a scan that lands every field role on the Dashboard today.

## What the app has today (read 2026-11-09)

- **Labels with a QR exist.** Jobs → Materials → Labels prints one Letter sheet per cage or box with the stencil, a QR and ruled lines. The QR carries `PRTS.CO/B/<CODE>` in capitals, 18 characters, a 21-module code that scans from across a room (`src/lib/materials/labels.ts`, `boxUrl`). The code is the container id's first eight hex characters in capitals, kept on `job_containers.code` with a unique index. The manifest print carries the same code so the paper and the label name one box.
- **prts.co forwards everything.** The zone has no origin and no Worker. One Cloudflare redirect rule answers every path with a 301 to the same path on clicktooling.com, lower-cased, query string kept (`scripts/cloudflare/prts-co-redirect.md`). So a scan lands on the app's `/b/<code>` route. A Worker on prts.co would never run while the rule exists; Redirect Rules run before Workers.
- **The box route is behind the sign-in.** `/b/:code` sits inside the Layout's protected routes (`src/App.tsx`, `src/pages/BoxCode.tsx`). Signed out, a scan lands on the sign-in page and the box is forgotten. Signed in, the page finds the box by its code under the caller's RLS and goes to its screen on the Tally's On site tab.
- **A crew's scan is broken today.** `/b` is on none of the field allow-lists in `src/lib/layoutRouteAccess.ts` (the subcontractor and helper list, the primary list, the superintendent list), and the Layout sends a role off a path it may not open to the Dashboard. Only the office roles can scan a label and land on the box. The guide tells the crew to point the camera at the label and the box opens; for them it does not.
- **A box's contents are a sum.** `job_material_movements` is an append-only ledger; a container's lines are the sum of its rows (`src/lib/materials/onSite.ts`, `containerLines`). Since v2.6743 the same arithmetic runs in SQL as `on_site_job_summary(job, since)`: every line of every container of a job in one call, granted to signed-in users (the service role keeps its default grant; PR 2 confirms it with a dry call before anything else, else a one-line GRANT).
- **There is no stored manifest.** The manifest is a print rendered from the ledger (`src/lib/materials/containerManifest.ts`, `ManifestPrintModal.tsx`): job, site, stencil, printed day, last recorded day and by whom, the lines with their counts, ruled rows. The laminated paper on a cage is a snapshot of the ledger on its print day.
- **A photo lives in Drive.** The phone shrinks the shot, puts it in the private `box-photos` bucket, writes a `job_box_photos` row; the `photo-save` sweep files it in the job's Drive photo folder, writes `drive_file_id` and `filed_at`, and deletes the bucket copy. The app keeps no lasting copy. The office page draws no thumbnail of a filed photo; the phone that took it draws its own copy from IndexedDB. The function `drive-link` already streams a Drive file's bytes through the service account with no sign-in (`?raw=1`), so a public page can show a filed photo without opening Drive.
- **Who may see and write.** One gate, `on_site_can_touch_job(job_id)`: the caller can see the job in `jobs_ledger` under their own RLS or is on its team. Every table has RLS for `authenticated` only; `anon` reads nothing. A signed-in person not on the team reads the lines and gets no press.
- **The public-page precedents.** The estimate link `/e/<ten letters>` and the bill link `/pay/<ten letters>` read one record by a short code through an edge function with `verify_jwt = false`, count wrong codes by the hour per source through `estimate_link_miss` and answer 429 past 20 misses (`_shared/estimateLinkMisses.ts`, reused by `pay-link` as is), and sit outside the Layout as light pages on the portal's paper (`src/pages/PayLink.tsx`, `portalTheme.ts`). Public views land in `public_page_views` with a `surface` and an `entity_id`, and a staff session or `?preview=1` is not counted (`_shared/publicViewCounting.ts`). Every public route must have a row in `src/lib/customerSurfaceRegistry.ts` or CI fails.
- **The sign-in comes back.** `SignInRoute` honours a one-shot return path in `localStorage` (`POST_LOGIN_REDIRECT_KEY` in `src/lib/iosPwa.ts`), the way the Add Task shortcut returns to `/task` after a sign-in. Internal paths only.
- **The search that exists is signed in.** Go anywhere's *Boxes on site* group (`src/lib/materials/boxSearch.ts`) finds a box by stencil, part or place across every job the caller can see. Nothing of it is public.

## The design

### The idea

The label is already the key. A scan opens a page that reads one box by its code and shows what the laminated manifest shows, minus the job's name and the people. Changing a count is the app's own press, reached by signing in and coming back to the same box. The search is for the person standing on the site holding a label, so a scanned code is what opens it, and it covers that site's boxes.

### 1. The public read: what a scan shows

`prts.co/b/<code>` → 301 → `clicktooling.com/b/<code>`, the route moved out from behind the sign-in. Signed out, the page reads the box through a new function, `box-read`, and shows:

- **The box**: its stencil and kind (*Cage B3*), its place and where-note (*Level 2 · by the north stair*). The page's own title, so a phone's tab reads *Cage B3*.
- **The newest photo**, large, with the day it was taken. The function answers the photo's address, which is the function itself: it streams the bytes from Drive by `drive_file_id` through the service account as `drive-link` does, or from the bucket while the sweep has not filed the shot yet, with an hour's cache header. No Drive link ever reaches the page.
- **The manifest**: every line with something on hand, in name order, with the manufacturer and the count. This is the manifest; the laminated paper is the same list on its print day. A line reads *Last counted Nov 5* or *Never counted* under the table, the day only.
- **Two presses**: **Sign in to change a count** (the primary) and **Find a part on this site** (the search, PR 3). Below them, small: *Click Plumbing & Electrical*.

What it never shows: the job's number or name, the customer, the address, any price or money, anyone's name (the ledger's `by_name`, the photo's taker), the history of movements, the other boxes (until a search asks), retired boxes. A retired box's code answers *This label is from a box that was retired* with no lines.

**The address stays as printed.** The code is eight hex characters, 32 bits, about four billion values; the live boxes number in the low hundreds, so a guess hits one in tens of millions, and the page carries nothing worth a guess. The estimate link's guard counts every miss per source and locks a source for the hour after 20. Reprinting every label on a yard of cages for a ten-letter code buys nothing the page needs; the card names it so the choice is on record. The code is the id's prefix, which under RLS opens nothing for anyone not signed in.

**The function `box-read`**: `GET ?code=<8 hex>` (anything else is 400 before the database is touched). Service role: the live container by code (404 and a miss when none, 410 when retired), the job's lines from `on_site_job_summary` cut to the container, the newest `job_box_photos` row for it. Answers `{ ok, box: { code, stencil, kind, place, where, lines: [{ partName, manufacturer, onHand }], lastCountedOn, photo: { takenOn, url } | null } }`. Writes one `public_page_views` row, surface `box_page`, `entity_id` the container id, unless the request carries `?preview=1` or a valid staff token (the page sends the browser's token when one exists, as the estimate page does). `GET ?code=<code>&photo=<id>` streams the photo. `verify_jwt = false`. The pure parts (the code check, the answer's shape, the client read) in `_shared/boxPage.ts`, re-exported from `src/lib/materials/boxPage.ts` and tested there, the `payLink.ts` pattern.

### 2. Signed in, nothing changes for the crew

The same route, with a session: the page goes to the box's screen on the On site tab as it does today, and PR 1 lets every field role through. While the session is still loading the page draws the public view, so a scan never waits on the auth gate; the moment the session is known it moves on. A signed-in person who is not on the job's team lands on the app's box screen as today, which reads the lines and offers no press.

### 3. The sign-in step to change a count

**Sign in to change a count** writes `/b/<code>` into the one-shot return key and goes to `/sign-in`. After the sign-in the app lands on `/b/<code>` again, now with a session, which goes to the box's screen on the On site tab: Used, Move to…, Can't find, Count this box, Add a part, Photo — the presses that exist, each writing its movement row under the gate. No new write, no new RPC, no new press. The sign-in page itself does not change; its mock-up frame shows it as it is with one line under the form, *You will go back to Cage B3*, which is an XS nicety and not owed.

### 4. The search, and the privacy line

The owner asked for a search from the signed-out screen. What a search reveals depends on what opens it, so here are the three ways, and what each shows to whom:

| Gate | What anyone with the address sees | Verdict |
|---|---|---|
| **Nothing**: `prts.co` open to all | Every live box on every job with its place and contents. The company's whole on-site inventory, which cage holds the brass valves and which the copper, on a page a thief can read from the parking lot. | No. |
| **A company-wide secret in the address** (`prts.co/s/<secret>`) | The same inventory to anyone who has the address. A secret in a URL is forwarded in a text the day it is useful, and then it is the row above with a longer address. | No. |
| **A code scanned from any box** (the recommendation) | The boxes **on that box's job** with their stencil, place and the lines that match the words typed. The person is standing on the site with a label in front of them; the search shows them the rest of that site. Nothing about another job. | Yes. |

So: `box-read` takes `?code=<code>&find=<words>` and answers the live containers of **the same job** whose stencil, place or lines match, each with its stencil, place, code and the matching lines with on hand, at most 30 boxes. The code is the key: no code, no search. A hit opens its own box page by its code. The page keeps the last scanned code on the phone for a day, so the bare `/b` page offers **Search the boxes on the site you last scanned** without a second scan.

What the owner gives up with this gate: a person on one site cannot find a part sitting on another site without signing in. The signed-in search (Go anywhere, *Boxes on site*) already does that across every job the person can see, and the public page's sign-in press is one tap away. If the owner wants the whole company searchable with no sign-in, the first row says plainly what that shows, and the card asks him to say so in words.

A development with several jobs on one site is the one case the job scope under-serves; the search can take the development's sibling jobs later (`developments` ties them), noted under Left.

### 5. The bare entry point, `prts.co`

Today `prts.co/` forwards to `clicktooling.com/`, the sign-in page. A second redirect rule on the zone, ahead of the first, sends the bare host (`http.request.uri.path eq "/"`) to `clicktooling.com/b`: the app's new **Scan a label** page, with the words *Point your camera at a box's label*, a box to type the eight characters under the QR, and the search line above when a code was scanned on this phone in the last day. The rule is an XS owner step, mirrored in `prts-co-redirect.md` like the first.

### 6. QR codes and labels

Nothing to print for the page itself. The sheet labels already carry the right address, the QR already encodes the code the page reads, the manifest print already carries the code under its title. `_shared/qrPng.ts` is not needed; the client's `qrcode.react` draws the labels today. One label note: the laminated manifest could carry the words *Scan the label to see today's count* in its foot, since the paper is a snapshot and the page is live. Optional, XS, PR 3.

### 7. Tape labels for the two Brother printers

The owner's second ask, 2026-11-09:

> Long term I plan to create QR code by using a Brother PT-E720BT and Brother P-Touch PT-D610BT to put onto boxes that may sometimes go out into the sun. How could we make it easy for the desktop app to print these labels?

**The rule: let the printer's own driver do the work.** Both printers install on a Mac or PC as ordinary printers with Brother's driver, and the tape width becomes the paper size. So the app lays the label out at the tape's size and prints it through the browser's print window, the way it prints the sheet labels today. No printer code in the app, and the same path serves both models and the next one.

What a web app cannot do, so the design does not try: Brother's b-PAC kit is Windows-only and runs as a COM object, out of a browser's reach. The printers' Bluetooth is classic Bluetooth for Brother's own phone app, which Web Bluetooth cannot open. Talking USB from the browser fights the installed driver and breaks per operating system. A helper program on the office computer would work and is one more thing to keep running.

**The experience, step by step.**

*At the desk, the first time.* Jobs → Materials → Labels. Above the labels, two chips: **Sheet** and **Tape**. Press Tape and the preview turns into one strip per box: the QR on the left, the stencil large beside it, the code with its dash and the words *Scan for what is inside* underneath. Tick the boxes to print or keep them all. Press **Print 6 tape labels**. The browser's print window opens. Pick the Brother printer, pick the 24 mm paper, set margins to none, press Print. The printer prints the strips one after another and cuts between them. The chip the office picked is remembered on that computer.

*At the desk, every time after.* Press Tape is already on. Press **Print N tape labels**, press Print. The browser remembers the printer and the paper for the site, so the print window opens ready. Two presses from the page to the tape.

*A whole job at once, from Brother's own editor.* **Export the labels as a CSV** on the same panel writes one row per box: the stencil, the code and the full address. Brother's P-touch Editor merges a CSV into a saved template and prints the run. For the office person who already lives in that editor, this is zero new habits.

*In the field, at the cage.* The PT-E720BT prints over Bluetooth from Brother's phone app. The box's screen on the On site tab gets a press, **Copy the label code**, which puts `PRTS.CO/B/4F2A-9C18` on the clipboard with a toast saying so. In Brother's app the person adds a QR, pastes, prints. No integration, and it works the day it ships. With no phone at all, both printers make a QR from text typed on their own keypad, and the code is printed under every sheet label to copy from.

**The label itself.** 24 mm tape, the widest both printers take (the owner confirms the width he stocks; the layout takes the width as a setting, 18 and 24). A 21-module QR fills the tape's height less a quiet zone of four modules on every side, so it scans from arm's length, which is right for a label on a cage's door. The stencil in the largest type that fits, since a person reads the stencil and the phone reads the code. Dark modules on a light tape, black on white or black on yellow, because scanners read dark on light; never white on black. The sun is the tape's job: Brother's laminated tape is rated for outdoors, and the strong-adhesive kind holds on a cage's bars.

### 8. The code reads with a dash

The owner's third ask, 2026-11-09: the printed code should read `PRTS.CO/B/4F2A-9C18`, four characters, a dash, four characters, so a person can relay it over the phone, while `4F2A9C18` keeps working and the QR stays as small as possible.

Two facts make this cheap. **The reader already takes the dash**: `normalizeBoxCode` strips everything that is not a letter or a digit before it checks for eight, and its test already holds `7D75-9246` → `7D759246`, so `/b/4f2a-9c18` opens the box today, and the Cloudflare rule passes a dash through untouched. **The dash would not grow the QR**: the labels draw the code at level M, where a 21-module code holds 20 characters, and `PRTS.CO/B/4F2A-9C18` is 19. The design still keeps the QR bare as asked, since the camera never reads the dash and 18 characters leaves the most room for error correction; the card notes that the dashed form would fit so the choice is on record.

So the change is one pure function and the places people read the code: `boxCodeWords(id)` → `4F2A-9C18` and `boxAddressWords(id)` → `prts.co/b/4F2A-9C18` in `labels.ts`, used by the sheet label's line under the QR and its address sentence, the manifest's code and foot, the tape strip, the Copy the label code press (the clipboard gets the dashed form, since a person pastes it into Brother's app and the printer's own QR reads either), the public page's words (*4F2A-9C19 is not a box on any job*) and the typed-code box on the bare `/b` page, which puts the dash in as the person types and takes it back out before asking. The QR's value stays `boxUrl`, the bare capitals. `box-read` strips the dash before its eight-hex check, so both forms open the box and the dashed form never counts as a miss.

**The build.** PR 4 (XS): the CSV export, a pure kernel (`labelsCsv.ts`) over the labels the panel already lists, and the phone's Copy the label code press over `boxUrl`. PR 5 (S): the Tape layout, a second print root beside the sheet's with `@page` set to the tape's size, the Sheet · Tape chips remembered per device, the tick list, the counted press from `batchWords`, a render smoke, the guide's Scan a label section saying how to print to tape, and a *Labels* paragraph in `docs/MATERIALS_ON_SITE_ARCHITECTURE.md`. Walked on both printers before it ships, with one run of each width, since the only proof of a tape layout is the tape.

## Where it plugs in

- **Exists, touched**: `src/App.tsx` (the `/b/:code` route moves to the public block; a `/b` route joins it), `src/pages/BoxCode.tsx` (the signed-out view and the session fork), `src/lib/layoutRouteAccess.ts` (`/b` on the three field lists), `src/lib/customerSurfaceRegistry.ts` (the row for `/b/:code` and `/b`), `supabase/config.toml` (`[functions.box-read] verify_jwt = false`), `scripts/cloudflare/prts-co-redirect.md` (the second rule), the guide *keep track of the material in the cages and boxes on site* (the Scan a label section), `docs/EDGE_FUNCTIONS.md`, `docs/MATERIALS_ON_SITE_ARCHITECTURE.md` (The doors), `docs/twins/APP_DIRECTORY.md` (the `/b` page), `PROJECT_DOCUMENTATION.md`, `ACCESS_CONTROL.md` (who sees what signed out).
- **Exists, reused as is**: `on_site_job_summary` (the lines), `estimate_link_miss` through `_shared/estimateLinkMisses.ts` (the guard), `public_page_views` through `_shared/publicViewCounting.ts` (the count), `_shared/driveJobFolder.ts`'s `driveMedia` (the photo's bytes), `POST_LOGIN_REDIRECT_KEY` (the return), `portalTheme.ts` (the light paper), `normalizeBoxCode` and `boxCode` in `labels.ts`.
- **New**: `supabase/functions/box-read/index.ts`, `_shared/boxPage.ts` with `src/lib/materials/boxPage.ts` and its test, `src/components/materials/BoxPublicPage.tsx` with a render smoke, `src/pages/BoxScan.tsx` (the bare `/b` page), one release note and fragment per PR. For the tape: `src/lib/materials/labelsCsv.ts` and `tapeLabel.ts` (the strip's rows and the page size per width) with tests, `src/components/materials/TapeLabelPrint.tsx` beside the sheet print in `JobsMaterialsTab.tsx`, the Copy press in `TallyOnSiteTab.tsx` over `boxUrl` in `labels.ts`.
- **No migration**, unless the dry call in PR 2 finds the service role without EXECUTE on `on_site_job_summary`; then one line.

## The plan

1. **PR 1 · the crew's scan lands on the box, and the code reads with a dash (XS)** — `/b` on the subcontractor, primary and superintendent lists in `layoutRouteAccess.ts`, with a test that walks the four roles over `/b/4f2a9c18` and `/b/4f2a-9c18`; `boxCodeWords` and `boxAddressWords` in `labels.ts` on the sheet label, the manifest and the guide, with tests. Ships alone and today; the first half is a fix, not the feature. The guide's Scan a label words come true for the crew.
2. **PR 2 · the public box page (S)** — `box-read` with the code check, the guard, the view row and the photo stream; the route out of the Layout; `BoxCode.tsx` forking on the session; `BoxPublicPage.tsx` on the portal's paper at 375 and 320; the sign-in press and its return; the registry row; the guide's section; the docs. Deploy the function after the merge (`supabase functions deploy box-read`); nothing in the database changes. `check:calls-ahead` has no table or RPC to label.
3. **PR 3 · the search and the front door (S)** — `?find=` in the function over the same job; the search box and its results on the public page; the bare `/b` page with the typed code and the remembered site; the second redirect rule on prts.co (the owner, or a session in his Chrome signed in to Cloudflare), mirrored; the manifest foot's line. Redeploy the function.
4. **PR 4 · the CSV and the Copy press (XS)** — **Export the labels as a CSV** on the Labels panel for Brother's editor, and **Copy the label code** on the box's screen for Brother's phone app. Ships before anything is laid out for tape, so the owner can print from the editor the day the printers arrive.
5. **PR 5 · the Tape format (S)** — the Sheet · Tape chips on the Labels panel, the strip per box at the tape's width, the tick list and the counted press, printed through the printer's driver from the browser's print window. Walked on the PT-D610BT and the PT-E720BT over USB before it merges.

Later, not owed: a development's sibling jobs in the search; a *Print this list* press on the public page that prints without the job's name; the sign-in page's *You will go back to…* line.

## How to verify

- **PR 1**: `/dev-login?as=1`, Settings → View as… → Helper, then open `/b/<a live box's code>` in the address bar at 375, once bare and once with the dash. Before: the Dashboard. After: the box's screen on On site. The same as a primary and a superintendent. Print one sheet label and one manifest on a ZZ job: the line under the QR reads `4F2A-9C18`, the QR still scans to the box, and the QR is still 21 modules across.
- **PR 2**, on a ZZ test job (never a paid job's box): the office adds a cage on the ZZ job, prints its label, takes one photo on the phone and waits for the sweep to file it (five minutes). In a browser with no session, open `prts.co/b/<CODE>` as printed: the 301, then the page with the stencil, the photo, the lines and the two presses, nothing of the job. Try a code that is no box: *is not a box on any job*, and after 20 wrong codes from one connection the 429 words. Press Sign in to change a count, sign in as a helper on the job's team: the On site tab opens on that cage. Read `public_page_views` for one `box_page` row, and none for the signed-in look. Retire the cage and scan again: the retired words. A real phone's camera on the printed label, iPhone and Android, since the label's capitals are what the rule lower-cases.
- **PR 3**: from the ZZ cage's page, Find a part: a word on a line in another ZZ box of the same job finds it, a word on a box of another job finds nothing. `prts.co` bare: the Scan a label page, the search line present on the phone that scanned, absent in a fresh browser.
- **PR 4**: Export the labels as a CSV on a ZZ job with three boxes: three rows, the stencil, the code, the address; open it in Brother's editor, merge into a template with a QR, print one; scan the tape with a phone. On the phone, Copy the label code on a ZZ box and paste it into Notes: the capitals as the sheet label prints them.
- **PR 5**: on the office Mac with the printer on USB and Brother's driver installed: Labels → Tape → Print 3 tape labels → the print window with the Brother printer and the 24 mm paper → three strips, cut between them, the QR scanning at arm's length to the right box page, the stencil readable from a step back. Once on each printer, once on each width the owner stocks, once on black-on-yellow tape. Close the tab, open it again: Tape is still the chip.
- Made-up names, jobs, counts and prices only, in the repo, the PR and every screenshot. The mock-ups were drawn with Playwright at 375 and 320 before they were shown; the PNGs stay local.

## The mock-ups

- [`scan.html`](./scan.html): the scanned box on a phone, signed out, at 375 and 320, and the retired and not-a-box states.
- [`search.html`](./search.html): Find a part on this site with its results, the empty answer, and the bare `prts.co` page with and without a remembered site.
- [`sign-in.html`](./sign-in.html): the hand-off in three frames: the public page's press, the sign-in page, the box's screen in the app with its presses.
- [`landing-before-after.html`](./landing-before-after.html): the page a scan opens, today and three after directions, the pick in its states, where each piece comes from, and the owner's calls (2026-11-10, see the last section).
- [`tape-labels.html`](./tape-labels.html): the strip on 24 mm tape at print size and enlarged, the Labels panel with its Sheet · Tape chips and the counted press, the print window's first-time picks, and the phone's Copy the label code press.

Every job, person, street, part and count in them is made up: Ridgeway Builders' Oak Hollow Apartments Building C, cage B3 at Level 2 by the north stair, Mateo Ruiz and Jordan Pike on the crew, the parts and their counts.

## Calls for the owner

1. **Build it as drawn?** Three PRs, the first a fix the crew hits today.
2. **The search's gate**: a scanned code, covering that site's boxes (the recommendation), or the whole company open at `prts.co` with no key, knowing what that page shows to anyone who finds the address.
3. **The Cloudflare rule** for the bare `prts.co`: the owner from the two lines in `prts-co-redirect.md`, or a session in his Chrome once he has signed in to Cloudflare.
4. **The tape**: which width he will stock (24 mm is the recommendation, 18 mm the fallback), and whether PR 4, the CSV and the Copy press, should go ahead of the public page since it is the smallest and the printers may arrive first.

## Where it stands

Designed 2026-11-09 from the owner's ask of that morning; the tape labels and the dashed code added the same day from his second and third asks. The go came the same afternoon: build it as drawn. **All five PRs are on main** (2026-11-09/10), built as a stack so the shared files (the box page, the guide) never conflicted in the queue; each was replayed past the queue's squash of the one below before it was armed.

| PR | What | Landed |
|---|---|---|
| 1 · #7469 · v2.6796 | `/b` on the three field allow-lists; the code reads `7D75-9246` on the sheet label and the manifest | 2026-11-09 |
| 2 · #7473 · v2.6797 | `box-read` (the code, the lines from `on_site_job_summary`, the newest photo streamed from Drive, the guess guard, the view row) and the public page; `/b/:code` out of the Layout; Sign in to change a count | 2026-11-09, `box-read` and `dev-mcp` deployed |
| 3 · #7474 · v2.6799 | `?find=` scoped to the scanned box's job; Find a part on this site; `/b` Scan a label; the second Cloudflare rule mirrored | 2026-11-09, `box-read` redeployed |
| 4 · #7475 · v2.6800 | Export the labels as a CSV; Copy the label code on the phone | 2026-11-09 |
| 5 · #7476 · v2.6801 | `LabelsPrintModal.tsx`: Sheet · Tape, 18 or 24 mm, a chip per box, the counted press, the `@page` rule at the tape's size | 2026-11-10 |

**Probed live** after each deploy, with `?preview=1` so no view counted: a real cage answers with its stencil, its lines, the last count's day and its newest photo (190 KB streamed from Drive); `?find=` lists the scanned cage first; an unknown code answers 404 and a non-code 400; the JSON names no job, customer, price or person.

**Left**: the owner's walk of the redrawn page, Text the office pressed once on a real phone (the last section); the owner's second Cloudflare rule (bare `prts.co` → `/b`, in `scripts/cloudflare/prts-co-redirect.md`); the ZZ walk in v2.6797's fragment on a phone with no session, sign-in hand-off included; the tape walk on both printers and both widths. Then retire the card and let the release notes carry it.

**Learned on the way** (for the next stacked train): after a replay onto main the SQL beds run can post only its `changes` job, so the required `sql-beds` check never appears and the queue will not take the PR; `gh run rerun` on that run posts it, then `enqueuePullRequest`. PR 3 sat four hours on this.

## The page a scan opens, a second look (2026-11-10)

The owner printed his first cage labels on the PT-D610BT, scanned one with an iPhone and asked whether the page it opens should be improved. [`landing-before-after.html`](./landing-before-after.html) draws today's page, three after directions on one cage, the pick in its states, where each piece comes from, and the calls. He picked direction B the same day (*Yes, build B*). PR 1 is v2.6868 and PR 2 is v2.6874; `box-read` is redeployed after PR 2. Two things are left for a real phone: whether the letterhead's number takes a text, and whether the `sms:` link fills in the words on his iPhone. Found on PR 1's walk and fixed in it: a press from Scan a label to a box page, or back, blanked the screen, because the two lazy routes had no Suspense above them.

**What the read found.** `box-read` answers the code, the stencil, the kind, the place, the where-note, the lines with their maker and count, the day of the last count and the newest photo. The page draws all of it except the code. His test cage showed no place, photo or maker because it has none. The summary the function already calls also holds every line at zero, each line's Can't find presses since its count and the time it was last touched; the kernel's `boxPageLines` drops the lines at zero and passes none of the rest on. One fault, read from the code and not walked: the retired page's Find a part on this site press ends in an error, because the function answers `retired` before it reaches the search.

**The recommendation: direction B, as two small PRs.**

1. **PR 1 (S, client only, no deploy).** The stencil in a tile with the kind, the place and the code under it, as the label reads. The count as a verdict from `lastCountedOn` and the app's 14-day rule: *Counted 2 days ago*, *Due a count*, *Never counted*. The photo as a band with a tap to see it whole. The search as a field on the page, holding the one blue press. The sign-in reworded for who it is for, *Sign in to record a use or a count*, with the line that it is once per phone. The retired page loses its Find press and gains *Scan another label*; the not-a-box page gains *Type the code* and the last-scanned site.
2. **PR 2 (S, the kernel and the function, one deploy, no migration).** A line emptied since the cage's last count stays as *None left*. A line with a Can't find since its count says so. *Text the office about Cage B3*, a text link to the company's own number with the cage's name filled in, which writes nothing. The stencil on a retired cage's page.

The guide's Scan a label section moves with each PR.

**Not offered.** Over the privacy line: who counted or touched a line, who took the photo, the job, the customer, the address or a map, a price, the history, the other cages before a search asks. Against the page's other rule, that nothing signed out writes: a form that reports a part missing. Not buildable: handing the scan to the app on an iPhone's home screen.

**The calls**, each with the pick:

1. Build B as two PRs with the client-only one first? *Yes.*
2. Which press is blue, Find or Sign in? *Find.*
3. Do the sign-in's new words read right? *Yes, with "On Click's crew?" above them.*
4. Which lines at zero show as None left? *The ones emptied since the cage's last count; a count clears them.*
5. Does "could not be found" show to someone signed out? *Yes.*
6. A way to say something is wrong with no sign-in: a text to the office, a form, or nothing? *The text, to the number the bill page shows.*
7. The photo as a band 150 tall, or as tall as today? *The band.*
8. A retired cage's page: drop the Find press, or let a retired label search its old site? *Drop it.*
