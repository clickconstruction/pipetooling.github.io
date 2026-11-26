---
name: "Job pace: the pace card says what it compares, and why"
number: 406
group: close
status: asked 2026-11-20 on the owner's phone walk · assessed and drawn three ways the same day · the owner picked B, two bars · built as v2.8048, merged and walked in place as the sample superintendent · the Job Budget card's sentence, the last place that said points, built as v2.8058 · both live 2026-11-20 · Still pressed in place on the test project the same day · walked read-only as a real superintendent at a phone's width · the small-job gap fixed as v2.8120 and the card drawn for the next stop as v2.8122, both live the same evening · left: the owner's own look, and four calls · walked in an iPhone simulator 2026-11-25, clocked in as the sample superintendent: the card and What is this? hold, the amber ask was not seen, and the walk met one fault beside the card, a reload that never lands, which counts against this card, the one whose walk met it, on the word given that day · that reload mended as v2.8562, the client alone, merged and live 2026-11-25, measured on a local build in Chromium and WebKit · its first look held on the live site the same day, three seconds from the press to the reload, and the second look is still owed · in a simulator the same day three presses each left the page, and one came back through the sign-in page onto the Dashboard, a fault read in the code and not built · asked the same day whether the fault moves to #417, the answer was to keep it on this card · that fault mended in v2.8582, the client alone, merged 2026-11-25, with a test that failed first, and not yet seen in a simulator or on a phone · a sign-in lost on a reload the same day was read in the auth log and is not the reload's doing · v2.8582 held in a simulator the same day, in three reloads and seven cold opens, and the second look of the reload mend passed: Exit across a deploy · the three small things met on those looks are mended in v2.8598 and v2.8599, the client alone, merged the same day; v2.8599 held on the live site on 2026-11-26 in three Hard Reloads, and both held in the simulator the same day, v2.8598 staged by an Exit from View as · the owner the same day: the wider gate waits until reloads are timed on the new build · 2026-11-26: the retry panel under the sign-in lock's error stays at its Retry press and reads again by nobody's hand but the person's
summary: >
  The owner circled the pace card's headline, Spending 22 points ahead of the work, and said he did
  not understand the section's place in the app or the word points. The card had no name, a headline
  about money it never drew, and three unnamed percents. It now has a name, Job pace, and compares
  two things the crew knows, Hours used and Work done, as two bars on one scale with the gap hatched.
  It speaks hours and never money. It asks before it warns: when hours went in after the percent was
  last set it is amber and asks Is 40% still right?, with Still 40% to say it again in one press, and
  it is red only on a fresh percent. What is this? explains the card and opens by itself once. The
  office's line says dollars over in place of points. On a small job, a gap of a tenth of the hours
  counts. Clocked in with no job, the superintendent sees the pace of the next stop.
next: The owner looks at the card on a phone and answers the four calls below. Both small mends held on 2026-11-26: v2.8599 live and in the simulator, v2.8598 in the simulator, staged by an Exit from View as. The wider gate waits, on the owner's word, until reloads are timed on the new build.
size: M, built as one PR, an XS for the Job Budget card and an S for the reload mend, all built; left: the looks (XS)
blocker: None in the code.
ver: v2.8048 · 8058 · 8120 · 8122 · 8562 · 8582 · 8598 · 8599
opinion: your call — the card is built on the defaults, and each of the four calls is one small change either way
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
4. A gap under one crew day reads on track. On a small job that can be a large share of the budget. Fixed
   as v2.8120 on the owner's word: a gap of a tenth of the hours budget counts too, and is said in hours.

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

## The last place that said points (v2.8058)

The Job Budget card's sentence read *labor is 9 points ahead of progress*. It now reads the dollars, *labor is
$4,233 over for the work done*, from `src/lib/jobs/jobBudgetWhy.ts`. The words live in a client-only file
because `jobBudget.ts` is copied to the edge functions, and a word changed there would leave every function
that bundles it reading as behind. The owner, 2026-11-20: "Yes, do it".

## What each state reads

| When | The card says |
| --- | --- |
| Hours ahead, the percent fresh | *Hours are ahead of the work.* The gap in hours. **Set the %**, then **My finish date** and **Ask a master**. Red. |
| Hours ahead, hours clocked after the percent | *Is 40% still right?* The day it was set and the hours since. **Set the %** and **Still 40%**. Amber. |
| Within one crew day, and under a tenth of the hours budget | *On track.* *Hours and work are moving together.* Calm. |
| Work ahead | *The work is ahead of the hours.* The hours under. Green. |
| Nobody has set a percent | *Nobody has set the work percent yet.* **Set the %**. |
| Under 8 hours | *Too early to tell.* |
| No hours budget | *This job has no hours budget yet.* The office sets it. |
| Money ahead, hours not | The hours' own headline, and one grey line that the office watches the money. |

