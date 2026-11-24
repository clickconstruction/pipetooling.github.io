---
name: "The pace card, shown: stages as a rail, fewer words, and presses of its own"
number: 396
group: ready
status: asked 2026-11-18 at the look for #384 · drawn four times with the owner the same day (two bars, three additions, then the stages stood up as a rail) · his word *Build the entire PR train* · PR 1 built as v2.7797, the card's new face · PR 2 built as v2.7803, Ask a master · PR 3a built as v2.7807, the table · PR 3b built as v2.7808, My finish date · PR 3c built as v2.7811, his date on the Projects board · all five PRs merged and live 2026-11-19 · walked live the same day as the Sample superintendent, both new presses pressed for real on the ZZ test project · the walk's finding fixed as v2.7910 on the owner's word *Yes, fold them*
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
next: The owner's walk with one real superintendent on his own phone, on a real project of his. That walk also carries the three questions punch list #384 left when it was retired.
ask: owner · walk · Walk the pace card with one superintendent, on his own phone.
size: M as a train of five (M · S · S · M · S)
blocker: None. The migration is pushed and every PR is live.
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

### PR 2 · Ask a master (S) · built as v2.7803

A press on the card opens a small window: quick questions as chips, a line to type, and the numbers that go
with it. It posts a job note that tags the job's master through the tagged job notes of #363.

What building it found:

- **The server already knows the job's master.** The list of who can be tagged on a job holds him, marked as
  on the job. The window offers the masters on the job and falls back to the office's masters.
- **A send notifies.** The note box's own call sends the tag's notice, and the window makes the same call.
- **The card can close the loop.** The job's tags are already read for the note feed, so the card says
  *Waiting on* the name, and for three days that an answer landed.

Is this the best we can do? Asked of this step:

- The quick question about a stage now names the stage in hand, *What counts as done on Rough-in?* The first
  build said *this stage*, and the master would have had to work out which.
- The answer is read by opening the job, under **Open this job**. The card says so. Showing the answer's words
  on the card itself would need the note's text beside its tag, which the tag read does not carry.
- A real send was not made at the build. It posts to a real person.

### PR 3 · My finish date (M) · built as v2.7807 (the table) and v2.7808 (the press)

His own finish day and what is in the way, kept in one small table. The rail's foot shows it beside the
plan's day. Two days before the day in force, or when the job falls behind, the card asks *Still finishing
Fri, Nov 20?* with **Yes** and **Pick a day**.

It became two PRs, the repo's way for a new table: 3a is the migration with its SQL bed, pushed by hand after
its merge, and 3b is the client. A third, 3c, puts his date in front of the office on the Projects board.

What building it found:

- **A table, not a note.** A finish date posted as a job note needs no migration. But the card draws his day
  beside the plan's, the board shows it to the office, and a one-tap **Yes** would fill a job's feed with notes.
- **Sayings are never changed.** A new day is a new row, so the office sees what he said and when.
- **The day in force** is his own last word when he has one, else the plan. The quick picks and the question
  both follow it.
- **The question is once a day.** A saying made today is the day's answer, so **Yes** quiets it until tomorrow.
- **A failed read takes nothing away.** His day is an addition to a card that is whole.

Is this the best we can do? Asked of this step:

- The question first asked on every day the job was behind. Once he has given a later day that is noise, so
  it now asks a man who is behind only until he has said a day, and after that only near his own day.
- After the day has passed there is no **Yes** to give. The box says the day has passed and offers **Pick a
  day** alone.
- The quick picks step over Saturday and Sunday. A crew that works a Saturday uses **Another day**.

### PR 3c · his date on the Projects board (S) · built as v2.7811

One line on a project's card for the office: who says which day, and what is in the way. Each person's
newest word, on the board page and on the Dashboard's Projects strip, from one read for all the cards.

Is this the best we can do? Asked of this step:

- The line does not say when he said it. A day said three weeks ago reads the same as one said this morning.
  The window's history is in the table, and a *said Tuesday* on the line is a small follow-up if the office
  asks for it.
