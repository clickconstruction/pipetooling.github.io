---
name: "Honest and fast: the last read kept, and a plain line when the app is slow"
number: 183
group: gated
status: proposed 2026-10-26 from the owner's holistic look at the user experience, the lens "Honest and fast" · waiting on the owner's five calls and on #163's queue for the last words
summary: >
  During a database freeze every live read hangs, so a daily screen shows a spinner, two grey
  bars or a blank, and a person cannot tell a freeze from a dead app. On a cold open the auth
  gate offers the cache-repair page at five seconds and falls through to sign-in at eight, so a
  freeze reads as being signed out. A failed schedule read lands as "No blocks scheduled."
  Two things: the last read kept on the device for the daily screens, in the shape the Pipeline
  already has since v2.3610, so a slow morning shows the page as read at 7:52 AM with a stamp,
  stale figures muted and the presses that act on them held; and one strip at the top of every
  screen, the same strip #163's waiting bar will use, that says "The app is slow right now." the
  moment something has waited four seconds with nothing landing, adds "The page you see was read
  at 7:52 AM." on a kept page, says "Nothing you pressed is lost." only while #163's queue holds
  every press, and reads "Could not reach the app. Retry." when nothing answers at all.
next: The owner's five calls below, then PR 1, the strip and the auth gate, which ships alone; PR 2 lifts the Pipeline's kept-read shape into one hook; PRs 3 to 5 keep a read for the phone's day, Quickfill and Messages, the Dashboard last.
size: L as a train of five (S · M · M · M · S), no migration
blocker: The owner's calls, and #163's queue for the words "Nothing you pressed is lost", which the strip can only say once a press is kept.
opinion: build PR 1 and PR 2 now, since the strip alone changes a slow morning and the shape already exists; keep the phone's day and Quickfill next, and give the Dashboard's 630 reads a to-do of their own
---

# Honest and fast: the last read kept, and a plain line when the app is slow (#183)

## The ask

The owner, 2026-10-26, in a holistic look at the user experience with Claude, picked the lens
**Honest and fast**:

> Refine: the last read kept for the daily screens, so a slow morning shows yesterday's page
> with a stamp, not a spinner. Add: a plain line when the database is slow: "the app is slow
> right now, nothing you pressed is lost."

and asked: *"Can you build a mockup of what this could look like and present it to me."*

This is a proposal. Nothing here is built until the owner picks. Two things were respected in
drawing it: the line must be true, so *nothing you pressed is lost* can be said only where a
press is kept and retried, which is #163's queue
([`offline-field-queue`](../offline-field-queue/README.md)); and a kept read must say when it
was read and that it is being read again, and never pass as live.

## Today, read and measured

Read from the loaders and from the dev server as the dev on 2026-10-26, at 1024 wide and at the
browser pane's phone preset. The request counts are one open of each page as the dev, who sees
every card; the office sees fewer. "In a freeze" is from the code: the runbook's two modes
([`DB_FREEZE_RUNBOOK.md`](../../docs/DB_FREEZE_RUNBOOK.md)) are a lock pileup, where every read
waits and then fails with `canceling statement due to statement timeout` (code `57014`, kept
non-retryable since v2.2843), and an instance stall, where nothing answers at all.

