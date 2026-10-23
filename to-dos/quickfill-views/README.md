---
name: "Quickfill views — the same page five ways: the whole page, Focus, the Roller, the Board, the Table"
number: 147
group: gated
status: options and a mock-up, 2026-10-23; nothing built; waiting on the owner's pick
summary: >
  Quickfill is one long page of stations, 28 of them on the dev's page today and 20,999 px tall
  at 1,024 px wide, about 27 screens of scrolling. On a phone it is already a round: a list of
  the stations, then one station per screen with Skip and Looked · N open · next. The owner wants
  to offer the team several ways to see the same page and named a roller, one group at a time.
  This to-do draws five: the page as it is, Focus (only the groups with work open, the rest one
  line each), the Roller (one group at a time with Previous and Next, a dot strip and
  "7 of 23 · 12 left with work"), the Board (every group as a card on one screen) and the Table
  (every item across groups in one sortable table). The pick is Focus and the Roller. Focus is a
  fold rule the page can carry today; the Roller is the phone's own screens let loose on the
  desktop with the Board as its index. The Table needs a row adapter per station and is parked.
next: The owner reads the mock-up and picks. Then PR 1 (Focus) and PR 2 (the switch, the Roller, the Board as its index).
size: S for Focus; M for the switch, the Roller and the Board together; L for the Table, a train of adapters
blocker: The owner's pick, and one call on whether Focus is a view or the page's own rule.
ver: proposed
opinion: build Focus and the Roller — Focus halves the scrolling for free, the Roller is mostly built already (the phone round), and the Board rides inside it as the index; hold the Table until a station asks for it by name
mockup: to-dos/quickfill-views/mockup.html
---

# Quickfill views (#147)

## The ask in the owner's words

Robert, 2026-10-23: "On https://clicktooling.com/quickfill are there other ways I can present this
page? I want to offer my team multiple views. I think one view could be the user scrolling through
the groups like a roller and only seeing one at a time. Help me think about what my options are and
show me some mockups."

## The page as it is today

Read on a local preview as the dev on 2026-10-23, read-only. The counts are the page's; every row
in the mock-up is made up (Ridgeway Builders, J1042 Maple Street remodel, Rosa, Luis, Marco, Priya).

| Fact | Today |
|---|---|
| Stations on the page | 28 (the org hides five of the 33 the code knows) |
| Page height at 1,024 px | 20,999 px, about 27 screens |
| Marked today (collapsed to a green bar) | 5: Office Arriving, Assistant Dailys, Texts, Email, Physical inbox, all before 10 AM |
| Due (never marked) | 1: Percent complete, 6 open |
| Not yet due (looked yesterday, due again today at noon) | 19 |
| Doors with no mark (open a page of their own) | 3: Schedule, Tomorrow's Schedule, My Inbox |
| Groups with work (count above zero) | 13: Dispatch inbox 2, Missing job info 2, Percent complete 6, People Hours 23, Billed Awaiting Payment 53, Supply Houses 3, Prospects 268, Office Leaving 1, Vehicle check-ins 10, Lost bid reasons 60, GC weekly review 7, Job follow-ups 2, Needs you 23 |
| Groups at zero | 7: Warnings, Jobs Cleanup, Property kinds, Unassigned field time, Complete no Total Bill, Missing bill dates, Field photos → Drive |
| The tallest bodies | Supply Houses 2,439 px (the directory open), Needs you 2,342 px, Schedule 2,201 px, Percent complete 1,320 px, Vehicle check-ins 1,138 px |

What the page already has, which the views build on:

