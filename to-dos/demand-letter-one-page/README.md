---
name: Demand letter — the letter on one page, the account behind it
number: 333
group: gated
status: mock-up 2026-11-12 · waiting on the owner's three calls · a working prototype sits on a local branch, not pushed
summary: >
  A demand letter from the Lien window runs about a page and a half. It breaks after the statement of account, so the
  demand and the signature land on page 2. The suggestion puts the whole letter on page 1, signed, with the pay code in
  the amount box, and moves the statement of account, the notice history and the enclosures to page 2. All of it on one
  sheet was measured and does not fit.
next: The owner reads the mock-up and makes the three calls. Then the build, one PR.
size: S
blocker: The owner's calls. The changed phrase is hers and counsel's to word.
opinion: build — the letter reads whole on one page and nothing is cut
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

Mock-up only. Nothing in the app changed. The prototype is on a local branch (`spike/demand-letter-first`) and never
merges as it is.
