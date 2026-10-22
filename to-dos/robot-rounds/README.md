---
name: "Robot rounds: the robots watch from the Mac Mini and say where they are every five minutes"
number: 142
group: ready
status: proposed 2026-10-21, second pass; nothing built
summary: >
  The owner wants a loop on his home Mac Mini that watches ClickTooling for work it can do, starting
  with bidding and pricing, and that tells the app every five minutes where it is, like a slow
  loading bar. Most of the loop exists: the robot estimator, its dispatcher, the hourly weekday
  routine, the heartbeat verb and the stage stamps every pipeline verb already writes. What is new
  is small: the rounds run every 15 minutes all day from a key that names the Mac, the heartbeat
  grows a plain-words shape and a five-minute rule, one reader turns the robot's own stamps into a
  seven-step bar an estimator can see on the bid, silence has a meaning and a door, and a press on
  the app reaches the Mac on its next signal. No new lens, no new table, one migration.
next: The owner's four calls below, then PR 1.
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

**New, in one line each:** rounds every 15 minutes all day from the Mac Mini's key; the heartbeat's
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
the Console, label *Robert's Mac Mini*; in Claude Code, make the routine **Robot rounds** with the
round's kickoff (PR 5) every 15 minutes, press **Run now** once so the approvals are saved. The
key is minted on the server and never shown; the owner's app account is only the harness. The
twin's writes are fenced by the key, not by whose Mac it is.

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
- **The Bid Board's robot icon** gets the same tooltip words: *Reading the sheets, 12 of 31. Last
  word 2 minutes ago.*
- **The Robot Board row**: *estimating · reading the sheets, 12 of 31 · 2 min ago*.
- **The Robots lenses' caption** gains one sentence: *The robots make a round every 15 minutes
  from Robert's Mac Mini. Last round 2:35 PM.*
- **The Console** gains a **Rounds** card at the top: one row per key that has made a round in
  seven days, awake or asleep, on which bid, the last round, the next, and the presses in decision
  5. Under it, the current bid's signals in order, oldest first, which is the slow loading bar's
  history and the *Read the run* door.
- **The Dashboard** says nothing while all is well. It speaks in decision 4.

**The bar is seven named steps, not a percent.** Picked it up · Plans filed · Reading the sheets ·
Counting · Pricing · Sealed · Questions for you. A percent would promise a pace nobody knows. The
sheet says *Most bids take about an hour* only once ten runs have stamped their LOCK, from the
median of start to lock in `twin_runs`.

### 4. What silence means: a quiet robot and a sleeping Mac are two different facts

Two clocks, each read from `last_seen_at` and the latest heartbeat.

- **Quiet on a bid.** A shell open and unlocked, and no verb from that key for ten minutes. The
  sheet reads *The robot went quiet on this bid at 2:41 PM. Another round picks it up within 15
  minutes.* Amber. Nothing for a person to do yet. The dispatcher's orphan rule tightens from 60
  minutes to 15: with a signal every five, fifteen minutes of nothing is a dead session, not a
  slow one.
- **Asleep.** No round from a key for 30 minutes inside its hours. The caption reads *No round
  from Robert's Mac Mini since 2:35 PM.* Gray. A Needs You item for the owner and devs: **The
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
uses. The loop is **the rounds**: *the robots make a round every 15 minutes*. A round is one pass
over the three queues from one Mac. Nothing on a screen says *loop*, *Mac Mini* or *heartbeat*
except the key's label the owner typed.

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
  the asleep detector says so within 30 minutes, to the owner, with the fix in the sentence.
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

1. **The bid**: the Bid Board row's robot icon with its tooltip, and the robot status sheet with
   the seven-step bar lit at *Reading the sheets*, the last word, the fold **What the robot
   touches**, and the two presses. The same sheet at phone width.
2. **The Robot Board row and the lenses' caption**: the live sub-line, the round sentence.
3. **The Console's Rounds card**: one Mac awake on b511, the last and next round, **Stop after
   this bid** and **Pause the rounds**, and *Read the run*: the bid's signals oldest first.
4. **Silence**: the same line in its three states, awake, quiet, asleep, and the two Needs You
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

**PR 2 · The reader and the bar on the bid (S + M).** Migration: `robot_progress(bid_ids uuid[])`,
SECURITY DEFINER, the bid roles, no money columns. Kernel `src/lib/bids/robotProgress.ts`: the
seven steps from the stamps and the heartbeat, the words for each state, quiet and asleep from the
two clocks, *Most bids take about an hour* from the median once ten runs have locked. `useRobotProgress`
(one call per visible set of bids, refreshed every minute while the sheet is open). The status
sheet's bar, the icon's tooltip, the Robot Board row's sub-line, the lenses' caption sentence, the
**What the robot touches** fold, **Read the run** and **Leave this one to me** (the opt-out that
exists, plus `orders: leave`). Tests: `robotProgress.test.ts` for every state and the words'
plain-words check, the sheet's render smoke, the mirror's label test. Guide: *let the robots shadow
a bid* gains **See where the robot is**. Docs: `BIDS_TABS_ARCHITECTURE.md` §Robots, `GLOSSARY.md`
*round*, `docs/migrations/`.