| Screen | The first three seconds on a good day | During a freeze | Reads per open |
|---|---|---|---|
| **A cold open, any screen** | *Loading…* from the auth gate, then the page | *Loading…*; at 5 s a link to the cache-repair page (`/fix-cache.html`, v2.1051); at 8 s the auth watchdog gives up and falls through to **sign-in**. A freeze looks like a wedged cache or being signed out, and both doors make it worse | — |
| **Dashboard** (desk) | The clock row and My Schedule draw at once from the day's boot cache when the page was open in the last 60 s (`dashboardBootCache.ts`, sessionStorage); otherwise two grey bars per section (`DashboardListRowSkeleton`) that fill one by one over about 6 s | The bars pulse until each read fails. Most section hooks swallow the error (`if (error) return`), so the bars stay. The schedule hook shows a warning toast and then draws *No blocks scheduled.*, which is false | 631, of them 115 RPCs; the slowest read 4.8 s |
| **Quickfill, the Roller** (desk) | *Loading…*, then the station chips and the search box, then the Roller's first station once the day's mark events land; the count line reads *counting…* and Done and Worked it wait (v2.5868) while the station counts; Not sure stays lit | The chips draw, since they come from the registry, and under them nothing: the deck needs the mark events, so no station is chosen and the page ends at the search box. Nothing says why | 902, of them 117 RPCs; every station's hook runs at page level in every view, the slowest 7.9 s |
| **Quickfill, the round** (phone) | The nav, then a blank page for a moment, then the round list with each station's count *at last look*, the day's marks from the Mark history | Blank under the nav. The *at last look* counts, which are a kept read of a kind, never appear, since the list waits for the live events | 99, 15 RPCs, the slowest 1 s |
| **Messages** (desk and phone) | *Loading…*, then the top bar with the five lanes' counts, then *Loading who is waiting on us…* in a card until the queue lands; the lanes fill over about 10 s | The counts stay blank and the card stays. A queue read that fails prints its problem in the card | 84, 16 RPCs; the jobs ledger read 8.6 s on a good day |
| **Pipeline** (desk) | The board the device last saw paints at once with a *board from 6 h ago* chip, money muted and row buttons inert, while *Updating jobs…* runs (v2.3610); with nothing remembered, *Loading jobs…* | The remembered board stays with its chip up to 24 h, *Updating jobs…* forever; past 24 h, *Loading jobs…* forever. **This is the shape to copy** | 148, 36 RPCs, the slowest 1.1 s |
| **My Schedule** (phone, the Dashboard's card) | Clock In at once; the card's two grey bars, then today's and tomorrow's blocks | The bars, then after the schedule read fails a warning toast and *No blocks scheduled.* A crew member reads an empty day | part of the Dashboard's |
| **Job Mode** (phone) | *Loading Job Mode…* centred, then the header and the day rail | The line stays. A failed read prints *Could not load Job Mode data* | its own six reads |
| **A write** (any) | The button spins. The clock punch has a 15 s deadline (`CLOCK_PUNCH_TIMEOUT_MS`) | After 15 s: *The server is not responding. Your clock-in may or may not have saved — close this and check the timer before trying again.* The press is gone. A fetch-layer failure gets `OfflineRetryPanel`'s Retry; a server code gets a sentence by its family and no Retry | — |

Three facts shape the plan:

1. **The app already keeps a read in two places.** The Pipeline remembers its board in IndexedDB
   for 24 h with the owner's two rules from 2026-09-19 (24 h at most, money muted) and the age
   chip. The Dashboard's boot cache keeps the name and the checklist for 60 s. Quickfill's Focus
   view keeps each station's last count across a reload (`keepFocusCounts`, v2.5830) and tells
   *still loading* from *reported zero* (`focusBucket`). The phone's round reads *3 at last
   look* from the Mark history. The shape exists; it is not shared.
2. **The app already classifies every failure in one place.** `errorKindOf` and
   `classifyResultError` (v2.2843) say network, server or unknown by class, never by text, and
   `supabase.ts` already wraps the client's fetch twice (the row-cap tripwire, the in-flight write
   count). A third wrapper sees every request start and land.
3. **The daily screens make their own slow morning.** 631 reads for the Dashboard and 902 for
   Quickfill at a desk, and the slowest of them 5 to 8 s on a good day. During a lock pileup each
   open tab's hundreds of waiting reads hold connections and queue behind the lock. The runbook
   already names open tabs thrashing as a symptom. A line in the chrome does not change that;
   the argument below changes the plan for it.

## The plan

### 1 · The slow line

**How the app knows.** One kernel, `lib/appHealth.ts`, pure and tested, fed by a third fetch
wrapper in `supabase.ts` beside the two that exist. The wrapper reports each request's start and
its end: landed with a status, failed at the fetch layer, or a server code. The kernel turns
that into one of four states:

| State | The rule | Why this rule |
|---|---|---|
| **fine** | nothing waiting past the bound, or a read landed under the bound since | the default, the strip is gone |
| **slow** | some request has waited past **4 s** and **nothing has landed in those 4 s**; or a response in the last 30 s carried a freeze code: `57014` the statement timeout, `57P03`, `53xxx`, `08xxx`, `PGRST000` to `003`, or HTTP 502, 503, 504, 522, 524 | the two-part rule tells a stalled app from one slow read. On a good day the Dashboard's slowest read is 4.8 s but 600 others land around it, so the line stays off. During a pileup nothing lands and the line shows at 4 s. The statement timeout is the freeze's own signature in the runbook |
| **unreachable** | a fetch-layer failure (status 0, a `TypeError`) while the browser says online; or 20 s with something waiting and nothing at all landing | an instance stall answers nothing, so the slow rule alone would hold forever |
| **offline** | `navigator.onLine` is false | #163's state, held here so the strip has one owner and the words never contradict |

A landed read under the bound clears slow and unreachable. The strip never flickers: it stays
at least 3 s once shown. The kernel is a store with a subscribe, the shape of `unsavedWork.ts`,
so the strip and the auth gate read it without a provider.

