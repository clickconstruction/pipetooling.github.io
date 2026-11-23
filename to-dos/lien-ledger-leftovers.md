---
name: "Lien desk: what the ledger (#361) left, to do later"
number: 415
group: residual
status: saved 2026-11-21 when #361 closed, on Taunya's word *save it all to a punch list card* · nothing built tonight on her word · every follow-up the thread of #361 left is here · its walks and loose ends written out in full on 2026-11-22, for Taunya's ask that every card say what is still to do and what still needs walking
summary: >
  Punch list #361 rebuilt the Lien desk's Months on this job as one card, the ledger, and closed on
  2026-11-21 once every choice made with it was built and live. Its last night left a handful of
  small things. Four are builds: the claim's dropped cents, an empty card with no next press, a late
  window the desk and the timeline read from two sources, and strip chips too small on a phone. One is
  five things Grace has not been told. Seven are walks: five screens seen only on made-up rows because
  no live notice is in that state yet, the three fixes of 2026-11-21 still to be looked at as pictures
  in both themes, and one affidavit reading never walked. Nothing here is urgent. Taunya wants every
  one of them done, later.
next: Tell Grace the five things in loose end 5 first, since that costs no code. Walk 1 can be done any time, and walk 7 on a ZZ Test job. Walks 2 to 6 wait on a live notice in that state. Loose ends 2 and 3 can be built in a quiet hour. Loose ends 1 and 4 change how a screen looks, so they go to their caller as labeled A/B mock-ups at 730 px and 380 px first.
size: four small builds (1 S · 2 XS · 3 XS · 4 S), one word to Grace, seven walks (XS each; five wait on live cases)
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
  themes is walk 1 below.

## Loose ends to build

Each names the PR it comes from and whose call it is.

1. **The claim drops cents while its bills keep them (S).** In Months on this job the claim reads *$12,700* and the
   bill lines under it *$12,700.00*. The claim is `formatUsdNoCents`; the lines are `demandMoney` in
   `LienClaimBills.tsx`. It is older than #361 and was carried over by #8990 (v2.7989). Show cents on both or drop
   them on both. **Grace's call**, since it is how her desk reads money. Draw both ways at 730 px and 380 px first.
2. **The empty card names no next press (XS).** With no month on the job the card reads only *No months on this job
   yet.* (`LienDeskMonths.tsx`, `data-lien-ledger-empty`), from #8990 (v2.7989). The repo's rule is that an empty
   state says what fills it and offers the press (`EmptyState` with `next`). The next step is the row above it, the
   last day of work and its Change ›. **No one's call**: a rule the card breaks.
3. **The late window is read from two sources (XS, check first).** The desk's `lateUntil` (`LienDesk.tsx`) is the
   affidavit's day from the affidavit windows' list. #9215 (v2.8170) made the missed notice's footer depend on it.
   The timeline's `late_notice` (`lienTimeline.ts`, #4717, v2.4708) uses its own filing deadline. That list leaves
   out a job whose day is more than the lead window ahead. There, the card and the footer would say the lien right
   is gone while the timeline says to send the late notice. This was never seen, and the gap may be a day or two wide.
   Build the case in a unit test. **No one's call** if they can part: both should read one source.
4. **The strip's chips are 18 px tall on a phone (S).** The line that pins to the top of a notice pane holds chips
   that are presses (`lienStripChips`, `.lienStripChip`, #8177, v2.7318). At 390 px each is 18 px tall. The owner's
   answer 5 of 2026-11-20 (#9133) grew every press on the months card to 44 px, not the strip's. **The owner's
   call**, since his answer drew that line. Grow the touch area, not the look, and picture it at 380 px first.
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

## Walks still owed

Every walk is read-only: open the page, read it, press nothing that saves. On the dev server a save writes prod.
Sign in with `node scripts/dev-pane-login.mjs`, never a typed password. If the browser pane is in another session's
View as, read in a throwaway headless Chrome instead. The page is `/lien-desk?tab=notices&job=<job id>` unless the
line says otherwise. Each is read at 730 px and 380 px, in light and in dark. Name no job or customer in what you write.

1. **The three fixes as pictures (#9211, #9262, #9305)**, as the dev. On a sent notice, the strip's second chip names
   the months it went for. On a missed notice that can no longer go, the gates are one quiet line with no red, and
   the strip opens with a grey *Window closed* chip. On a draft, *This notice* has its claim in small figures under
   it, inside the column. Not walked because the live reads took words and widths only, at 1,440 px and 390 px, in
   one theme.
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

Strike each piece as it ships, with its version. Delete the card when the four builds are shipped or
dropped by their caller, Grace has heard the five, and each walk is done or dropped.