## The four calls left for the owner

Each is built on its default. Each is one small change either way.

1. **Money ahead, hours not: should the crew's card stay calm?** Built: yes. Materials are bought before the
   work they are for, and the crew cannot see or change dollars.
2. **Still 40% files a Status Report.** It clears the report-due reminder and counts in the reports chip, as
   the **Set the %** window's own save does. The other way is a mark that is no report, which needs a place to
   keep it.
3. **A percent is old after 8 hours.** On a job that is over, the card asks again on each day after work went
   in. The other way is a longer wait, a crew day or a week.
4. **The next stop's card also shows on a bid.** A clock on a bid has no job of its own, so the card draws for
   the day's next stop, as it does with no job linked. The other way is no card until a job is linked.

## Is this the best we can do?

- The percent is a value a person can change, and the house rule draws such a value as its own field in
  place. Here it opens the **Set the %** window, because the window takes a number for each stage. Left.
- The folded row's two thin bars still have no labels. The open card names them now. Left for the walk with a
  real superintendent, as #396 left it.
- The office's board calls a pace in days, and in hours when the gap is under a crew day. The crew's card says
  hours. They agree on which jobs are ahead of the work on hours, and differ only where money leads alone.

## The Still press, walked in place (2026-11-20)

After both PRs were live, as the Sample superintendent through View as, Job Mode on, clocked onto the ZZ test
project, on the dev server at `main` against live data.

- The test project is on track, so the card does not offer **Still** there. For the walk, two made-up days of
  9 hours were added to that job's read in the browser only, through a temporary hook that was never
  committed. Nothing made up was written anywhere.
- The card then read amber, *Is 25% still right?*, 27 of 70 hours against 25%, *set 12 days ago*, and *The
  crew has put in 18 hours since.*
- **Still 25%** was pressed. The press went grey while it saved. The card turned red, *Hours are ahead of the
  work.*, *set today*, *The gap is about 10 hours.*, with **Set the %** and the finish presses under it.
- The press wrote one Status Report on the test project in the sample account's name: 25%, with the note
  *Still 25%. Said on the Job pace card.* A report on a ZZ test record reaches no phone and no inbox.
- After a full reload the card still read red and *set today*, from the server's own read.

Left on the test project, on purpose: that Status Report, and two clock sessions of a few minutes in the
sample account's name. Job Mode on the sample account is off again.

## The walk as a real superintendent (2026-11-20)

The owner asked for the walk as the company's superintendent, on his phone. It was done through View as at a
phone's width, on the dev server at `main` against live data, and nothing that writes was pressed.

- **His page showed no Job pace card at that moment.** He was clocked in with no job linked. The card draws
  only for the job he is on or next, which is how it has always been mounted. A day that starts with a clock
  in and no job hides the card until a job is linked. Fixed as v2.8122, below.
- **Drawn for his first stop under his own sign-in**, through a temporary hook that was never committed, the
  card read amber, *Is 40% still right?*, both bars, *set 28 days ago*, and the hours since. The first stage
  wore its tick. Nothing ran off the side at 390 pixels.
- **How this is figured** opened with no dollar on it. It still shows the strip's own chip, *money ahead*.
- **My finish date** and **Ask a master** opened their windows, the second naming the master on the job, and
  both were closed. Nothing was saved or sent.

## How to verify

- View as the sample superintendent with Job Mode on, on a project he is clocked onto.
- The card reads **Job pace**, with two bars and no word *points*.
- On a project whose percent is older than its last worked day: amber, *Is N% still right?*, and **Still N%**
  turns it red with the gap in hours. Press it only on the test project: it files a Status Report.
- A stage marked 100% shows its tick.
- **What is this?** is open the first time and folded the next.
- Job window, Costs: a job whose money is ahead reads *$N over so far*.
- Projects board: the words under a money-ahead card read *Money is ahead of the work.*
- Projects board: a small job behind by less than a crew day, but by a tenth of its hours or more, reads
  *6 hours behind.* with the chip *-6 h*, never *On pace.*
- Clocked in as the superintendent with no job linked: the card reads *Next stop* with the job's number and
  name, and shows that job's pace.

## The next stop (v2.8122)

The walk as a real superintendent found his page with no Job pace card: he was clocked in with no job linked,
and the card drew only for a job the Job Mode card shows. It now draws for his next stop on the day, with one
line, *Next stop* and the job's number and name (`src/lib/jobMode/paceNextStop.ts`). Walked read-only as the
same superintendent, still clocked in with no job linked: the card was there, named his first stop, and read
that job's pace. The owner, 2026-11-20: "Yes, build it".

## Live (2026-11-20)