**PR 3 · The Console's Rounds card (S, edge).** `TwinRoundsCard` at the top of the Console: one
row per key seen in seven days, awake, quiet or asleep, the bid, the last and next round, **Stop
after this bid**, **Pause the rounds** (until a time, or until pressed again), the current bid's
signals under *Read the run*. The two flags are writes a dev or the owner may make
(`twin_credentials` UPDATE policy for those two columns only). The round's reply shows the robot's
own word for its state. Tests: render smoke, the flag writes. Docs: the Console's section in
`BIDS_TABS_ARCHITECTURE.md`, `ACCESS_CONTROL.md` for the owner's write.

**PR 4 · Silence on the Dashboard (S).** `dashboardNeedsYou.ts`: **The robots have not made a
round since …** (owner and devs, 30 minutes inside the hours, snooze and dismiss) and **The robot
is blocked on b511** (the people who can clear it, with the door the block names). The orphan rule
in `code-operator.md` and the dispatcher's lookback go from 60 minutes to 15. Tests: the Needs You
kernel's cases. Guide: *run the robot estimator from the Claude app* → **Know when there is work**
gains the two items.

**PR 5 · The round itself (S, docs, edge).** `docs/twins/kickoffs/rounds-operator.md`: the routine
prompt (one pass over the three queues, oldest first, at most one shell per round and two rounds at
once, heartbeat every five minutes with the shape, obey `orders`, idle heartbeat when nothing is to
do), the Mac's setup list from decision 1, and what the owner sees. `scripts/build-twin-mcp-briefs.mjs`
and the twin-mcp redeploy, as every kickoff change needs. The Console's *Run the robots* card gains
**Copy rounds kickoff** beside the handoff prompt. The `/bid` skill and `code-operator.md` gain the
five-minute rule. Guide: *run the robot estimator from the Claude app* gains **Rounds from a Mac
that stays on**. Docs: `docs/twins/HANDOFF.md` → Day-to-day operation.

Each PR: `npm run claim`, a release note, a `docs/recent-features/` fragment, `npm run check:todos`
while this file stands. The last PR deletes the folder. The owner sets up the Mac Mini after PR 5
is deployed; nothing before it changes what the hourly routine does.

## How to verify

- **PR 1**: from a Code session with the twin key, `heartbeat` with `progress` on a ZZ shell;
  the Console's ledger shows the step and the detail; a second idle heartbeat from the same key
  moves the first row's `ended_at` and adds no row; a heartbeat note with *$41,200* on a sealed
  shell lands as *[amount withheld]*.
- **PR 2**: dev-login as Robert, open a live bid whose robot is working: the sheet shows the lit
  step, the detail and the last word; stop the robot's session and wait eleven minutes: the line
  turns amber and names the time; `?as=twin:estimator:1` cannot call `robot_progress` on a human
  bid's value (the function returns none).
- **PR 3**: press **Stop after this bid** while a round is on a shell: the next heartbeat's reply
  carries the order, the shell locks and reports, no new claim follows, the row reads *stopped*.
- **PR 4**: pause the rounds for 40 minutes: the Dashboard item appears for the owner, snoozes,
  and clears on the next round.
- **PR 5**: the Mac Mini runs for one day: the ledger shows one idle row per quiet stretch, every
  shadow's bar reached *Sealed* or *Waiting on you*, and the Robot Board's coverage tile matches
  the round's reports.

## Is this the best we can do? Do we educate the user as well as we can?

The first draft, read back against the house's five lenses, changed in each:

1. **Fewer presses on a phone.** The first draft put a *Rounds* lens on the Bids page and a
   percent bar with a time estimate on it. The second puts the progress where a thumb already
   lands, the robot icon on the bid, and the sheet's bar is seven named steps that need no reading
   of a number. *Read the run* is one press from the same sheet. Nothing new to find.
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
   rule, the Needs You snooze and the Console's setup button.
5. **Cut.** Gone from the first draft: the percent, the time estimate before ten runs exist, the
   Dashboard line on every signal, *Take over*, a push for silence, a new lens, a new table, a new
   guide. Left: one migration, one reader, one kernel, four surfaces that read it, two flags.

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
- **A percent or a countdown.** Seven steps and a median, once there is one.
- **Pausing one robot but not another.** The pause is per key, and a key is a Mac. Two robots on
  one Mac pause together.
- **Progress on backtests.** A backtest is a dev's run; the Console's ledger shows it as today.
- **The pricing robot's bar.** Its three stages already stamp; the Rounds card lists a matrix in
  hand with its stage, and the matrix request's own row keeps its heartbeat column. A bar on the
  Pricing tab is a later small PR when an estimator asks.

## The owner's calls

Each drawn with the recommended answer; the mock-up shows that answer.

1. **How often a round.** 15 minutes (recommended: a bid filed at 2:03 is picked up by 2:15, and
   two rounds never overlap on one bid); 5 minutes; 30 minutes.
2. **When the rounds run.** All day, every day (recommended: a bid filed Saturday is shadowed
   Saturday, and nothing a robot does reaches a customer); the hourly routine's weekday 7 to 6.
3. **Who may pause.** The owner and devs (recommended); estimators too.
4. **Where silence reaches you.** The Dashboard's Needs You card (recommended); a push as well.
