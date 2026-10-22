---
name: "Robot rounds: the robots watch from the Mac Mini and say where they are every five minutes"
number: 142
group: ready
status: proposed 2026-10-21, third pass (the ring on the icon, the owner's ask after the second); nothing built
summary: >
  The owner wants a loop on his home Mac Mini that watches ClickTooling for work it can do, starting
  with bidding and pricing, and that tells the app every five minutes where it is, like a slow
  loading bar. Most of the loop exists: the robot estimator, its dispatcher, the hourly weekday
  routine, the heartbeat verb and the stage stamps every pipeline verb already writes. What is new
  is small: the rounds run every five minutes all day from a key that names the Mac, the heartbeat
  grows a plain-words shape and a five-minute rule, one reader turns the robot's own stamps into a
  seven-step bar an estimator can see on the bid, the Bid Board's robot icon becomes a ring that
  fills one segment per step so the stage reads at a glance, silence has a meaning and a door, and a
  press on the app reaches the Mac on its next signal. No new lens, no new table, one migration.
next: The owner's three open calls below, then PR 1. The round's cadence is decided: five minutes.
size: M as a train of five (S S M S S); one migration, one edge redeploy per PR
blocker: none
ver: proposed
opinion: build — the rounds are the routine that already ran on the operator machine, moved to a Mac that stays on; the signal is the robot's own stamps read back in plain words, so the estimator stops guessing between "queued" and "sealed"; and silence finally has a meaning, which is what a loop nobody watches needs most.
mockup: to-dos/robot-rounds/mockup.html
---

# Robot rounds (#142)

## The ask, in the owner's words

Robert, 2026-10-21, on the Bids page:

> My idea is that I sign in with this account on my home Mac Mini and have it run a loop where it
> is always watching for data on click tooling that it can action on. It's kind of like the web
> page's assistant, and its job is to be helpful. I think the first way it can be helpful is by
> bidding and pricing jobs. This currently exists already and maybe it is as simple as continuing
> what I have built, but I would like a small update if we're going to do that. I would like every
> five minutes for there to be a signal sent to click tooling of its progress so that a user can
> know what is happening in the background and not just when it is done. Kind of like a loading
> bar, but at a much slower pace.

And: *come up with a mock-up of what this could look like and ask yourself holistically is this
the right move? And then refine the mock-up and then ask yourself is this the best we can do? Do
we educate the user as well as we can?*

And, on the second pass the same day: *On the bid board robot icons, I would like to see a circle
that completes to 100 percent, so at a glance a user can see what stage or percent it's on, and
still click on it to see more.* That is the third pass, decision 3b.

Two asks in one. A **loop that stays up** on a machine that stays on, working the robots' queues
without a person pasting a kickoff. And a **signal while it works**, read by the people who wonder
where a bid's robot is, not only by the dev who runs the fleet.

## What exists today, and what the Mac Mini would reuse

Read 2026-10-21. The loop the owner describes is most of the way built; the signal is half built
and shown to the wrong audience.

| Piece | Where | What it does today | Reused or new |
|---|---|---|---|
| The robot estimator | `twin-estimator-1`, the `/bid` skill, `docs/twins/kickoffs/code-operator.md` | Claims one live plumbing bid at a time from the dispatcher, reads the plans itself, seals a blind number, asks its questions, files a report. Stops after three bids a session; two sessions at once at most. | reused whole |
| The dispatcher | `next_shadow`, `next_price_matrix`, `next_submittal_task` in `supabase/functions/twin-mcp/index.ts` | The `twin_shadow_runs` row is the claim, so two sessions never get the same bid. A shell another session touched in the last 60 minutes is left alone. | reused; the 60 minutes become 15 once the signal is every 5 |
| The hourly routine | `docs/twins/kickoffs/shadow-operator.md`; `LEARNING_PLAN.md` item 3 | A Claude Code routine, `15 7-18 * * 1-5`, on a repo checkout: read the queue, launch up to two robots, report. Live on the operator machine since 2026-09-06. Runs while the Claude app is open. | reused as the shape of a round; moved to the Mac Mini |
| Set up on this Mac | Console → Run the robots; `twin-setup` | One Terminal command mints a key labelled with whose Mac it is and writes it into Claude's config. The key is the machine. | reused; the label becomes the round's name |
| The heartbeat | `heartbeat` verb → a `twin_runs` row with `bid_id`, `stage`, `state` working, blocked or done, a 400-character note | The kickoff says: send one when you start, when you block, when you finish. `get_work_state` returns `latest_heartbeat`. | widened: a shape, a fifth state, a five-minute rule, the Mac that sent it |
| The stage stamps | `add_bid_note` and every pipeline verb write `[STG-0]` … `[STG-3..5 + LOCK]`, `[pricer STG-n]` on the shell's ledger (`bids_submission_entries`) | The robot's own record of each step, written whether or not it remembers to heartbeat. | reused as the bar's truth |
| The run ledger | Console → Recent runs (`TwinRunsLedger`, `twinConsoleDisplay.ts`) | PULSE and BLOCKED chips, 15 newest rows. `twin_runs` is readable by devs only (`twin_runs_select_dev`). | reused for devs; a reader for everyone else |
| The bid's robot icon and status sheet | `robotRowState.ts`, `robotStatusTimeline`, `RobotStatusSheet.tsx` | Five steps: picks it up, reads and counts, seals, you send, scored. While working it says *In progress, its counts land on the robot bid as it goes.* | the home of the progress |
| The Robot Board row | `robotMirror.ts` `mirrorStatusLabel` | *queued · next weekday batch*, *estimating · counting in CountTooling*. | the row's sub-line becomes live |
| The pricing robot's and submittal robot's heartbeats | `bid_price_matrix_requests.heartbeat_at`, `bid_submittal_tasks.heartbeat_at`; `robotBacklog.ts` | A matrix working with no heartbeat for over an hour turns the devs' *Robots have work waiting* card amber. | the rule's shape, reused for bids |
| A robot's liveness for the office | `submittal_robot_liveness()` | A SECURITY DEFINER reader: how many unrevoked seats, the newest `last_used_at`. `last_used_at` is stamped by `twin-login` only, a sign-in, not by a verb. | the reader's shape; the stamp moves to every verb |
| Needs You | `dashboardNeedsYou.ts` | Devs: *Robots have work waiting*. Estimators and devs: *N robot bids are waiting on your audit*. | two items added, only when a person is needed |
| The fence | `apply_digital_twin_write_blocks`, the no-send trigger, the seat gate, rung 2 | A robot writes only its own shells. Nothing leaves the app by a robot's hand. | reused as the answer to "what will it touch" |

**New, in one line each:** rounds every five minutes all day from the Mac Mini's key; the heartbeat's
shape and cadence; one reader, `robot_progress()`, that any bid role may call and that never
carries a dollar figure; the bar on the bid, the live row, the Console's Rounds card, two Needs You
items; a pause and a stop that the Mac reads on its next signal; the words.

## The decisions

### 1. Where the loop lives: the Mac Mini first, the cloud when it earns it

**Alternatives.**

- *A. A cloud cron.* Claude's scheduled cloud agents, or a GitHub Action, call the dispatcher on a
  timer. No sleeping Mac, no stale sign-in. But a robot run reads 30 plan sheets as files, renders
  closer looks, and runs an hour. That is a Claude Code session with a disk, which the cloud
  routine can be, at a cost per round the owner has not priced, and the plan-reading path has been
  proven only on a Mac.
- *B. The owner's Mac Mini.* The Claude app, the connector from **Set up on this Mac**, and a
  routine, exactly the operator machine's shape since 2026-09-06, on a machine whose only job is
  this. Risks: the Mac sleeps, the app is closed, the Claude sign-in lapses, and nobody notices.

**Recommendation: B, with the risk named on the screen.** Every piece of B exists. The signal is
designed so that the host does not matter: it carries the key's label, and a cloud round would
carry its own. If the Mac proves flaky, the same kickoff runs in the cloud and the app changes
nothing. What B needs that the cloud would not is a **quiet detector** (decision 4), because a Mac
fails silently.

**Setup on the Mac Mini, in order:** System Settings → Energy, never sleep, and open at login;
sign in to the Claude app with the owner's own Anthropic account; press **Set up on this Mac** on
the Console, label *Robert's Mac Mini*; press **Copy rounds kickoff** and paste it into a Claude
Code session on that Mac. The paste makes the routine and runs it once (decision 7). The key is
minted on the server and never shown; the owner's app account is only the harness. The twin's
writes are fenced by the key, not by whose Mac it is.

**Every five minutes, and the overlap rule that makes it cheap.** The owner's call (2026-10-21):
fifteen minutes is too slow. A round every five minutes means a bid filed at 2:03 is picked up by
2:05 and *front of the line* is near instant. A bid takes about an hour, so most rounds will wake
while an earlier round of the same key still holds one. The rule: a round's first call is its idle
heartbeat, and the reply says whether this key already has a round on a bid. If two do, the round
leaves at once, before it reads a guide or opens the queue, so an idle round costs seconds. If
fewer than two do, it claims one and works it to the lock. The clock is five minutes; the work is
one bid at a time, two at most, per Mac. Idle rounds collapse to one ledger row a day, so 288
rounds leave one line. The cost that remains is the owner's Claude plan, one short session every
five minutes; the kickoff keeps the idle path to one call so that stays small.

### 2. The signal: widen `heartbeat`, do not add a verb or a table

**Alternatives.**

- *A. A new `progress` verb and a `twin_progress` table.* Clean, and a second thing the robot must
  remember to call, a second table with its own policies, a second reader.
- *B. Widen `heartbeat`.* It already takes bid, stage, state and a note and lands in `twin_runs`
  with a time. It grows: a fifth state `idle` for a round that found nothing; `credential_id`,
  which Mac said it; and a `progress` object in plain shape: `step` (one of seven), `read` (*12 of
  31 sheets*), `wrote` (*its copy's ledger, 2 notes*), `waiting_on` (null, or *a person: the plans
  ask on b511*), `next` (*counting*), `eta_min` (optional). The kickoff's rule becomes: **send one
  when you start, every five minutes while you work, when you block, when you finish, and once
  per round with nothing to do.** Consecutive `idle` rows from one key collapse into one row whose
  `ended_at` moves, so a day of rounds is one line, not 96.

**Recommendation: B.** One verb, one ledger, one rule. And the bar does not depend on the robot
remembering: twin-mcp stamps `twin_credentials.last_seen_at` on every verb, throttled to once a
minute per key, and the step comes from the stage stamps the verbs write anyway. The heartbeat
adds the detail inside a step and the reason it waits. A robot that forgets to heartbeat still
shows as alive and on the right step; it only loses *12 of 31*.

**Blindness holds.** A heartbeat on a sealed shadow goes through `scrubMoney`
(`_shared/twinQuestionShape.ts`, the same scrub the questions get), so a note with a running total
lands as *[amount withheld]*. The reader selects no `locked_total`, no `bid_value`.

### 3. Where the progress shows: on the bid, from one reader

**Alternatives.**

- *A. A new Rounds lens on the Bids page.* A place to look, and a place nobody looks until told.
- *B. The surfaces that already answer "where is the robot on this bid".* The Bid Board's robot
  icon and its status sheet, the Robot Board row, the Robots lenses' caption, and the dev Console.

**Recommendation: B.** One reader, `robot_progress(bid_ids uuid[] default null)`, SECURITY
DEFINER, callable by the bid roles (`ROBOT_AUDIT_ROLES`: dev, master, assistant, controller,
estimator), returning per key its label, `last_seen_at`, state and current bid, and per asked bid
the latest heartbeat's words and the step from the shell's stamps. One kernel,
`src/lib/bids/robotProgress.ts`, turns a row into the words and the bar, so four surfaces can never
disagree.

- **The bid's robot status sheet** (estimators): the *Reads the plans, counts, and prices* step
  opens into a seven-step bar with the lit step and its detail, the last-word time, and the Mac.
  Below it, a fold, **What the robot touches**, with the four sentences from decision 6.
- **The Bid Board's robot icon** becomes a **ring** (decision 3b): seven segments, one per step,
  filled as the robot passes them, the glyph it has today at the centre. The tooltip says the step in
  words: *Step 3 of 7. Reading the sheets, 12 of 31. Last word 2 minutes ago.* A tap opens the sheet
  as today.
- **The Robot Board row**: *estimating · reading the sheets, 12 of 31 · 2 min ago*.
- **The Robots lenses' caption** gains one sentence: *The robots make a round every five minutes
  from Robert's Mac Mini. Last round 2:35 PM.*
- **The Console** gains a **Rounds** card at the top: one row per key that has checked in within
  seven days, with the robot's status light and word, when it last checked in, what it has in hand,
  what it finished recently, and the presses in decision 5 (decision 8 has the whole row). Under
  it, the current bid's signals in order, oldest first, which is the slow loading bar's history and
  the *Read the run* door.
- **The Dashboard** says nothing while all is well. It speaks in decision 4.

**The bar is seven named steps, not a percent of time.** Picked it up · Plans filed · Reading the
sheets · Counting · Pricing · Sealed · Questions for you. A percent of minutes would promise a pace
nobody knows. The sheet says *Most bids take about an hour* only once ten runs have stamped their
LOCK, from the median of start to lock in `twin_runs`. The ring (3b) is the same seven steps drawn
round the icon, so its fill is a percent of steps, which is honest, and never a percent of minutes.

### 3b. The ring on the icon: a circle that fills one segment per step

The owner's third-pass ask: a circle on the Bid Board's robot icon that completes to 100 percent,
so the stage reads at a glance, and the icon still opens the sheet.

**Alternatives.**

- *A. A ring that fills with time.* Elapsed minutes over the median run. Smooth, and a guess: a
  31-sheet set and a 9-sheet set would show the same fill at the same minute, and the ring would
  sit at 100 percent while the robot was still counting.
- *B. A ring of seven segments, one per step, filled as the stamps land.* The fill is steps done
  of seven. The segment the robot is on fills by the signal's inside-step count when it has one
  (12 of 31 sheets read fills the third segment 39 percent) and pulses when it has none. The gaps
  between segments are the stage marks, so a glance reads *third of seven* without a number.
- *C. B, with the segments weighted by the median minutes each step takes.* A truer loading bar,
  once ten runs have locked and the medians exist. Not the first cut: it changes the segments'
  lengths, not their meaning, and the ring from B upgrades in place.

**Recommendation: B, with C named as the later upgrade.** The ring is the bar from decision 3 drawn
round the glyph the row already has, from the same reader and kernel, so the icon, the sheet and
the Robot Board row can never disagree. A person who learns the ring on the board recognises the
bar on the sheet, and the other way round.

**The ring in each state of the icon** (`robotRowState` already names them):

| State | The ring | The centre | The tooltip |
|---|---|---|---|
| queued | seven empty segments, gray | the robot, as today | *Queued. The next round is within five minutes.* |
| working | the done segments blue, the current one filling or pulsing | the robot | *Step 3 of 7. Reading the sheets, 12 of 31. Last word 2 minutes ago.* |
| quiet | the same fill, amber | the robot | *Quiet since 2:41 PM. Another round picks it up within ten minutes.* |
| needs | seven empty segments, amber | **!** as today | *Needs something from you. Tap to see what.* |
| sealed | full, green | the lock, as today | *Sealed. Its number shows when you send.* |
| scored | full, green | the check, the delta beside it as today | *Scored. Tap to compare.* |
| off, none, grade | no ring | as today | as today |

**Size and touch.** The icon is 22 px today. The ring is 28 px outside, a 3 px band, the glyph 20 px
inside it, and the tap target stays the row's 44 px cell. The seven gaps are 2.5 degrees each, so a
segment is still a segment at 28 px. The ring is one component, `RobotRing`, drawn by CSS conic
gradients, no SVG per row, and it carries the tooltip words as its label for a screen reader.

**Where the ring draws.** The Bid Board's robot icon (desktop and the phone board), the Robot Board
row's Robot cell, and the status sheet's header, so the sheet opens on the ring the person tapped.
The Rounds card uses the words, not the ring.

### 4. What silence means: a quiet robot and a sleeping Mac are two different facts

Two clocks, each read from `last_seen_at` and the latest heartbeat.

- **Quiet on a bid.** A shell open and unlocked, and no verb from that key for ten minutes. The
  sheet reads *The robot went quiet on this bid at 2:41 PM. Another round picks it up within ten
  minutes.* Amber. Nothing for a person to do yet. The dispatcher's orphan rule tightens from 60
  minutes to 15: with a signal every five, fifteen minutes of nothing is a dead session, not a
  slow one, and the round after that claims it.
- **Asleep.** No round from a key for 15 minutes inside its hours, three rounds missed. The
  caption reads *No round from Robert's Mac Mini since 2:35 PM.* Gray. A Needs You item for the owner and devs: **The
  robots have not made a round since 2:35 PM**, detail *Robert's Mac Mini is asleep, or Claude is
  closed on it. Wake it and open Claude. The rounds start again on their own.*, action *Open the
  Console*. Snooze and dismiss as the backlog item has.
- **Blocked.** The heartbeat says `blocked` and names what it waits on. A Needs You item for the
  people who can clear it: a plans ask reaches the estimator as it does today (`kind: 'plans'`,
  the robot needs sheet); a machine problem reaches the devs as an operator question. The signal
  adds the bid's sheet line: *Waiting on you: the plans. Open the robot needs sheet.*

Two kinds of silence, two owners. An estimator never hears about the Mac; the owner never hears
about a slow sheet.

### 5. What a person can press, and how a press reaches a Mac

A Mac behind a home router cannot be told anything. It can ask. So every press is a flag the Mac
reads in the reply to its next signal, within five minutes, and the button says so.

| Press | Where | Who | What it does | What the button says |
|---|---|---|---|---|
| **Read the run** | the bid's sheet, the Robot Board row, the Console | bid roles | Opens the bid's signals, oldest first, with the stamps between them | *Read the run* |
| **Leave this one to me** | the bid's sheet | estimator and up | Sets `robot_opt_out` on the bid, the tick the bid form already has, and voids the open shell on the next signal. The row leaves the queue and the coverage count. | *Leave this one to me · the robot stops within five minutes* |
| **Stop after this bid** | the Console's Rounds card | owner and devs | `twin_credentials.stop_after_bid = true`; the round finishes the shell it holds, locks it, reports, and makes no more claims until the flag is cleared | *Stop after this bid* |
| **Pause the rounds** | the Console's Rounds card | owner and devs | `paused_until` set to a chosen time or until pressed again; a round that wakes paused sends one idle heartbeat and leaves | *Pause the rounds · until 6 PM* |
| **Set up on this Mac** | the Console, as today | devs | Mints the Mac's key | unchanged |

Not a press: *Take over*. A shadow is the robot's own blind copy. Nobody continues it; a person
either lets it finish or tells it to leave the bid alone. The owner's word *take over* is *Leave
this one to me*.

The reply to `heartbeat` grows one field, `orders`: `carry on`, `stop after this bid`, `pause
until <time>`, `leave <bid>`. The round obeys and says so in its next heartbeat, so the Console's
row changes from *stopping after b511* to *stopped* on the robot's word, not the button's.

### 6. What the rounds may touch, and what they are called

**The rounds' to-do list is three queues people fill, and nothing else.** The shadow queue
(every live plumbing bid with readable plans, since v2.2936, and a bid a person put at the front
of the line); the price-matrix requests (a person pressed *Price it with the robot*); the submittal
tasks (a person pressed *Ask the robot*). In that order, oldest first. The round never adds to the
list. "Always watching for data it can action on" is a watch over those three queues; widening it
to another role's work is an owner decision on the locked list in `DIGITAL_TWINS_PLAN.md`.

**The four sentences a person reads, on the bid and in the guide:**

> The robot reads the plans and works on its own copy of the bid. It never edits your bid. It
> never sends anything to anyone. Its number stays sealed until you send yours.

**The name.** The owner said *assistant* and *helper*. Both are role names in this app, so neither
can be the loop's. The people who do the work stay **the robots**, the word every screen already
uses. The loop is **the rounds**: *the robots make a round every five minutes*. A round is one pass
over the three queues from one Mac. Nothing on a screen says *loop*, *Mac Mini* or *heartbeat*
except the key's label the owner typed.

### 7. Starting the rounds stays one press, in the place a dev already presses

The owner's check: *is it still as easy as before for a dev to copy the prompt they need to set
this loop in motion?* Today a dev presses **Set up on this Mac** once and **Copy Code kickoff** per
batch, both on the Console's *Run the robots* card, and reads the prompt first through *Preview*.
The rounds keep that shape exactly and add one row.

- **One more row on the same card.** *Run the robots* → the Claude Code column gains a row between
  *Start a batch* and *Hand shadow coverage to someone*: **Make this Mac the rounds**, with a
  **Copy rounds kickoff** button and a *Preview the rounds kickoff* link under it, as the other
  three rows have. The three rows that exist do not move or change.
- **One paste does everything.** The copied kickoff opens the way `code-operator.md` does, *run
  this now*, and tells the Code session to make the routine itself: the name **Robot rounds**, the
  schedule (every five minutes, all day), the round's prompt verbatim, and one run now so the tool
  approvals are saved. Today's shadow handoff asks the person to create the
  routine by hand from a cron line; the rounds kickoff does not. The Mac's three settings (never
  sleep, open at login, the Claude sign-in) are the first lines of the prompt, as a checklist the
  session reads back to the person, so nobody opens a doc to find them.
