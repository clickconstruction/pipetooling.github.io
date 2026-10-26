---
name: "Go anywhere: the search box opens a page, a Settings card, a guide or a window by name"
number: 181
group: gated
status: PROPOSED 2026-10-26. The plan, the argument against it and the mock-up are drawn. Waiting on the owner's pick of the box's shape.
summary: >
  The header's search finds jobs, bids, estimates and customers, and nothing else. A Settings
  card is four presses and a scroll away, a guide three presses, the Lien desk a gavel you have
  to know about, and a to-do a hunt through 102 rows with no search. The owner's lens: one
  go-anywhere box, the same search or ⌘K, that also opens a page, a Settings card, a guide or
  a window by name. Mostly an index over links that already work. This to-do plans one kernel
  of doors, each with its words, its link and its role gate, built from the routes, the Settings
  groups, the guides' titles and keywords, the punch list's rows and the deep links the app
  already uses. It weighs the owner's Search more than jobs button against results grouped by
  kind under the same words, a typed prefix with ⌘K, and a kind picker. The pick is the grouped
  results, with the prefix as a keyboard accelerator and the group's N more as the phone's picker.
next: The owner reads the mock-up and picks the box's shape. Then PR 1, the index and its test, which the dev-doors Settings card reads too.
size: M, as four PRs, S M S S
blocker: The owner's pick of the box's shape.
ver: proposed
opinion: build B, one box and the same words with the doors grouped under the jobs, and ship the index first since the dev-doors card reads it too
mockup: to-dos/go-anywhere/mockup.html
---

# Go anywhere: the search box opens a page, a Settings card, a guide or a window by name (#181)

## The ask

The owner, 2026-10-26, in a holistic look at the user experience, picked this lens:

> a go-anywhere box (the same search, or ⌘K) that also opens a page, a Settings card, a guide or
> a window by name. Mostly an index over links that already work.

His own idea: *offer a button like "Search more than jobs" in the search bar unless you can
think of better ways*. His ask: *come up with a plan, ask yourself is this the best we can do,
and then present me a mockup of what you think we should build*.

Two things to respect. Every entry carries its role gate, so a person never sees a door they
cannot open. And another session is at the same time auditing every dev-only door and building
a Settings card that lists them from one kernel. So this plan builds one shared index of doors
that both can read, not two lists.

## Today

Read in the app as the dev on 2026-10-26, at 1280 wide and at the browser pane's phone preset.

**What the box finds.** The magnifier opens one box over the header row. It looks across four
kinds at once and nothing else: jobs by name, address, HCP number and Click number, bids by
number, project, address, customer and GC, estimates by number, title, address and customer,
and customers by name. Two characters start it. The rows come back in one list, jobs first,
then bids, estimates and customers. A job opens the job window, a bid its preview, a customer
its snapshot and an estimate its page. The office roles get this box. Helpers and subs get a
jobs-only lookup with a read-only card. **Estimators, primaries and superintendents have no
magnifier at all.** The reader is `HeaderGlobalSearch.tsx`, the gate `headerSearchEligibleForRole`.

**How it is reached.** On a desk the magnifier sits beside the nav. ⌘K or Ctrl+K opens and
closes it from any page, and on the Dashboard the S key opens it. On a phone the magnifier is in
the strip beside the home icon, and it stays there when an assistant's dock is up. The box takes
the whole header row with a Back button, and the rows drop under it full width. ↑ ↓ move a
highlight, Enter opens it, Esc closes. Nothing is lit until an arrow is pressed.

**Three other searches already exist, each on its own page.** The Settings rail has
*Search settings…* over a hand-written index of 60 entries in `settingsSearch.ts`, each naming
its tab and anchor, role-safe because the caller passes the viewer's groups. The Help page has
*How do I…* over the 438 guides by title, keywords, category and body, and strips a leading
*how do I*. The punch list has filter chips and no search. None of the three is reached from the
header's box.

**The presses to reach what the box does not find.** Counted from the Dashboard. A press is a
tap or a click. Typing is not counted.

