---
name: "Materials on site: a better door on the Job Mode card"
number: 407
group: close
status: assessed, mocked up three ways and built the way the owner picked, v2.8050 · the three doors that turned people away are fixed, v2.8060 · the card says boxes due a count and stickers waiting, v2.8103 · each walked on the dev server on 2026-11-20 · not yet looked at on a crew's phone
summary: >
  On the Job Mode card a small underlined link, Materials on site, sat alone between the day's stops
  and the pace card, on every job. Almost no job has material left on site. The owner asked for a whole
  look at where the door belongs. The assessment found the doors each role has, checked his 99% on the
  live data and drew three ways on a phone mock-up. He picked the second: the door stays on every job
  as a proper press beside Job calendar, and it shows a count when the job's site holds boxes.
next: Look at the press on a crew's phone on the one site that holds boxes.
size: S (one client-only PR)
blocker: None.
ver: v2.8050, v2.8060, v2.8103
opinion: build — built; the press costs no line on the card and now says when a site holds something
---

# Materials on site: a better door on the Job Mode card (#407)

The mock-up is [`mockup.html`](mockup.html). Its names, job numbers and counts are made up.
The repo is public, so nothing below is a real name or a real figure.

## The ask

The owner, 2026-11-20, from a walk of the app on his phone, with the link circled on a screenshot:

> I don't like how this materials on site button looks, I don't think it's a good part of the user
> flow, and for 99% of jobs there are no materials left on site. Can you help me holistically look at
> this and help me come up with a better place to offer it as a door to a user?

## What the assessment found

Read from the code on `main` and from the dev seat reading as itself, 2026-11-20.

### The doors

- **A field crew** had the card's link, on every day state and with no check for boxes. Clocked in it
  opened that job. Otherwise it opened whichever job the tally listed first. Beside it: a scanned label
  or sticker, and the **Materials on site** fold in Job detail's Today's work, which already says what
  is there or *nothing yet*. Indirect ways: the Dashboard's Tally square, Settings' Job Parts Tally and
  the search's box rows. A field crew has no bottom-bar entry, no menu entry, no search door named
  On site and no Needs you line about materials.
- **The office** has Materials → On site, Jobs → Materials, the Pipeline tools menu's Materials desk,
  the job window's Materials tab, the Procure step's line, two Needs you lines, the Development page's
  report and site screen, and the site screen's By person look.

### The 99%

It held. About one working job in fifty held a live box, and one job on that day's schedule. One crew
member had pressed anything on site in thirty days, on the three days the site was first counted.

Two things the counts showed that the ask did not:

- **Boxes belong to a site more than to a job.** Every real box stood on one site, and all but two of
  them under a sister job nobody was scheduled on. A count of the scheduled job alone would have said two.
- **Sticker runs follow the boxes.** The only run printed for a real job was that site's.

### Who needs the door

- A person standing at a box. The label is their door already.
- A crew arriving at a site that holds boxes. Nothing on the card told them.
- A person leaving material behind for the first time, at the end of a visit.
- The office, whose doors are fine.

## The three ways

| | Way A | Way B | Way C |
|---|---|---|---|
| A job with boxes | A row with the count, in the job's head | A press with the count, beside Job calendar | Nothing |
| A job with none | Nothing | The press, no count | Nothing |
| No schedule | Nothing | Nothing | Nothing |
| The first box | The office's sticker puts the row on the card | The press, then Add a container | The sticker's scan, or Job detail |

The recommendation was Way A, on the strength of the 99%.

## What the owner said

- Asked whether crews start a job's first box on their own or the office hands them stickers first, he
  pressed **Crews start it**, then wrote: *the office hands them a sticker, but they can identify
  materials and a box on their own*. Way A was redrawn around it: the row would also draw on a job with
  stickers waiting, and the row first proposed for Leave report was dropped.
- Offered **Build Way A** and **Build Way B**, he pressed **Build Way B**.
- Shown Way B on the real card in three pictures, he said **Wrap it up**.

## What was built (v2.8050)

Job calendar and Materials on site are one row of presses under the job's address. The press shows the
count of the live cages and boxes on the job's site, opens the job the card names, and is not drawn on
a card that names no job. The detail is in [`docs/recent-features/v2.8050.md`](../../docs/recent-features/v2.8050.md).

## Left

- **A look on a crew's phone.** The walk was on the dev server with a made-up stop on the ZZ test job.
- **A real estimator's read.** The walk of v2.8060 kept the dev's sign-in, so every job was readable.

## The three doors (v2.8060)

The owner, 2026-11-20: *let's look at the three doors that may turn people away*. Walked by hand as each
role, the fault was real. The search's box rows, the Procure step's link and the job window's *Open the
materials page* all opened Jobs → Materials, which sent a primary and a superintendent to Reports and an
estimator to the Bid Board. Each now opens the Tally's On site tab on the job for everyone but the office.
The detail is in [`docs/recent-features/v2.8060.md`](../../docs/recent-features/v2.8060.md).

## Due a count and the stickers waiting (v2.8103)

The owner, 2026-11-20, asked for the last three things left on this card: the Procure link walked on a live
bid, *"Due a count" on the press, which needs a small database function*, and *the stickers-waiting line,
which belonged to Way A*.

- The Procure link was walked on the ZZ test bid as the office and as an estimator. Both landed where
  v2.8060 says.
- The card has one line under its two presses, only where the site has news: how many boxes are due a
  count, and how many printed stickers are ready for a box. It is a line and not a second number on the
  press, since two numbers pushed the pair of presses onto two rows on a phone.
- One database function answers the site's boxes, the ones due and the stickers.

The detail is in [`docs/recent-features/v2.8103.md`](../../docs/recent-features/v2.8103.md).