- The office cannot answer on the board. **Ask a master** is the crew's way to ask, and the tagged job note is
  the office's way to answer.

## The walk, 2026-11-19

Walked on main's code against the live database, on a phone-width screen, viewing as the Sample
superintendent. The pace card draws for a superintendent only, so the dev's own account cannot walk it. A
working day was held in the browser, because a sample account has no stops. Every press below was a real
press, and every write went to the ZZ test project, click 1113.

What was pressed, and what came back:

- **Ask a master.** One question, *Is 25% right?*, from its chip. The note posted on the job with the card's
  numbers on its second line. The card read *Waiting on Sample.*, and still did after a reload.
- **The master's side.** Viewing as the Sample leader, the question sat under **Tagged job notes** on Jobs
  with the numbers attached. He typed an answer and pressed **Post**. His tag cleared.
- **The answer back.** The superintendent's card then read *Sample answered. Open this job to read it.*
- **Yes** on *Still finishing Fri, Nov 20?* saved the plan's day in one press, and the question left the card.
- **My finish date.** The window opened on the plan's day with the working day each side. Monday was picked,
  a reason typed, and saved. The card read *You said Mon, Nov 23.* with the reason after it.
- **The Projects board**, as the dev: the test project's card carried *Sample says Mon, Nov 23:* and the reason.

One thing was stood in. The question's window offers the masters on the job, and the test project's one
master is a real person. The people read was answered in the browser so the window offered the Sample leader
alone. The send itself was the app's own, and a guard in the walk refused any note for anyone else.

Left on the test project, on purpose: two rows of `job_finish_calls` in the Sample superintendent's name
(the table has no delete), and two job notes, the question and its answer.

The card was also read, with nothing pressed that writes, on two real projects with three stages each. The
rail drew on both, one from the job's percent and one from the crew's own stage reports.

### What the walk found

- **The rail lists bid lines that are not stages, and their names run long.** The rail takes every bid line
  that carries hours. On both real projects that brought in lines after the three stages: an added piece of
  work on one, and on the other a line whose name is a whole paragraph of scope, about fifty words. The open
  card read 88 and 106 words on those two projects against 48 on the one-stage test project. That is the
  complaint this card was built to answer. Fixed as v2.7910, on the owner's word *Yes, fold them*: the stages
  keep their names, and every other bid line is one last row, **Other work**.
- **A stage reported done below one that is not.** One project has its second stage at 100% and its first with
  no report. The rail marks the first as the stage in hand, above a ticked one. That is what the reports say,
  so the rail is right, but it reads oddly.
- **A reason with no full stop ends the line without one.** *You said Mon, Nov 23. Test walk: waiting on the
  inspector* is what he typed. Small.
- **Ask a master on a job he cannot open** says the people on the job could not be read. This showed only
  because the sample account is on no real crew. A superintendent scheduled on his own job reads its people.

Not seen: the says line on the Dashboard's Projects strip, which did not list the test project. A real
superintendent on his own phone. A phone notice to a real master.

### Still owed: the walk with a real superintendent

Punch list #384 was retired with one thing no card held: no real person is on Short. The office sets one
superintendent to Short on his People desk. The owner walks the short page and this card with him on his own
phone, and asks the three questions #384 left: what he looks for first, which part bothers him most, and what
he would miss if the screen showed only his next stop, **Arrived**, **Leaving** and **Leave report**. On this
card, ask whether the two thin bars on the folded row need labels.

## How to verify

- View as the sample superintendent, set Short, turn Job Mode on, and clock onto a ZZ project, or hold a day
  of stops in the browser.
- The folded row: the headline, the finish day and two thin bars.
- Open it: the rail when the job has two or more stages, the hours bar, **Set the %** on the stage in hand.
- **How this is figured**: the strip with its days, the budget's source, the sign-off and the score, as they
  read before. A tap on a day still opens the day.
- A job with one stage: the **Work** bar and the finish day in words.