- **The setup command can carry it.** The **Set up on this Mac** dialog gains one tick, *This Mac
  makes the rounds*. With it on, the Terminal command puts the rounds kickoff on the clipboard
  instead of the batch kickoff when it reopens Claude, so a fresh Mac is two presses and one paste:
  set up, tick, paste. The dialog's words change by one line.
- **The Rounds card is a door too.** When no key has made a round in seven days, the card's only
  row reads *No Mac makes the rounds yet. Copy the rounds kickoff and paste it into Claude Code on
  the Mac that will.* with the same button, so a dev who lands on the card first is not sent to
  another card.
- **Nothing about the key changes.** The rounds use the key **Set up on this Mac** minted; there
  is no second key, no second connector, no new allow rule. A dev who already set up the Mac for
  batches pastes the rounds kickoff and is done.

The kickoff is one markdown file, `docs/twins/kickoffs/rounds-operator.md`, copied whole with the
connector filled in, the way the other three are, so the Console's button and the doc can never
drift. `scripts/build-twin-mcp-briefs.mjs` bundles it with the rest.

### 8. The robots' status on the Console: alive, last check-in, what it worked on

The owner's ask, after the third pass: *on the Robot Console I think it would be important to see
a signal of the status of the agent, if it is alive, its last check-in and what it worked on
recently.* Thought through against what the ledger already holds.