| To reach | On a desk | On a phone |
|---|---|---|
| A job by its number | magnifier, pick: **2** | **2** |
| The Office hours card on Phone and texts | gear, Settings, Phone and texts, a scroll past seven cards: **3 and a scroll**. The rail's own search does not know the card, so it does not help | gear, Settings, the Section picker, Phone and texts, the scroll: **4 and a scroll** |
| The guide *bill a customer and get paid* | gear, Help, pick: **3** | **3** |
| The Lien desk's Timeline tab | Jobs, the orange gavel, Timeline: **3**, and only if you know the gavel | hamburger, Jobs, the gavel, Timeline: **4** |
| To-do #126 on the punch list | gear, Settings, Punch list, then a browser find or a scroll through 102 rows: **3 and a hunt** | **3 and a long scroll** |

The words a person types for these are not job words. *Office hours*, *bill a customer*,
*lien notice* and *quick replies* get **No matches.** today, and the box does not say what else
it could have looked in.

## The index

One kernel, `src/lib/search/doors.ts`, pure and node-testable. The sources are handed in, the
way `appDirectoryCheck.ts` and `helpGuides.ts` take theirs, so nothing in it reads the disk or
imports Vite.

```ts
export type DoorKind = 'page' | 'window' | 'settings' | 'guide' | 'todo'

export interface Door {
  id: string              // 'settings:settings-phone-texts-hours', 'guide:bill-a-customer', 'todo:126'
  kind: DoorKind
  label: string           // the row's words: 'Office hours'
  where: string           // the row's muted line: 'Settings · Phone and texts'
  words: readonly string[] // what people type: synonyms, the old name, the directory's task line
  to: string              // '/settings?tab=settings-phone-texts#settings-phone-texts-hours'
  gate: (viewer: DoorViewer) => boolean
}

export interface DoorViewer {
  role: UserRole
  estimatorProspectsAccess: boolean
  teamProspectsAccess: boolean
  farmModeActive: boolean
}

export function doorsFor(viewer: DoorViewer, sources: DoorSources): Door[]
export function searchDoors(query: string, doors: readonly Door[], perKind?: number): DoorGroup[]
export function doorPrefix(query: string): { kind: DoorKind | 'place' | null; words: string }
export function isDevOnly(door: Door): boolean
```

**Where each kind comes from, and its gate.** The gate is never written twice. Every door
reads the helper that already decides the same question in the app.

| Kind | Source | How many today | Gate | The link |
|---|---|---|---|---|
| page | the signed-in routes of `src/App.tsx`, the nav's labels, and the tabs the directory's *Go here when…* lines name, Jobs' ten and Bids' ten among them | 40 pages, about 30 tabs | `isPathAllowedForRole` from `layoutRouteAccess.ts`, plus the in-page surface's predicate from `roleGate.ts` for Crew P&L, Team, Payroll, Hours and Weekly money | `/jobs?tab=billing` |
| window | a hand-kept list of the windows that open from a query: the Lien desk and its Timeline, GC Review, the Follow-ups deck's Idle lens, Weekly money movement, the scope book, the call script, a Messages thread | about 12 | the `can*` helper the page uses for the same window, `canOpenGcProjects`, `canOpenMessages`, `canSeeGcMoney` and their kin | `/jobs?tab=stages&legal=1&legalTab=timeline` |
| settings | `getZonedSettingsGroups(role)` for the 22 groups and `SETTINGS_SEARCH_INDEX` for the 60 cards, with the 20 anchors of `settingsDeepLink.ts` | 82 | the group's own filter, so an entry shows only when its tab is in the viewer's groups, as `searchSettings` does today | `/settings?tab=settings-phone-texts#settings-phone-texts-hours` |
| guide | `HELP_GUIDES`, each title and its keywords, never the body | 438 | `guideIsRelevantForRole`, the Help page's own filter | `/help?g=<slug>` |
| todo | the punch list's rows from `virtual:punch-list`, number and name | 102 | `canOpenPunchList`, dev and master | `/punch-list#n126` |