**Where it sits.** The first row inside the nav chrome (`appNavChrome` in `Layout.tsx`), above
the nav's own row. Today the nav row pads its own top by the iPhone's status bar
(`.appNav`'s `max(var(--app-nav-pad-y), env(safe-area-inset-top))` in `index.css`), so while the
strip shows it takes that padding on itself and the nav row keeps its plain padding; the strip
then starts below the clock and the battery and the nav sits under it. The banner slot above the
chrome, where Training mode and Customer waiting draw, sits under the status bar on a Home Screen
phone, so it is the wrong slot for a line a phone must read. The strip is in flow, so it pushes
the nav down one line rather than covering it, and the window and status-bar checks
(`check:window-z`, `check:status-bar`) see no new fixed layer. One component, `AppHealthStrip.tsx`, 28 px, amber on
the surface, the same at a desk and on a phone. It is **the same strip #163's bar will use**: one
row, the health words first, the queue's count and its door after, so a phone never carries two
bars.

**Its words**, each state on a desk and on a phone in the mock-up. The sentences follow
`plainWords.ts`: one idea each, the figure in the sentence, no dash or bracket.

| State | The strip reads |
|---|---|
| slow, this page live | **The app is slow right now.** |
| slow, this page a kept read | **The app is slow right now. The page you see was read at 7:52 AM.** |
| slow, #163's queue holding every press made since | **The app is slow right now. Nothing you pressed is lost. 2 waiting to send ›** |
| slow, a press refused or held outside the queue | **The app is slow right now. 1 press needs you ›** in amber, #163's rule; *nothing you pressed is lost* is not said |
| unreachable | **Could not reach the app. Retry** with the one press; on a kept page **Could not reach the app. The page you see was read at 7:52 AM. Retry** |
| offline, #163 | **No signal. 2 waiting to send ›** |
| a dev's screen, slow for 60 s | the slow line plus **Run /db-freeze before anyone restarts.** |

**Retry** reloads the page. The shell is precached, so the reload is cheap, and a kept page
paints first. A per-page retry would need every page to expose its reads; the reload is honest
and the same everywhere.

**When it goes.** The moment a read lands under the bound. No *back to normal* line: the page
itself fills in, and on a kept page the stamp turns from *reading again…* to nothing.

**The auth gate.** The gate reads the same kernel. Past 5 s, when the kernel has seen a request
start and nothing land, the gate says *The app is slow right now. Keep this open.* and does not
offer the cache-repair link; the link stays for the case where no request could start. The 8 s
watchdog waits while the state is slow or unreachable, so a freeze no longer lands on sign-in.

### 2 · The last read kept

**The shape, lifted from the Pipeline.** `lib/jobs/boardSnapshot.ts` and `boardSnapshotStore.ts`
(v2.3610) become `lib/keptRead.ts` and `keptReadStore.ts`: one IndexedDB database
`pipetooling-kept`, one store `pages`, a key of user id, page and scope, a schema number, the
rules `buildKeptRead`, `keptReadIsUsable` (same key, every wanted scope, younger than 24 h, not
from the future), `parseKeptRead` and `describeKeptReadAge`. One hook, `useKeptRead(key, rows,
{ loading, scopes })`, writes the rendered rows after every read of the page landed and hands
back the kept rows with their `readAt` while the live read runs. The Pipeline is re-pointed at
it with no change on screen.

**What is kept.** The rendered rows, never the raw tables: the view model each page draws.
Quickfill keeps the deck's order and each station's count and next line. Messages keeps the
lanes' rows and the bar's counts. My Schedule keeps today's and tomorrow's blocks. Job Mode
keeps the day rail. The Dashboard keeps the Needs you lines, My Inbox, Assigned jobs and the
Billing pipeline's units. A read is written only once the page's reads all landed, as the board
is written after its enrichment, so a half page is never kept.

**Which screens, in order.** The phone's day first (My Schedule and Job Mode): the smallest rows,
the crews' morning, and #163's step 4 already plans it, so this to-do builds the shape and #163
uses it. Quickfill's deck and counts second, since the Roller is the office's morning and the
counts are already half kept. Messages' queue third. The Dashboard last, card by card, money
muted as the Pipeline's is. The Pipeline is done.

**How a kept page reads.** One stamp line at the top of the page, in the page's own words, in
the age chip's amber:

| Page | The stamp |
|---|---|
| Dashboard | **Read at 7:52 AM · reading again…** |
| Quickfill | **Counts from 7:52 AM · counting again…**, and the station's line *3 open at 7:52 AM* |
| Messages | **Who was waiting at 7:52 AM · reading again…** |
| My Schedule, Job Mode | **Your day as read at 7:52 AM · reading again…** |

Every figure that may be stale is muted, the Pipeline's `stagesMoney` treatment under a
`data-kept-read` attribute on the page root: money at opacity 0.42 and grey, counts at 0.55.
A press that acts on a kept row is held, inert, with the hint *reading again…*, as the board's
row buttons are: a Done press that would record a count, Take it on a message, Bill on a unit.
A press that does not depend on the row stays live: Clock In reads its own session live, Add
job, the search, Skip and Not sure on a station. When the live read fails the stamp reads
**Read at 7:52 AM · could not read again · Retry**, and the strip above says why.

**When it is thrown away.** After 24 h, the owner's rule for the board. On sign-out and on an
account switch, as `clearBoardSnapshots` runs today. When the scope changes: another customer
filter, another Show lens, another day for the schedule, since the key carries it. When the
schema number moves. A twin or an impersonated session never writes one, since the key carries
the acting user and impersonation clears the store.

**What it must never do.** Pass as live: the stamp and the muting are not optional, and the
attribute lets a test prove them. Show another person's read: the key carries the user id and
sign-out clears the store. Keep a money figure a press could act on: the figure is muted and the
press inert, like the board. Keep the clock's open session: the clock reads live, since Clock In
and Clock Out act on it. Be kept from a half-landed page.

## Is this the best we can do?

Argued against, and the plan changed where the argument won.

**A stale page misleads more than a spinner.** A stamp is read once and forgotten, and a muted
figure still gets read. True, so the kept page is never the only sign: the strip shows at 4 s
whether or not a read is kept, and on a kept page it names the time. A spinner during a freeze
also misleads, in the worse direction: it reads as a dead app, and the two doors the app offers
today, the cache-repair page and sign-in, make the morning worse. The plan keeps both signs and
adds the auth gate's change, which was not in the ask.

**The office would act on yesterday's count.** On Quickfill a Done press records the count, so
a kept 0 would write a false mark. Won: on a kept station Done and Worked it wait exactly as they
do today while counting, and only Skip, Not sure and reading are live. The kept read serves the
deck and the next lines, not the mark. The same rule holds the Dashboard's Bill and Messages'
Take it.

**A freeze needs what a line cannot give.** A dev, the runbook and `pg_terminate_backend`
within minutes. A line cannot call the dev, and during a freeze a telemetry write hangs like
every other. Won in part: the dev's own screen says *Run /db-freeze before anyone restarts* at
60 s, which costs one role check. The office's line has a different job: to keep people from
reloading, re-pressing and wiping caches, and from calling the dev about a 5 s read. The runbook
stays the dev's. Not added: an outside ping from the app, since the app is the thing that is
down.

**The fix belongs in the reads.** Largely won. 631 and 902 reads per open, with the slowest at
5 to 8 s on a good day, is a slow morning the app makes for itself, and during a pileup those
reads are part of the pile. The plan changed in two places: PR 4 makes the Roller read the
station on screen instead of running every station's hook at page level, which is both the
kept read's cheapest form and a read diet; and the Dashboard's 631 reads get a to-do of their
own rather than a kept read first, since keeping 631 reads' worth of rows is the wrong kind of
fast. Not changed: the strip, because fewer reads still freeze when the database does.

**The smallest version that still feels different.** PR 1 alone. On a slow morning every screen
says *The app is slow right now* at 4 s instead of nothing, and a cold open no longer lands on
sign-in. That is the version to ship first and the reason the train is ordered as it is.

## Decisions for the owner

1. **The bound.** 4 s with nothing landing, as proposed; or a plain 4 s on any one read, which
   would show the line most mornings on the Dashboard as the dev sees it. The recommendation is
   the two-part rule.
2. **Which screens keep a read, and in what order.** The phone's day, then Quickfill, then
   Messages, then the Dashboard card by card, as proposed; or Quickfill first for the office.
3. **The words.** *The app is slow right now.* is the owner's own line and the recommendation;
   *The database is slow* names a thing the office does not see.
4. **How long a kept read lives.** 24 h, the board's rule; or shorter for the phone's day, which
   is wrong by tomorrow. The recommendation is 24 h for every page and a key that carries the
   day for the schedule, so yesterday's day is never shown as today's.
5. **One strip or two.** One strip owned by this to-do, with #163's waiting count and its door as
   its second segment, as drawn; or #163's bar on its own. One is the recommendation, since a
   phone cannot carry two lines at the top.

## Where it plugs in

| Piece | Exists | New |
|---|---|---|
| Every request's start and end | `supabase.ts` wraps fetch for the row-cap tripwire and the in-flight write count | a third wrapper feeding the health store |
| The failure's class | `errorKindOf`, `classifyResultError` (v2.2843); the freeze codes in the retry table | the kernel reuses the classes and the code families |
| The health store | the subscribe shape of `unsavedWork.ts` | `lib/appHealth.ts`: the states, the bound, the hysteresis; tested |
| The strip | the banner slot in `Layout.tsx` above the nav; `CustomerWaitingBanner` as the precedent | `AppHealthStrip.tsx`, with a slot for #163's count |
| The auth gate | `AuthGateLoadingScreen` in `App.tsx`, the 5 s link and the 8 s watchdog in `useAuth` | the slow words, the watchdog holding while slow |
| The kept read | `lib/jobs/boardSnapshot.ts`, `boardSnapshotStore.ts`, `JobsListCacheContext.tsx`, the `data-board-snapshot` muting in `index.css` | `lib/keptRead.ts`, `keptReadStore.ts`, `useKeptRead`, `KeptReadStamp.tsx`, `[data-kept-read]` rules |
| Quickfill | `keepFocusCounts`, `focusBucket`, the Mark history's *at last look*, `markPresses` loading state | the deck and counts through the hook; the Roller's station-on-screen reads |
| Messages | `FollowUpPanel`'s queue and the top bar's counts | the queue through the hook |
| The phone's day | `useDashboardSubSchedule`, `DashboardJobModeCard` | the blocks and the rail through the hook; the schedule's failed read no longer lands as empty |
| The Dashboard | the boot cache, the skeletons | Needs you, My Inbox, Assigned jobs and the Billing pipeline through the hook, money muted |
| Words | the guide *keep working when the signal drops* is #163's | a guide *what to do when the app is slow*, plain words |

No migration. No edge function.

## The plan, as PRs

1. **PR 1, the strip and the gate** (S). `lib/appHealth.ts` and its tests, the fetch wrapper,
   `AppHealthStrip.tsx` in the banner slot, the auth gate's slow words and the watchdog's hold,
   the dev's runbook line. The guide. A release note and a fragment. Ships alone.
2. **PR 2, the shape** (M). `lib/keptRead.ts`, `keptReadStore.ts`, `useKeptRead`,
   `KeptReadStamp.tsx`, the `[data-kept-read]` rules; the Pipeline re-pointed with no change on
   screen; the strip's *The page you see was read at* sentence turned on by the stamp.
3. **PR 3, the phone's day** (M). My Schedule and Job Mode keep today's read, keyed by the day;
   the schedule's failed read shows the kept day or the strip, never *No blocks scheduled.*
   This is #163's step 4, taken here.
4. **PR 4, Quickfill** (M). The deck and each station's count and next line kept; the Roller
   runs the hooks of the station on screen and the Focus view, not every station's.
5. **PR 5, Messages** (S). The queue and the bar's counts kept.
6. **Later, with #163.** The queue's count and door join the strip; *Nothing you pressed is
   lost* turns on. The Dashboard's reads get their own to-do before its cards are kept.

## The mock-up

[`mockup.html`](./mockup.html), served at `/to-dos/honest-and-fast/mockup.html`. Every person,
job and count is made up: Marisol the assistant, Ridgeway Builders, Pruett & Vance, Cedar Bend
Holdings, Hartline Mutual. The frames: the strip in each of its states on a desk and on a phone
with #163's count on the same strip; the Dashboard and Quickfill's Roller today during a freeze
beside the same screens with the kept read and its stamp; My Schedule on a phone the same way;
and one press during a freeze, Clock In at 7:58 AM, before and after, with a press that cannot
wait beside it. Each after names what Marisol now knows that she did not.

## How to verify

On the dev server as the dev, nothing pressed that writes. To fake a freeze without touching
prod, hold the client's reads from the browser pane: wrap `window.fetch` so every `/rest/v1/`
request resolves 20 s late, then move to a page. The strip reads *The app is slow right now* at
4 s and goes when the held reads land. Reject the held requests instead and the strip reads
*Could not reach the app* with Retry. Open a page once live, hold the reads, leave and come back:
the kept page paints with its stamp, its figures muted and its row presses inert, and the strip
names the time. Sign out: the store is empty. On the phone preset the strip is one line under
the nav's top and the stamp fits on one line. A cold open with the reads held says *The app is
slow right now. Keep this open.* and never reaches sign-in.

## Where it stands

Proposed 2026-10-26. Nothing built. The number was taken in the shared notes of the day's
sessions, after #178 to #182.