**What answers each question today, and what is missing.**

| Question | What exists | What is missing |
|---|---|---|
| Is it alive? | The fleet strip reads `twin_credentials.last_used_at`, stamped by `twin-login` at sign-in only. The Recent runs ledger shows the newest 15 rows across every robot. | A per-key last call. A robot that fell silent is invisible by omission: nothing on the page says *not heard from*. |
| When did it last check in? | A heartbeat at start, block and done. | A cadence, and the row that shows the latest one per key. PR 1 gives the cadence. |
| What did it work on? | `twin_runs` reports (`report:SHADOW-b2041`), `twin_shadow_runs` locks and scores, `bid_price_matrix_requests` finished by a twin, `bid_submittal_tasks` finished by a twin. | Nothing joins them per robot in time order, and nothing says it in words. |

**The row, one per key.** A key is a seat on a Mac, so *Twin Estimator 1 on Robert's Mac Mini*
and *Twin Pricer 1 on Robert's Mac Mini* are two rows, and a second Mac is a third.

- **The light and the word**, never colour alone: **Alive** (green: checked in within seven
  minutes, the five-minute round plus two of grace), **Quiet** (amber: seven to fifteen), **Asleep**
  (gray: over fifteen, three rounds missed), **Paused until 6 PM**, **Stopping after b511**, and
  **Never checked in** for a key minted and not yet used. Computed at read time from
  `last_seen_at` and the two flags; nothing is stored.
