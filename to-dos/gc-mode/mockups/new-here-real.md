---
name: "New here? on real data: the GC projects page walks a first-timer through what is on main"
rows: PLAN_2026-10-07.md, Helper 6's row (New here? on real data, after door 1 and the switch); the prototype's src/lib/gcMode/gcTour.ts (GC_TOUR_STEPS); BOARD_REAL_BUILD.md B3-a and door 2
branch: the plan on spike/new-here-plan (from origin/spike/gc-mode at 4a8778bae); the PR from origin/main once door 1 (#4852) is merged, one PR, no migration
status: plan 2026-10-07 by Helper 6 at the lead's go. Nothing cut or claimed. Two calls for the lead, and one seam with Helper 2.
---

# New here? on real data

## What it is

The prototype's *New here?* walks the Project Board: three stages, the ring, the days left, who to
call, buyout and building. None of that is on main yet. Main's `/gc` is the list of GC projects
that door 1 opens. Each project has a card, with five windows behind the cards. So this tour walks
**what a tester can touch tomorrow**:

- the switch;
- New project;
- a project's card, its Drive line, its plans, a new set and its questions;
- the gaps;
- the scope book.

The prototype's board stops come back with the board, in door 2 (*After B3* below).

- **A New here? button** on the GC projects header, beside **Open the scope book**. It opens by
  itself on a person's first visit, once per browser, as the prototype's did (Board item 8).
- **Ten stops**, in `src/lib/gc/tour.ts`, through main's `SpotlightTour` as it is. It needs no new
  features: `missingBody` covers a page with no project yet.
- **Anchors named for the thing, not the place**: `gc-new-project`, `gc-plans`, `gc-new-set`,
  `gc-questions` and so on. When B3-a moves the cards onto a project's own page, the names move with
  the buttons and the walk still finds them.
- **A test that reads the source**, so no PR can drop an anchor without the test saying so.
- **The guide** `start-a-gc-project` gains one sentence. Also a release note and its fragment. No
  migration, no types, no function.

## The stops, as a person reads them

Each body passes `plainWordsFailures` (checked 2026-10-07 against main's `src/lib/plainWords.ts`:
ten stops, no failures). Titles are eight words or fewer. A stop on a card points at the **first**
card on the page.

| # | Anchor | Title | Body | When the anchor is missing |
|---|---|---|---|---|
| 1 | `gc-mode-switch` | GC mode | In GC mode we are the general contractor. We hire a company for each trade, and they quote to us. Press Trades to go back to the Bids page. | (always there) |
| 2 | `gc-new-project` | Start a project | A GC project starts the day its plans come in. Press New project. The window has four steps: the project, the plans, the trades and each scope. Press Create the project at the end. | (always there) |
| 3 | `gc-project-card` | A project's card | Each project gets a card like this one. It says how many sets of plans came in and how many sheets the newest has. The trades are listed below, each with its budget and its scope lines. | No GC project yet. Its card shows here once you press New project. |
| 4 | `gc-drive` | The plans in Drive | The plans live in Google Drive. Press Make the Drive folder once for each project. The words beside the plans link say who can open them. Fix the sharing in Drive, then press Check again. | No GC project yet. Each project keeps its plans in a Drive folder. |
| 5 | `gc-plans` | Read the plans | Press The plans to see every sheet and section. Pick a set to see the plans as they stood then. A sheet a set took out stays in the list, crossed out. | No GC project yet. The plans open from a project's card. |
| 6 | `gc-new-set` | A new set came in | An addendum or a whole new set can come in while we bid. Press A new set of plans came in. Paste its sheet list. The window shows what changed and which scope lines it touches. | No GC project yet. A new set goes on from a project's card. |
| 7 | `gc-questions` | Questions about the plans | A company quoting a trade may ask about the plans. Press Questions about the plans to record it. Send it to the architect from there. Record the answer when it comes back. The next set of plans carries it. | No GC project yet. Questions open from a project's card. |
| 8 | `gc-gaps` | Gaps | Red words name a gap. One trade leaves some work out for another trade. That other trade's scope does not cover it yet. Settle it before our bid goes out. | No gap on this project. Red words show here when one trade leaves work out that no other trade covers. |
| 9 | `gc-scope-book` | The scope book | The scope book keeps the scope lines we use for each trade. Step 4 of New project pulls lines from it. Press Save as a set on a trade to keep its lines for the next job. | (always there) |
| 10 | `gc-new-here` | See this again | Press New here? to walk the page again. The guide below says each step in full. | (always there) |

The card's footer link reads *Read the full guide: start a GC project →*. It goes to
`/help?g=start-a-gc-project`, through `SpotlightTour`'s `guideHref` and `guideLabel`.

**Words that must not change, or a stop loses its words.** These are the page's own labels, and
each stop names them exactly:

- New project, Create the project, and the four step names;
- The plans, A new set of plans came in, Questions about the plans;
- Make the Drive folder, Check again, Open the scope book, Save as a set;
- Trades, New here?

The test pins them by reading the source (below). The prototype's gotcha says the same thing
(`HANDOFF.md`, *Walkthroughs anchor to words and `data-tour` names*).

## Where the anchors go

| Anchor | Where on `GcProjects.tsx` |
|---|---|
| `gc-mode-switch` | a `span` around `<BidsModeToggle mode="gc" />`. The toggle itself stays as it is, since Bids uses it too |
| `gc-new-project` | the **New project** button |
| `gc-scope-book` | the **Open the scope book** button |
| `gc-new-here` | the new **New here?** button |
| `gc-project-card` | the first project's card |
| `gc-drive` | the first card's Drive line |
| `gc-plans`, `gc-new-set`, `gc-questions` | the first card's three buttons. A lost bid has no **A new set of plans came in**, so stop 6 uses its `missingBody` there |
| `gc-gaps` | the first card's red gap line, when it has one |

`Btn` in `src/components/gc/gcUi.tsx` gains an optional `dataTour` prop, as `Card` already has. It is
an addition, so no caller changes.

## The code

- **`src/lib/gc/tour.ts`**: `GC_NEW_HERE_STEPS: SpotlightTourStep[]` (the table above),
  `GC_NEW_HERE_GUIDE` (the href and the label) and `GC_NEW_HERE_SEEN_KEY = 'gc-new-here-seen-v1'`.
- **`src/lib/gc/tour.test.ts`**:
  - ten stops, each anchor once;
  - every body and `missingBody` passes `plainWordsFailures`;
  - every title is eight words or fewer;
  - every stop after the first names a control the page carries. A list of exact labels is checked
    against the source of `GcProjects.tsx` and `src/components/gc/*.tsx`;
  - every anchor appears as `data-tour="<anchor>"` or `dataTour="<anchor>"` in that same source.

  This is the guard that makes B3-a carry the names.
- **`src/pages/GcProjects.tsx`**:
  - the button, `Btn kind="quiet"`, words **New here?**;
  - `tourOpen` starts true when `localStorage` has no `GC_NEW_HERE_SEEN_KEY`. The key is set when
    the tour opens. Every read and write is in `try`/`catch`, and a blocked storage means no auto
    open, never a crash;
  - `<SpotlightTour steps={spotlightTourStepsPresent(GC_NEW_HERE_STEPS)} … />` once `loaded`, so a
    stop never points at a card still loading. Stops with a `missingBody` stay and center;
  - the anchors.
- **`src/content/help/start-a-gc-project.md`** gains one line after the first paragraph: *Press
  {{button:outline|New here?}} at the top of GC projects for a short walk through the page.* It
  passes the plain-words test.
- **`src/content/releaseNotes/v2.NNNN.ts`**, *GC projects: New here? walks you through the page*.
  Bullets:
  - *Press New here? at the top of GC projects for a short walk through the page.*
  - *It opens by itself the first time you visit.*
- `docs/recent-features/v2.NNNN.md`.
- `docs/twins/APP_DIRECTORY.md` gets one clause on `/gc`: *New here? walks the page.*
  `PROJECT_DOCUMENTATION.md` §20 gets the same clause.

**Checks before arming:**

- vitest on `src/lib/gc`, `src/components/gc`, `src/lib/helpGuide` and `src/lib/releaseNotes`;
- eslint on the touched files;
- the theme check;
- typecheck;
- the dev server on 5306, walked at 1280 and at 375 px:
  - as a dev with the test project: all ten stops land on their controls;
  - in a private window: it opens by itself once, and not again after a reload;
  - the empty page cannot be walked on prod while the test project is there, so the render test
    below checks it.
- **A render smoke**, `GcProjects.render.test.tsx` (`renderWithProviders`):
  - with no project and empty storage, the tour opens on stop 1, and stop 3 shows its
    `missingBody`;
  - with the key set, it does not open until **New here?** is pressed.

## Two calls for the lead

**A. Ship it on the list now, or wait for the board.** *My default:* now, right behind door 1.
Testers arrive on day 1 and the list is what they will see. The anchors are named for things, so
B3-a's move of the cards onto a project's page carries them, and the source test fails if it does
not. *The other way:* wait for B3-a (day 2) and write one tour for the board and the project page
together. That means testers' first day has no walk.

**B. Open by itself, or only on a press.** *My default:* by itself on the first visit, once per
browser, as the owner had it in the prototype (Board item 8). *The other way:* only on **New here?**,
if the lead would rather testers see the page cold first and say what confused them.

## The seam with Helper 2 (B3-a), for the lead to settle

Door 1 opens `/gc` to the office and estimators. B3-a, day 2, turns `/gc` into the Project Board
*behind the dev door*, and door 2 opens the board after B3 and B4. Both cannot be true on one route.
Once door 1 is in, **B3-a must gate the board inside the page**:

- a dev sees the board, with the list moved to a project's own page;
- everyone else keeps today's list, until door 2 swaps that gate for `canOpenGcProjects`;
- the same goes for Helper 1's Schedule tab until schedule PR 10.

I'll send this to Helper 2 once the lead agrees. It touches their B3-a plan, not mine.

## After B3: the board's stops come with door 2

When door 2 opens the board, *New here?* on the board gets the prototype's board stops back,
rewritten for what is real by then:

- *How a job moves*, with the owner's numbered stage titles of 2026-10-04;
- the three stages;
- the row, the ring, the days left and who to call, as B2b lands;
- By customer;
- Trade partners and the scope book.

This list's stops 3 to 8 move to the project's own page as its walk. The owner's numbered marks need
the spike's three `SpotlightTour` additions (`numbered`, `marks`, `bullets`). They are lifted as
additions in door 2's PR, with the Bids tours' snapshots unchanged. That is door 2's plan, not
this one.

## Is this the best we can do?

Three ways it could be better:

1. **Walk the New project window too.** The first real task a tester does is New project. A stop
   inside the window for each of its four steps would help more than stop 2's one line. That needs
   `SpotlightTour` to find anchors inside a window with its own scroll, which has to be tried
   first. It would be a second, small tour, opened from the window's own **New here?**.
2. **Know whether testers finish it.** Record the tour's opens, its last stop reached and its
   closes, the way `useRoleGate` records `ui_nav_clicks`. Then the morning triage of
   `USER_TESTING.md` can say "4 of 6 testers left at stop 4, the Drive line" instead of guessing.
   It is a few lines and no table.
3. **Make the gaps stop actionable.** Today the page cannot change a scope after New project,
   except with lines a new set brings. So stop 8 can only say *Settle it*. A **Fix this gap** on
   the red line could add the left-out work to the other trade's scope with one press, through one
   small RPC. Stop 8 would then say *Press Fix this gap*. That is New project's tail, a PR of its
   own, and it needs a migration.

## Status

Planned 2026-10-07 by Helper 6. Read:

- the prototype's `gcTour.ts` and the tour's launch in its `GcMode.tsx`;
- main's `SpotlightTour.tsx` (`anchor`, `title`, `body`, `missingBody`, `center`, `terms`, and no
  more);
- `plainWords.ts`;
- the Submittals tour and its test, the pattern;
- `GcProjects.tsx` on door 1's branch;
- `GcNewProject.tsx`'s step names and **Create the project**;
- `BOARD_REAL_BUILD.md` B3-a and door 2.

Waiting on the lead's calls A and B, and door 1's merge.
