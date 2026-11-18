---
name: "The pace card, shown: stages as a rail, fewer words, and presses of its own"
number: 396
group: ready
status: asked 2026-11-18 at the look for #384 · drawn four times with the owner the same day (two bars, three additions, then the stages stood up as a rail) · his word *Build the entire PR train* · PR 1 built as v2.7797, the card's new face
summary: >
  The owner looked at the superintendent's pace card on the short Job Mode page and did not like it:
  too many words, not enough showing instead of telling, and nothing to do when the job is on pace.
  The card said its reading in about ninety words with one press. The new card shows it: the job's
  stages top to bottom as a rail that ends in the finish day, the hours as one bar, and Set the % on
  the stage in hand. Everything the card used to say sits behind one press, How this is figured. The
  folded row on the short page carries two thin bars and the finish day, so most days the card is
  never opened. Two presses are new: Ask a master, a question to the master on the job that carries
  the numbers with it, and My finish date, his own word on when the job finishes, which the card
  also asks for two days before the plan's day and when the job falls behind.
next: PR 2, Ask a master. Then PR 3, My finish date, with its migration and the push.
size: M as a train of three (M · S · M)
blocker: None in the code. PR 3's migration is pushed by hand right after its merge.
opinion: build — the card's numbers do not change, only how they are shown, and each new press rides something the app already does or one small table
---

# The pace card, shown (#396)

The mock-up is [`mockup.html`](mockup.html): the card as it was beside the card as built, on pace and behind,
with the two windows the new presses open. Its job, stages, days and hours are made up. The repo is public,
so nothing here names a real person, job or figure.

## The ask

The owner, 2026-11-18, looking at the pace card behind the short page's pace line: "I don't like this
section." Then: "I think there's too many words. Not enough showing instead of telling. And the context is
low when the action is low. For example, action could include a user reporting when he thinks the job will
finish. Or requesting clarification from a master on the job."

Read as three asks: cut the words, let a picture carry the reading, and never leave him with a card he can
only read.

## What the card said

About ninety words and one press when the job was on pace:

- the job's label again, and where the hours budget came from;
- the headline, ahead or behind;
- a strip with a legend of four parts, one of them *0 d at 24 h?*;
- a sentence with the planned finish and the finish at this pace;
- the office's sign-off in three clauses;
- the month's score in four clauses.

**Set the %** showed only when the job was behind or had no percent.

## What was drawn, and the owner's calls

1. **Two bars and a row of days.** Work over hours on one scale, a flag on the finish day, three presses.
   The owner: "This is good, but can we do any better?"
2. **Three additions.** The folded row carries the picture. The work is shown as the job's stages, since a
   superintendent thinks in stages and a percent makes him translate. The card asks one question when it
   matters. The owner on the stages: "This has great potential but should it be vertical instead of
   horizontal?"
3. **The stages stood up as a rail.** The names fit on one line at a phone's width, the form is the day's rail
   he already reads on the card's top, and the finish day joins it as the last row. The owner: "Build it",
   then "Build the entire PR train, asking ourselves is this the best we can do along the way."

Three calls were put to him with a default each. He said build, so the defaults stand:

| Call | Stands as |
| --- | --- |
| Does his finish date move the plan or the score? | No. It is his word beside the plan. The plan and the score stay the office's. |
| Who gets the question? | The master on the job. The office can read it. |
| Where does the month's score go? | Behind How this is figured, since it changes once a month. |

He also asked whether **Ask a master** sends the master a to-do card. It does not. It is a job note that tags
him, which waits on him until he types an answer or presses **No reply needed**, and the answer comes back
to the superintendent under **You asked**. A Checklist task can be ticked without answering, and a tick sends
nothing back.

## The plan

### PR 1 · the card's new face (M) · built as v2.7797

- `lib/jobMode/paceCard.ts`, pure and tested: the rail's rows from the job's stages, the finish day and the
  day this pace lands on, the hours bar, the days of hours left, and the folded row's second line.
- `PaceRail.tsx`: the rail and the thin bar.
- `SuperintendentCard`: the headline, the rail, the hours bar, the move when behind, and **How this is
  figured** over everything the card used to say. Nothing is removed.
- `JobModeShortRow` takes a picture: the pace line shows two thin bars and the finish day.

What building it found:

- **A stage's percent needs no new write.** The **Set the %** window already takes a number for each stage
  (punch list #130). The press on the stage in hand opens it.
- **Most jobs have no stage reported.** Then the job's one percent is spread over the stages in order, by
  their share of the hours. The fold says so in one line, so a tick is never taken for a stage's own report.
- **A job with fewer than two stages has no rail.** The ZZ test project is one. It shows a **Work** bar and
  the finish day in words.
- **A finished stage shows no date.** The drawing had one. Nothing keeps the day a stage reached 100.
- **The days left are days of hours.** The line's own figure is the unspent budget in crew days, so the card
  says *3 days of hours left*, not *3 days left*, which would read as the calendar.

Is this the best we can do? Asked of this step:

- The two thin bars on the folded row have no labels. Blue is the work and amber is the hours, and the open
  card names the hours. A label on each would cost the row a line. Left for the walk with a real
  superintendent.
- A tap on a stage that marks it done in one press was drawn and not built. It would need its own write
  beside the window that already files a status report. The window is one press further and says more.

### PR 2 · Ask a master (S)

A press on the card opens a small window: quick questions as chips, a line to type, and the numbers that go
with it. It posts a job note that tags the job's master through the tagged job notes of #363.

### PR 3 · My finish date (M)

His own finish day and what is in the way, kept in one small table. The rail's foot shows it beside the
plan's day. Two days before the plan's finish, or when the job falls behind, the card asks *Still finishing
Fri, Nov 20?* with **Yes** and **Pick a day**. The office reads his date on the Projects board.

## How to verify

- View as the sample superintendent, set Short, turn Job Mode on, and clock onto a ZZ project, or hold a day
  of stops in the browser.
- The folded row: the headline, the finish day and two thin bars.
- Open it: the rail when the job has two or more stages, the hours bar, **Set the %** on the stage in hand.
- **How this is figured**: the strip with its days, the budget's source, the sign-off and the score, as they
  read before. A tap on a day still opens the day.
- A job with one stage: the **Work** bar and the finish day in words.
