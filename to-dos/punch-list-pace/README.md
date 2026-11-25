---
name: "Punch list: the pace of the list and the merge queue, on one page"
number: 444
group: ready
status: asked 2026-11-24 · the card and the mock-up · nothing is built
summary: >
  The owner asked to see the merge queue and how fast punch-list cards are being closed. Most of it
  is already live in two places. The Burndown at the top of /punch-list counts cards opened and closed
  from the folder's own history. Settings → How fast a change ships lists the merge queue from a read
  of GitHub every 15 minutes. This card joins them on /punch-list and fills four gaps. The Burndown has
  no three-week stretch. Its sentence gives no rate a day. The queue is on another page. A change in
  the queue does not say whether its checks are running or it is ready.
next: PR 2, client only. The Burndown gains The last 21 days, its sentence gains the rate a day, and the folded line says which way the list is going.
size: M as a train of four (XS · S · S · S)
blocker: None. PR 4 redeploys one edge function after its merge.
opinion: build — the history, the read of GitHub and its token already exist, so this is three small changes to screens and one field more on a read.
---

# Punch list: the pace of the list and the merge queue, on one page (#444)

Every number in `mockup.html` is made up. The pull request titles in it are made up too.

## The ask

Asked by the owner on 2026-11-24, while working through the whole list with a managing session. The
words are paraphrased here.

- The owner wants to see the merge queue.
- The owner wants to see the rate at which punch-list cards are being closed.

The managing session wrote the ask out as four things the page should answer at a glance:

1. Open cards by day for the last three weeks, as one line.
2. Cards opened and cards closed per day, with the three-week totals.
3. One plain sentence that says which way the list is going.
4. The merge queue: each change in it, its place, whether its checks are running or it is ready, how
   long it has waited, and merges to main per hour today.

The reason behind it is a count from that day. In three weeks 183 cards were opened and 124 were
closed, so the list grew from 114 to 173.

## What is already live

This card started as a new view. A read of the page showed that most of the view exists.

**The Burndown, at the top of `/punch-list`** (`#burndown`, live since 2026-11-13).

- It replays every commit on main that changed `to-dos/` when the app is built. A card file added is a
  card opened. A card file deleted is a card closed. The README and the mock-up files never count.
- It draws the open cards hour by hour, with two lines running on to when the list clears.
- It draws new and closed cards in columns. A column is an hour, three hours, six hours or a day.
- Six tiles give the open cards, the points left, *Closed a day*, *New a day* and two clear-by days.
- A sentence opens it. On 2026-11-24 it read *173 cards are open, 792 points of work. In the last 7
  days 23 cards closed and 60 new ones came in, so the list is growing.*
- **Look at** picks the stretch: the last 24 hours, 3 days, 7 days, 14 days, or all of it.
- The deploy checks out the whole history for it (`fetch-depth: 0` in `deploy.yml`). A build with a
  cut-off clone still passes, and the section says the build read only the newest commit.

The same kernel gives the day's count. Run over three weeks it answers 183 opened, 124 closed and 114
to 173, so the page and the count agree.

**Settings → How fast a change ships** (live since 2026-11-02).

- The `ship-pace` function reads GitHub every 15 minutes with a token of its own. It writes one
  `app_settings` row, `ship_pace_v1`. The client reads that row and never calls GitHub.
- The card **In line now** lists the merge queue in the order changes go live. Each line says its
  place, how long it has waited and about how long is left.
- A line under the list counts the changes still on their checks, and the ones held by a red check.
- Four tiles count the day: opened, merged, open now, in the merge queue.
- The row holds every hour of the last three days with its merges.
- A dev can press **Read GitHub now** to read at once.

## What the ask still adds

| The ask | Live today | The gap |
|---|---|---|
| 1. Open cards for three weeks, one line | The open line, for 24 hours, 3, 7 or 14 days, or all of it | No three-week stretch |
| 2. Opened and closed per day, three-week totals | Columns of new and closed. *New a day* and *Closed a day* tiles with the stretch's totals | Day columns only on *all of it* |
| 3. A sentence that says which way | The sentence says *growing*, *shrinking* or *holding level* | It gives totals and no rate a day. Folded, the section says nothing |
| 4. The queue, its places and waits | Settings → How fast a change ships | It is not on `/punch-list`. A line does not say *checks running* or *ready*. No merges an hour today. The read is up to 15 minutes old |

## The decision

One rule decided most of it: amend what is there and add no second copy.

**Items 1 to 3 stay in the Burndown.** A second chart of the same cards on the same page would have to
agree with the first for ever. So the Burndown is amended:

- **Look at** gains **The last 21 days**. Past 14 days a column is already a whole day, so the
  three-week stretch draws opened and closed by day with no new chart.
- The sentence gains the rate a day: *In the last 7 days 60 new cards came in and 23 closed. That is
  8.6 new and 3.3 closed a day, so the list is growing by 5.3 a day.*
- The folded section says the direction too: *173 open · 792 points · growing by 5.3 a day*.
- The device remembers the stretch picked, as it remembers **Hide the burndown**.

**Item 4 is a block on `/punch-list` that reads the row the app already has.** The choices:

