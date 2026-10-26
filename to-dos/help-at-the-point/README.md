---
name: "Help at the point: a ? on every desk, the guide behind an error line, and the count of who opens which guide"
number: 187
group: gated
status: BUILDING 2026-10-26. The owner said build it, the three picks taken as recommended. PR 1 v2.5897 (#6222), PR 2 v2.5903 (#6224) PR 3 v2.5908 (#6231) PR 4 v2.5917 (#6236) and PR 5 v2.5918 are up; PRs 3 to 6 follow the same day; PR 7 waits 90 days on the counts.
summary: >
  The app has 438 guides and no count of which ones are opened: 37,990 clicks in the ledger
  since August and not one names the Help page or a guide. The page-minutes readout sees the
  Help page at 406 minutes in 90 days, a sixtieth of the Pipeline's. The owner's lens: a ? on
  every desk in the shape of the Messages page's, the guide that opens from an error line, and
  a read of the ledger to see which guides are opened and which never are. This to-do plans the
  one line that records a guide open with the door it came through, the ? card on eight desks
  from one kernel of words a desk and one card component, the error door as a card in place
  with a guide per family of error, and argues against each part before changing the plan.
next: PRs 3 to 6, then the owner's look at the ? on the Lien desk and the job window and at an error line's card. PR 7 in 90 days, from the Usage panel's never-opened list.
size: M, as seven PRs, XS XS S S S M XS
blocker: The owner's three picks, for PRs 3 to 7. PR 1 and PR 2 have none.
ver: proposed
opinion: build PR 1 and PR 2 today, then the ? on the four Pipeline windows first, the error door as a card in place and never a page, and delete no guide until the counts are 90 days old
mockup: to-dos/help-at-the-point/mockup.html
---

# Help at the point: a ? on every desk, the guide behind an error line, and the count of who opens which guide (#187)

## The ask

The owner, 2026-10-26, in a holistic look at how the app feels to use, picked this lens:

> Refine: a "?" on every desk; the guide that opens from an error line; read `ui_nav_clicks` to
> see which guides are opened and which never are.

The model he named is the Messages page's **?** (v2.5802): one press at the end of the top bar
opens a card that says what each lane holds, one sentence a lane, so the explanation sits where
the question arises. The lanes' sentences moved behind it from under the headings, and the page
got shorter.

Another session is planning at the same time a go-anywhere search, #181, where the header's box
opens a guide by name. This plan does not add a search. It puts the guide where the person
already is, and counts both. Where the two meet is said under *What #181 covers instead*.

## 1. What the clicks say

### How a guide opens today, and what each door records

A guide opens five ways. None writes a row.

| Door | What happens | Recorded |
|---|---|---|
| The Help page's list or search, `/help`, and the same browser under Settings → Guides | `GuideBrowser` sets `?g=<slug>` on the address | nothing |
| A link on a surface, `/help?g=<slug>` or `helpGuideHref(slug)` | 63 guides have one somewhere in the app's code; of the eight desks below only the Lien desk's § Rules and call script and GC projects' walk and gaps line carry one | nothing |
| A walkthrough's stop or footer, `SpotlightTour` | the link closes the walk and opens the guide (v2.5783) | the GC walk records its own open and close, not the guide |
| The share page, `/g/<slug>/`, and its **Open in ClickTooling ›** | a static page the build writes; a crawler reads the card, a person bounces into `/help?g=` | nothing: `public_page_views` allows four surfaces and a guide is not one |
| The gear menu's **Help** entry | a link inside the `gear-menu` container the capture listener watches | captured, and **no row in 90 days**: nobody opened Help from the menu |

`recordNavClick` has about forty-five callers and none is in `GuideBrowser.tsx`, `Help.tsx` or
`SpotlightTour.tsx`. The capture listener on the top nav, the gear menu and the phone's menu
records a bare link's path, so the only guide-shaped row the ledger could hold is `/help` from
the gear menu, and it holds none.

### What the ledger holds instead

Read on 2026-10-26 as the dev, through the page's own client on the dev server, with the
dev-only aggregates `usage_nav_clicks(90)` and `usage_page_minutes(90)` (v2.2342). Counts only;
no row left the browser.

| | Last 90 days |
|---|---|
| Rows in `ui_nav_clicks` | 37,990, all since 2026-08-26, the first row the table has |
| Distinct controls | 35 |
| Rows naming the Help page or a guide | **0** |
| Rows in `help_feedback` | 0 |
| Minutes on the Help page, `user_app_activity_page_daily` | **406**, 7 people: estimator 106 (2 people), assistant 24 (3), superintendent under one (1), dev 276 (1, and that one's rows include every Claude session that runs as the dev) |
| Minutes on Settings → Guides | 8, the dev |
| Minutes on the Pipeline, `jobs:stages`, for scale | 24,894, 9 people |
| Minutes on Quickfill · GC projects · the Bridge · Prospects' board | 2,677 · 774 (711 of them the dev) · 656 (the dev) · 9 (the dev) |

So the page-minutes side of the measurement plan sees the Help page and the clicks side does
not. The Help page gets about a sixtieth of the Pipeline's time, and the two estimators are the
people who read it most per head.

The ledger does hold four signals of a person being lost, which rank the desks in part 2:

| Signal | Rows | What it says |
|---|---|---|
| `gc_new_here`, the GC projects walk (v2.5783) | 85 opens, 53 closes | 82 of the opens were the walk opening itself on a first visit. **43 of the 53 closes were at stop 1 of 10**; 8 reached stop 10. Two assistants opened it 33 times on a first visit and closed it at stop 1 26 times. A walk that opens itself is dismissed; a card that waits is not. |
| `job_window_opened` | 1,440 | assistant 739 (3 people), dev 425, superintendent 113 read-only, helpers 94 read-only, master 44, controller 21: the most opened window in the app, by eight roles |
| `station_deep_link`, a Quickfill station opened by its link | 221 | Email 72, Physical inbox 36, Today's lines 34, Texts 20, Percent complete 19 |
| `role_gate_redirect` | 19, 9 people | a primary or a superintendent landing on the Pipeline (7) or a Bids tab (7) they cannot open, an assistant on Combined labor (3): the one error family the ledger counts |
| `discard_guard_shown` · `offline_retry_clicked` · `rls_refused` | 72 · 2 · 0 | the other error-shaped beacons; the refused-write family did not fire once |

### Which guides are opened most, and which never

**As far as the ledger knows, no guide has ever been opened and every one of the 438 is
never-opened.** That is the finding, and PR 1 is the fix. The nearest thing to a never-opened
list that can be computed today is static: which guides have a door anywhere but the Help list.

| Category | Guides | A door in the app's code | Linked from another guide | **No door anywhere** |
|---|---|---|---|---|
| Office | 205 | 20 | 83 | **115** |
| Bids & Estimating | 100 | 20 | 60 | **32** |
| Billing & Money | 58 | 14 | 31 | **23** |
| Getting Started | 33 | 1 | 8 | **24** |
| Field Work | 24 | 1 | 9 | **15** |
| Jobs & Scheduling | 18 | 7 | 5 | **9** |
| All | 438 | 63 | 196 | **218** |

A guide with no door is reached only by scrolling the Help list or typing the right words in its
search. The 218 titles are listed at the end of this file, by category. Twenty-four of the
thirty-three *Getting Started* guides are among them, which is the one row of this table that
reads as a bug: a getting-started guide nobody is pointed at on arrival.

### The one line that records a guide open: PR 1

One effect in `GuideBrowser`, where `selectedSlug` changes to a slug that is a guide:

```ts
recordNavClick(userId, role, GUIDE_OPENED_CONTROL, guideOpenedTarget(slug, via))
// control 'guide_opened', target '/help?g=<slug>#via=<door>'
```

- `from_path` is already written by the helper, so `/help` and `/settings` tell the page from
  the Settings zone. The role is already on the row.
- The door rides on the address as `via=`, read once and left alone: `list` and `search` from
  the browser's own presses, `walk` from a tour's stop or footer (`SpotlightTour` adds it),
  `share` from the share page's **Open in ClickTooling ›** (`helpShareCard.ts` adds it),
  `legend` from a ? card (PR 3), `error` from an error door (PR 6), `box` reserved for #181's
  search. A link with no `via` reads as `link`, so none of the 63 existing links changes.
- A slug that is not a guide records `guide_missing` with the same target, so a dead link in the
  wild is found by the readout instead of by a person.
- The search's typed words are never recorded; the row holds the slug. A search box can hold a
  customer's name.
- `guideOpenTelemetry.ts` is pure and tested (the target's shape, the via rules, the missing
  case); `GuideBrowser.render.test.tsx` gains one case: one row per open, none on a re-render,
  none on the list.
- The same PR adds a **Guides** panel to Settings → Usage, beside *clicks by control*: the
  twenty most opened, by role and by door; the count of guides with no open in the window, out of
  438; the `guide_missing` rows. The readout is what makes the never-opened rule under
  *Decisions* decidable in 90 days.

Nothing to decide, no migration, no edge function: the row shape, the policy and the aggregate
RPC exist. Size XS.

## 2. The ? on every desk

### The shape

The Messages page's, exactly: a round **?** at the end of the top bar (26 px, the Bridge's rule
already draws one the same size with *Why this rule*); a press opens one card under the bar; one
row a part of the desk, the part's name in bold and one sentence of what it holds; the last row
is the door, **Read the guide: *the guide's title* →**, which opens the guide over the desk; and
**Close**. On a phone the card is a sheet from the bottom. Every sentence passes
`plainWordsFailures` (one idea, twenty words at most, no glue), and a row says what the part
holds, never how to do a step. The how is the guide's.

The mock-up draws it on two desks: `mockup.html` → **1 The Lien desk** and **2 The job
window**, each at desktop width with the card open and at phone width as a sheet.

### The wiring

- **One type and one check**, `src/lib/help/deskLegend.ts`: `DeskLegend { key, label, rows:
  LegendRow[], guide: { slug, title }, phoneRows?, desktopRows? }` and
  `deskLegendFailures(legend, guideSlugs)`, the plain-words failures of every row plus a failure
  when the guide slug is not a guide, the way `helpGuideLinks.guides.test.ts` refuses a dead
  link. `deskLegends.test.ts` runs every desk's legend through it, so a row that fails plain
  words or a guide that is renamed fails CI.
- **One kernel of words a desk**, beside the desk's own words, each exporting one `DeskLegend`:
  `lib/jobs/lienDeskLegend.ts`, `lib/legal/legalDeskLegend.ts`, `lib/jobs/jobWindowLegend.ts`,
  `lib/jobs/bankPaymentsLegend.ts`, `lib/gc/projectBoardLegend.ts`,
  `lib/prospects/subsBoardLegend.ts`, `lib/quickfill/stationLegend.ts` (one legend per station
  from `QUICKFILL_SECTIONS`, built from the station's banner question, its count, the three
  presses and the station's own guide where one exists). `lib/messages/laneLegend.ts` becomes
  the first `DeskLegend` with no change to its words.
- **One card component**, `src/components/help/LegendCard.tsx`, generalised from
  `LaneLegend.tsx`: the grid, an optional color stripe per row (the lanes keep theirs), the door
  row, Close, and on a phone the sheet. `LaneLegend` becomes a four-line caller. One
  **`LegendButton`**, the ?, with `aria-label="What this desk holds"`, `aria-expanded`, and a
  blue dot until the person has pressed it once, kept per person in `user_prefs` beside the
  other per-person switches, not per browser (the GC walk's per-browser key opened it 33 times
  for two assistants).
- **Recorded**: one `legend_opened` row with target `#<desk>` on each press, and the door's
  guide open carries `via=legend`, so the readout of PR 1 says which ? are pressed and which
  cards send people on to the guide.

### Each desk: what confuses a person on arrival, and what the card says

Each desk was read on 2026-10-26 as the dev through the page's text (the browser pane was
hidden, so no screenshot; the words below are the desks' own), its guide and its entry in
`docs/GLOSSARY.md`. The row's name is in bold; the sentence is the card's. Each card ends with
**Read the guide: *title* →**.

**The Lien desk** (`/jobs?tab=stages&liendesk=1`; guide *send lien notices from the Lien desk*,
the longest guide in the app at about 2,400 words; the desk's § Rules and call script already
open guides). On arrival: eleven controls on the title line, a rail of four steps under three
kinds of paper, three piles whose buttons each name a different move, and a pill that reads
*Record the mailing · 7* with no sign of what a run is.

- **Do now**: Every lien paper that needs someone to act, late or due soonest first.
- **Only you can…**: The two steps only the leader takes, approve and sign. The office sees them under Waiting on.
- **The rail**: The four steps of a notice with how many rows stand on each. Press a step to see only those rows.
- **Deadlines**: When each deadline falls, on one calendar with the 15ths as columns.
- **All filings**: Every paper by its state, under Notices, Affidavits, Retainage and Timeline.
- **Record the mailing**: The printed notices as one packet. It records what is ready and holds the rest with the reason.
- **§ Rules**: The Texas rules the desk follows, with the guide behind each one.

**The job window** (opened from any job row; guide *move between a job's Job, Edit, Bill, and
Costs tabs*). On arrival: a header with seven icons, six tabs, a tinted Costs card, and on a
phone a bar whose middle button changes its name with the job's stage. The most opened window in
the app, by eight roles, two of them read-only.

- **Job**: The read view. The address, the customer, the activity feed and a Costs card.
- **Edit**: The job itself. Numbers, name, address, service type, the people and the customer.
- **Bill**: Money in. The line items, then the bills and the payments that paid them.
- **Costs**: Money out, told straight. Four numbers first, then where the money went.
- **History**: One row per day worked, and the lien timeline while money is still owed.
- **Documents**: The job's pay applications, bills, contract, test reports, lien paper and folders.
- **The icons** (desktop): Share, supply house, send as task, calendar, mail and the gear work from any tab.
- **The bar** (phone): Status opens the status rail. The middle button is the job's next move. Note jumps to the note box.

**The Legal desk** (`/jobs?tab=stages&legal=1`; guide *review a collections account before it
goes to your attorney*). On arrival: a rail of accounts sorted by *what Click would keep*, four
tiles that are questions, a red-and-yellow list called *Before this goes to an attorney*, and six
tabs. The header's one sentence already names the three paths.

- **The rail**: Every Collections account, largest first by what Click keeps after the firm's share and the filing cost.
- **Can we sue?**: Yes when the customer got the bill, a crew was placed on the property and nothing is disputed.
- **How much? · What's left for us?**: What they owe, then what we keep after the firm's cut, with a verdict.
- **What could go wrong?**: What hurts the case, in plain words.
- **Before this goes to an attorney**: Red items an attorney asks for first. Yellow ones are worth knowing.
- **The tabs**: Narrative, Account, Paper, Evidence, With the firm and Timeline. Each holds one part of the packet.
- **Three paths**: Run it in house, mark it attorney-ready, or write it down.

**Bank payments on AR** (`/jobs?tab=stages&openBankPayments=1`; guide *match bank deposits to
the bills they pay*). On arrival: *To match · All*, a *Came back* group of cases on top with a
$30 fee line and a timeline, a *Who paid you* pane that may be empty, and a green sweep bar that
appears only some mornings.

- **To match**: Every deposit from the bank not yet on a bill, newest first.
- **All**: Every deposit, the applied ones too, each with its chip.
- **Came back**: Checks the bank returned, worked as cases on top of To match.
- **Who paid you**: The payer the deposit's name and memo point at, with their open bills. Green means the amount matches.
- **The sweep bar**: Deposits that each match exactly one open bill, applied in one pass after you review them.
- **⋯**: Mark returned deposits, and the full screen button beside Close.

**GC projects** (`/gc`; guide *see where every GC project stands*; the *New here?* walk of ten
stops, v2.5783). On arrival: six views in a tab strip, a Project Board with a stage strip, rings
and *$0 so far, with 5 holes*, then a long card per project with a clock, a key and a trades
table. The walk opens itself and is closed at its first stop four times in five.

- **The Project Board**: Every GC project by its stage, with the days left and the price so far.
- **The strip**: One pill per stage with its count. Press one to jump there.
- **A row's ring**: Fills as the project gets through its stage. The card says what to do next.
- **By customer**: The same rows under each customer we build for.
- **The other views**: Trade partners, Customers, Follow up, Messages and Money, one tab each.
- **New here?**: A ten stop walk of the page. This card is the short version.

**The Bridge** (`/bridge`, dev only; guide *read the Bridge*; the rule already has a ? with five
points). On arrival: a big number with two lights, a cash readout, one rule, five cards with a
red one, and a page that keeps going. One reader, the owner, who wrote it.

- **The top line**: This week's field contribution, with two lights for net position and cash.
- **The cash readout**: The lowest cash point in the next eight weeks, against your floor.
- **The rule**: Find the slowest step. Its own ? says why in five points.
- **The five cards**: Market, Sales, Build, Bill and Collect, in the order work flows. The red one is the weakest link.
- **Collect, broken down**: Every payer's open bills by their pay pace, with the one move on each.
- **Monday sheet**: The week's call, recorded and scored on Friday.

**The Prospects Subs board** (`/prospects?kind=subs&tab=board`; guide *find subs for the
bench*). On arrival: a five-step strip, a *For* picker, and two paragraphs of explanation the
board prints permanently under the strip, then one column a trade with ranked cards. The board
already explains itself in prose; the ? folds that prose.

- **The strip**: The path onto the bench. To call, Called, Talked, On the bench, Quoted.
- **For**: The project a set of plans is for. Its trades come first.
- **A column**: One trade. Call first on top, then who answers, then never called, then coldest.
- **Call the top 3**: Runs the calling deck through the column's best three in order.
- **A card**: Call now, To the bench, Pass, and the pick between Call first, Normal and Later. A drag pins it.

**Quickfill's stations** (`/quickfill`; guide *run the office day with Quickfill*, and a
station's own guide where it has one: Percent complete, Physical inbox, Property kinds, Email,
Needs you). On arrival: thirty-one stations, each a banner question, a count, a Next line and
three presses whose lit one changes with the count. The banner question is already half the
card: it says what up to date means here. The card adds the other half.

- **The question**: What up to date means on this station.
- **The count**: Items waiting on someone in the office. A dash means the station has no count.
- **The Next line**: The first row to act on and its verb.
- **The three presses**: Done when nothing is left, Worked it when rows are left, Not sure to ask the owner.
- **The colors**: Red never marked or past due, yellow due today, green looked at and not due.
- **Mark history**: Eight weeks of looks, behind the chart icon.

### The rank

The owner asked for the desks ranked by how often their guides are opened. No guide open is
recorded, so this rank is by the signals the ledger does hold, and PR 1 replaces it with the real
one in 90 days.

| Rank | Desk | Why here |
|---|---|---|
| 1 | The job window | 1,440 opens by eight roles, 739 of them by three assistants; two field roles see it read-only and nothing on it says so |
| 2 | The Lien desk | the office's Needs you sends people here with the leader's count; the longest guide; the only desk with a guide door today, two of them |
| 3 | Quickfill's stations | 2,677 minutes, 254 top-nav presses by assistants, 221 station links; the banner is half a card already and 31 stations share one guide |
| 4 | The Legal desk | the tiles are questions a first-timer cannot answer; six tabs; 259 minutes on Accounts receivable plus the desk's share of the Pipeline's |
| 5 | Bank payments on AR | a window that changes shape with the morning's deposits; cases, a fee line and a sweep bar that is not always there |
| 6 | GC projects | the walk's 43 closes at stop 1 are the ledger's clearest sign that a first-timer wants one card, not ten stops; 63 non-dev minutes in 90 days |
| 7 | The Bridge | one reader, the author; its rule already carries a ? |
| 8 | The Subs board | 9 minutes in 90 days, the dev's; nobody is confused where nobody goes, and the board already prints its explanation |

## 3. The guide from an error line

### The lines a person sees

`formatErrorMessage` has 365 call sites and `formatPostgrestOrUnknownError` seven; about 1,400
places show an error toast; 132 named operations feed the sentence. The families, from
`src/utils/errorHandling.ts` (v2.2836's class rules):

| Family | The line today | Retry |
|---|---|---|
| network | *No connection — the app couldn't reach the server, so nothing was saved. Check your signal and try again.* | yes; the `OfflineRetryPanel` retries a read on its own when the signal returns, on nine surfaces |
| access denied, `42501` | *You don't have access to this \<thing\>.* / *You don't have permission to \<do the thing\>.* | no |
| broken link, `22P02` · `PGRST116` | *This link points to something that doesn't exist any more.* | no |
| the sign-in lock | *The app was busy renewing your sign-in, so this did not load. Try again.* | yes |
| timeout | *\<operation\> did not respond within 20s* and *Try refreshing the app* | the request may have landed, so the line says so |
| the server's own words | *Couldn't load \<thing\>: \<the server's message\>* / *Failed to \<do the thing\>: \<the server's message\>* — a check constraint, a duplicate key, a trigger's words, as Postgres wrote them | depends |
| unknown | the raw message, or the caller's fallback | no |
| a refused write (v2.3058) | *Save didn't apply — you don't have permission to edit this \<thing\>, or it no longer exists. Your changes were not saved.* | no |
| the page itself | *Something went wrong loading this page.* with a reload | yes |

The newer surfaces read a tighter shape: *Could not read the papers · \<reason\> · Retry*
(the Physical inbox), *Could not read the legal tables · Retry* (the Legal desk, v2.5780, which
also retries on its own), *Back online — tap Retry to try again.* (the Retry panel). And a batch
names what it held: the lien run's *9 notices are held · They stay in the pile with the reason in
red* (v2.5533) with the reason on each row (an unconfirmed owner, no signature, no mailing
address, a $0 claim, no number yet); the Collect desk's *N payers hold*; Today's sends' held
texts with why (no number, STOP); a Docsmit envelope held over its sheet count.

### Which are seen most

Not recorded. `errorClassTelemetry.ts` writes one console line per (kind, code, operation) per
page load and says its own follow-up is *a real `error_shown{class, operation}` event into
whatever sink the app adopts*. The sink exists: `ui_nav_clicks`, as `rls_refused` and
`role_gate_redirect` already use it. The ledger's proxies say the refused-write family fired
zero times in 90 days, the offline retry twice, the role gate nineteen times.

**PR 2**, XS: `reportErrorClass` also records one `error_shown` row per triple per page load,
target `/<kind>?code=<code>&op=<operation>`, `from_path` the surface. Same once-per-triple
throttle, same fire-and-forget posture, no table. The Usage panel of PR 1 gains the families by
count and surface. After that, *which lines people see most* is a read, not a guess.

### The door

**Per family, not per surface.** The family's sentence is the same on every surface, so its
explanation is too; the surface's own help is the desk's ? card. The door is one more word after
the reason: *Could not save the payment · No connection, the app did not reach the server ·
**What this means** · Retry*. On a toast it is the toast's one action (`ToastAction`, which the
app already has for Undo).

A press opens the **same `LegendCard` in place**, under the line or over the toast, with three
rows and the door: **What happened** (the family's sentence, longer, in the person's words),
**What was saved** (nothing, or *may have landed*, by the family), **What to do** (Retry where
the family allows it, who to ask for an access refusal, reload for a page that failed to load),
and **Read the guide: *title* →**, which opens the guide **in a new tab** the way § Rules does,
so the error, the window and the half-typed form stay. The words live in
`src/lib/help/errorGuides.ts`: `errorDoor(kind, code, operation) → { rows, guide }`, pure,
tested for every family, every guide slug checked against the registry.

The mock-up draws two: `mockup.html` → **3** the network family inline on the job window's Bill
tab with the card open, and the server's-words family as a toast on a phone with the card
behind its action.

### The guides that must be written

None of the 438 answers an error line today. The nearest are *update the app when a new version
is ready* (the page that failed to load) and *sign in when my password won't work*. Four to
write, in Getting Started, each under 400 words:

1. *what No connection means and what was saved*: the network family and the Retry panel, for
   the field roles first.
2. *what you don't have access to this means and who to ask*: the access family and the role
   gate, drawn from `ACCESS_CONTROL.md`, one line per role saying who grants what.
3. *read the server's words on a failed save*: the six phrasings Postgres uses that reach the
   screen (violates check constraint, duplicate key, null value in column, permission denied,
   foreign key, the app's own `RAISE` words) and what each asks you to fix.
4. *what to do when the app did not respond or a link points nowhere*: the timeout, the broken
   link and the sign-in lock families, and *Try refreshing the app*.

The lien run's holds already have their guide: *send lien notices from the Lien desk* → *What
the run holds back*. Its held rows get the door to that heading, with `#what-the-run-holds-back`.

### The PRs, smallest first

| PR | Size | What it touches |
|---|---|---|
| **1 · Record a guide open** | XS | `lib/guideOpenTelemetry.ts` (+test), the effect in `GuideBrowser.tsx` (+render case), `via=` on the five doors (`helpGuideHref` gains an optional third argument, `SpotlightTour`, `helpShareCard.ts`), the Guides panel on `SettingsUsageTab.tsx`; guide *read the Usage dashboard* gains a section |
| **2 · Record an error shown** | XS | `errorClassTelemetry.ts` writes the row, the families panel on the Usage tab |
| **3 · The card, and the ? on the Lien desk and the job window** | S | `lib/help/deskLegend.ts` (+test), `components/help/LegendCard.tsx` and `LegendButton.tsx`, `LaneLegend.tsx` re-seated, `lib/jobs/lienDeskLegend.ts`, `lib/jobs/jobWindowLegend.ts`, the ? on `LienDeskModal.tsx` and `JobWindowModal.tsx`, the first-press dot in `user_prefs`, `legend_opened` rows; the two guides each gain one sentence saying the ? is there |
| **4 · The ? on the Legal desk, bank payments, GC projects and the Subs board** | S | four kernels, the ? on `LegalDeskModal.tsx`, `BankPaymentsModal.tsx`, `GcProjects.tsx` (beside New here?), `SubsBoard.tsx` (its two printed paragraphs move into the card, as the lanes' sentences did on Messages) |
| **5 · The ? on Quickfill's stations** | S | `lib/quickfill/stationLegend.ts` over `QUICKFILL_SECTIONS` and the banner, the ? on the banner line in `QuickfillRoundScreen.tsx` and the Page view, each station's own guide where one exists |
| **6 · The error door** | M | `lib/help/errorGuides.ts` (+test), *What this means* on the newer lines (`QuickfillPhysicalInboxSection`, `LegalDeskModal`, `OfflineRetryPanel`), the toast action where `formatErrorMessage` feeds a toast through the shared helper, the lien run's held rows, the four guides, `via=error` |
| **7 · The never-opened rule** | XS | 90 days after PR 1: the Usage panel's never-opened list becomes the reading list, and the rule under *Decisions* is applied once, by hand, as one docs PR |

The Bridge's ? is not in the train (see part 4).

### What #181 covers instead

#181 is finding by name: the header's box gains a **Guides** group over the titles and keywords,
a `?` prefix, and a `where:` line in a guide's front matter so a guide's row offers *Go there →*.
This to-do is finding by place: the ? on the desk and the door on the error line open the one
guide for where the person already stands. The seam is PR 1: #181's box opens a guide with
`via=box`, so the Usage panel reads both doors on one row per guide, and #181's door index can
list each desk's ? guide as that desk's `guide:` door without a second list of slugs.

## 4. Is this the best we can do?

**A ? nobody presses.** The Bridge's rule has had a ? since the link PRs and Messages since
v2.5802; neither records a press, so nobody knows. The GC walk does record, and its 43 closes at
stop 1 say what a first-timer does with help that arrives uninvited: dismisses it. A ? that waits
costs 26 px and is pressed only by someone with the question, which is the point. The risk is the
other way: a first-timer does not know a ? is there. *Change:* the ? wears a blue dot until the
person has pressed it once, kept per person, and PR 3 records every press, so a ? with no press
in 90 days on a desk people use is a ? in the wrong place, not a reason to open it by itself.

**A legend that repeats the guide.** It would, if a row said how. *Rule, held by the test:* a row
names a part on the screen and says what it holds, in one sentence, twenty words at most, and a
row that starts with a command (*Press*, *Open*, *Type*) fails `deskLegendFailures`. The Lien
desk's seven rows are 93 words against the guide's 2,400. Where a desk already prints its
explanation permanently, the Subs board's two paragraphs and Quickfill's banner, the card absorbs
it and the screen gets shorter, which is what Messages did with the lanes' sentences.

**An error door that opens a page while the error is still on screen.** It must not. A toast lasts
seconds; an inline line sits over a form with typed words in it; the job window is a window over
the Pipeline. Navigating to `/help` loses all three. *Change, already in the plan above:* the
door opens the card in place, and the guide opens in a new tab from the card's last row. The
first version of this plan had the line open the guide page; part 3 was rewritten to the card.

**Should the never-opened guides be deleted rather than linked?** Not on zero data. The 218 with
no door are not never-opened; they are never-pointed-at, and the Help page's 406 minutes went
somewhere. *Change:* PR 7 is the rule, applied once in 90 days: a guide with no open in the
window and no door is given a door from the surface it describes or retired, decided title by
title, and the 24 *Getting Started* guides with no door are looked at first because a
getting-started guide with no door on arrival is a contradiction.

**The smallest version that would still catch a confused first-timer.** PR 1 and PR 3: record
the opens, and put the ? on the two windows the office lives in, the job window and the Lien
desk. Everything after that is paid for by the counts. *Changes made to the plan by this
argument:* the Bridge's ? is dropped (one reader, who wrote the page, and the rule's ? is
already there); the Subs board's ? adds no words, it folds the two it has; Quickfill's ? is one
kernel over the registry, not thirty-one hand-written cards, and a station with no guide of its
own doors to *run the office day with Quickfill*.

## Decisions

1. **The first-press hint**: a blue dot on the ? until the person has pressed it once, per
   person (recommended), or a plain ? with no hint, or the card opening itself once per desk
   (not recommended; the walk's numbers).
2. **The error door's shape**: the card in place with the guide in a new tab (recommended), or
   the line opening the guide page, or the toast alone with no card.
3. **The never-opened rule, applied in 90 days**: a guide with no open and no door is given a
   door or retired, title by title (recommended), or kept as is with the list as a reading list,
   or retired on sight.

Two the plan takes as given, unless the owner says otherwise: the dev's own rows are set aside
when the desks are ranked, since every Claude session runs as the dev and the dev's 43 first
visits to the GC walk are those sessions; and the words on every card are held by the plain-words
test with no exemption list, as the guides are.

## Where it plugs in

- **Recording**: `src/lib/navClickTelemetry.ts` (`recordNavClick`, fire-and-forget, the
  `ui_nav_clicks` table of v2.2334 with dev-only reads), `usage_nav_clicks` and
  `usage_page_minutes` (v2.2342) behind `SettingsUsageTab.tsx`; `GuideBrowser.tsx` owns
  `?g=` through `helpGuideUrlParam.ts`; `helpGuideAnchors.ts` builds the links; `SpotlightTour.tsx`
  carries a stop's `guide` and the footer's `guideHref`; `helpShareCard.ts` writes the share
  page and its app link; `errorClassTelemetry.ts` is the console-only reporter with the named
  follow-up.
- **The card**: `src/components/messages/LaneLegend.tsx` over `src/lib/messages/laneLegend.ts`
  and `lib/followUp/laneNotes.ts` (v2.5802); `BridgeRule.tsx`'s ? and popover; the sheet shape
  the queues fold already draws on a phone.
- **The desks**: `LienDeskModal.tsx` (its title line, § Rules through `LienRulesModal.tsx`, the
  call script's guide link), `legal/LegalDeskModal.tsx` (`LEGAL_READ_FAILED_WORDS` from
  `lib/legal/legalTablesRead.ts`), `JobWindowModal.tsx` and `JobDetailModalContext.tsx` (the
  `job_window_opened` row), `BankPaymentsModal.tsx`, `pages/GcProjects.tsx` with `lib/gc/tour.ts`
  (`gc_new_here`), `pages/Bridge.tsx`, `prospects/SubsBoard.tsx` over `lib/prospects/subsStages.ts`,
  `pages/Quickfill.tsx` with `lib/quickfill/sections.ts`, `sectionBanners.ts` and
  `QuickfillRoundScreen.tsx`.
- **The errors**: `src/utils/errorHandling.ts` (`formatErrorMessage`,
  `formatPostgrestOrUnknownError`, `describeClassifiedError`, the two code sets), `lib/networkErrorMessage.ts`
  (`OFFLINE_ERROR_MESSAGE`), `lib/refusedWrite.ts` (`rls_refused`), `lib/roleGate.ts`
  (`role_gate_redirect`), `components/OfflineRetryPanel.tsx` over `lib/offlineRecoveryState.ts`,
  `components/Toast.tsx` (`ToastAction`), `lib/jobs/lienDeskRun.ts` (`runRecordWords`, the held
  reasons), `lib/bridge/collect/collectWords.ts`.
- **Words and docs**: `src/lib/plainWords.ts`; the guides named above; `docs/GLOSSARY.md`'s
  entries for each desk; `PROJECT_DOCUMENTATION.md` where a desk gains a control; a release note
  and a fragment per PR; `docs/twins/APP_DIRECTORY.md` unchanged (no page is added).
- **Sibling plans**: #181 go-anywhere (`to-dos/go-anywhere/`), the seam above; #182 desks as
  pages (`to-dos/desks-as-pages/`) moves the Legal desk to `/legal-desk` and the Lien desk and
  the bank window after it; the ? and its kernel do not care whether the desk is a window or a
  page, and PR 3 lands on the window as it is today.

## How to verify

- **PR 1**: as the dev, open one guide from each door (the list, the search, a link on a
  surface, the GC walk's gaps stop, a share page's **Open in ClickTooling ›**); `usage_nav_clicks(1)`
  through the page's client, or Settings → Usage → Guides, shows five `guide_opened` rows with the
  five `via` values and the right `from_path`; open `/help?g=not-a-guide` and one `guide_missing`
  row appears; re-render the page and no second row appears.
- **PR 3**: on the Lien desk press the ?; the card lists the parts in the desk's order with the
  door at the end; the dot is gone on the next open on another browser as the same person; the
  door opens the guide and the row carries `via=legend`; on the phone preset the card is a sheet
  and Close puts the desk back as it was. The same on the job window, where the phone card has
  the bar row and the desktop card the icons row.
- **PR 6**: in the Physical inbox set the browser offline and press Retry; the line reads
  *Could not read the papers · No connection… · What this means · Retry*; the card opens under
  it; the guide opens in a new tab and the station is untouched behind it; one `error_shown` row
  and one `guide_opened` row with `via=error`.
- Every PR: `npm test` holds `deskLegends.test.ts`, `errorGuides.test.ts` and the guides' link
  and plain-words tests; `npm run check:todos` and the eight deploy checks.

## Where it stands

| What | PR | State |
|---|---|---|
| Proposal, the live read and the mock-up | this PR | proposed 2026-10-26 |
| PR 1 · record a guide open | v2.5897 #6222 | built 2026-10-26 |
| PR 2 · record an error shown | v2.5903 | built 2026-10-26 |
| PR 3 · the card, and the ? on the Lien desk and the job window | v2.5908 | built 2026-10-26 |
| PR 4 · the ? on the Legal desk, bank payments, GC projects and the Subs board | v2.5917 | built 2026-10-26 |
| PR 5 · the ? on Quickfill's stations | v2.5918 | built 2026-10-26 |
| PR 6 · the error door and four guides | | building 2026-10-26 |
| PR 7 · the never-opened rule | | in 90 days |

## The 218 guides with no door anywhere but the Help list

Titles only, by category, as the app's code and the other guides stood on 2026-10-26. This is the
nearest thing to a never-opened list until PR 1 has run for 90 days, and it is PR 7's reading
list. A title here means no surface links the guide and no other guide links it.

### Getting Started (24)

check off my daily tasks and leave notes · fill and sign a form like the W-9 on my phone · find a setting fast · find and merge duplicate customers · find the current company documents · get started as a leader · get started as a primary · get started as a superintendent · get started as an estimator · get started in the office (assistant or controller) · jump between dashboard sections · know when someone deletes a lot at once · merge two user accounts into one · read the Usage dashboard · see the app as a role or as a person · see what changed in recent app updates · see which emails the app sends me · share a help guide with someone · sign in when my password won't work · switch between light and dark mode · turn on Pin Mode to pin pages · understand how ClickTooling works · update the app when a new version is ready · work my inbox on the dashboard

### Field Work (15)

add a job to my schedule and move my day around · approve my team's hours · ask Dispatch for a missing phone number or photos folder · keep my record straight · message a customer from job mode · rate my crew at clock-out · report a day the clock missed · report a problem with my truck or send an odometer reading · report a turnaway and bill a trip charge · share a job with a teammate · sort my card purchases to jobs · supervise a crew · use Farm Mode to see only my checklist · write a tech's bio · write up a change order from the field

### Jobs & Scheduling (9)

find a job you just added · get a daily email of what your crews did · see the pipeline on a map · see what was done on a job · see what your crews did today · see your jobs on a map · sort the pipeline by percent complete · sort the pipeline by when jobs were added · work the Pipeline from my phone

### Billing & Money (23)

close the money week · fill out an AIA G702-G703 · give a customer a discount · know whether a customer keeps their word · label bank transfers and wires · let a customer pay by bank transfer or mailed check · mark a bill uncollectible and keep it off your numbers · mark supply-house bills paid · name company debit cards and link them to people · read the cost and value timeline on a job · read the team review · record a return or credit from a supply house · see everyone's pay setup · see where money flows · see which payments paid a bill · see who is spending what on the company cards · see your partner ledger and weekly statements · send a bill to more than one person · send a GC our lien waiver · sort the bank feed · split a bill so a customer can pay with multiple cards · split a job into stages and bill stage by stage · tag bank purchases so rules and reports read them the same way

### Bids & Estimating (32)

add the job's own work to the schedule · answer a trade that says it will be late · bid to your marked-up plans when the drawings are too rough to read · bring in a schedule someone handed us · copy a bid into another trade or duplicate it · draw a rough schedule for our bid · fill a takeoff from the book · get supply house prices on a bid · look up a part on Google from the takeoff · open a job account when you win a bid · price a bid at a target margin · price a takeoff in sticks · put a new set of plans on a GC project · refresh a takeoff's prices to today's book · see every customer and where each job stands · see every paper on a job and what is missing · see how a GC job's stage is going · see how close the robots are to our numbers · see what pricing sees on takeoffs · see where a person stands and what comes next · see where every company stands and who is late · see where every GC project stands · see who to call about the schedule · set a new baseline after a change order · share a bid tab with the trades · show a customer where their job stands · split a line into parts · start a schedule from a template · track what the work waits on · use the pricing tape calculator · use the robots and the new bid tools as an estimator · walk the schedule each week

### Office (115)

add a customer (and close out the prospect they started as) · add a quick call or email to my hours · add a stage and its tasks to a roadmap · add ITB links to a bid · align unmarked hours with jobs in one pass · answer a customer who sent a request from their portal · archive a customer · audit job bills on the Billing tab · auto-fill a bid's distance to office · backfill payment history from HouseCall Pro · build a fillable form from a PDF · catch up on payroll weeks that never got a report · change the default bid cover letter text · change the wording of an email the app sends · chase late payments with call mode · classify customers as commercial or residential in one sitting · clear the four Subs tiles from the board · combine duplicate people into one · combine two duplicate jobs into one · complete the office section of a form · create an assembly while doing a takeoff · create, rename, and share a roadmap · drill into the dashboard money cards · enter a form a sub filled out on paper · estimate how long a roadmap task will take · find a customer from my phone · find my way around the People page · find the big jobs with thin margins · flip between a bid's view and its edit form · get into a city permit portal · give someone a task · group jobs into a development · hide groups of jobs from the Pipeline board · keep private employee files · know when Edit Job saves my changes · link bids and estimates to a project · link old jobs to their customers in one sweep · make job addresses wrap at the city name · manage employment dates for my team · manage the contract library and packets · match clock sessions to jobs and bids · merge two spellings of the same builder · move field photos to google drive · number and order the stages and tasks on a roadmap · onboard a new subcontractor · open a job's activity full screen · open a person's desk · open just the Pipeline sections you use · pick my own highlight color on the Bid Board · plan the roadmap and see how each goal is going · put a cost estimate on a task · read a partner's balance from the office · read field reports on the dashboard · read the Estimating Health section · read the roadmap Timeline · read true profit on Job Summary · read what bidding costs · reconcile Cash App payments against pay reports · reconcile HCP billing history · reconcile the books against bank statements · review my team's completed tasks · say who can run a job on their own · schedule a sub across every surface · schedule a task for later or make it repeat · search jobs on the Pipeline board · see a customer's full history and lifetime value · see a customer's full profile from the Pipeline board · see a task's full history and notes · see every contract we offer side by side · see every job and bid on one map · see everything that happened with a customer · see how fast jobs turn into cash · see how many jobs are running at once, over time · see how many jobs ran each day · see how often we go back · see jobs, bids, and estimates on the map · see man hours for the office and the field · see profit by month on Job Summary · see the money flow on a workflow · see what a bid's price is made of · see what a sub put on a signed form and open the PDF · see what days a job is on people's calendars · see what moved through the pipeline this week · see what the office got done on any day · see what the team sees · see what to do next on a roadmap · see what we owe each person on payroll · see what work is coming · see where a task fits in its roadmap · see where everyone clocked in is right now · see where someone stands and share a pay statement · see where you win and lose with a builder · see whether the crew was full · see which jobs made or lost money this week · see who worked with whom, and who was on which job at any moment · see your bids on a map · send a sub a work order from a sheet · send an hr report about someone · set a job's progress from the Pipeline board · set an account man on a job · set defaults for everyone · set how far back assistants can see and add hours · set the applied version date on a staff contract · set the company owner account · set up Floaty and the ring game · staff and discuss a roadmap task · text a bid's name, address, and due date to someone · track a general contractor on a job · track and rank prospective hires · track RFIs on a bid · turn on reading the bids inbox · turn on the reply push · use the cover letter studio · work the hours grid on a phone · work the punch list of unfinished projects