The words of a page door are its label, the nav's old names, and the directory's task line that
points at it. *See every open bid, who it went to, what's won/waiting* becomes words on the Bid
Board's door. The 62 lines of `docs/twins/APP_DIRECTORY.md` are a ready-made intent index, and
PR 1 moves them in by hand once. A number typed on its own, with or without J, B, E or C in
front, searches today's rows only. A word searches everything.

**The test, `doors.test.ts`**, the shape of `appDirectoryCheck.ts`:

1. Every page and window door's path is a route `src/App.tsx` declares, through
   `appRoutePathsFromSource`.
2. Every settings door's tab is a group id, and its anchor is in `SETTINGS_HASH_ANCHOR_TO_TAB`
   or is the group itself.
3. Every guide door's slug is a guide, and every to-do door's number is on the board.
4. For every role in the `UserRole` union, every door `doorsFor` returns passes
   `isPathAllowedForRole` for its path. **No door leads to a bounce.**
5. Every window door names the file that reads its query key, and that file reads it, with
   `searchParams.get('legal')` in its source.
6. The other way round, so the index cannot drift the way the Settings index has: every
   signed-in route has a page door, every Settings group has a door, every anchor in
   `settingsDeepLink.ts` has a door. The Settings index is missing Office hours, Reply push,
   Quo connection and Inboxes today, nine cards on one tab, because nothing checks it.
7. No two doors share an id, and every door's words are lowercase and non-empty.

**Sharing it with the dev-doors card.** `isDevOnly(door)` is computed, not declared: a door
is dev-only when its gate opens for a dev and for no other role. The Settings card the other
session builds lists `doorsFor(devViewer, sources).filter(isDevOnly)`, and the box lists
`doorsFor(viewer, sources)`. One list, two readers. Whichever PR lands first owns the `Door`
type and the other imports it. If `src/lib/settings/devDoors.ts` lands first with its own
entries, PR 1 reads them as the window and page doors whose gate is dev, and adds no copy.

## The box

Four ways, side by side. Every one keeps today's rows exactly where they are, since the office
searches a job number fifty times a day.

### A · The owner's button, Search more than jobs

A button in the search bar. A press switches the box to a second list that searches pages,
Settings cards, guides and to-dos. The first list never changes.

- **Best at:** the job list stays as short as today, there is no new key to learn, and a
  visible word says the box can do more. The simplest build.
- **What it costs a person who does not know it is there:** everything. The people who most
  need *where is Office hours* are the ones who never read the row under the results, and they
  still get **No matches.** and still go to the gear. Two lists means two searches and a mode to
  remember. On a phone the button takes a row of a 375px screen. And it names what the box is
  not, *more than jobs*, instead of what it finds.

### B · One box, the same words, the doors grouped by kind under the jobs

Nothing changes above the first door. Today's rows stay on top with no header. Under them,
only when the typed words match one, come **Pages**, **Settings**, **Guides** and
**Punch list**, each a small-caps header with up to three rows and **N more ▸**. A press on
N more shows that kind alone, with **All kinds** to come back. A group with no rows does not
draw. When nothing at all matches, the box says what it looked in.

- **Best at:** nothing to learn. The words a person already types find more. A wrong guess,
  *lien*, shows the Lien desk, its guide and the signing code card at once, so the box teaches
  the app's names. On a phone the folds keep it to one screen.
- **What it costs:** the panel can be taller. With three rows a group and four groups it is at
  most twelve door rows under today's rows, and today's panel already caps at 22rem with a
  scroll. The ranking has to be careful: doors match on word starts and never on a bare number,
  so *13* finds jobs and not thirteen guides.

### C · A typed prefix, with ⌘K

`>` for a page or a Settings card, `?` for a guide, `#` for a to-do. The prefix narrows the box
to one kind. ⌘K and Ctrl+K already open it.