v2.8122 and v2.8120 merged that evening, and one site deploy carries both. The live site's own code was read
after it finished: the Dashboard draws the *Next stop* card, and the Projects board counts a gap of a tenth of
the hours budget. The next stop was not walked again on the live site, because that needs the superintendent
clocked in with no job linked.

## Walked in a simulator (2026-11-25)

Walked on 2026-11-25 in an iPhone simulator, in Safari at 402 by 874 points, in dark, on the live site, through View as the sample superintendent with Job Mode on. It is a simulator and not a real phone, so the owner's own look still stands.

- **Holds.** Clocked onto the ZZ Test walk project, the card reads **Job pace** with its two bars, *Hours used* and *Work done*, and no word *points*. **What is this?** opens and folds.
- **Not walked: the amber ask.** *Is N% still right?* with **Still N%** needs a project whose percent is older than its last worked day. The test project reads ahead, so the card was green.
- **What the look cost.** The sample superintendent was clocked in and out for it. That account is a fixture and not a ZZ Test row. It left one clock session of about two minutes on the test project, and a line under **Your record** on that account's Dashboard, *No report on* the test project. **Report** was not pressed, since a saved field report is emailed. The same press had been held as a question for the owner, and he has been told.

**One fault found beside the card, read in the code the same day, and built since as v2.8562: a reload that never lands.** It counts against this card, the one whose walk met it, on the word given 2026-11-25. Asked later that day *The reload fault: keep it on #406, or move it to #417 by the newest-card rule?*, the answer was "Keep #406", quoted from that session's record of the user's answers. So the mend, its fragment and its walk cite this card, and nothing of it moves to #417.

