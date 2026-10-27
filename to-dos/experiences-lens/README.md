---
name: "What everyone sees: every screen, as every role, in every state, live on invented data"
number: 194
group: ready
status: designed 2026-10-26 · the owner asked for it to be built once the mock-up passes its own review
summary: >
  The owner's long-term ask: one place in Dev settings that shows every experience a user can
  have, live, on test data, so a style or theme change shows on all of them before it ships.
  Today three tools each cover a slice. What customers see draws the customer's pages and emails
  on sample data, What the team sees draws the team's emails, and View as signs in as a role over
  live rows. No inside screen can be drawn on invented data, none can be drawn light and dark at
  once, and none can be drawn in its empty, loading or error state. The design is a sealed frame:
  one small module runs first on every page load and does nothing unless the lens named the frame.
  Then it swaps the frame's storage, network, sockets and sensors for an invented world, so the
  real app, unchanged, draws any page as any role, in any state, at any width, light or dark, and
  never reads or writes a real row. A new Settings tab, What everyone sees, lays the frames side
  by side, sweeps every screen a role can open, and lets a theme draft redraw all of them at once.
next: PR 2, the sealed frame and the world's first rows, then PR 3, the tab.
size: L, as five PRs after this one, M M M L M
blocker: none
ver: designed
opinion: build — the sealed frame is the one seam that reaches every inside screen without changing the app
mockup: to-dos/experiences-lens/mockup.html
---

# What everyone sees: every screen, as every role, in every state, live on invented data (#194)

## The ask