- **Best at:** a keyboard person on a desk who knows the habit from an editor. Precise and fast.
- **What it costs:** a hidden language the office does not know. On a phone `>` is two taps
  into the symbol keyboard. On its own it is A with a secret button.

### D · A kind picker, chips under the box

All · Jobs · Pages · Settings · Guides · Punch list, one tap each.

- **Best at:** visible and phone-friendly. One tap narrows.
- **What it costs:** a row of chrome on every open, for the one search in twenty that needs it.
  It is B's fold drawn as a filter.

### The pick: B, carrying C and D inside it

B is the box. C's prefixes ride on it as an accelerator for a desk, never required. D's picker
is B's **N more** press, which already narrows to one kind. The owner's button has one strength,
a visible word that says the box does more, and that word moves into the placeholder:
*Jobs, bids, customers, pages, settings, guides…*. The empty box, before a word is typed, shows
**Recent**, the last eight doors opened on this device.

**On a phone** the box takes the header row with Back, as today. The groups stack under it full
width, three rows each, **N more** a chip at the group's end. The keyboard's Go key opens the lit
first row. No prefix is needed. Recent matters most here: an assistant's three Settings cards
are one tap from the empty box.

**On a desk** ⌘K and Ctrl+K open and close it, and S on the Dashboard, as today. ↑ ↓ walk every
row across the groups. The first row is lit as soon as there are rows, so Enter alone opens the
best match. Tab jumps to the next group's first row. Esc closes. A line under the panel says the
keys once, the way the quick replies' / list says *↑ ↓ pick · Enter or Tab fills · Esc closes*.

## The plan

Smallest shippable first. Each PR carries its release note and fragment, and PR 2 the guide.

1. **The index and its test** (S, no screen changes): `src/lib/search/doors.ts` and
   `doors.test.ts`, the page words seeded from the nav and the directory's 62 task lines, the
   windows list with the file each one names, `isDevOnly` for the dev-doors card, the Header line
   of `docs/twins/APP_DIRECTORY.md`.
2. **The box: pages, windows and Settings cards** (M): `HeaderGlobalSearch.tsx` draws the
   groups under today's rows from `searchDoors`, the fold and N more, the lit first row, Tab, the
   prefixes, the placeholder, the empty box's Recent kept per device the way Messages keeps
   Show, the phone form. The guide `global-search` gains a section *Pages, settings and guides*.
3. **Guides and the punch list** (S): the Guides group by title and keywords through the Help
   page's own question strip, the Punch list group for dev and master with `#n<number>`, and a
   `where:` line in a guide's front matter naming the page it is about, seeded from the
   directory's lines, checked by the test, so a guide's row carries **Go there →** beside it.
