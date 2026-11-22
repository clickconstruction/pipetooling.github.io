---
name: "Lien desk: what the ledger (#361) left, to do later"
number: 415
group: residual
status: saved 2026-11-21 when #361 closed, on Taunya's word *save it all to a punch list card* · nothing built tonight on her word · every follow-up the thread of #361 left is here
summary: >
  Punch list #361 rebuilt the Lien desk's Months on this job as one card, the ledger, and closed on
  2026-11-21 once every choice made with it was built and live. Its last night left a handful of
  small things: two words-and-look faults older than the card, two older presses that are too small
  or say too little, one rule the desk and the timeline each read their own way, five screens that
  have only been seen on made-up rows because no live notice is in that state yet, and five things
  Grace has not been told. Nothing here is urgent. Taunya wants every one of them done, later.
next: Nothing tonight, on Taunya's word of 2026-11-21. Later, tell Grace the five things first, since that costs no code. Then any piece in a quiet hour. The two pieces that change how a screen looks (1 and 4) go to Taunya as labeled A/B mock-ups at 730 px and 380 px before any build. The five walks wait on a live notice in that state.
size: S pieces (1 S · 2 XS · 3 XS · 4 S · 5 S), five walks (XS each, waiting on live cases), one word to Grace
blocker: None for the builds. The walks wait on live notices in the states they name.
---

# Lien desk: what the ledger (#361) left, to do later (#415)

## Where this comes from

Punch list #361 closed on 2026-11-21. Its closed line in `to-dos/README.md` names what it built:
v2.7989, then the fixes and answers through v2.8234. On closing it, Taunya said: *"save it to a
punch list card for us to do. I don't wanna build anything more tonight on this, but I wanna do
every single follow-up at a later time."* This card is every follow-up that thread left.

## Builds

1. **The claim drops cents while its bills keep them (S, a look choice).** In Months on this job
   the claim reads *$12,700* and the bill lines under it read *$12,700.00*. The claim is
   `formatUsdNoCents`; the bills are `demandMoney` in `LienClaimBills.tsx`. This is older than #361;
   the ledger carried it over. Show cents on both, or drop them on both. Draw both ways first.
2. **The empty card names no next press (XS).** With no month on the job the card reads only
   *No months on this job yet.* (`LienDeskMonths.tsx`, `data-lien-ledger-empty`). The repo's rule is
   that an empty state says what fills it and offers the press (`EmptyState` with `next`). A comment
   there says the next step is the row above it, the last day of work and its Change ›. Name it in
   the empty line too.
3. **The desk and the timeline read the late window from two sources (XS, check first).** The desk's
   `lateUntil` (`LienDesk.tsx`) is the affidavit's day from the affidavit windows' list. The timeline's
   `late_notice` (`lienTimeline.ts`) uses its own filing deadline. That list leaves out a job whose day
   is more than the lead window ahead. A job whose last notice window just closed could fall in that gap.
   There, the months card and the footer would say the lien right is gone while the timeline says
   *send the late notice*. This was never seen, and the gap may be only a day or two wide. Build the
   case in a unit test. If they can part, have both read one source.
4. **The strip's chips are 18 px tall on a phone (S, a look choice).** The line that pins to the top of
   a notice pane once it scrolls holds chips that are presses (`lienStripChips`, `.lienStripChip`).
   At 390 px each is 18 px tall. The rule for a phone is 44 px to the touch. The owner's answer 5 of
   2026-11-20 grew every press on the months card, not the strip. This is older than #361. Grow the
   touch area, not the look, the way the card's presses did, and picture it first.
5. **Tell Grace (no code).** The Lien desk is Grace's desk. She has not yet heard these five, all decided
   or built while she was away from the thread:
   - Record it… on a missed notice opens with no paper picked and no month ticked. That was the
     owner's answer 1 of 2026-11-20, and it changes how her v2.8027 opens.
   - A missed notice whose affidavit can still be filed now offers the send in its footer (v2.8170).
     The footer used to say the lien right was gone. Taunya kept the send on 2026-11-21.
   - A missed notice that can no longer go folds its gates to one line, *Window closed Aug 15 · …*,
     as a sent notice does (v2.8206, Taunya's pick).
   - Her open choice on #361, the figure in the head of the notice's column, was answered by Taunya
     on 2026-11-21. The claim now sits small under the name (v2.8234). She was shown three ways.
   - A sent notice's strip and months bar name the months it went for, not *No month picked* (v2.8167).

## Walks waiting on a live case

Each of these was built and tested on made-up rows. None has a live notice in its state yet. Walk
each read-only, at a desk and at 390 px, the first time one appears.

1. **A missed notice in the late window**: every window closed unsent, the affidavit not filed and its
   day ahead. The footer should hold the send, and the closed month's stop should say a late notice
   can still go (v2.8170).
2. **A missed notice that can no longer go, with two or more closed months.** The gates' line
   should open *Windows closed, the last Oct 15* (v2.8206). The one live case has a single month.
3. **A notice with two or more earlier papers.** The tick column should stay pinned at the right edge
   while the grid slides (v2.8116, the owner's answer 2).
4. **A closed month noted by someone with a long name, on a phone.** The *noted by* line should wrap
   inside its column (v2.8074).
5. **A sent notice whose record names no month.** The strip should read *No month named ›* and the
   months bar *no month named* (v2.8167). All seventeen sent records named their months on 2026-11-21.

The affidavit's side of the owner's answer 1 belongs here too. A closed month recorded by hand through
Record it… reads as noticed, whatever the paper's date, and the affidavit reads the same rows. This
was read in the code and never walked. Walk it on a ZZ Test job, or on the first real one.

## How to retire it

Strike each piece as it ships, with its version. Delete the card when the five builds are shipped or
dropped by Taunya, Grace has heard the five, and each walk is done or dropped.
