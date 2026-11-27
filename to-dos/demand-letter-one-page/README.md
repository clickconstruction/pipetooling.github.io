---
name: Demand letter — the letter on one page, the account behind it
number: 333
group: close
status: LIVE 2026-11-13 (v2.7086, PR #7870), on the owner's word *Yes, build it* · the owner looked on 2026-11-24 and had one comment, the small Pay online label in the amount box, taken out in v2.8549 · the shorter box seen live 2026-11-25, 19 px shorter at 390 px with *Pay online* gone · left: the PDF's own look, and counsel's eye on the one changed phrase
summary: >
  A demand letter from the Lien window runs about a page and a half. It breaks after the statement of account, so the
  demand and the signature land on page 2. The suggestion puts the whole letter on page 1, signed, with the pay code in
  the amount box, and moves the statement of account, the notice history and the enclosures to page 2. All of it on one
  sheet was measured and does not fit.
next: The owner presses Open the PDF on the sample, in Settings → What customers see → Lien letters → Final demand letter, if he wants the PDF's own look: the walk could not open it. Then he says whether counsel's eye on the changed phrase is still owed, and the folder goes. Answered 2026-11-27 by Taunya, *Second nine stand*, to the pick *Yes, send it to counsel*: counsel reads the one changed phrase, and the card stays open until that read.
size: XS
blocker: the owner's word on counsel's eye. v2.8549 was seen live on 2026-11-25.
ver: v2.7086 · v2.8549
opinion: build — it is built; the look is hers
---

# Demand letter: the letter on one page (#333)

## The ask, in the owner's words

2026-11-12, on the export of the lien letters from the live site (punch list #326), with the demand letter's two pages
in front of her:

> take a look at this page as well, how could we help make it all fit on one page?

And, after she was told the letter the Lien window sends is longer than the sample: *Yes, mock it up.*

## What was found

- **The sample was short.** The demand letter in Settings → What customers see is the short form: four lines of debt
  and one notice. v2.7080 holds that one on a page with a tighter setting.
- **The letter the Lien window builds is longer.** It carries a statement of account, a pay code, the fee and interest
  lines, a dated notice history and its enclosures. It runs about a page and a half.
- **It breaks in the wrong place.** The *Demand* heading asks for 72 mm before it starts, so the letter stops after the
  statement and the demand itself opens page 2. The signature is on page 2 for every shape tried.
- **Almost nothing has been sent.** The app holds one recorded demand letter, from September, voided. So there is no
  body of real letters to test on, and nobody depends on the present look.

## All of it on one sheet: measured, and it does not fit

The first thing tried, since it is what she asked for. The suggestion below was drawn with no page break and the type
allowed to step down to 10 point (the lien letters' floor, v2.7071). On five made-up letters:

- The shortest still ran about 83 mm past the page at 11 point, a third of a sheet.
- No step down to 10 point held any of the five on one page.

To fit, the letter would have to lose the statement of account or the notice history. Those are counsel's to cut.

## The suggestion

`mockup.html`: one board, *Now* beside *My suggestion*, both drawn by the letter's own code for one made-up job.

**Page 1 is the whole letter, signed. Page 2 is the account behind it.**

1. **The pay code** moves into the amount box, a third cell beside *Balance due* and *Pay in full by*. A letter with two
   or more payable bills keeps its codes on page 2, above the bills they pay.
2. **The statement of account, the notice history and the enclosures** move to page 2, in that order. *Copies to* stays
   last.
3. **The signature** drops the phone and the email when the letterhead already shows them.
4. **One phrase changes**: *for the work below* becomes *for the work on the statement of account behind this letter*.
   No other word changes, and the order of the demand's own sentences is as it was.
5. **The fit of v2.7080 guards page 1**: when the letter runs past the page, the lines close up and then the type steps
   down, and the first setting that holds the signature on page 1 is used.

### Tested on five made-up letters

| Letter | Now | Suggestion |
|---|---|---|
| One bill, two notices, a house (no lien line) | signed on page 2 | signed on page 1, 11 pt |
| One bill, three notices, the lien line | signed on page 2 | signed on page 1, 11 pt |
| One bill of five lines, six notices, the lien line, two copies | signed on page 2 | signed on page 1, 11 pt |
| Three bills, four notices, the lien line | signed on page 2 | signed on page 1, 11 pt |
| A paper bill with no pay code, one notice | signed on page 2 | signed on page 1, 11 pt |

Both ways take two pages for all five. The difference is where the letter ends.

## The owner's calls

1. Build it this way, or leave the letter as it is.
2. The changed phrase. It is hers and counsel's to word.
3. The signature without the phone and the email.

## The build, if she says yes

One PR, no migration, no edge function:

- `src/lib/jobsDocuments/demandLetter.ts`: the model puts the letter first and the account after a page break, the
  amount box takes one pay code, the fit counts the letter's pages. The prototype did this in about 120 lines.
- The same order in the letter's HTML (`buildDemandLetterEmailHtml`), which draws the preview, the email body and the
  page a recorded letter reopens on, and in its plain text. The prototype did not touch these.
- A letter recorded before the change must reopen as it was sent: the stored snapshot needs a mark for the layout it
  was drawn in, read the way `form: 'short'` is on the lien affidavit.
- The sample in Settings moves to the shape the Lien window builds, so the group shows what a customer gets.
- Not checked by the prototype: the notary block, the theft-of-services line, a letter with five or more pay codes,
  and a real code scanned from paper.

## Where it stands

Built as v2.7086 on her word *Yes, build it* (2026-11-12), the way the mock-up shows: the three calls were taken as
drawn. The PDF, the page, the email and the plain text follow one order, a letter recorded before draws as it was
sent, and the sample in Settings is the letter the Lien window builds. `docs/recent-features/v2.7086.md` has the
measurements and what was not checked. Left: her look, and counsel's eye on the changed phrase.

Live 2026-11-13 07:05Z. Walked on clicktooling.com with every write refused: the sample's *Open the PDF* press makes
two pages, the letter signed on page 1 with the pay code drawn in the amount box as a picture (v2.7090), and the
statement of account, the notice history and the enclosures on page 2. The code was not read back by a scanner.

**The owner's look, 2026-11-24.** He saw the letter as *What customers see* draws it and had one comment: *the "pay online" words on this particular final demand letter could be removed, reducing the total height.* v2.8549 takes the small *Pay online* label out of the amount box, on the page, in the email and in the PDF. The code, *Scan to pay* and the address stay. The box is a line shorter where the words sit under the code. In the PDF the code sets the box's height, so it is as tall as it was, and the letter is still signed on page 1. Two things on this card are still not answered: counsel's eye on the changed phrase, and the statement table on a narrow page, under the next heading.

## The shorter box, seen live (2026-11-25)

Read on clicktooling.com as the dev, in Settings → **What customers see** → **Lien letters** → *Final demand letter* → *show large*, at 390 px, once on the build before v2.8549 and once on the build that holds it. The sample's own HTML was measured. Nothing was saved.

| At 390 px | Before | After |
|---|---|---|
| The amount box | 342 by 160 px | 342 by 141 px, 19 px shorter |
| The words under the code | three lines: *Pay online*, *Scan to pay*, *or go to* the pay address | two lines: *Scan to pay*, *or go to* the pay address |
| *Pay online* in the letter | once | not at all |
| The whole letter | 2,023 px | 2,005 px |

- **Holds.** The code, *Scan to pay* and the pay address are still in the box. The changed phrase, *for the work on the statement of account behind this letter*, is still in the letter. The letter does not scroll sideways.
- **Not read: the PDF.** **Open the PDF** was not pressed, since the walk's browser turns it into a file save. The PDF's side stands on the build's own test, two pages with the letter signed on page 1, or on the owner's press.

## Seen on the live walk, for later

Not changed: a note, by the owner's rule of 2026-11-13 that a session on Opus 5.5 writes what should change on a card.

- **The statement table on a narrow page.** In the Settings preview, which is 390 px wide, the *For* column is 73 px
  and a line's words stand one per line, so the row is about 200 px tall. A debtor reading the letter's email on a
  phone sees the same. The table (`statementHtml`) is older than this card. The Settings sample shows it since v2.7086
  because the sample now carries a statement. A fix would give a line's words their own row under the invoice row on a
  narrow page, or let *Sent* and *Due* wrap. It is the look of a paper a customer gets, so it waits for the owner.