4. **The box for everyone** (S, the owner's call): estimators, primaries and superintendents get
   the doors-only box, and the field roles keep their job card and gain the guides for their role.

## Is this the best we can do?

Arguing against the pick, and where the argument won.

**A person types a task in their own words.** *Send a lien notice* is not a page name. An index
built from route names and Settings labels misses it, and B returns **No matches.** like today.
The argument wins twice. First, the directory's *Go here when…* lines are tasks in plain words
mapped to links, so they become words on the doors, which is why PR 1 moves them in. Second,
the 438 guide titles are already tasks in plain words, *send lien notices from the Lien desk*,
and every feature ships one. So the Guides group catches the task phrasing. But a guide is
reading, not going. **Change:** PR 3's `where:` line, so the guide's row offers **Go there →**
and the task lands on the place, not only on the page about it.

**A role sees a door it cannot open.** The gate on every door reads the helper the app already
trusts, and test 4 proves, for every role, that no door bounces. The tabs with in-page gates
carry the same predicate as `roleGate.ts`'s surface. Per-user flags, Prospects for an estimator
and Banking for the controller, ride in the viewer. The box reads the imitated role while
*View as…* is on, as the nav does. What the test cannot see: a card that opens and then reads
only, as Phone and texts does for an assistant. That door is honest already, the card says who
sets it. **No change to the plan**, and one line in `docs/ACCESS_CONTROL.md` that the index's
gates are the matrix's and not a second copy.

**A phone has no keyboard shortcut.** The magnifier is one tap on every page, in the strip or
beside the dock, and the box already takes the row. The prefixes are not needed there, N more
is the picker, and Go opens the lit row. **Change:** Recent moved from a nice-to-have in PR 4
into PR 2, because on a phone it is the whole win for the cards a person opens every morning.

**Should the search learn what each person opens most?** The quick replies count presses and
sort the most used first, and `ui_nav_clicks` already records every nav press. A per-person
*most opened* on the server is the bigger version. It waits. The recent list per device, eight
doors in local storage, is the smallest thing that feels different tomorrow and costs no table.
**Change:** none, and a note that a later PR can seed the empty box from `ui_nav_clicks` by role
once the box has run for a month and the counts say what each role opens.

**Against B itself.** The panel grows, and a two-letter query could pull guides. The rule that
a number searches today's rows alone, and that doors match on word starts, holds the panel to
jobs for *13* and *J14*. The cap of three a group holds it for *the*. And the office's habit is
untouched, since nothing above the first door moves.

**Against a hand-kept index.** It drifts, as the Settings index has, nine cards behind on one
tab. **Change:** test 6, the reverse check, so CI fails on a route or a Settings group or an
anchor with no door. Windows cannot be enumerated by a test, so they stay hand-kept with the
check that the named file reads the key.

**The smallest version that would still feel different tomorrow.** PR 1 and PR 2 without the
windows and without Recent: the box you already use finds pages and Settings cards. *Office
hours* lands on the card. A week of that says whether guides belong in the box or stay on Help.

## Where it plugs in

| Piece | Exists | New |
|---|---|---|
| The box | `HeaderGlobalSearch.tsx`: the provider, the hotkeys, the input over the header row, `UnifiedSearchResultRow` for today's rows, `activeResultIndex` and the arrows | the door groups under the rows, the fold, the lit first row, Tab, the prefixes, Recent |
| The gates | `isPathAllowedForRole`, `roleGateLanding`'s surfaces, `getZonedSettingsGroups`, `guideIsRelevantForRole`, `canOpenPunchList`, the `can*` helpers in `gc/access.ts` and `messages/assignRule.ts` | `DoorViewer`, and `isDevOnly` |
| The words | `SETTINGS_SEARCH_INDEX` and its keywords, the guides' `keywords:`, the nav's labels, the directory's 62 task lines | the page and window doors' words, typed once in `doors.ts` |
| The links | `settingsDeepLink.ts`'s anchors, `/help?g=`, `/punch-list#n<number>`, the query keys `Jobs.tsx` and `Gc.tsx` read | nothing: every door is a link that already works |
| The matching | `searchSettings`' rank, label prefix then word start then keyword, and `searchHelpGuides`' question strip | `searchDoors`, one rank over every kind |
| The guides | `global-search.md` | its new section, and the `where:` line on the guides that have one page |
| Docs | the Header line of `APP_DIRECTORY.md`, the Page Access Matrix in `ACCESS_CONTROL.md` | one line each |

## How to verify

On the dev server as the dev, then as *View as…* an assistant and an estimator. Open the box
with ⌘K and type each of the mock-up's four searches. *1418* shows jobs and bids and nothing
else. *office hours* lands on the card after Enter alone. *how do I bill a customer* shows the
guide first with **Go there →** beside it. *send a lien notice* shows the Lien desk, and the
signing code card only for a master or a dev. As the assistant the Punch list group is never
drawn. On the phone preset the box takes the row, each group shows three rows and a chip, and
N more shows that kind alone. Open the empty box twice and read the first search under Recent.
Nothing here writes.

## The owner's calls

1. **The box's shape**: B as drawn, or A, the button, which PR 2 could build in a day.
2. **Guides in the box**: in PR 3 as planned, or left on the Help page until the box has run.
3. **The box for everyone**: PR 4, or the office roles only as today.
4. **The prefixes**: keep `>` `?` `#`, or drop them and keep only N more.
