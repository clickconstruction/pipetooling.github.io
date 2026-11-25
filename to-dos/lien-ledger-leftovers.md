---
name: "Lien desk: what the ledger (#361) left, to do later"
number: 415
group: residual
status: saved 2026-11-21 when #361 closed, on Taunya's word *save it all to a punch list card* · nothing built tonight on her word · every follow-up the thread of #361 left is here · its walks and loose ends written out in full on 2026-11-22, for Taunya's ask that every card say what is still to do and what still needs walking · read again against `main` on 2026-11-24, nothing built: loose ends 1, 2 and 4 stand as written, loose end 3 is real, walk 1 is done and left loose end 6, and the pictures for loose ends 1 and 4 went to Taunya · loose end 3 built on Taunya's go the same day, v2.8454 · loose ends 1, 2, 4 and 6 built the same day on the picks from the pictures, v2.8537, v2.8535 and v2.8538, and loose end 5 answered · walk 2 done on a staged ZZ Test job, walk 7's record written and its reading not seen, which left a finding with no decision yet · v2.8537 and v2.8538 seen on the live desk the same day, read-only, and they read as built; v2.8535's empty card has no live case · walk 4 done on the ZZ Test job staged again, and the two ZZ Test filings voided after it, the same day, on the owner's standing yes for ZZ Test rows · the finding decided the same day, the owner's pick: draw the card from the job's stand-in month, shipped v2.8541 and deployed that night · a second finding of walk 7, the path that forgot a notice only on record, shipped v2.8554 and deployed the same night, on the owner's yes · walk 7 and the path's look written as one sitting on a ZZ Test job, and handed to the walker
summary: >
  Punch list #361 rebuilt the Lien desk's Months on this job as one card, the ledger, and closed on
  2026-11-21 once every choice made with it was built and live. Its last night left a handful of
  small things. Every build among them shipped on 2026-11-24: the late window read from one source
  (v2.8454), the empty card's next press (v2.8535), the claim's cents (v2.8537), and the pinned strip
  for a thumb with a long chip that fits (v2.8538). The five things for Grace were answered that day.
  Seven walks were owed. Walks 1, 2 and 4 are done. Walk 7's record was written on a ZZ Test job and its
  reading was not seen, and that left a finding: the affidavit pane draws its months card only for a
  job with approved clock hours. The owner picked the way on 2026-11-24, and its build shipped that night as v2.8541.
  The same walk left a second finding, a path that forgot a notice only on record, and its build shipped as v2.8554.
  Neither build has been seen live: walk 7 is the look at both, in one sitting. Walks 3, 5 and 6 were not staged and wait on live cases. The two
  ZZ Test filings the walks left are voided. The cents and the pinned strip were seen on the live desk on 2026-11-24 and read as built. The empty
  card's next press has no live case to be seen on.
next: Walk 7 can be read: both builds are deployed (v2.8541 and v2.8554, 2026-11-24). It is read in one sitting with the path's look. It needs a new record by hand on a ZZ Test job, since the first one is voided. Walks 3, 5 and 6 wait on a live case or are dropped by Taunya.
size: four walks (XS each): 7 is ready to read on a ZZ Test job, 3, 5 and 6 wait on live cases
blocker: None. Both builds are deployed, and one record by hand serves both looks.
---

# Lien desk: what the ledger (#361) left, to do later (#415)

## Where this comes from

Punch list #361 closed on 2026-11-21. Its closed line in `to-dos/README.md` names what it built:
v2.7989, then the fixes and answers through v2.8234. On closing it, Taunya said: *"save it to a
punch list card for us to do. I don't wanna build anything more tonight on this, but I wanna do
every single follow-up at a later time."* This card is every follow-up that thread left.

## Done, not owed

- **The office's look at Months on this job, at a desk and on a phone.** Taunya's word of 2026-11-21, *Looked, reads
  right*, recorded on #361's closed line in `to-dos/README.md`.