- **As seen.** Right after a site deploy, in an hour when three landed, **Exit** from View as left the page on *Updating app…* for about 80 seconds. A fresh load read the same for 30 more. Then the page read *This page could not load*, and its **Reload** press stayed grey with *Checking for a signal…* for 90 seconds or more, while the site answered in a fifth of a second. Quitting Safari cleared it.
- **Why.** Once the app decides to reload, it first clears its kept copy of the site, and only then leaves the page (`hardReload.ts`). Nothing limits that wait. The **Reload** press asks the network first, and on a yes it stays dead on purpose while the page leaves (`RouteChunkBoundary.tsx`). So a clearing that hangs leaves *Updating app…* or a grey press on screen for good. It may show most on the simulator's Safari, and the hole is in the app either way.
- **The mend. Built as v2.8562, PR #9798, merged 2026-11-25 and live with the client deploy of that merge.** The client alone, with no migration and no function. A reload waits three seconds at most for its clearing, then leaves. A grey **Reload** comes back after ten seconds with *The reload did not finish. Press Reload to try again.* *Updating app…* gives way to the same press after ten seconds. The record is [`docs/recent-features/v2.8562.md`](../../docs/recent-features/v2.8562.md).
- **Whose fault it was: the app's, in any browser.** The clearing waits behind the app's own install of its kept copy, 1,548 files fetched one at a time, and a load after a wipe installs from nothing. Measured on a local build in headless Chromium and headless WebKit: a bare clearing asked for during an install answered only when the install ended, after about 102 seconds, and the mended reload asked the server for its page after 3.0 seconds.
- **The first look held on the live site, 2026-11-25.** A walker made it as the dev in the app's Browser pane, on the build that carries every version through v2.8568, on a page with nothing typed. The clearing was made to never answer, then **Hard Reload** was pressed from the gear menu. The page left 3.0 seconds after the press and came back on the same page. No confirm opened, and the kept copy read *activated* afterwards. The look wrote nothing.
- **In a simulator, 2026-11-25: the press leaves every time.** Three presses of **Hard Reload** from Settings, with nothing staged, on a Mac under heavy load, so the times are weak. The page left inside 1.5 seconds each time. The staged look cannot be made there: Safari refuses a script line typed into its address bar.
- **One fault met on that look, read in the code the same day and not built.** One reload of the three drew the sign-in page to the signed-in dev at about 8 seconds, then landed on the Dashboard and not on Settings. About 95 seconds later a toast read *The app was busy renewing your sign-in, so this did not load. Try again.* Why, as read: the app's check of the sign-in gives up at 8 seconds and draws the person as signed out, even when the sign-in had already arrived by another road (`useAuth.ts`). The page they asked for is then not kept, and a dev lands with no role, so on the Dashboard. It counts against this card, whose walk met it. The client alone, S. It is not reproduced outside the simulator, so the mend starts with a test that shows it.
- **That fault is mended in v2.8582, merged 2026-11-25, the client alone.** The watchdog now keeps a person the auth listener has already handed over, and where it does sign out it forgets whose role was read. A test that failed on main was written first. Not yet seen in a simulator or on a phone. Left, briefed and not built: with the sign-in in hand the app still reads *Loading…* until the 8 seconds are up.
- **A sign-in lost on a reload, 2026-11-25, and it is not the reload's doing.** In the walker's pane a **Hard Reload** came back on the sign-in page with the browser's sign-in gone. Read in the auth log the same day: the simulator's look had pressed the app's **Sign out** on the same test account 52 minutes before, and that press ends every session of the account, on every device. The pane's first request after the reload was answered that its session was gone, and the browser then drops the sign-in. v2.8582 does not change this, and nothing is to build. A walker who presses **Sign out** on a shared account ends the other walker's sign-in.
- **v2.8582 held in a simulator, 2026-11-25.** Three presses of **Hard Reload** and seven cold opens by address, on a Mac under heavy load: no sign-in page and no lost page. **The second look passed too:** with View as on and a deploy just ended, **Exit** read *Loading…*, then *Updating to the newest version…* at 3.2 seconds, and came back as the dev at 9.3. The recipe's words *Updating app…* are out of date.
- **Three small things met on those looks, read in the code the same day, and mended in v2.8598 and v2.8599, merged 2026-11-25 and not yet seen live.** The press of **Hard Reload** stands 3.3 seconds with nothing on the screen: it waits on the wipe's deadline and draws nothing. Landing in View as, Settings once drew the sign-in lock's raw words as the whole page, with no press. And where that error draws its plain words, which end *Try again*, no **Retry** is offered.
- **v2.8599 held on the live site, 2026-11-26.** Three presses of **Hard Reload** in the Browser pane: the full-page cover drew inside about 50 ms, the page left at 0.2, 3.1 and 3.1 seconds, and each came back signed in. Read in dark, since the account is on dark; the light theme was not read. v2.8598's words no press can stage, so they are still unseen.
- **In the simulator the same day, v2.8599 and v2.8598 both hold.** Three **Hard Reload** presses, two from the tally and one from Settings across a deploy, came back on the page they left and none through the sign-in page; the *Reloading…* cover was caught at 1.4 seconds, a dark surface, readable, with no white flash. The lock line was staged at last: **Exit** from View as the sample assistant drew on Settings *The app was busy renewing your sign-in, so this did not load. Try again.* with **Retry** under it, as v2.8598 built. One press on Retry read *Loading…*, then *Taking too long? Fix the app*, and Settings drew 16 to 29 seconds later, which is the held lock waiting out; the panel stays at its press, as the person chose. No raw error anywhere.
- **Two more first loads, 2026-11-26, on the live site in the Browser pane.** By the walker's report, as the dev. A first load stood on the card *Still loading. This can happen right after an app update.*, with **Reload** and **Fix the app**, twice in one sitting: once on a cold pane just signed in, and once across a client deploy. A plain reload cleared it both times, and no sign-in was lost. No time was taken on either. They are two more looks for the wider gate below, which still waits.
- **In the simulator the same day, the lock words twice more.** On a Mac under heavy load. A fresh load of a Settings tab drew the words as a red toast with **Tell the dev**, not as the plain line with **Retry**; which read failed is not known. And an **Exit** from View as landed on the plain line with **Retry**, which read *Loading…* for 20 seconds or more and then drew the page. An Exit from View as has landed on that line in two simulator sittings of two. In the Browser pane the same hour an Exit landed clean. Read in the code: Exit puts the dev's session back and then loads the page whole (`impersonationExit.ts`), so the page's first read can race the sign-in's renewal. Nothing is briefed: the person's answer that the panel stays at **Retry** stands, and two looks on a starved Mac are weak.
- **The wider gate, answered 2026-11-25 (UTC) in the managing session.** Asked *"Do all the picks on round 3, rows 1 to 11, stand?"*, the answer was "Yes, all picks", quoted from that session's record of the user's answers. The row read: *#406: the wider gate for a slow phone waits until the simulator has timed reloads on the new build*, and the pick was to wait.
- **The retry panel, answered 2026-11-26 (UTC) in the managing session.** Asked on 2026-11-26 (UTC) in the managing session whether every pick on the question sheet stands, the person answered "All picks stand". Row 12 read: *#406: The retry panel stays at the Retry press, no re-read by itself. Pick: Yes.* So the panel v2.8598 draws under the sign-in lock's error offers **Retry** and does not read again on its own, since a re-read would loop while another tab holds the lock. Nothing is built for it.
- **Not settled on that look.** A page not opened before, pressed two minutes after a deploy ended, read *Loading…* for 22 to 33 seconds and never *Updating app…*. The page may already have been on the new build, so it neither passes nor fails the mend.
- **Still not walked.** The second look, a deploy landing while View as is on. No phone has seen the mend. Which wait hung on the simulator was never seen there, since no log came off it. Both looks are the walkers', with the recipe the build thread left in its hand-over note.
- **It is not the pace card's own fault.** The card was only on screen. The reload path's earlier mends are on the legal portal's card (#85), under the main chunk's split.