- **Checked in 2 minutes ago**, the exact time on hover. For an asleep key, *Last check-in Fri
  5:12 PM*.
- **Now**: the latest heartbeat's words for that key, *Reading the sheets on b511, 12 of 31, since
  2:04 PM*, or *Nothing in hand*.
- **Recently**: the last five things the robot finished, newest first, each with its time and a
  door. *Sealed b2038 for b509 Cedar Park Vet Clinic. Asked 2 questions.* opens the bid's robot
  sheet. *Matrix ready for b503, 2 asks.* opens the Pricing tab. *Filed 6 cut sheets on b498.*
  opens Submittals. *Parked b2035 for b507. Waiting on the plans.* opens the robot needs sheet.
  Open on the first row, folded to its newest line on the rest.
- **Today**: *1 bid sealed, 1 parked. 88 rounds found nothing to do.*
- The two presses from decision 5.

Finished work is stamped with the robot's user, not the key, so **Recently** is the robot's and
shows on every key of that robot; **Now** and the check-in are the key's, because PR 1 stamps
`credential_id` on each heartbeat. Two Macs on one seat would show the same Recently list twice,
which is true.

**How to build it.**

1. **Reader `robot_agents()`**, SECURITY DEFINER, devs only because it names keys. Per unrevoked
   key: the label, the robot's name and `twin_kind`, `last_seen_at`, `paused_until`,
   `stop_after_bid`, the latest heartbeat row for that `credential_id`, and `recent`: a UNION of the
   robot's finished work in the last seven days, newest five, each as `{kind, at, bid, shadow,
   count}`: reports, shadow locks and scores, matrices with their status and asks, submittal tasks
   with their kind and rows written. One call returns the card.
2. **Kernel `src/lib/bids/robotAgents.ts`**, pure: `agentState(row, now)` gives the tone, the word
   and the check-in sentence; `ROBOT_ALIVE_MS` (7 min) and `ROBOT_ASLEEP_MS` (15 min) sit beside
   `ROBOT_BACKLOG_HEARTBEAT_STALE_MS`; `recentWorkLine(item)` gives the words and the door;
   `todayLine(items, idleRounds)`. Tests: each state, the minute either side of each threshold, a
   paused and a stopping key, a never-used key, every kind of recent line, and the words through
   `plainWordsFailures`.
3. **`useRobotAgents()`**: the RPC on mount and every 30 seconds while the Console is mounted,
   paused while the tab is hidden. Status is the point of the card, so it does not wait for a
   reload.
4. **`TwinRoundsCard`**: the rows, the light as a dot with the word beside it, the folds, the
   doors, the presses. The Recent runs ledger stays below it as the raw ledger, idle rows collapsed.
5. **The estimators' line** reads the same thresholds through `robot_progress()`, which names no
   key: the lenses' caption says *The robots checked in 2 minutes ago.*

**The two-key fact, and what it does to the rounds.** The setup command writes one connector
entry, `twin-mcp`, whichever seat's key it carries, so a Mac today holds one seat at a time and a
pricer key is refused every bid verb. A round that covers prices as well as bids needs both keys on
the Mac. PR 5's tick writes the pricer's key under its own name, `twin-pricer-mcp`, and the rounds
kickoff says which connector each queue uses. Until that lands, the rounds cover the shadow queue
and the submittal tasks, which both answer to the estimator's key, and the pricer keeps its own
kickoff. The Console shows one row per key either way, so the owner sees at once which seats the
Mac holds.

## Holistically, is this the right move?

**Yes, as the next step of what is built, and no, as a new thing.** The owner's loop is the
operator machine's hourly routine on a Mac that stays on, with the hours widened. That part is a
kickoff file and an afternoon on the Mac. The part worth building is the signal, and it is worth
building because the program's bottleneck is people, not robots: 31 audits waited a month (#66)
while the estimators could not tell a queued robot from a working one from a dead one. A bar that
says *reading the sheets, 12 of 31, two minutes ago* turns the robot from a thing that happens to
a bid into a colleague whose progress you can glance at, and silence into a fact with a door.

**The risks, answered.**

- *A stale session on the Mac.* The robot's authority is its key, minted by **Set up on this
  Mac**, never the owner's app sign-in. A lapsed Claude sign-in stops the rounds and nothing else;
  the asleep detector says so within 15 minutes, to the owner, with the fix in the sentence.
- *Two robots on one bid.* Already impossible: the `twin_shadow_runs` row is the claim, and
  `next_shadow` never hands two sessions one bid. The signal makes the orphan rule honest at 15
  minutes instead of 60, so a Code session someone starts beside the rounds waits less.
- *Writes the owner did not ask for.* The fence holds a robot to its own shells; the no-send
  trigger holds everyone's robots off customers; the seat gate keeps the pricer off bids. The
  rounds add no write. The new columns are on the robot's own tables, and the two presses write a
  flag the owner or a dev set.
- *The robot forgets to signal.* Then the bar still moves on the verbs' stamps, and *last word*
  reads from the once-a-minute `last_seen_at`. Only the *12 of 31* goes missing.
- *The Dashboard turns into a ticker.* It does not. Progress lives on the bid; the Dashboard
  speaks for a sleeping Mac or a blocked robot, with snooze.
- *Cost.* One heartbeat every five minutes on a one-hour bid is twelve rows. A day of idle rounds
  is one row. The reader is one function. The routine's cost is the owner's Claude plan, which the
  hourly routine already spends.

**What would make it the wrong move:** building the Mac into the app. Nothing here knows a Mac
exists; it knows a key with a label and a time it last spoke. That is what lets the cloud take
over without a release.

## The mock-up

[`mockup.html`](./mockup.html), light and dark on `src/index.css`'s tokens, every name and number
made up (the GC is *Ridgeway Builders*, the jobs are *Oak Hollow Dental* and *Cedar Park Vet
Clinic*, the Mac is *Robert's Mac Mini*, today is Tue Oct 21, 2026, 2:38 PM):

1. **The bid**: the Bid Board rows' robot icons as rings, a key of the ring in every state, the
   tooltip, and the robot status sheet with the seven-step bar lit at *Reading the sheets*, the
   last word, the fold **What the robot touches**, and the two presses. The same sheet at phone
   width.
2. **The Robot Board row and the lenses' caption**: the live sub-line, the round sentence.
3. **The Console**: the *Run the robots* card's Claude Code column with its one new row and
   button; the Rounds card with one row per key, the estimator alive on b511, the pricer alive with
   nothing in hand, a second Mac asleep, each with its check-in, its Now and its Recently list,
   **Stop after this bid** and **Pause the rounds**; *Read the run* with the bid's signals oldest
   first; and the Rounds card's empty state with the same button.
4. **Silence**: the same line in its three states, alive, quiet, asleep, and the two Needs You
   items with their words and doors.
5. **The signal**: what one heartbeat carries, field by field, and the words each becomes.
6. **The second pass**: what changed from the first draft, in the house's five lenses.

## The plan

**PR 1 · The heartbeat grows (S, migration, edge).** Migration: `twin_runs.state` CHECK admits
`idle`; `twin_runs` gains `credential_id uuid` and `progress jsonb`; `twin_credentials` gains
`last_seen_at`, `paused_until`, `stop_after_bid`; an index on `twin_runs (twin_user_id,
started_at desc) where mission = 'heartbeat'`. twin-mcp: `resolveTwin` stamps `last_seen_at` once a
minute per key; `heartbeat` takes `progress`, collapses consecutive idle rows per key, scrubs
money on a sealed shadow, and answers with `orders`. `twinConsoleDisplay.ts` reads the new shape
(the ledger's PULSE line shows the step and the detail). Tests: the kernel's parse of old and new
notes, a bed for the collapse and the scrub. Docs: `EDGE_FUNCTIONS.md` → twin-mcp conversation
layer, `docs/migrations/`. Deploy twin-mcp after the push.

**PR 2 · The reader, the bar on the bid and the ring on the icon (S + M).** Migration:
`robot_progress(bid_ids uuid[])`, SECURITY DEFINER, the bid roles, no money columns. Kernel
`src/lib/bids/robotProgress.ts`: the seven steps from the stamps and the heartbeat, the words for
each state, quiet and asleep from the two clocks, *Most bids take about an hour* from the median
once ten runs have locked, and `ringFill(progress)`: steps done of seven plus the current step's
inside fraction, 0 to 1, with the tone (blue, amber, green, gray). `useRobotProgress` (one call per
visible set of bids, refreshed every minute while the board or the sheet is open). `RobotRing`
(conic gradients, the seven gaps, the glyph inside, the label) wrapping `RobotGlyph` on the Bid
Board, the phone board, the Robot Board row and the sheet's header. The status sheet's bar, the
ring's tooltip, the Robot Board row's sub-line, the lenses' caption sentence, the **What the robot
touches** fold, **Read the run** and **Leave this one to me** (the opt-out that exists, plus
`orders: leave`). Tests: `robotProgress.test.ts` for every state, `ringFill` at each step and with
and without an inside count, and the words' plain-words check; `RobotRing.render.test.tsx` for the
seven states; the sheet's render smoke; the mirror's label test. Guide: *let the robots shadow
a bid* gains **See where the robot is**. Docs: `BIDS_TABS_ARCHITECTURE.md` §Robots, `GLOSSARY.md`
*round*, `docs/migrations/`.

**PR 3 · The Console's Rounds card: the robots' status (M, migration, edge).** Migration:
`robot_agents()` (decision 8), devs only, and the `twin_credentials` UPDATE policy for the two
flag columns. Kernel `robotAgents.ts` (`agentState`, the thresholds, `recentWorkLine`,
`todayLine`) and `useRobotAgents` (every 30 seconds while mounted). `TwinRoundsCard` at the top of
the Console: one row per key seen in seven days with the light and word, *Checked in … ago*, Now,
Recently (five, folded after the first row, each a door), Today, **Stop after this bid**, **Pause
the rounds** (until a time, or until pressed again), and the current bid's signals under *Read the
run*. The round's reply shows the robot's own word for its state. The lenses' caption gains *The
robots checked in 2 minutes ago* through `robot_progress()`. Tests: `robotAgents.test.ts` (every
state and threshold, every recent kind, the words), the card's render smoke (three rows, the folds,
the flag writes), the caption's test. Docs: the Console's section in `BIDS_TABS_ARCHITECTURE.md`,
`ACCESS_CONTROL.md` for the owner's write, `docs/migrations/`.

**PR 4 · Silence on the Dashboard (S).** `dashboardNeedsYou.ts`: **The robots have not made a
round since …** (owner and devs, 15 minutes inside the hours, snooze and dismiss) and **The robot
is blocked on b511** (the people who can clear it, with the door the block names). The orphan rule
in `code-operator.md` and the dispatcher's lookback go from 60 minutes to 15. Tests: the Needs You
kernel's cases. Guide: *run the robot estimator from the Claude app* → **Know when there is work**
gains the two items.

**PR 5 · The round itself, one press to start it (S, docs, edge).**
`docs/twins/kickoffs/rounds-operator.md`: the *run this now* opening, the Mac's three settings as a
checklist the session reads back, the instruction to make the routine **Robot rounds** (every five
minutes, the prompt verbatim) and run it once, then the round's prompt itself (the idle heartbeat
first and leave if two rounds of this key already hold a bid; else one pass over the three queues,
oldest first, one shell per round, heartbeat every five minutes with the shape, obey `orders`), and
what the owner sees. `scripts/build-twin-mcp-briefs.mjs` and the twin-mcp redeploy, as every kickoff change needs.
The Console's *Run the robots* card gains the row **Make this Mac the rounds** with **Copy rounds
kickoff** and its *Preview* link (decision 7); `TwinSetupDialog` gains the tick *This Mac makes
the rounds* and `twin-setup` puts the rounds kickoff on the clipboard when it is on; the Rounds
card's empty state carries the button. The `/bid` skill and `code-operator.md` gain the five-minute
rule. Tests: the Console's render smoke (the new row, the preview), `desktopKickoff.test.ts` for the
rounds kickoff's connector fill, the setup dialog's smoke. Guide: *run the robot estimator from the Claude app* gains **Rounds from a Mac
that stays on**. Docs: `docs/twins/HANDOFF.md` → Day-to-day operation.

Each PR: `npm run claim`, a release note, a `docs/recent-features/` fragment, `npm run check:todos`
while this file stands. The last PR deletes the folder. The owner sets up the Mac Mini after PR 5
is deployed; nothing before it changes what the hourly routine does.

## How to verify

- **PR 1**: from a Code session with the twin key, `heartbeat` with `progress` on a ZZ shell;
  the Console's ledger shows the step and the detail; a second idle heartbeat from the same key
  moves the first row's `ended_at` and adds no row; a heartbeat note with *$41,200* on a sealed
  shell lands as *[amount withheld]*.
- **PR 2**: dev-login as Robert, open the Bid Board while a robot works: the bid's ring shows two
  full segments and a third part filled, the tooltip names the step, and the Robot Board row and
  the sheet show the same ring; open the sheet: the lit step, the detail and the last word; stop
  the robot's session and wait eleven minutes: the ring and the line turn amber and name the time; `?as=twin:estimator:1` cannot call `robot_progress` on a human
  bid's value (the function returns none).
- **PR 3**: open the Console while a round holds a bid: the key's row reads *Alive*, *Checked in
  1 minute ago*, and Now names the step; quit Claude on the Mac: within seven minutes the row reads
  *Quiet*, within fifteen *Asleep*, with the last check-in's time; Recently lists today's lock and
  the matrix with the right times and each line opens its door; press **Stop after this bid**
  while a round is on a shell: the next heartbeat's reply carries the order, the shell locks and
  reports, no new claim follows, the row reads *Stopped*.
- **PR 4**: pause the rounds for 20 minutes: the Dashboard item appears for the owner, snoozes,
  and clears on the next round.
- **PR 5**: on a Mac with the connector set up, press **Copy rounds kickoff**, open Claude Code,
  paste: the session reads the three settings back, makes the routine **Robot rounds** and runs it
  once; within a minute the Rounds card shows the Mac alive with its first round; while that round
  holds a bid, the next two rounds leave after one call and the ledger shows one idle row. Then the Mac
  Mini runs for one day: the ledger shows one idle row per quiet stretch, every shadow's bar
  reached *Sealed* or *Waiting on you*, and the Robot Board's coverage tile matches the round's
  reports.

## Is this the best we can do? Do we educate the user as well as we can?

**The third pass, the owner's ask after the second.** The second pass had cut the percent for seven
named steps on the sheet, and left the Bid Board's icon with words in a tooltip. The owner asked for
the glance back: a circle that completes to 100 percent on the icon itself. The ring keeps what the
cut was for, no percent of minutes, no guessed pace, and gives the glance by drawing the seven steps
round the icon. It is the same kernel, so it added one component and one function to PR 2 and no
new source of truth. What it changed in the teaching: a person now meets the seven steps on the
board, before the sheet, and the sheet confirms them.

The first draft, read back against the house's five lenses, changed in each:

1. **Fewer presses on a phone.** The first draft put a *Rounds* lens on the Bids page and a
   percent bar with a time estimate on it. The second puts the progress where a thumb already
   lands, the robot icon on the bid, and the sheet's bar is seven named steps that need no reading
   of a number. The third makes the icon itself the answer: the ring says *third of seven* with no
   press at all. *Read the run* is one press from the same sheet. Nothing new to find.
2. **Plain words.** The first draft's sheet said *substrate*, *STG-3*, *shell* and *heartbeat*.
   The second says *reading the sheets*, *counting*, *its own copy of the bid*, *last word*. Every
   sentence a person reads in the mock-up passes `plainWordsFailures`, and the kernel's words test
   holds them in PR 2. The one trade word left, *takeoff*, is not on these screens.
3. **Do what is ready.** The first draft's *Stop* stopped everything. The second's **Leave this
   one to me** stops one bid and the round carries on with the rest; **Stop after this bid**
   finishes the shell in hand rather than orphaning it; a paused round still sends its idle signal
   so the screen never lies about it. And the bar moves on the verbs' stamps even when the robot
   forgets to signal.
4. **Reuse.** The first draft added a `round` verb, a `twin_presence` table and a new liveness
   reader. The second widens `heartbeat`, puts two columns on the key that already is the Mac,
   derives the step from stamps that exist, copies `submittal_robot_liveness()`'s shape for the
   reader and `robotBacklog.ts`'s stale rule for the clocks, and reuses the opt-out, the orphan
   rule, the Needs You snooze and the Console's setup button. Starting the rounds reuses the
   *Run the robots* card's row shape, its copy and preview pattern, the setup command's clipboard
   step and the same key, so a dev learns nothing new to set the loop in motion. The status row
   reads the ledger rows the robots already write, reports, locks, matrices and tasks, and adds no
   table for them.
5. **Cut.** Gone from the first draft: the percent of minutes, the time estimate before ten runs
   exist, the Dashboard line on every signal, *Take over*, a push for silence, a new lens, a new
   table, a new guide. Left: one migration, one reader, one kernel, four surfaces that read it, one
   ring, two flags.

**Do we educate as well as we can?** The first time an estimator opens a working robot's sheet,
the bar itself is the lesson: seven steps, one lit, a time. Under it, **What the robot touches**
is four sentences, open on the first visit and folded after (the same first-visit rule the
Submittals walkthrough uses). The icon's tooltip says the same step in the same words, so the
sheet confirms rather than surprises. *Leave this one to me* says what happens and when. The two
guides grow a section each instead of a new guide nobody searches for, and the Console card's first
line says what a round is before it says what this one is doing. What we do not do: explain the
blind rule again on this sheet. *Its number stays sealed until you send yours* is the whole of it
for a person on a bid; the rest is in *see how close the robots are*.

## Not carried

- **A push when the rounds stop.** The Dashboard item first; a push if the owner misses it twice.
- **A cloud round.** The kickoff is host-blind; run it in the cloud the day the Mac disappoints.
- **Rounds for other roles.** An owner decision on the locked list.
- **A percent number or a countdown.** The ring is the percent, of steps; a median sentence once
  there is one.
- **A ring weighted by the clock** (3b, alternative C). Once ten runs have locked, the segments can
  take the median minutes of each step, so the ring's pace matches a watch. The ring from B upgrades
  in place; nothing a person learned changes.
- **Pausing one robot but not another.** The pause is per key, and a key is a Mac. Two robots on
  one Mac pause together.
- **Progress on backtests.** A backtest is a dev's run; the Console's ledger shows it as today.
- **The pricing robot's bar.** Its three stages already stamp; the Rounds card lists a matrix in
  hand with its stage, and the matrix request's own row keeps its heartbeat column. A bar on the
  Pricing tab is a later small PR when an estimator asks.

## The owner's calls

Each drawn with the recommended answer; the mock-up shows that answer.

**Taken 2026-10-21: how often a round.** The draft said 15 minutes; the owner said that is too
slow and five is better. Five it is: a bid is picked up within five minutes of filing, and the
overlap rule in decision 1 keeps an idle round to one call. The asleep clock tightens with it.

1. **When the rounds run.** All day, every day (recommended: a bid filed Saturday is shadowed
   Saturday, and nothing a robot does reaches a customer); the hourly routine's weekday 7 to 6.
2. **Who may pause.** The owner and devs (recommended); estimators too.
3. **Where silence reaches you.** The Dashboard's Needs You card (recommended); a push as well.
