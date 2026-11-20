---
name: "Job pace: the pace card says what it compares, and why"
number: 406
group: close
status: asked 2026-11-20 on the owner's phone walk · assessed and drawn three ways the same day · the owner picked B, two bars · built as v2.8048 · read on the dev server on a real project, read-only · left: the owner's look on a phone, and three calls
summary: >
  The owner circled the pace card's headline, Spending 22 points ahead of the work, and said he did
  not understand the section's place in the app or the word points. The card had no name, a headline
  about money it never drew, and three unnamed percents. It now has a name, Job pace, and compares
  two things the crew knows, Hours used and Work done, as two bars on one scale with the gap hatched.
  It speaks hours and never money. It asks before it warns: when hours went in after the percent was
  last set it is amber and asks Is 40% still right?, with Still 40% to say it again in one press, and
  it is red only on a fresh percent. What is this? explains the card and opens by itself once. The
  office's line says dollars over in place of points.
next: The owner looks at the card on a phone and answers the three calls below. Then the Job Budget card's sentence, the last place that says points.
size: M, built as one PR
blocker: None in the code.
ver: v2.8048
opinion: your call — the card is built on the defaults, and each of the three calls is one small change either way
---

# Job pace: the pace card says what it compares, and why (#406)

The mock-up is [`mockup.html`](mockup.html): the card as it was beside the three ways it was drawn, in three
states. Its job, stages, days and numbers are made up. The repo is public, so nothing here names a real
person, job or dollar figure.

## The ask

The owner, 2026-11-20, on a phone, with the headline *Spending 22 points ahead of the work.* circled: "I don't
understand this section's place in the app, 'points' is not readily understandable to me as a user. Can you
help me holistically look at this and help me come up with a better way to present this that educates me on
what and why?"

## What the assessment found

Read from the code on `main` and through the dev seat, read-only.

**What the card is for.** It tells the superintendent on a project whether the job is using its hours and
money faster than the work is getting done. It wants one of four things from him: set an old percent, answer
the stage's checklist, say his own finish day, or ask the master. Only the superintendent role gets it, on a
job that is a working project. The office reads the same reading on the Projects board, the Projects line on
the Dashboard and the Costs tab.

**Why it did not read.**

- The card had no name. It opened on its headline, so there was nothing to ask about.
- *Points* was the share of the money spent minus the percent of work done. Nobody on a job says it.
- The headline's number was about money, and the card's face drew no money. A superintendent is never shown
  dollars, so he could not check it.
- Three percents and a bar, none named: one on the stage's press, one in a sentence, one drawn.
- Red came first. The one sentence of why was the fifth thing down, in small type.
- The card could not say a percent was old. On the job in the owner's screenshot the percent was four weeks
  old and a crew day of hours had gone in after it.
- Nothing said the office reads the same thing, or what happens if he does nothing.

**The three numbers.** Each was right as arithmetic. The headline's was money against work. The sentence's
was the job's one percent. The press's was that same percent worked out for one stage, since no stage had a
report of its own.

**Faults.**

1. Two weightings for one fact. The job's percent is built from the stages by price. The rail spread it back
   by labor hours. A first stage marked done read 98% and still in hand. Fixed.
2. The headline was money and the bar was hours. On the day of the assessment, three of the four projects
   that read *money ahead* had their hours under the work. Fixed on the crew's card: it reads hours.
3. A job with no hours budget read *Too early to call.* Fixed on the crew's card.
4. A gap under one crew day reads on track. On a small job that can be a large share of the budget. Not
   changed.

**Who uses it.** Two superintendent accounts are live, one of them the sample account. Of 18 working
projects, 5 read red that day. **My finish date** and **Ask a master** were two days old and had been pressed
only on the walk of the day before.

## The three ways, and the owner's pick

| | What it changes | What it costs |
| --- | --- | --- |
| **A. Same card, plain words** | A name, a headline that says what is ahead of what, each number named, one line of what to do | The reader still works out the gap |
| **B. Two bars** (picked) | A's words, and the two things drawn on one scale with the gap hatched. Amber and a question before red | A longer card |
| **C. The card asks** | One question with two answers. The bars sit behind a press | The shortest, and it teaches the least |

The owner, 2026-11-20: "Build B", then "I want B (what we decided) to be live".

## What was built (v2.8048)

- `src/lib/jobMode/paceReading.ts`: the states, every word and the bar lengths, pure and tested.
- `src/components/jobMode/PaceReadingFace.tsx`: the name, the headline, the two bars, the sentences and the
  presses, and the fold **What is this?**
- `src/lib/jobMode/paceStillIo.ts`: **Still 40%**, the same percent filed again as a Status Report.
- `SuperintendentCard.tsx`: draws the face in place of its headline, its hours bar and its move sentence.
  Everything behind **How this is figured** is as it was.
- `PaceRail.tsx` and `paceCard.ts`: the spread by price, and a quiet press with no number.
- `superintendentLine.ts` and `JobCostsLineBudgets.tsx`: the office's words.
- Guides: `job-mode-clocking` and `see-where-every-project-stands-and-set-its-expected-hours`.

## What each state reads

| When | The card says |
| --- | --- |
| Hours ahead, the percent fresh | *Hours are ahead of the work.* The gap in hours. **Set the %**, then **My finish date** and **Ask a master**. Red. |
| Hours ahead, hours clocked after the percent | *Is 40% still right?* The day it was set and the hours since. **Set the %** and **Still 40%**. Amber. |
| Within one crew day | *On track.* *Hours and work are moving together.* Calm. |
| Work ahead | *The work is ahead of the hours.* The hours under. Green. |
| Nobody has set a percent | *Nobody has set the work percent yet.* **Set the %**. |
| Under 8 hours | *Too early to tell.* |
| No hours budget | *This job has no hours budget yet.* The office sets it. |
| Money ahead, hours not | The hours' own headline, and one grey line that the office watches the money. |

## The three calls left for the owner

Each is built on its default. Each is one small change either way.

1. **Money ahead, hours not: should the crew's card stay calm?** Built: yes. Materials are bought before the
   work they are for, and the crew cannot see or change dollars.
2. **Still 40% files a Status Report.** It clears the report-due reminder and counts in the reports chip, as
   the **Set the %** window's own save does. The other way is a mark that is no report, which needs a place to
   keep it.
3. **A percent is old after 8 hours.** On a job that is over, the card asks again on each day after work went
   in. The other way is a longer wait, a crew day or a week.

## Is this the best we can do?

- The percent is a value a person can change, and the house rule draws such a value as its own field in
  place. Here it opens the **Set the %** window, because the window takes a number for each stage. Left.
- The folded row's two thin bars still have no labels. The open card names them now. Left for the walk with a
  real superintendent, as #396 left it.
- The office's board still calls a pace in days. The crew's card says hours. They agree on which jobs are
  ahead of the work on hours, and differ only where money leads alone.

## How to verify

- View as the sample superintendent with Job Mode on, on a project he is clocked onto.
- The card reads **Job pace**, with two bars and no word *points*.
- On a project whose percent is older than its last worked day: amber, *Is N% still right?*, and **Still N%**
  turns it red with the gap in hours. Press it only on the test project: it files a Status Report.
- A stage marked 100% shows its tick.
- **What is this?** is open the first time and folded the next.
- Job window, Costs: a job whose money is ahead reads *$N over so far*.
- Projects board: the words under a money-ahead card read *Money is ahead of the work.*