- **The words of v2.8167 (#9211), v2.8206 (#9262) and v2.8234 (#9305) on the live desk.** Each was read on
  clicktooling.com the day it deployed. The reads ran in a throwaway headless Chrome signed in as the dev, with every
  write refused, at 1,440 px and 390 px. They read words and widths from the page, not pictures. The look in both
  themes was walk 1 below, done on 2026-11-24.

## Loose ends to build

Each names the PR it comes from and whose call it is. Each was read again against `main` on 2026-11-24, after
v2.8341 and v2.8346 (the desk on a phone), v2.8364 (deeper green presses) and v2.8415 (smaller cents) had touched
the desk's files. Loose end 3 was built that day, and then loose ends 1, 2, 4 and 6 on the picks made from the
pictures. Each struck line names its version, and the fragment of that version holds what changed and what was run.

1. ~~**The claim drops cents while its bills keep them (S).**~~ **Shipped v2.8537**, as B: cents on both, the cents
   small. The pick was answered on 2026-11-24 from the labeled pictures. The claim, the figure under *This notice*,
   the Months title row and the strip's Claim chip now show their cents through `Money`. The list at the left keeps
   whole dollars, as a column to run the eye down. **Seen live 2026-11-24**, on a draft and on a missed notice, at
   730 px and 380 px: the claim's cents are 15.1 px under 21.6 px dollars, the figure under *This notice* is
   84.8 px in an 88.1 px column, each bill line shows its cents, and nothing slides sideways. What it was: in Months on this job the claim reads *$12,700* and the
   bill lines under it *$12,700.00*. The claim is `formatUsdNoCents`; the lines are `demandMoney` in
   `LienClaimBills.tsx`. It is older than #361 and was carried over by #8990 (v2.7989). Show cents on both or drop
   them on both. **Grace's call**, since it is how her desk reads money. Draw both ways at 730 px and 380 px first.
   - **Still so on 2026-11-24.** The claim is `formatUsdNoCents` at `LienClaimBox.tsx:75`. The same whole dollars
     sit under *This notice* (`LienDeskNoticePane.tsx:637`), on the months bar and on the strip's Claim chip
     (`LienDesk.tsx:2323` and `:2375`). The lines are `demandMoney` at `LienClaimBills.tsx:27`. The smaller-cents
     sweep (#9552, v2.8415) changed neither: in these files it touched only the claim box's split sentence.
   - **It is more than a look.** `formatUsdNoCents` rounds to the dollar. A claim of $12,700.50 reads *$12,701* on
     the desk, over bills that add up to $12,700.50, and the notice itself prints $12,700.50.
   - **The sweep narrows the choice.** Since v2.8415 an amount with cents draws them small through `Money`, and
     `check:small-cents` refuses a plain one on a swept surface. So *cents on both* means small cents on both.
   - **Drawn on 2026-11-24** from the real component on made-up rows, at 730 px and 380 px: Today, A (whole dollars
     on both) and B (cents on both, the cents small, with B in dark beside it). B is the one recommended, since the
     desk then reads the figure the paper prints. At 380 px the longer figure still fits under *This notice*:
     85 px in an 88 px column. The pictures went to Taunya for Grace. They are not in the repo.
2. ~~**The empty card names no next press (XS).**~~ **Shipped v2.8535.** The empty card now reads *No months on
   this job yet. Set the last day of work › gives the job its first month.*, and the press opens the window the
   path's LAST WORK stop opens. A reader with no press reads what gives the job a month. Not seen live: no
   notice looked at on 2026-11-24 has a job with no month, and the ZZ Test job opens no pane while it has no GC. What it was: with no month on the job the card reads only *No months on this job
   yet.* (`LienDeskMonths.tsx`, `data-lien-ledger-empty`), from #8990 (v2.7989). The repo's rule is that an empty
   state says what fills it and offers the press (`EmptyState` with `next`). The next step is the row above it, the
   last day of work and its Change ›. **No one's call**: a rule the card breaks. Still so on 2026-11-24:
   `LienDeskMonths.tsx:238` is `<EmptyState compact main="No months on this job yet." />`, with no `next`.
3. ~~**The late window is read from two sources (XS).**~~ **Shipped v2.8454**, on Taunya's go of 2026-11-24. It was
   real. The desk's `lateUntil` read the affidavit's day off the affidavit windows' list, which holds a job only
   within thirty days of its day. For a day or two after the last notice window closed, with the affidavit's 15th
   moved off a weekend to a Monday 31 or 32 days off, the months card and the footer said the lien right was gone
   over a path that said to send the notice late. The next such day was 2027-04-16. The pane now takes the day from
   the path it draws (`lienLateNoticeUntil`, `LienTimeline.affidavitDay`), under the desk's unchanged rule. The
   example, the sweep and what was run are in `docs/recent-features/v2.8454.md`. It was never seen live: walk 2
   is its look, on a live notice in the late window.
4. ~~**The strip's chips are 18 px tall on a phone (S).**~~ **Shipped v2.8538**, as C: one line that slides
   sideways, 44 px tall, with a 44 px touch area on every press and the chips' look unchanged. The pick was
   answered on 2026-11-24 from the labeled pictures. Measured on a harness of the real pane: the strip pins 45 px
   at 380 px where it pinned 81 px. **Seen live 2026-11-24** at 380 px: one line 45 px
   tall that slides, no scrollbar, the job's name cut at two fifths, each chip 18 px with its touch area 13 px over
   and under. Chromium only, not seen on a real phone. What it was:
   the line that pins to the top of a notice pane holds chips
   that are presses (`lienStripChips`, `.lienStripChip`, #8177, v2.7318). At 390 px each is 18 px tall. The owner's
   answer 5 of 2026-11-20 (#9133) grew every press on the months card to 44 px, not the strip's. **The owner's
   call**, since his answer drew that line. Grow the touch area, not the look, and picture it at 380 px first.
   - **Still so on 2026-11-24**, measured on the real component at 380 px and at 730 px, and read live on walk 1.
     Each chip is 18 px tall in 10.9 px type (`lienRowChipStyle`, `lienDeskRowStyles.ts:13`, a line height of
     18 px). *Show gates ▴* beside them is 18.7 px. The strip with four chips is 81 px tall. The phone work of
     v2.8341 and v2.8346 did not reach the strip.
   - **Drawn on 2026-11-24** at 380 px, with the touch area marked in dashes. A is today. B keeps the look and
     gives each press a 44 px touch area, and the rows move apart, so the strip pins 135 px. C keeps the look and
     the 44 px, on one line that slides sideways, so the strip pins 44 px. C is the one recommended. B and C change
     a phone only, so the 730 px picture is the same for all three. The pictures went to Taunya for the owner.
     They are not in the repo.
5. ~~**Tell Grace (no code).**~~ **Answered 2026-11-24**: the list was given as told, with no objection. It is six
   things with v2.8454's late window. This line rests on that day's session's own report. What it was: the Lien
   desk is Grace's desk. She had not yet heard five things decided or built
   while she was away from the thread. **Grace's**, to hear and to object to any. Taunya or the coordinator tells her.
   - #9134 (v2.8115): Record it… on a missed notice opens with no paper picked and no month ticked. That was the
     owner's answer 1 of 2026-11-20, and it changes how her v2.8027 (#9026) opens.
   - #9215 (v2.8170): a missed notice whose affidavit can still be filed now offers the send in its footer. The
     footer used to say the lien right was gone. Taunya kept the send on 2026-11-21.
   - #9262 (v2.8206): a missed notice that can no longer go folds its gates to one line, as a sent notice does.
     Taunya's pick.
   - #9305 (v2.8234): her open choice on #361, the figure in the head of the notice's column, was answered by
     Taunya from three mock-ups. The claim now sits small under the name.
   - #9211 (v2.8167): a sent notice's strip and months bar name the months it went for, not *No month picked*.
6. ~~**A long next step runs off the strip (XS).**~~ **Shipped v2.8538**, with loose end 4. At a desk a chip too
   long for the strip wraps inside its own shape, and on a phone C's sliding line holds it. Measured on a harness:
   the pane slides sideways 0 px where it slid 150 px and 152 px. **Seen live 2026-11-24** on the missed notice of
   walk 1's kind: at 730 px the red chip wraps to two lines, 36 px tall, inside the strip, and at 380 px it keeps
   its one line on the sliding strip. Nothing slides sideways at either width. What it was: found on walk 1,
   2026-11-24. The strip's third chip is the path's
   next step. On a missed notice that can no longer go it is a whole sentence in red: *The affidavit window closed
   with nothing filed — the lien is gone; the money is still owed ›*. A chip cannot wrap (`lienRowChipStyle`,
   `whiteSpace: 'nowrap'`), so the chip is cut at the right edge and the pane slides sideways: 150 px at 380 px,
   152 px at 730 px, once the strip shows. The strip is from #8177 (v2.7318). **No one's call** that it must fit.
   How it fits rides loose end 4: C's sliding line holds it, and A or B needs the chip to wrap or say less.

## Walks still owed

Walks 1, 2 and 4 are done. Walks 3, 5, 6 and 7 are owed, and *Where the walks stand* under the list says what each
needs.

Every walk is read-only: open the page, read it, press nothing that saves. On the dev server a save writes prod.
Sign in with `node scripts/dev-pane-login.mjs`, never a typed password. If the browser pane is in another session's
View as, read in a throwaway headless Chrome instead. The page is `/lien-desk?tab=notices&job=<job id>` unless the
line says otherwise. Each is read at 730 px and 380 px, in light and in dark. Name no job or customer in what you write.

1. **Done 2026-11-24. The three fixes as pictures (#9211, #9262, #9305)**, as the dev. On a sent notice, the strip's second chip names
   the months it went for. On a missed notice that can no longer go, the gates are one quiet line with no red, and
   the strip opens with a grey *Window closed* chip. On a draft, *This notice* has its claim in small figures under
   it, inside the column. All three read right on clicktooling.com, at 730 px and 380 px, in light and in dark.
   - The sent notice's second chip names its month, as *Sep ›*.
   - The missed notice's gates read *Window closed Sep 15 · nothing sent* over one quiet line, with no red in the
     head or the line. Its strip opens with a grey *Window closed Sep 15 ›*. The strip does hold one red chip, the
     path's next step, which is not the gates' word. That chip is too long for the strip: loose end 6.
   - The draft's claim sits under *This notice*, inside its column, in 11.5 px figures under a 12 px name.
   - Nothing slid sideways at either width but loose end 6. The strip's chips were 18 px tall live: loose end 4.
   - How: one throwaway headless Chrome, one page load, every write stopped at the browser, the theme set on the
     page. The pictures show real jobs, so they stayed out of the repo.
   - The desk that day held one notice to draft, eight ready, six printed, two sent and one missed. The missed one
     is past the late window and has one closed month, so walks 2 and 3 still wait.
2. **Done 2026-11-24, on a staged ZZ Test job. A missed notice in the late window (#9215)**, as the dev. Pick a missed notice whose every window closed
   unsent, while the affidavit is unfiled and its day is ahead. The card says *a late notice can still go · the
   affidavit by <day>*. The footer holds *Ask the leader to approve* under *Sign and send · Not signed yet*. The
   closed month's stop says *A late notice can still go, and the affidavit can follow it*. Nothing says the lien
   right is gone. Not walked because no live notice is in the late window; the one on 2026-11-21 was past it.
   - It read right at 730 px and 380 px, in light and in dark, by that day's session's own report. The card said
     *a late notice can still go · the affidavit by Dec 15*. The footer's head was *Sign and send · Not signed
     yet*. The closed month's stop said *A late notice can still go, and the affidavit can follow it*. Nothing
     said the lien right is gone, and the path said *Send the Sep notice late*.
   - One difference from the words above: the footer said *Don't send yet. Enter the owner of record…* in place
     of *Ask the leader to approve*, because the ZZ Test job has no property record.
   - It was a day the windows' list held the job, so it is not v2.8454's own case. That case has still not been
     seen live. Its next day is 2027-04-16.
   - Staged through the dev seat: the job was given a ZZ Test GC and a last day of work set by hand. Both were
     put back after, and read back as before on 2026-11-24.
3. **A missed notice that can no longer go, with two or more closed months (#9262)**, as the dev. The gates' line
   and the strip's first chip read *Windows closed, the last <day>*, and the months bar reads *<months>, closed*.
   Not walked because the one live case has a single closed month.
4. **Done 2026-11-24, on the staged ZZ Test job. A notice with two or more earlier papers (#9130)**, as the dev, on a draft whose job has two sent notices. At
   730 px the grid slides inside its frame and *This notice* stays pinned at the right edge. At 380 px the earlier
   papers are *A ✓* marks and the tick keeps the right edge. Not walked because no live notice has two earlier papers.
   - Read on the live desk, pressing nothing that saves. The job's draft named an open month over two earlier
     papers for one closed month, both recorded by hand.
   - In a narrow card the two earlier papers are *A ✓* and *B ✓* marks under the month, and the tick keeps the
     right edge. Nothing runs past the edge. That is the card at a 380 px window, and also at a 730 px window,
     where the pane is 362 px wide.
   - In a wide card at a 632 px pane the grid slides inside its frame, by 51 px. *This notice* stays pinned at
     the right edge and draws its edge line. Neither the pane nor the page slides.
   - One difference from the words above: at a 732 px pane the grid did not slide. Two short by-hand papers fit
     it exactly. It slides at that width only when the papers' words are longer.
   - The widths above are the pane's. The months card takes its narrow shape at 560 px and under.
5. **A closed month noted by someone with a long name (#9075)**, as the dev, on a notice with a noted closed month.
   At 380 px the *noted by* line wraps inside its column and never runs under the tick. Not walked on a real long
   name; it was seen only on made-up names.
6. **A sent notice whose record names no month (#9211)**, as the dev. The strip reads *No month named ›*, and the
   months bar *no month named*. Neither asks for a pick. Not walked because no such record exists; all seventeen sent
   records named their months on 2026-11-21.
7. **The affidavit's side of the owner's answer 1 (#9134)**, as the dev, on a ZZ Test sub job with a missed notice.
   This walk writes, so it is the one walk not done on a real job. Record a paper by hand for its closed month
   through the months card's Record it…. Then open `/lien-desk?tab=affidavits` and pick the job. *Months the
   affidavit claims* reads that month *on the lien*, whatever the paper's date. Delete the ZZ rows after. Not walked
   because it was read only in the code, and a real case needs a real paper recorded.

## Where the walks stand

Read on 2026-11-24. Staging a walk writes on a ZZ Test job through the dev seat. The owner gave a standing yes for
ZZ Test rows that day. What walks 3 and 5 need is that day's session's reading, written here as it left it.

- **Walk 3** was not staged. Two closed months need approved clock hours in two past months, and hours cannot be
  put in a past month through the app. It waits on a live case.
- **Walk 4** is done. It was staged twice: the ZZ Test job's GC set and its last day of work set by hand to a
  day in a month still open, two writes on the job's row, and both put back after the look.
- **Walk 5** was not staged: the *noted by* line needs a note made by another account, one with a long name. It
  waits on a live case.
- **Walk 6** cannot be staged. No press makes a sent record that names no month: the by-hand form and the dev
  seat's verb both refuse a paper with no months. It waits on a live case, and there may never be one.
- **Walk 7** is half done. Record it… on the months card opened the by-hand form with the closed month ticked,
  and one record was written: one new filing and nothing else. The affidavit pane then drew no *Months the
  affidavit claims* card, and its path read *§ 53.056 notice · no work month yet*. The build for the card,
  v2.8541, is live since 2026-11-24, and so is the path's own build, v2.8554. The reading waits on a new record
  by hand, made in one sitting with the look at the path.

## Found on the walks

~~**The affidavit pane draws *Months the affidavit claims* only for a job with approved clock hours.**~~ **Shipped
v2.8541**, on the owner's pick of 2026-11-24: draw the card from the job's stand-in month. Found on walk 7 that
day. The pane built the card when the job's clock months were not empty, so a job dated by hand, by a bill or by
its creation never showed it, whatever notice was on record. The card now takes the months of the paper's own
span for such a job. Each month says what it rests on in place of its hours, and its notice is read against it
as for a clock month. The other way, to leave the rule and say so in one quiet line, was not taken. Not seen
live yet: walk 7 is its look, and it needs a new record by hand on a ZZ Test job, since the first one is voided.
Walk 7 also read *no work month yet* on the path's § 53.056 stop. That reading was looked into after, and is the
finding under *Found after the walks*, shipped v2.8554.

## Left on prod

Nothing live. The two § 53.056 notice filings the walks recorded by hand on the ZZ Test job were voided on
2026-11-24, after walk 4, with the Void press on each record in the job's Lien window. Their ids start `b32b3eba`
and `ccb70578`. Each void wrote one column on one row, and no paper was tied to either, so nothing else moved.
The job reads as before the walks: no GC and no last day of work set by hand.

Two things stay that nothing takes back, and both were sent to punch list #443, the standing list of presses
nothing takes back:

- A voided record cannot be un-voided, and nothing deletes a filing. Both rows stay in the table, voided.
- Each by-hand record left one line on the job's activity, and the void does not take the line off.

## Found after the walks

~~**The desk's path forgets a notice that is only on record.**~~ **Shipped v2.8554**, on the owner's yes of
2026-11-24. Walk 7 read *§ 53.056 notice · no work month yet* on the path of a job with a notice on record. It was
not about clock hours. The desk's path took its notice months from the month reader and from desk papers that read
sent, and never from the notices on record. A notice recorded by hand on a job with no live paper leaves no paper
that says sent, and the reader drops a noticed month a week after its notice day. The path now reads every month a
live record names as sent, on the day it went, as the Lien window's path always has. No date moved. On prod that
day, by count: two billed sub jobs had a notice on record that the path could not see, and three more had a record
that named more months than their sent paper. Not seen live yet.

## How to retire it

Strike each piece as it ships, with its version. Delete the card when the five builds are shipped or
dropped by their caller, Grace has heard the five, each walk is done or dropped, and the finding's build has shipped.