- **The mark** (`quickfill_section_marks`, one row per station, org-wide): a ✓ Mark in every header, the big button at the foot, the green bar it collapses to, the 12 h reopen, the history modal, the count it saw (`quickfill_section_mark_events.outstanding_count`).
- **The phone round** (v2.3783, punch list #30): `QuickfillRoundList` (the stations as rows, due first, from `lib/quickfill/round.ts`) and `QuickfillRoundScreen` (one station per screen: the question, the body, Skip · Looked · N open · next, *4 of 20*). It renders only under 640 px. **It is the Roller already, on the phone.**
- **The jump grid**: 28 chips in the freshness colours with the marker's initial and the time; the search box; the floating section dock at the foot.
- **The metrics context**: every station reports its count (`useReportQuickfillSectionMetric`); nothing reports its rows.
- **The Needs you station** (punch list #146, landing now): the Dashboard card's lines, and from v2.5774 a third view, **Fill them in**, a deck that walks the rows behind four line kinds with the fields to clear each. Its Cards / Walk the list / Fill them in chips are the closest thing the app has to a view switch on one card.

## The options

Five, all drawn in `mockup.html` at the width of the page and with today's counts. A light/dark
toggle and a view switch sit at the top of the mock-up; the phone frame beside the Roller swipes.

### 1. The page (today)

The stacked run, unchanged: jump grid, search, five green bars, then 23 open stations top to bottom.
Its case: the office knows it, every link in the app lands on it, and a dev's reorder and hide and
banner edits already shape it. Its cost is the one the owner feels: 27 screens, and the tallest
bodies (Schedule, Supply Houses, Needs you) sit between you and a two-row station.

**The mark**: unchanged.

### 2. Focus — only the groups with work

The same run, with one rule: a station whose count is zero folds to the one-line strip a marked
station already folds to, with its ✓ Mark on the strip. Marked-today stations and the three doors
fold the same way, under their own small headings. Today that opens 13 stations and folds 15; the
page drops from about 27 screens to about 16, with no station lost and every ritual still
stampable. A folded strip has **Open now**, exactly as a marked one does.

Its case: it is the cheapest of the five (the wrapper already draws the strip) and it is the change
a desktop person would feel every morning. Its honest question: is it a view or the page's own rule?
A switch means someone must choose it; a rule means the whole-page run is one click away under
*Show the empty groups*. The to-do recommends the rule, with the owner's say.

**The mark**: unchanged on open stations; a zero station's strip carries ✓ Mark so the look still
gets stamped on a clean day (the guide's rule: the cards hide, the rituals stay stampable).

### 3. The Roller — one group at a time

The phone's round screen on the desktop. The headline is the station's name and its count, then
its question, then its body at full width. **← Previous** and **Next →** at the thumb, with the
arrow keys on a keyboard and a swipe on a phone. Under the headline a strip of dots, one per group
in the deck, in the freshness colours, and the words **7 of 23 · 12 left with work**. The deck is
every station not yet marked today, due first then page order, the three doors last. A switch,
**Show the 5 marked today**, puts the fresh ones back in. A **Groups ▾** button opens the Board as
the index, so nobody counts dots to find Vehicle check-ins.

Its case: it is the owner's own picture of the page, and it is mostly built. `QuickfillRoundScreen`
and `QuickfillRoundScreenContext` do this today under 640 px; the build lets a wider viewport use
them, adds Previous and the dot strip, and takes the deck from a kernel instead of the narrower
`roundQueue` (which today holds only the one due station, since the rhythm rule says the rest are
due at noon). Its honest cost: a person who wants two stations side by side cannot have them here,
and the tallest bodies still scroll inside their screen.

**The mark**: the thumb bar is the round's: **Skip** moves on without marking; **Looked · 23 open ·
next →** is the same org-wide mark as the ✓, with the count it saw, then the next group. Texts,
Email and Physical inbox keep their mark-with-a-note inside the body and the bar reads *Mark
inside · next →*. A door reads *next →* only. A zero station reads *Nothing here · Looked · next →*
so it is one tap.

### 4. The Board — every group as a card on one screen

28 cards in four columns, about two screens tall. Each card: a colour rail in the station's state,
the name, the count large, the first two items, **Open ›**, and ✓ on its head. The five marked
today sit as a row of slim green strips at the foot; the three doors are cards that say *opens the
page ›*. A tap opens the group as a Roller screen (or scrolls to it on the page, the owner's call).

Its case: the whole office day on one screen, which no other view gives. Its honest cost: *the
first two items* needs every station to say what its rows are, and today no station does; only
the count reaches the page. The cheap build shows the count and the question and no items, and a
station earns its two lines when it reports them (a `previewLines` beside its count in the
metrics context). The Board is also the Roller's index, so it should ship inside the Roller build
and become a view of its own only if people open it for itself.

**The mark**: ✓ on the card head, the same mark; a marked card drops to the green strips at the
foot. **Open now** on a strip lifts it back.

### 5. The Table — every item across groups, one dense table

Columns: Group · Item · Detail · Age or amount · Door. Default order is the page's; **Sort** by age,
by amount or by group; a filter box over every column. The group chips sit above the table with
their ✓ marks, since a sorted table has no group header to hang a mark on. Today that would be
about 460 items from 13 groups, of which 268 are Prospects and 60 are lost bids.

Its case: the assistant who sweeps by age or by dollar, not by station. Its honest cost: a row
adapter per station (the rows live inside 25 section components in 25 shapes), and four stations
have nothing a table can hold: Schedule and Tomorrow's Schedule are day grids, My Inbox is a page
of its own, Prospects is a warmth chart. And the sweep the owner wants from an assistant is what
the Needs you station's **Fill them in** deck is landing this week, one row at a time with the
fields to clear it. The Table is parked until a station asks for it by name.

**The mark**: on the chips above the table only; marking greys the group's rows and keeps them,
because a mark is a look and the rows are work.

## How a view is chosen and remembered

A segmented switch beside the page title, desktop and tablet only: **Page · Focus · Roller ·
Board** (Table when it exists). Under 640 px the phone round stays and the switch is hidden, since
the round is the Roller.

Remembered per person the way Banking and the Dashboard remember theirs: a row per user, read on
load, upserted on change. The house pattern is `banking_user_prefs` (`lib/bankingUserPrefs.ts`:
`user_id`, one column per toggle, `updated_at`, upsert `onConflict: 'user_id'`, with localStorage
as the instant-load cache) and `user_dashboard_preferences` (`quick_buttons_placement`, the same
shape, written from Settings). The Needs you card's Cards / Walk toggle is the lighter precedent:
localStorage keyed per user (`needsYouModeStorageKey`), per device, no table.

The pick: a new `quickfill_user_prefs` table on the `banking_user_prefs` shape, `user_id` ·
`view` · `roller_show_done` · `updated_at`, own-row RLS, with the localStorage cache so the page
never flashes the wrong view. One migration. A `?view=roller` on the URL opens a view for a link
and does not change the saved one.

## Is this the best we can do? Are we being straightforward?

- **Five views is three too many.** Every new station would have to work in each, and the office
  would have to learn five layouts of one page. Two of the five fold into the others: the Board is
  the Roller's index, and Focus is a rule the page can simply follow. That leaves the page, the
  Roller, and a fold rule.
- **The Roller is already built.** The phone round is one station per screen with Skip and
  Looked · N open · next. Saying so is the straightforward thing; the build is a viewport gate, a
  Previous button, a dot strip and a deck kernel, not a new surface.
- **Focus may not be a view at all.** Folding a zero station to one line loses nothing (Open now
  is on the strip) and halves the scrolling. The honest recommendation is to make it the page's
  rule and keep *Show the empty groups* one click away. That is the owner's call, because it
  changes the page for everyone.
- **The Table is the only one that costs real work**, and its best customer is being served
  another way this week (Fill them in). Parking it is straightforward; promising it is not.
- **The dot strip at 23 dots is near its limit.** Past 30 groups it should become a ring with the
  count. The mock-up draws the dots because 23 reads fine and the colours carry the state.
- **A switch nobody can find is no switch.** It goes beside the title, not in Settings, and the
  help guide's first paragraph names it.

## The pick

Focus and the Roller, in that order. Focus first because it is a S and every desktop person feels
it; the Roller second because it is the owner's ask and most of it exists. The Board ships inside
the Roller as its index. The Table is parked.

## What a build would touch (nothing built)

**PR 1, Focus (S, no migration):**
- `src/lib/quickfill/views.ts` (new kernel) — `foldedInFocus(row)` and the headings for the
  folded strips (*7 at zero · 5 marked today · 3 doors*); tests.
- `src/pages/Quickfill.tsx` — the `QuickfillSectionWrapper` gains a `foldedEmpty` prop that draws
  the marked strip's layout with ✓ Mark; the page passes it from the kernel when Focus is on.
- `src/content/help/quickfill.md` — one paragraph, *Only the groups with work*.
- Release note, `docs/recent-features/` fragment, `docs/QUICKFILL_ARCHITECTURE.md` (the wrapper's
  dossier), `docs/GLOSSARY.md` → Quickfill (page).

**PR 2, the switch and the Roller (M, one migration):**
- `supabase/migrations/<stamp>_quickfill_user_prefs.sql` — `SET lock_timeout = '3s'`;
  `quickfill_user_prefs (user_id uuid primary key references users, view text, roller_show_done
  boolean, updated_at timestamptz)`; own-row RLS; the three `apply_*` calls; `docs/migrations/`
  page; `src/types/database.ts` regenerated.
- `src/lib/quickfillUserPrefs.ts` (new, on `bankingUserPrefs.ts`) and a localStorage cache.
- `src/lib/quickfill/views.ts` — the deck (`rollerDeck(rows, showDone)`: not-fresh first by the
  round's order, doors last), `rollerHeadline(deck, index)` → *7 of 23 · 12 left with work*,
  `parseQuickfillView(search)` for `?view=`; tests.
- `src/components/quickfill/QuickfillViewSwitch.tsx` (new) — the segmented control.
- `src/components/quickfill/QuickfillRoundScreen.tsx` — a `prev` button and a `strip` slot; the
  bar's labels unchanged.
- `src/components/quickfill/QuickfillRollerStrip.tsx` (new) — the dots and the words.
- `src/components/quickfill/QuickfillBoard.tsx` (new) — the index: cards from `roundRows`, count
  and state, no items until a station reports `previewLines`.
- `src/pages/Quickfill.tsx` — the Roller branch no longer gated on `narrowViewport`; the deck from
  the kernel instead of `roundQueue`; the Board opened from **Groups ▾**.
- `src/contexts/QuickfillSectionMetricsContext.tsx` — an optional `previewLines` on a report.
- `src/content/help/quickfill.md` — *Pick how the page is laid out*; `docs/twins/APP_DIRECTORY.md`
  only if `?view=` counts as a path (it does not add a route).

**Later, the Table (L):** `src/lib/quickfill/tableRows.ts` with one adapter per station, a
`QuickfillTable.tsx`, and a `rows` report beside `previewLines`; one PR per few stations.

## How to verify (when built)

- Desktop preview as the dev (`/dev-login?as=1&to=/quickfill`): the switch beside the title;
  Focus folds the seven zero stations and the five marked ones and keeps every ✓; the Roller opens
  on the first due station with *1 of 23*, Next and Previous walk the deck, Looked marks and moves
  on, the strip's dots recolour as marks land; reload keeps the view.
- Phone width: the round, unchanged; no switch.
- `npm test` for the kernels; the page's render smokes; `e2e viewport-smoke` loads `/quickfill`.