| Choice | For | Against |
|---|---|---|
| **A. Read the `ship_pace_v1` row** (picked) | No new function, token, table or migration. The queue's rules and words are written and tested. One read of GitHub feeds two screens, so they cannot disagree | The row is up to 15 minutes old |
| B. A new function that reads the queue and caches a minute | Fresh to the minute | A second reader of the same queue with its own token and its own rules. `ship-pace` is that function already |
| C. A snapshot taken at build time | No read at all | The queue turns over in minutes and a build is hours old. It would be wrong nearly always |
| D. A link to GitHub's queue page | Free | It leaves the app and needs a GitHub login. It does not answer at a glance |

The age is the one cost of A, and it has two cheap answers. Both are in the plan.

- The block says how old its read is, in the words the Settings tab uses: *As of 2:41 PM*.
- When a dev opens the page and the row is over five minutes old, the page asks for one read. It asks
  once per opening and never on a timer. **Read GitHub now** stays as a press. A master reads the row
  as the cron left it, since the function answers a dev alone.

**Each line gains its state.** GitHub gives every entry of the queue one of five states. The function
reads four facts an entry today, and the state is a fifth on the same query.

| GitHub's state | The words on the line |
|---|---|
| `AWAITING_CHECKS` | Checks running |
| `MERGEABLE` | Ready |
| `QUEUED` | Waiting its turn |
| `LOCKED` | Merging now |
| `UNMERGEABLE` | Will not merge |

The queue read on 2026-11-24 while this card was written held five changes: four `AWAITING_CHECKS` and
one `MERGEABLE`.

**Merges an hour today** is drawn from the row, which holds each hour's merges: a small column for
each hour of the day, with **Merged today** and **In the last hour** beside it. One average for the
day would be dragged down by the night, so no average is shown. The merge queue is the only way onto
main, so a merged pull request is a merge to main.

**Where the block sits.** Above the Burndown, under the page's opening lines. The queue is short, at
most ten lines, and the Burndown is long. Under the Burndown it would sit two screens down.

## Not picked

- **Opened and closed side by side.** The ask said *side by side*. The Burndown draws new above a line
  and closed below it, and that drawing is the one the owner asked for on 2026-11-12. One chart with
  day columns answers the question. Say the word and the columns stand side by side instead.
- **A separate Pace page.** The punch list is a view of the repo, and the pace is a fact about the
  list. It belongs on the list's page.
- **A faster cron.** Every five minutes is three times the reads for a screen few people open. The
  read on opening serves the person who is looking.

## Where it plugs in

Exists:

- `src/lib/todos/punchListHistory.ts`: the Burndown's rules. `BURNDOWN_RANGES`, `paceOver`,
  `takeawayWords`, `waveHours`.
- `scripts/todos/readTodoHistory.ts` and `todoHistoryPlugin` in `vite.config.ts`: the replay of git.
- `src/components/punchList/PunchListBurndown.tsx`: the section.
- `supabase/functions/_shared/shipPace.ts`: the queue's rules and words, shared by the function and
  the client. `paceQueue`, `queueLineWords`, `queueTitleWords`, `queueBucketsWords`, `paceAsOfWords`.
- `supabase/functions/ship-pace/index.ts`: the read of GitHub (`readQueue`).
- `src/lib/settings/shipPaceIo.ts`: the client's read of the row, and a dev's **Read GitHub now**.
- `src/components/settings/SettingsShipPaceSection.tsx`: **In line now** on the Settings tab.

New:

- PR 2: a `21d` stretch, the rate in `takeawayWords`, a `foldedWords` for the folded line.
- PR 3: `src/components/punchList/PunchListQueue.tsx` and a small kernel for merges an hour today.
- PR 4: `state` on `PaceQueueEntryInput` and `PaceQueueEntry`, and `queueStateWords`.

## The plan

1. **PR 1, docs only.** This card and `mockup.html`.
2. **PR 2, client only (S).** The Burndown: **The last 21 days**, the rate a day in the sentence, the
   direction on the folded line, the stretch remembered on the device. Kernel tests, the render smoke,
   the guide *work the punch list*.
3. **PR 3, client only (S).** **In the merge queue** on `/punch-list`, from the row: the line, merges
   an hour today, the as-of words, one read on opening for a dev, **Hide the queue**. An empty queue
   says *Nothing waiting on the queue.* A read that fails offers Retry. The guide again.
4. **PR 4, one edge function (S).** `ship-pace` reads each entry's state. The kernel carries it and
   both screens draw it. `ship-pace` is redeployed after the merge. A row written before the redeploy
   has no state, and its lines draw without the chip.

## How to verify

- **PR 2.** Open `/punch-list` as a dev. Pick **The last 21 days** under **Look at**. The columns of
  *New and closed* are whole days, and the tiles' totals are three weeks. Press **Hide the burndown**.
  The one line left says which way the list is going.
- **PR 3.** Open `/punch-list` as a dev. **In the merge queue** lists the same changes, in the same
  order, as Settings → How fast a change ships. Count the page's requests after it opens: one read of
  the row and at most one call to `ship-pace`.
- **PR 4.** After the redeploy, press **Read GitHub now**. Each line carries its state. Compare one
  line with the queue page on GitHub.

Nothing here writes a row a person made. The one write is the function's own row.

## Where it stands

- 2026-11-24: the card and the mock-up. Nothing is built.
