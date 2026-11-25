# How the pictures were drawn

A picture here is the real app on a local dev server, in a sealed lens frame (punch list #194),
with invented rows. No file under `src/` is changed, the live site is never opened, and nothing is
written to the database. 88 pictures of fifteen cards were drawn this way on 2026-11-24.

## The pieces, in this folder

- **`vite.config.ts`**: the repo's own Vite config plus one plugin. The plugin wraps
  `buildLensWorld` in `src/lib/lens/world/lensWorld.ts` as the dev server serves it, so a sealed
  frame takes extra rows from `window.__picExtra` before the app starts:
  `tables` replace a table's rows, `add` appends to them, `rpc` and `functions` are static answers.
- **`lib.cjs`**: the shooter, over Playwright. It names the window
  `pipetooling-lens:{"as":…,"mood":"full","theme":…}` before any page script, checks
  `window.__lens.config.as` before every capture, and closes the page at once if the frame is not
  sealed or if any request leaves for Supabase. Service workers are blocked. `p.asks()` lists every
  read the frame made and who answered it (`world`: the frame had rows, `rule`: answered empty,
  `missing`: an error), which is how to find the rows a screen needs.
- **Five folders of scripts**, named by their cards. A `rows*.cjs` or `world*.cjs` file holds the
  invented rows. The others open a role at a width, press what the card is about, and shoot.
  Only the scripts that made a kept picture are here.
- **`pages/`**: `cards.json` holds each card's words and its pictures' captions. `make-pages.cjs`
  writes every `pictures.html` and the index from it and a folder of WebP pictures.

## To draw a card again

One command does it: `npm run todo:pictures -- 396`, with the card's number.

It reads the card from `pages/cards.json`, starts the dev server with the kit's config, runs the card's scripts (`draw`, each line a script and the words it takes), turns each PNG into WebP, stamps the card with today and the newest version on the checkout, and writes the card's page. The PNGs land in a new folder under the system's temp folder, and the command prints where. It stops and writes nothing when a script fails or a picture the card names was not drawn. The app has then changed under the script, and the script is the thing to mend.

The command does not cut the lead picture beside the card (`pictures-lead.webp`, or `pictures-today.webp` with `pictures-if-built.webp`). That cut is a choice: `cwebp -crop x y w h -resize <width> 0`, about 234 px wide for a phone screen and 412 px for a desk one.

A page says the day its pictures were drawn and what main was at: *Made by a script on 2026-11-24 (…), with main at v2.8442.* The board reads both. A card that cites a version newer than that is marked on its row: *The screen changed after these were drawn.* A redraw clears the mark.

By hand, the same steps:

1. Start the dev server with the kit's config, on a port of its own, from the repo root:
   `npx vite --config scripts/todos/pictures-kit/vite.config.ts --port 5187 --strictPort`.
   In a Claude session, use a launch entry and `preview_start`, and close the tab it opens: that tab is not sealed.
   A fresh worktree needs `.env.local` first, or the app does not start.
2. Run a script from the repo root:
   `NODE_PATH=$PWD/node_modules node scripts/todos/pictures-kit/396-426-189/pace2.cjs`.
   A capture takes 6 to 15 seconds. Pictures land in `PIC_OUT`, or in a folder under the system's temp folder.
3. Look at every picture before keeping it: the Lens badge or the right screen, no error box, no
   real name, and that it shows what its caption says.
4. Convert each PNG: `cwebp -q 80 -m 6 picture.png -o picture.webp`.
5. Write the pages: `node scripts/todos/pictures-kit/pages/make-pages.cjs <folder of .webp>`.
   It needs every picture named in `cards.json`. With `--card <number>` it writes that one card's page and needs that card's pictures alone. To change only a page's words, edit the page: the
   words are plain HTML above the pictures.

## The rules the pictures keep

- **Invented data only.** The lens people (Devon, Max, Rosa, Cora, Eli, Paco, Sid and Hal Sample,
  Sam Plumber), the lens customers, and names that read as invented. Never a real customer, job,
  person, phone, address or amount, since the repo and the `/to-dos/` pages are public.
- **Every picture says what it is**: the app with invented data, or a card's mock-up. A mock-up is
  never passed off as the built screen.
- **A screen that differs from its card is shown as it is**, with one line that says so.

## What tripped

- The lens's own company holds people, four customers, five jobs, five bids, a schedule, clock
  sessions, bills and message threads. 80 of the 85 app pictures needed more rows than that.
- A static answer is the same whatever the arguments. Where a screen calls one RPC with several
  arguments, answer per argument from an init script in front of the sealed fetch (`rpcByArg` in
  `111-119-284/rows.cjs`).
- At night the frame's day does not read as a working day. Hold Playwright's clock at mid-morning.
- Job Mode and Short view live in the frame's storage, which is a memory store. Set them in the
  page after it loads.
- Reads the lens has no answer for draw error text on Job Mode. `396-426-189/world.cjs` answers
  them empty (`QUIET`).
- The street view and the map on Permits come from outside services and draw grey in the frame.
- A headless browser has no camera and no phone keyboard.
- The app's own company name shows in a reply box. Crop it out.
- `sips -c <h> <w> --cropOffset 0 0` crops the centre. Use `--cropOffset 1 1` for the top.
- Only Chromium is installed here, so no picture is from Safari.