The owner, 2026-10-26, after saying build the customer reviews train (#185):

> Long term I would like to expose in Dev settings all the different experiences a user can have
> and what they see live with test data so we can review the style and if we change themes or
> styles know how this will look. Once you have finished building what you've mocked up would you
> be able to take a holistic view of the app and mockup what that could look like and then ask
> yourself is this the best we can do and is this deep enough, and then build it too

Four tests are in those words, and the design has to pass each one:

1. **All the experiences.** Not one audience. The customer's pages, emails and texts, each
   role's own screens, and the states each screen can be in.
2. **Live.** The real components drawing, not pictures of them, so the lens never goes stale.
3. **Test data.** Invented people and jobs, never a real customer's row, and no write that
   reaches the database.
4. **Theme and style changes.** A change to the look shows on every experience, side by side,
   light and dark, phone and desk, before it ships.

## Today: what each tool can show

| Tool | Who opens it | What it draws | Invented data | Light and dark | Widths | States |
|---|---|---|---|---|---|---|
| What customers see | dev, master, assistant, controller | the customer's pages, emails, texts and papers, every audience | yes, the sample tokens through the real code | no, the pages pin light by design | phone or desktop | live and done |
| What the team sees | dev | the team's emails, by person or by role | yes | no | one | one |
| View as | dev | the whole app, as a role's sample account or a real person | no, live rows, and its writes are real | the dev's own | the dev's own | whatever is live |
| Render smokes (933 files) | CI | each component, wired | stub data, empty | no CSS at all | desktop only | the ones a test sets up |
| `visual-qa.mjs`, `mobile-surface-shots.mjs` | a terminal | screenshots of 26 surfaces, with contrast and overflow audits | no, signed in as the dev over live rows | yes | 390 or 1440 | live only |
| Help guide mock-ups | everyone | hand-copied buttons and chips | yes | light only | one | none |

So the customer's side is well covered, and the inside is not. A dev can see what an estimator
sees only by becoming one over live rows, one role at a time, in their own window. Nothing draws a
screen's empty, loading, error or offline state outside a test. Nothing draws one screen light and
dark at once, because the theme lives in one key that every same-origin frame shares. And a theme
change is seen only after it ships, on whatever screen someone happens to open.

## How big "every experience" is

An experience is who, where, in what state, and how it is drawn.

- **Who.** Nine roles: dev, master, assistant, controller, estimator, primary, superintendent,
  sub, helper. On top of them, Job Mode, Dispatch Mode, Farm Mode, Pin Mode and training mode.
  Outside, the homeowner, the GC, the trade partner, the property owner, the law firm and the house.
- **Where.** The app has 75 routes, 26 of them public, about 400 windows, 13 of which open from a
  link, and up to 23 Settings groups. The door index (`src/lib/search/doors.ts`) already lists
  every page, tab, linkable window and Settings card each role can open, through the app's own
  gates. Outside, What customers see's journeys hold 77 steps.
- **State.** Full, empty, loading, slow, error, offline, read-only. Outside pages add their broken
  link states: expired, turned off, run out, incomplete.
- **How.** Phone 375, tablet 768, desk 1280. Light and dark. English and Spanish on the pages that
  have Spanish.

**The measurement that shaped the design.** Signed in as the dev, the nine most used pages ask the
database for 252 different tables, RPCs and edge functions. The dashboard alone asks for 160, in
684 requests. A lens that hand-answers each endpoint would never keep up, and a screen it forgot
would break. So the world answers every request by rule, from the schema, and holds invented rows
only where they make a screen look real.

## The design: a sealed frame

The lens draws each experience in an iframe of the real app, at a set width. Every viewport hook
reads `matchMedia`, so a 375px frame draws the real phone layout. The new part is that the lens
names the frame, and a named frame seals itself before the app starts.

1. **The name.** The tab opens `<iframe name="pipetooling-lens:{…}" src="/jobs?tab=stages">`. The
   name carries who, the state and the theme. A frame's name survives its reloads and its own
   navigation, so a hard reload inside the frame stays sealed.
2. **The seal.** `src/lib/lens/seal.ts` is the first import in `main.tsx`. Without the name it
   returns at once and costs nothing. With it, before any other module runs:
   - `localStorage` and `sessionStorage` become memory stores. They are seeded with the role's
     invented session and the frame's theme. The dev's real session and settings are never read
     or written.
   - `fetch` to the Supabase address goes to the world. Every other address goes out as normal,
     such as map tiles and fonts.
   - A socket to the realtime address becomes a quiet one.
   - `indexedDB` and the cache store are hidden. The Pipeline board keeps a remembered copy in
     IndexedDB, and a hard reload clears the caches, so both would otherwise reach the real ones.
   - Location, notifications and the online flag answer from the frame's state.
   - A link or `window.open` that starts a new tab passes the name on, so that tab stays sealed.
3. **The world's front door.** The world answers the way PostgREST does, from the request the
   real client built:
   - A table read filters the world's rows with the same operators, orders, ranges and counts.
     Embedded reads follow the foreign keys that `database.ts` already lists.
   - Inserts, updates and deletes change the frame's copy only, and vanish on reload. So a
     button pressed in the lens does what it does, and nothing reaches the database.
   - An RPC with a handler answers from it. One without answers the empty value its return type
     allows: no rows for a set, nothing for a scalar, an error for an object.
   - An edge function with a handler answers from it. One without answers an error.
   - Sign-in calls answer with the role's invented person.
   - Every answer given by rule is written to the frame's list of gaps, so the tab can say how
     much of a screen was the world's and how much was a stand-in.
4. **Nothing in the app changes.** The client, the hooks, the gates and the pages run exactly as
   they do for a signed-in person. The theme flips by the same storage event the gear menu's
   toggle sends to other tabs, so `ThemeContext` needs no change either.

**What keeps it safe.** The world is invented and ships in its own chunk, which only a sealed
frame loads. A sealed frame never holds a real token, so nothing it could send is authorized. Its
writes live in its memory. The name is a soft gate, not a lock. Anyone who names a window sees the
invented world, which holds no real row and no secret. The tab that names frames is dev only.

**The state knob is the world's mood.** Full answers with the rows. Empty answers with none,
except the person's own. Loading never answers. Slow answers after a pause. Error answers every
read with an error. Offline fails every request the way a dropped connection does. Training mode
marks the person read-only. So every screen shows its empty state, its skeleton, its error words
and its offline panel without a line of code per screen.

## The tab: What everyone sees

The name matches the two tabs beside it: What customers see draws the customer's side, What the
team sees draws the team's emails, and What everyone sees draws every screen. It sits in the
System zone, dev only, as asked.

- **The knobs.** Who: a role, or a customer audience. Where: search every screen that role can
  open, from the door index. State, Width, Theme, and Language where the screen has Spanish.
- **Modes and twins.** Job Mode and Dispatch Mode are routes, so they are screens under Where.
  Training mode is a state. Farm Mode and Pin Mode are flags the seal seeds into the frame's
  memory store, so they sit beside Who, and so does a digital twin: an estimator held to its own
  bids.
- **Across.** One knob varies and the rest hold. Across widths and themes is the default: six
  frames, phone, tablet and desk, light over dark. Across roles draws one screen as every role,
  such as the dashboard as everyone, side by side. Across states draws one screen full, empty,
  loading, error, offline and in training mode.
- **Each frame** has its caption, the gap count, and four audit badges: sideways scroll, text
  under 3:1 contrast, a broken image, a console error. They are the same audits `visual-qa.mjs`
  runs, run inside the frame.
- **The contact sheet.** Every screen the chosen role can open, under the held knobs. The frames
  are live and load a few at a time as you scroll, so a role with a hundred doors does not boot a
  hundred apps. Badges total at the top: "3 screens scroll sideways at 375. 2 have text under 3:1
  in dark."
- **The theme draft.** Every token in `src/index.css`, grouped, with its light and dark value.
  Change one and every frame on the page redraws with it. Flip Draft and Current to compare.
  Copy as CSS gives the change as a patch for a PR. Pairs that matter show their contrast as you
  type: body text, muted text, links and the top bar.
- **The customer's side** comes into the same catalog through What customers see's own frames:
  the pages by their sample tokens, the emails, texts and papers by their builders. Those pages
  pin light by design, so their dark column is not drawn twice.

## The world

- **One invented company.** It extends the sample people the customer pages already use: Sam
  Sample at 100 Sample St in Kyle, Pat Sample at Sample Contracting, Elena at Sample Owner LLC,
  Sam Plumber at Sam's Plumbing. So the office's job window and the customer's portal tell one
  story about the same job.
- **A person for each role,** with fixed ids, so a frame's session is the same every time.
- **Rows typed by `database.ts`.** Each table has one builder with defaults. A new required column
  fails the typecheck until the builder fills it, so the world cannot drift quietly.
- **Busy enough to stress a layout.** Long names, long addresses, many rows, large amounts, so a
  style change meets the worst case, not the tidy one.
- **What each role's rules would return.** A sub sees only the jobs they are on, as the database's
  policies decide. The world states those rules beside its rows. The real policies are not run,
  which the next section owns.

## Is this the best we can do?

Six other ways were weighed.

1. **Storybook, the usual answer.** A story per component, written and kept by hand, in a tool
   beside the app. It shows components, not experiences: no role, no gate, no page around them.
   Every story is one more thing to keep in step, and the inventory found none written. The
   sealed frame draws the real pages with no story to write.
2. **A gallery of screenshots.** It never goes stale only if someone retakes it, and it cannot
   be clicked. Kept for one job only: the CI report below, which compares before and after.
3. **View as, one frame per role.** One sign-in per browser, so frames cannot hold different
   roles. It shows live rows, and its writes are real.
4. **Fixtures per component, through the `io` seams.** About 50 components take an `io`, and 62
   smokes pass fakes. The 32 older pages and the 488 files that call Supabase directly have no
   seam. The sealed frame reaches all of them, and the `io` components draw through it too.
5. **A copy of the database in the browser.** PGlite runs Postgres in the page. Loaded with the
   real schema, every RPC and every policy would run as it does on prod, so the numbers would be
   computed, not invented. It is deferred, not rejected. The schema needs pg_cron, pg_net and
   other extensions stubbed. The download would be tens of megabytes, and each lens would boot
   for seconds. The seam is the same `fetch`, so it can replace the world's answers later without
   touching the tab or the seal.
6. **A Supabase branch holding the world.** A second database is billed every month and needs
   its own sign-ins and migrations. Later, if PGlite falls short.

**What it does not cover yet, said plainly.**

- Numbers the database computes, through RPCs, are the world's answers, not the database's.
- Touch-only CSS, nine `pointer: coarse` rules, does not apply in a desktop browser's frame. The
  CI report runs with touch on.
- Windows that need a click to open: the frame is live, so you click. Scripted openings come
  with the CI report.
- A page's print layout is not drawn. The papers come from What customers see's previews.

## Is it deep enough?

Against the four tests: every inside screen as every role, every state, both themes and three
widths, and the customer's side in the same catalog. The real app draws, on invented data, and
nothing reaches the database. A theme draft redraws everything before a PR exists.

Beyond the ask, three things fall out of the seal for free:

- **States everywhere.** The consistency sweep (#184) counted 522 empty-state sites and about 800
  error sentences. The lens shows each one by flipping a knob, which turns that sweep from a grep
  into a look.
- **Roles side by side.** The dashboard as all nine roles at once answers "what does each person
  see" in one glance.
- **The CI report (PR 6).** A style PR runs the contact sheet headless, light and dark, at three
  widths with touch on, against its own build and main's. It lists the screens that changed, with
  before and after. That is how a reviewer knows how a change will look before it merges.

## Decisions for the owner

1. **The name**, What everyone sees, beside What customers see and What the team sees.
2. **Dev only**, as asked. Opening it to the master later is one gate.
3. **The CI report** runs only on a PR that touches CSS, the theme or the portal palette, so other
   PRs pay nothing.

## The mock-up

[`mockup.html`](mockup.html), served at `/to-dos/experiences-lens/mockup.html`. Every person, job
and number in it is invented. It draws:

1. The tab, with its knobs live: pick a role, a state and what varies, and the frames redraw.
2. The dashboard as every role, at phone width.
3. The Jobs page in every state.
4. The contact sheet for the estimator, with two screens flagged.
5. The theme draft, which redraws every frame on the page as you change a token, with Copy as CSS.
6. The seal, drawn: what a named frame swaps, and one frame's gap list.

## Where it plugs in

- `src/main.tsx`: one first import, `./lib/lens/seal`.
- `src/lib/lens/seal.ts`: reads the name, swaps the browser pieces, loads the world on the first
  request. Small on purpose, and it imports nothing heavy.
- `src/lib/lens/answer/*.ts`: the PostgREST reader (select, filters, embedding, ranges, counts,
  writes), the RPC and function answers, sign-in. Pure kernels with a corpus of real request URLs.
- `src/lib/lens/world/*.ts`: the people, the company, the rows, the per-role rules.
- `scripts/build-lens-schema.mjs`: from `database.ts`, each table's columns and foreign keys and
  each RPC's return kind, the way `build-dev-mcp-catalog.mjs` writes its catalog.
- `src/components/settings/SettingsWhatEveryoneSeesTab.tsx` and its pieces, in `settingsGroups.ts`'s
  System zone.
- Docs: `PROJECT_DOCUMENTATION.md`, `GLOSSARY.md`, `ACCESS_CONTROL.md`, the help guide, the release
  notes and fragments.

## The plan

1. **This PR.** The to-do and the mock-up.
2. **The seal and the world's front door.** The seal, the PostgREST reader with its corpus, the
   schema map, the people for each role, the world's first rows, the gap list, the state knob. No
   tab yet. A frame named by hand in a test shows the dashboard as each role.
3. **The tab.** Who, where, state, width, theme, across widths and themes, across roles, across
   states, the gap count, the help guide.
4. **The audits and the contact sheet.** The four badges in every frame, the sheet with its
   totals, frames loaded a few at a time.
5. **A full world.** Rows and handlers so the dashboard, Jobs, Bids, Customers, Messages and the
   schedule look busy for every role, and the customer's side folded into the catalog.
6. **The theme draft and the CI report.** Tokens, Draft and Current, Copy as CSS, contrast pairs,
   then the headless before-and-after on style PRs.

## How to verify

- The reader's corpus: request URLs the real client builds, each with the rows it must return.
- The seal: without the name nothing changes. With it, no request reaches the Supabase address
  and the real `localStorage` is unchanged after a frame signs in, writes and reloads.
- Every role's dashboard boots sealed in a render test with no network.
- Screenshots of the tab at 375, 768 and 1280, light and dark.
- Live: in the tab, the network panel shows no request to Supabase from a frame, and the
  dev's own theme and settings are as they were.

## The decision

Build it, in the order above. The seal comes first because everything else stands on it, and it
is useful alone: a dev can name a frame in the console and see any screen as any role.
