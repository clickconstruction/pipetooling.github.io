---
name: "Help sheets printed with every lien paper"
number: 314
group: gated
status: asked 2026-11-11 after the office's first signed batch of lien affidavits came back with mistakes · the batch read against the record the same day · three mock-ups drawn and checked as real prints, with made-up names
summary: >
  The office signed and notarized its first batch of short-form lien affidavits on 2026-11-11.
  Read against the record, none could be filed as it stood: the county blank at the top was
  filled with the property's county on every sheet, no notary seal showed, and several papers
  should have been stopped before they were printed. The owner asked for help sheets that print
  with every paper. Three shapes are drawn: a cover sheet for each paper, one sheet for the whole
  batch, and a marked guide copy of the paper itself.
next: The owner picks a shape, or a mix. The pick here is B for the batch press and A for a single paper printed from the Lien window, with the top blank's label fixed on the form either way.
size: M as a train of three (S the form's label · M the sheet on the batch print and the Lien window · S the same sheet for the two notices)
blocker: The owner's pick of a mock-up. The three holds listed under *What a sheet cannot fix* are separate work and are his to order.
opinion: your call — pick A, B or C; the pick is B for a batch and A for one paper, and the form's top blank gets a label whichever wins
---

# Help sheets printed with every lien paper (#314)

## The ask

The owner, 2026-11-11, with the scan of the office's first signed affidavits: *this was their
first attempt to fill things out, I see a lot of mistakes … what I am thinking is we need to
design and start printing help sheets with all of the papers.*

## What the first batch got wrong

Eleven short-form affidavits (`buildShortLienAffidavitBlocks`), signed and notarized in one
sitting. Read against the Lien desk's record through the dev seat the same day. No name or
address from that batch is written here.

| What | How many | Who could have caught it |
|---|---|---|
| The county blank above *BEFORE ME* holds the property's county. The form means the county where the paper is signed; the notary's block below was right | all 11 | the person signing, told which county goes where |
| No notary seal shows on the scan | all 11 | the notary, with a checklist |
| A paper sworn on a property the county's page shows with a homestead exemption | 1 | the app, once someone answers the homestead question (punch list #305, item 3) |
| The owner line prints an attention line where the owner is a city | 1 | the app: the record names a city as owner |
| Months sworn on a house where the first notice was mailed after those months' dates, and the record shows that notice went to the owner alone | 5 papers on 2 properties | the app: it holds the months and the sends |
| Several separate affidavits on one property | 5 on one, 3 on another | counsel's question 5 on #305 |
| One property's address printed three ways across three papers | 3 | the job's own address field |

A signed and sealed paper cannot be corrected by hand, so each one that goes forward is printed,
signed and notarized again. That is why the sheet has to work before the notary, not after.

## What a sheet has to say

1. **The blanks, and nothing else.** Six of them on the affidavit: the county at the top, the
   signature, the county in the notary's block, the day, the notary's signature and printed name,
   the seal. The top county is where the paper is signed.
2. **When to stop.** A homestead, a public owner, an owner line that is an office or a title, a
   month with no notice mailed on time or no copy to the contractor, more than one paper on a
   property, anything printed wrong. One sentence each, and the rule that a signed paper is
   printed again, never fixed.
3. **What happens after.** Which county clerk, the recording number, the two presses in the app
   (**Record filing…**, **Record service ›**), the copies to the owner and the original contractor.

Every sentence follows the plain-words rules (`src/lib/plainWords.ts`) and names a press by its
exact words.

## The three mock-ups

Each was printed with headless Chrome and read back as a PDF: every help page fits one letter
sheet.

- **A, a cover sheet for each paper** (`a-cover-sheet-per-paper.html`). One page in front of every
  affidavit with that job's facts: the job, the property, the claim, the file-by day, the clerk,
  and the two addresses the copies go to. It has room for the recording number. It costs a sheet
  per paper.
- **B, one sheet for the whole batch** (`b-one-sheet-per-batch.html`). The blanks and the stop
  list once, then a row for each paper with the clerk, who gets a copy, and five boxes to tick:
  signed, sealed, filed, in the app, copies mailed. A paper the app would stop is listed with its
  reason and is not printed behind the sheet.
- **C, a guide copy of the paper itself** (`c-guide-copy-of-the-paper.html`). The paper prints
  twice: first with the blanks filled in as they should read and numbered marks beside them, then
  clean. It teaches best, since the answer sits where the pen goes. Its risk is that someone signs
  or files the guide copy, so it carries a band at the top and the foot.

### The same sheet for the other two papers

- **§ 53.056 notice.** No notary and no blanks. The steps are: sign, put the invoice behind it,
  mail one copy to the owner and one to the original contractor by certified mail, type both
  tracking numbers in the app. The date on the sheet is the mail-by day.
- **§ 53.057 retainage notice.** The same, with the day our contract ended in the facts and
  counsel's cover letter named as page 1 of the owner's copy.

## The pick

**B for a batch, A for one paper.** The first run was one person signing a stack, and B is the
only shape that follows a paper past the notary to the clerk, the app and the mail. A is the same
blocks for a single paper printed from the Lien window. C is the best teacher and could be the
training handout, but as a daily sheet it puts a second copy of a sworn paper in the stack.

## What a sheet cannot fix

Three of the seven mistakes are the sheet's. The rest were on the paper before it printed, and a
sheet only helps if someone reads it. Each of these is its own piece of work:

1. **Label the top blank on the form.** *COUNTY OF ____ (where signed)*, or drop the top venue and
   keep the notary's. One line in `buildShortLienAffidavitBlocks`. Small, and worth doing whichever
   mock-up wins. The wording of a sworn paper is counsel's to confirm.
2. **A hold for a public owner on the affidavit.** The notice's gates already read *public
   property* (`lienDeskGates.ts`); the affidavit's do not.
3. **A hold when a sworn month has no timely notice, or no copy to the original contractor.** The
   desk holds the months and the sends (`lienAffidavitNotices.ts`). What counts as timely is the
   app's reading and wants counsel's word first.

The homestead case is already built as punch list #305, item 3.

## Decisions that are the owner's

- **Which mock-up?** The pick: B for a batch, A for one paper.
- **Does the help sheet print by itself, or only when asked?** The pick: by itself, first in the
  print, with a box on the batch bar to leave it off once the office knows the paper.
- **Label the top blank now, before counsel answers?** The pick: yes. It changes no sworn
  statement, only says which county the blank wants.
