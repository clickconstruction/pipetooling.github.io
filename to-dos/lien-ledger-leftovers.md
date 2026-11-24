---
name: "Lien desk: what the ledger (#361) left, to do later"
number: 415
group: residual
status: saved 2026-11-21 when #361 closed, on Taunya's word *save it all to a punch list card* · nothing built tonight on her word · every follow-up the thread of #361 left is here · its walks and loose ends written out in full on 2026-11-22, for Taunya's ask that every card say what is still to do and what still needs walking · read again against `main` on 2026-11-24, nothing built: loose ends 1, 2 and 4 stand as written, loose end 3 is real, walk 1 is done and left loose end 6, and the pictures for loose ends 1 and 4 went to Taunya
summary: >
  Punch list #361 rebuilt the Lien desk's Months on this job as one card, the ledger, and closed on
  2026-11-21 once every choice made with it was built and live. Its last night left a handful of
  small things. Five are builds: the claim's dropped cents, an empty card with no next press, a late
  window the desk and the timeline read from two sources, strip chips too small on a phone, and a
  strip chip too long for its strip. One is five things Grace has not been told. Six are walks: five
  screens seen only on made-up rows because no live notice is in that state yet, and one affidavit
  reading never walked. The look at the three fixes of 2026-11-21 in both themes was walked on
  2026-11-24. Only the late window has a date: the desk and the timeline next part on 2027-04-16.
  Taunya wants every one of them done, later.
next: Taunya says which piece to build first. Tell Grace the five things in loose end 5 first, since that costs no code. Walk 7 can be done any time on a ZZ Test job. Walks 2 to 6 wait on a live notice in that state. Loose end 3 is real and is the one with a date, so build it before 2027-04-16. Loose ends 2 and 6 can be built in a quiet hour. Loose ends 1 and 4 change how a screen looks: their labeled pictures at 730 px and 380 px went to Taunya on 2026-11-24, and each waits on its caller's pick.
size: five small builds (1 S · 2 XS · 3 XS · 4 S · 6 XS), one word to Grace, six walks (XS each; five wait on live cases)
blocker: None for the builds. The walks wait on live notices in the states they name.
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
the desk's files. Nothing was built that day.

1. **The claim drops cents while its bills keep them (S).** In Months on this job the claim reads *$12,700* and the
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
2. **The empty card names no next press (XS).** With no month on the job the card reads only *No months on this job
   yet.* (`LienDeskMonths.tsx`, `data-lien-ledger-empty`), from #8990 (v2.7989). The repo's rule is that an empty
   state says what fills it and offers the press (`EmptyState` with `next`). The next step is the row above it, the
   last day of work and its Change ›. **No one's call**: a rule the card breaks. Still so on 2026-11-24:
   `LienDeskMonths.tsx:238` is `<EmptyState compact main="No months on this job yet." />`, with no `next`.
3. **The late window is read from two sources (XS, checked: it is real).** The desk's `lateUntil` (`LienDesk.tsx`) is the
   affidavit's day from the affidavit windows' list. #9215 (v2.8170) made the missed notice's footer depend on it.
   The timeline's `late_notice` (`lienTimeline.ts`, #4717, v2.4708) uses its own filing deadline. That list leaves
   out a job whose day is more than the lead window ahead. There, the card and the footer say the lien right
   is gone while the timeline says to send the late notice. The gap is one or two days wide, and it was built in a
   scratch unit test on 2026-11-24. **No one's call**: both should read one source.
   - **Why they part.** `lateUntil` (`LienDesk.tsx:1299`) finds the job in `data.affidavits.entries`. The desk keeps
     a windows row only when its day is 30 days off or nearer, or the job has a started affidavit paper
     (`lienDeskKeepRows`, `lienDeskStarted.ts:63`). The timeline falls back to the last month's own filing day
     (`lienTimeline.ts:509`), so it never loses the job. The last notice day is a 15th and the affidavit's day is
     the next month's 15th, each moved to Monday off a weekend. So the day after the notice window closes, the
     affidavit is up to 32 days off. When it is 31 or 32 the list has no row, `lateUntil` is null, and the desk
     says gone. That takes an affidavit 15th on a weekend.
   - **The smallest example.** A commercial sub job last worked in January 2027, nothing sent, no affidavit drafted.
     The notice day is Thursday Apr 15, 2027. May 15 is a Saturday, so the affidavit's day is Monday May 17. On
     Friday Apr 16 that is 31 days off. The months card says *lien right gone · the money still rides*. The footer
     says *Window closed · Nothing to sign* and offers no send. The gates fold to *Window closed Apr 15*. On the
     same pane the path says *Send the Jan notice late, then file the affidavit — 31 days*, and the billed row and
     the Deadlines board say to send it late too. On Saturday Apr 17 the day is 30 off, and the desk says *a late notice can
     still go · the affidavit by May 17* again.
   - **How often.** The test ran every work month from 2025 to 2030 on the three clocks (commercial, residential,
     kind not set), every day from the notice day to two days past the affidavit's: 7,005 days. The two parted on
     69 of them, in 48 of the 216 pairs of month and clock, never for more than two days running, and always the same way: the desk says
     gone, the timeline says send it late. Never the reverse. The days ahead: 2027-04-16, 2027-07-16, 2027-12-16
     and 17, 2028-03-16 and 17, 2028-06-16. In 2026 it was Jan 16, Jul 16 and 17, and Oct 16. A job with a started
     affidavit paper stays on the list and never parts.
   - **Where the one source already is.** The notice's own entry carries `affidavitDay` (`lienDesk.ts:346`,
     v2.7273): the windows' day when they list the job, else the last month's filing day. `lateUntil` does not read it.
   - **How sure.** Sure of the gap and its width for a job dated by one clock. The kernels ran as they are
     (`buildLienDeskQueue`, `buildLienAffidavitQueue`, `lienDeskKeepRows`, `buildLienTimelineFromDesk`,
     `lienNoticeFootHead`, `buildLienPayRunway`). Three things were not run. `lateUntil` is written inside
     `LienDesk.tsx`, so its five lines were copied into the test. The two readers' day filters were written from
     their SQL (`20261118230000_lien_closed_days.sql`), not run on a database. And it was never seen live: no
     notice has been in the late window on a parted day since v2.8170. The test was a scratch file and is not in
     the repo.
4. **The strip's chips are 18 px tall on a phone (S).** The line that pins to the top of a notice pane holds chips
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
5. **Tell Grace (no code).** The Lien desk is Grace's desk. She has not yet heard five things decided or built
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
6. **A long next step runs off the strip (XS).** Found on walk 1, 2026-11-24. The strip's third chip is the path's
   next step. On a missed notice that can no longer go it is a whole sentence in red: *The affidavit window closed
   with nothing filed — the lien is gone; the money is still owed ›*. A chip cannot wrap (`lienRowChipStyle`,
   `whiteSpace: 'nowrap'`), so the chip is cut at the right edge and the pane slides sideways: 150 px at 380 px,
   152 px at 730 px, once the strip shows. The strip is from #8177 (v2.7318). **No one's call** that it must fit.
   How it fits rides loose end 4: C's sliding line holds it, and A or B needs the chip to wrap or say less.

## Walks still owed

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
2. **A missed notice in the late window (#9215)**, as the dev. Pick a missed notice whose every window closed
   unsent, while the affidavit is unfiled and its day is ahead. The card says *a late notice can still go · the
   affidavit by <day>*. The footer holds *Ask the leader to approve* under *Sign and send · Not signed yet*. The
   closed month's stop says *A late notice can still go, and the affidavit can follow it*. Nothing says the lien
   right is gone. Not walked because no live notice is in the late window; the one on 2026-11-21 was past it.
3. **A missed notice that can no longer go, with two or more closed months (#9262)**, as the dev. The gates' line
   and the strip's first chip read *Windows closed, the last <day>*, and the months bar reads *<months>, closed*.
   Not walked because the one live case has a single closed month.
4. **A notice with two or more earlier papers (#9130)**, as the dev, on a draft whose job has two sent notices. At
   730 px the grid slides inside its frame and *This notice* stays pinned at the right edge. At 380 px the earlier
   papers are *A ✓* marks and the tick keeps the right edge. Not walked because no live notice has two earlier papers.
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

## How to retire it

Strike each piece as it ships, with its version. Delete the card when the five builds are shipped or
dropped by their caller, Grace has heard the five, and each walk is done or dropped.
